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
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <fieldset>
        <legend className="text-sm font-medium text-gray-900">Gender</legend>
        <p className="text-xs text-gray-500">
          Used to pick the correct Navy formula and analysis weights.
        </p>
        <div className="mt-3 flex gap-4">
          {(['male', 'female', 'other'] as Gender[]).map((g) => (
            <label
              key={g}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize ${
                gender === g
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
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

      <div>
        <label
          htmlFor="dob"
          className="block text-sm font-medium text-gray-900"
        >
          Date of birth
        </label>
        <input
          id="dob"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="height"
            className="block text-sm font-medium text-gray-900"
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
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            required
          />
        </div>
        <div>
          <label
            htmlFor="weight"
            className="block text-sm font-medium text-gray-900"
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
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
            required
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !gender}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-green-700">Saved.</span>
        )}
      </div>
    </form>
  );
}
