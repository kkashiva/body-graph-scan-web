'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import {
  AlignmentGrid,
  FrontSilhouette,
  ProfileSilhouette,
} from './silhouette';

type Pose = 'front' | 'profile';
type Step = 'front' | 'profile' | 'review';
type CaptureMode = 'camera' | 'upload';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches /api/blob/upload cap

type Captured = {
  blob: Blob;
  url: string; // object URL for preview
};

export function ScanCapture({ gender }: { gender?: string | null }) {
  const router = useRouter();

  const [mode, setMode] = useState<CaptureMode>('camera');
  const [step, setStep] = useState<Step>('front');
  const [captures, setCaptures] = useState<Record<Pose, Captured | null>>({
    front: null,
    profile: null,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleCaptured = useCallback((pose: Pose, cap: Captured) => {
    setCaptures((prev) => {
      // Revoke any previous object URL for this pose to avoid memory leaks.
      if (prev[pose]) URL.revokeObjectURL(prev[pose]!.url);
      return { ...prev, [pose]: cap };
    });
  }, []);

  // Clean up object URLs on unmount.
  useEffect(() => {
    return () => {
      Object.values(captures).forEach((c) => c && URL.revokeObjectURL(c.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!captures.front || !captures.profile) return;
    setSubmitError('');
    setSubmitting(true);

    try {
      // 1. Create scan row, snapshots height/weight.
      const createRes = await fetch('/api/scan', { method: 'POST' });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create scan');
      }
      const { id: scanId } = (await createRes.json()) as { id: string };

      // 2. Direct-to-blob upload for each pose.
      const poses: Pose[] = ['front', 'profile'];
      const urls: Record<Pose, string> = { front: '', profile: '' };

      for (const pose of poses) {
        const cap = captures[pose]!;
        const file = new File([cap.blob], `${pose}.jpg`, {
          type: cap.blob.type || 'image/jpeg',
        });
        // Canonical pathname is scans/<scanId>/<pose>.jpg — the upload route
        // validates the scan belongs to the caller and rejects any other
        // pathname.
        const result = await upload(`scans/${scanId}/${pose}.jpg`, file, {
          access: 'public',
          handleUploadUrl: '/api/blob/upload',
          contentType: file.type,
          clientPayload: JSON.stringify({ scanId, pose }),
        });
        urls[pose] = result.url;
      }

      // 3. Finalize scan — save URLs and flip status.
      const finalizeRes = await fetch(`/api/scan/${scanId}/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          frontImageUrl: urls.front,
          profileImageUrl: urls.profile,
        }),
      });
      if (!finalizeRes.ok) {
        const body = await finalizeRes.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to finalize scan');
      }

      router.push(`/scan/${scanId}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: CaptureMode) {
    if (next === mode) return;
    setSubmitError('');
    setMode(next);
    if (next === 'camera') setStep('front');
  }

  return (
    <div className="space-y-6">
      <ModeToggle mode={mode} onChange={switchMode} />

      {mode === 'upload' ? (
        <UploadStep
          captures={captures}
          onCaptured={handleCaptured}
          onSubmit={submit}
          submitting={submitting}
          submitError={submitError}
        />
      ) : (
        <CameraFlow
          step={step}
          setStep={setStep}
          captures={captures}
          handleCaptured={handleCaptured}
          submit={submit}
          submitting={submitting}
          submitError={submitError}
          gender={gender}
        />
      )}
    </div>
  );
}

function CameraFlow({
  step,
  setStep,
  captures,
  handleCaptured,
  submit,
  submitting,
  submitError,
  gender,
}: {
  step: Step;
  setStep: (s: Step) => void;
  captures: Record<Pose, Captured | null>;
  handleCaptured: (pose: Pose, cap: Captured) => void;
  submit: () => Promise<void>;
  submitting: boolean;
  submitError: string;
  gender?: string | null;
}) {
  return (
    <div className="space-y-6">
      <Stepper step={step} captures={captures} />

      {step === 'front' && (
        <CameraStep
          pose="front"
          overlay={
            <>
              <AlignmentGrid />
              <FrontSilhouette gender={gender} />
            </>
          }
          headline="Step 1 · Front pose"
          instructions="Face the camera. Arms slightly out, feet shoulder-width. Align your body inside the silhouette overlay."
          existing={captures.front}
          onCaptured={(cap) => handleCaptured('front', cap)}
          onNext={() => setStep('profile')}
        />
      )}

      {step === 'profile' && (
        <CameraStep
          pose="profile"
          overlay={
            <>
              <AlignmentGrid />
              <ProfileSilhouette gender={gender} />
            </>
          }
          headline="Step 2 · Profile pose"
          instructions="Turn 90° to the side, arms relaxed at your sides. Align your body inside the silhouette overlay."
          existing={captures.profile}
          onCaptured={(cap) => handleCaptured('profile', cap)}
          onBack={() => setStep('front')}
          onNext={() => setStep('review')}
        />
      )}

      {step === 'review' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Step 3 · Review
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirm both photos look clear and well-aligned before submitting.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-6">
            {(['front', 'profile'] as Pose[]).map((pose) => (
              <div key={pose} className="space-y-3">
                <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
                  {captures[pose] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={captures[pose]!.url}
                      alt={`${pose} capture`}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold capitalize text-foreground">
                    {pose}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(pose)}
                    className="cursor-pointer text-xs font-medium text-primary underline hover:text-primary/80"
                  >
                    Retake
                  </button>
                </div>
              </div>
            ))}
          </div>

          {submitError && (
            <div className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
              {submitError}
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => setStep('profile')}
              disabled={submitting}
              className="flex-1 cursor-pointer rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent disabled:opacity-50 sm:flex-none"
            >
              Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 cursor-pointer rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:flex-none"
            >
              {submitting ? 'Uploading…' : 'Submit for analysis'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModeToggle — switches between live camera capture and file upload.
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  onChange,
}: {
  mode: CaptureMode;
  onChange: (m: CaptureMode) => void;
}) {
  const options: { value: CaptureMode; label: string; sub: string }[] = [
    { value: 'camera', label: 'Live camera', sub: 'Capture with your device camera' },
    { value: 'upload', label: 'Upload files', sub: 'Pick existing photos from disk' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Capture mode"
      className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2"
    >
      {options.map((opt) => {
        const active = opt.value === mode;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`cursor-pointer rounded-xl px-4 py-3 text-left transition-all ${
              active
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <div className="text-sm font-bold">{opt.label}</div>
            <div
              className={`mt-0.5 text-xs ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
            >
              {opt.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadStep — single-screen file-picker form for both poses. Reuses the same
// Captured state and submit() as the camera flow.
// ---------------------------------------------------------------------------

function UploadStep({
  captures,
  onCaptured,
  onSubmit,
  submitting,
  submitError,
}: {
  captures: Record<Pose, Captured | null>;
  onCaptured: (pose: Pose, cap: Captured) => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  submitError: string;
}) {
  const [localError, setLocalError] = useState('');

  function handleFile(pose: Pose, file: File | null) {
    setLocalError('');
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(
        `${pose} image is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is 10 MB`,
      );
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setLocalError(`${pose} image must be JPEG, PNG, or WebP`);
      return;
    }
    onCaptured(pose, { blob: file, url: URL.createObjectURL(file) });
  }

  const bothReady = !!captures.front && !!captures.profile;
  const error = localError || submitError;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xl font-bold tracking-tight text-foreground">
        Upload photos
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick a front-pose and profile-pose photo from your device. JPEG, PNG, or
        WebP up to 10 MB each.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {(['front', 'profile'] as Pose[]).map((pose) => (
          <UploadSlot
            key={pose}
            pose={pose}
            captured={captures[pose]}
            onFile={(f) => handleFile(pose, f)}
          />
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!bothReady || submitting}
          className="flex-1 cursor-pointer rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:flex-none"
        >
          {submitting
            ? 'Uploading…'
            : bothReady
              ? 'Submit for analysis'
              : 'Select both photos to continue'}
        </button>
      </div>
    </div>
  );
}

function UploadSlot({
  pose,
  captured,
  onFile,
}: {
  pose: Pose;
  captured: Captured | null;
  onFile: (f: File | null) => void;
}) {
  const inputId = `upload-${pose}`;
  const labels: Record<Pose, { title: string; hint: string }> = {
    front: { title: 'Front pose', hint: 'Facing camera, arms slightly out' },
    profile: { title: 'Profile pose', hint: '90° side view, arms relaxed' },
  };
  const meta = labels[pose];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{meta.title}</p>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
        </div>
        {captured && (
          <label
            htmlFor={inputId}
            className="cursor-pointer text-xs font-medium text-primary underline hover:text-primary/80"
          >
            Replace
          </label>
        )}
      </div>

      <label
        htmlFor={inputId}
        className={`group relative flex aspect-[9/16] w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-card transition-colors ${
          captured
            ? 'border-border'
            : 'border-border hover:border-primary/50 hover:bg-accent/40'
        }`}
      >
        {captured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={captured.url}
            alt={`${pose} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
            <svg
              className="h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5V21"
              />
            </svg>
            <span className="text-sm font-semibold text-foreground">
              Tap to choose a photo
            </span>
            <span className="text-xs">JPEG, PNG, or WebP · up to 10 MB</span>
          </div>
        )}
      </label>

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function Stepper({
  step,
  captures,
}: {
  step: Step;
  captures: Record<Pose, Captured | null>;
}) {
  const items = [
    { key: 'front', label: 'Front', done: !!captures.front },
    { key: 'profile', label: 'Profile', done: !!captures.profile },
    { key: 'review', label: 'Review', done: false },
  ] as const;
  return (
    <ol className="flex items-center justify-center gap-4 sm:justify-start">
      {items.map((it, i) => {
        const active = it.key === step;
        return (
          <li key={it.key} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all ${active
                  ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : it.done
                    ? 'border-green-500 bg-green-500/10 text-green-500'
                    : 'border-border bg-card text-muted-foreground'
                }`}
            >
              {i + 1}
            </span>
            <span
              className={`hidden text-sm font-semibold transition-colors sm:inline ${active ? 'text-foreground' : 'text-muted-foreground'
                }`}
            >
              {it.label}
            </span>
            {i < items.length - 1 && (
              <span className="h-px w-6 bg-border sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// CameraStep — owns the MediaStream lifecycle and capture UX.
// ---------------------------------------------------------------------------

function CameraStep({
  pose,
  overlay,
  headline,
  instructions,
  existing,
  onCaptured,
  onNext,
  onBack,
}: {
  pose: Pose;
  overlay: ReactNode;
  headline: string;
  instructions: string;
  existing: Captured | null;
  onCaptured: (cap: Captured) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    'environment',
  );
  const [cameraError, setCameraError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);

  // Start/stop the MediaStream when facing mode changes or on unmount.
  useEffect(() => {
    let cancelled = false;
    async function start() {
      setCameraError('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            aspectRatio: { ideal: 9 / 16 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Play can reject on iOS if called before user gesture; ignore.
          videoRef.current.play().catch(() => { });
        }
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? `Camera unavailable: ${err.message}`
            : 'Camera unavailable',
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If the user selected the front ('user') camera, most browsers apply a
    // CSS mirror in the preview but the underlying frame is NOT mirrored.
    // Our analysis needs anatomically-accurate images, so we write the frame
    // un-mirrored regardless of preview.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCaptured({ blob, url: URL.createObjectURL(blob) });
      },
      'image/jpeg',
      0.9,
    );
  }

  function startCountdown() {
    if (countdown !== null) return;
    let n = 3;
    setCountdown(n);
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        setCountdown(null);
        capture();
      } else {
        setCountdown(n);
        setTimeout(tick, 1000);
      }
    };
    setTimeout(tick, 1000);
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xl font-bold tracking-tight text-foreground">{headline}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{instructions}</p>

      <div className="mt-8 flex flex-col gap-8 sm:flex-row">
        <div className="relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-3xl border border-border bg-black shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
          />
          {overlay}
          {countdown !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <span className="text-8xl font-black text-white drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {countdown}
              </span>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-8 text-center backdrop-blur-sm">
              <svg className="mb-4 h-12 w-12 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-white">{cameraError}</p>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 sm:w-64">
          <div className="space-y-3">
            <button
              type="button"
              onClick={startCountdown}
              disabled={!!cameraError || countdown !== null}
              className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            >
              {countdown !== null ? `Capturing in ${countdown}…` : 'Start Timer (3s)'}
            </button>
            <button
              type="button"
              onClick={() =>
                setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))
              }
              disabled={!!cameraError}
              className="h-12 w-full cursor-pointer rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-all hover:bg-accent disabled:opacity-50"
            >
              Switch to {facingMode === 'user' ? 'Back' : 'Front'} Camera
            </button>
          </div>

          {existing && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground uppercase tracking-widest">Last capture</span>
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              </div>
              <div className="group relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-border bg-card shadow-inner transition-all hover:border-primary/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={existing.url}
                  alt={`${pose} preview`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 flex gap-3 border-t border-border pt-8">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 cursor-pointer rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-accent sm:flex-none"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!existing}
          className="flex-1 cursor-pointer rounded-xl bg-primary px-10 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 sm:flex-none"
        >
          {existing ? (onBack ? 'Continue' : 'Next Step') : 'Capture to continue'}
        </button>
      </div>
    </div>
  );
}
