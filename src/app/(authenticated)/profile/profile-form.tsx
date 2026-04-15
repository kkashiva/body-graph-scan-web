'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Gender = 'male' | 'female' | 'other';

export function ProfileForm({
  initial,
}: {
  initial: {
    gender: string;
    dateOfBirth: string;
    heightCm: string | number;
    weightKg: string | number;
  };
}) {
  const router = useRouter();
  const [gender, setGender] = useState<Gender | ''>(
    (initial.gender as Gender | '') || '',
  );
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth || '');
  const [heightCm, setHeightCm] = useState(String(initial.heightCm || ''));
  const [weightKg, setWeightKg] = useState(String(initial.weightKg || ''));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          gender,
          dateOfBirth,
          heightCm: heightCm === '' ? null : Number(heightCm),
          weightKg: weightKg === '' ? null : Number(weightKg),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save profile');
      }

      setSavedAt(Date.now());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-8">
      <fieldset>
        <legend className="text-sm font-semibold tracking-wide text-foreground">
          Gender
        </legend>
        <p className="text-xs text-muted-foreground">
          Used to pick the correct Navy formula and analysis weights.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          {(['male', 'female', 'other'] as Gender[]).map((g) => (
            <label
              key={g}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-semibold capitalize transition-all ${
                gender === g
                  ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              <input
                type="radio"
                name="gender"
                value={g}
                checked={gender === g}
                onChange={() => setGender(g)}
                className="sr-only"
              />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor="dob"
          className="block text-sm font-semibold tracking-wide text-foreground"
        >
          Date of birth
        </label>
        <input
          id="dob"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="block w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label
            htmlFor="height"
            className="block text-sm font-semibold tracking-wide text-foreground"
          >
            Height (cm)
          </label>
          <input
            id="height"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="50"
            max="260"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="182"
            required
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="weight"
            className="block text-sm font-semibold tracking-wide text-foreground"
          >
            Weight (kg)
          </label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="400"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="block w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="68.5"
            required
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={saving || !gender}
          className="rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {savedAt && !saving && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-500">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Changes saved
          </span>
        )}
      </div>
    </form>
  );
}
