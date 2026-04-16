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

type Captured = {
  blob: Blob;
  url: string; // object URL for preview
};

export function ScanCapture({ gender }: { gender?: string | null }) {
  const router = useRouter();

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
