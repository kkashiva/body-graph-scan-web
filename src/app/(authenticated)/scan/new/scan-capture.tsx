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

export function ScanCapture() {
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
              <FrontSilhouette />
            </>
          }
          headline="Step 1 · Front pose"
          instructions="Face the camera. Arms slightly out, feet shoulder-width. Align your body inside the green silhouette."
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
              <ProfileSilhouette />
            </>
          }
          headline="Step 2 · Profile pose"
          instructions="Turn 90° to the side, arms relaxed at your sides. Align your body inside the blue silhouette."
          existing={captures.profile}
          onCaptured={(cap) => handleCaptured('profile', cap)}
          onBack={() => setStep('front')}
          onNext={() => setStep('review')}
        />
      )}

      {step === 'review' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Step 3 · Review
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Confirm both photos look clear and well-aligned before submitting.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4">
            {(['front', 'profile'] as Pose[]).map((pose) => (
              <div key={pose}>
                <div className="aspect-[9/16] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                  {captures[pose] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={captures[pose]!.url}
                      alt={`${pose} capture`}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-gray-700">
                    {pose}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep(pose)}
                    className="text-gray-600 underline hover:text-gray-900"
                  >
                    Retake
                  </button>
                </div>
              </div>
            ))}
          </div>

          {submitError && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setStep('profile')}
              disabled={submitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
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
    <ol className="flex items-center gap-2 text-xs">
      {items.map((it, i) => {
        const active = it.key === step;
        return (
          <li key={it.key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : it.done
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-300 bg-white text-gray-500'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={
                active ? 'font-semibold text-gray-900' : 'text-gray-500'
              }
            >
              {it.label}
            </span>
            {i < items.length - 1 && (
              <span className="mx-1 h-px w-8 bg-gray-300" />
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
          videoRef.current.play().catch(() => {});
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
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{headline}</h2>
      <p className="mt-1 text-sm text-gray-500">{instructions}</p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row">
        <div className="relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-lg border border-gray-200 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`h-full w-full object-cover ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            }`}
          />
          {overlay}
          {countdown !== null && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-7xl font-bold text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]">
                {countdown}
              </span>
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-red-300">
              {cameraError}
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-56">
          <button
            type="button"
            onClick={startCountdown}
            disabled={!!cameraError || countdown !== null}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {countdown !== null ? `Capturing in ${countdown}…` : 'Capture'}
          </button>
          <button
            type="button"
            onClick={() =>
              setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))
            }
            disabled={!!cameraError}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Switch camera ({facingMode === 'user' ? 'front' : 'back'})
          </button>

          {existing && (
            <div className="mt-2">
              <p className="text-xs text-gray-500">Last capture</p>
              <div className="mt-1 aspect-[9/16] w-full overflow-hidden rounded border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={existing.url}
                  alt={`${pose} preview`}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={!existing}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {existing ? 'Next' : 'Capture first'}
        </button>
      </div>
    </div>
  );
}
