'use client';

import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';

type Pose = 'front' | 'profile';

function uuid(): string {
  // crypto.randomUUID exists in modern browsers and Node 19+.
  return crypto.randomUUID();
}

export function TrainingUploader() {
  const router = useRouter();

  const [front, setFront] = useState<File | null>(null);
  const [profile, setProfile] = useState<File | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [knownBf, setKnownBf] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!front || !profile) {
      setError('Both front and profile images are required');
      return;
    }
    const knownBfNum = Number(knownBf);
    if (!Number.isFinite(knownBfNum) || knownBfNum < 3 || knownBfNum > 55) {
      setError('Known BF% must be a number between 3 and 55');
      return;
    }

    setSubmitting(true);
    try {
      const tempId = uuid();
      const urls: Record<Pose, string> = { front: '', profile: '' };

      for (const [pose, file] of [
        ['front', front],
        ['profile', profile],
      ] as [Pose, File][]) {
        const result = await upload(`training/${tempId}/${pose}.jpg`, file, {
          access: 'public',
          handleUploadUrl: '/api/admin/training/upload',
          contentType: file.type,
          clientPayload: JSON.stringify({ tempId, pose }),
        });
        urls[pose] = result.url;
      }

      const res = await fetch('/api/admin/training', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          frontImageUrl: urls.front,
          profileImageUrl: urls.profile,
          knownBfPct: knownBfNum,
          gender,
          heightCm: heightCm ? Number(heightCm) : undefined,
          weightKg: weightKg ? Number(weightKg) : undefined,
          source: source || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to register training scan');
      }

      // Reset form
      setFront(null);
      setProfile(null);
      setKnownBf('');
      setHeightCm('');
      setWeightKg('');
      setSource('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <h2 className="text-lg font-semibold text-foreground">Add a sample</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FileField label="Front image" file={front} onChange={setFront} />
        <FileField label="Profile image" file={profile} onChange={setProfile} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Gender">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as 'male' | 'female')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="male">male</option>
            <option value="female">female</option>
          </select>
        </Field>
        <Field label="Known BF % (3–55)">
          <input
            type="number"
            step="0.1"
            min="3"
            max="55"
            value={knownBf}
            onChange={(e) => setKnownBf(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Source (e.g. DEXA)">
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Height cm (optional)">
          <input
            type="number"
            step="0.1"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Weight kg (optional)">
          <input
            type="number"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Uploading…' : 'Add sample'}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function FileField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
      />
      {file && (
        <span className="mt-1 block text-xs text-muted-foreground">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
        </span>
      )}
    </Field>
  );
}
