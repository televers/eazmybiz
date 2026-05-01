"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { removeVisitorPhoto, uploadVisitorPhoto } from "@/lib/visitors/actions";
import { primaryButtonMd, secondarySkyButtonMd } from "@/lib/ui/primary-button";

const fieldClass =
  "rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm file:mr-3 file:rounded file:border file:border-[var(--border)] file:bg-[var(--card)] file:px-2 file:py-1 file:text-xs";

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const WEBCAM_MAX_EDGE = 1600;

function webcamAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Downscale and compress to JPEG under server max size (best effort). */
async function frameToJpegFile(video: HTMLVideoElement): Promise<File> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Camera not ready yet.");

  let cw = w;
  let ch = h;
  if (cw > WEBCAM_MAX_EDGE || ch > WEBCAM_MAX_EDGE) {
    const scale = WEBCAM_MAX_EDGE / Math.max(cw, ch);
    cw = Math.round(cw * scale);
    ch = Math.round(ch * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture image.");

  ctx.drawImage(video, 0, 0, cw, ch);

  let quality = 0.88;
  let blob: Blob | null = null;
  for (let i = 0; i < 5; i++) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    if (!blob) throw new Error("Could not capture image.");
    if (blob.size <= MAX_UPLOAD_BYTES) break;
    quality -= 0.12;
  }
  if (!blob || blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("Photo is still too large after capture — try better lighting or a lower resolution.");
  }

  return new File([blob], "visitor-webcam.jpg", { type: "image/jpeg" });
}

export function VisitorPhotoField({
  visitorId,
  photoUrl,
  canEdit,
  hint,
}: {
  visitorId: string;
  /** Short-lived signed URL or null. */
  photoUrl: string | null;
  canEdit: boolean;
  /** Extra line under the label (e.g. check-in instructions). */
  hint?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamStarting, setWebcamStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopWebcamStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const closeWebcam = useCallback(() => {
    stopWebcamStream();
    setWebcamOpen(false);
    setWebcamStarting(false);
  }, [stopWebcamStream]);

  useEffect(() => {
    return () => stopWebcamStream();
  }, [stopWebcamStream]);

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current && webcamOpen) {
        el.srcObject = streamRef.current;
        void el.play().catch(() => {
          setError("Could not start camera preview.");
        });
      }
    },
    [webcamOpen],
  );

  async function uploadPhotoFile(file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    const res = await uploadVisitorPhoto(visitorId, fd);
    if (!res.ok) setError(res.error ?? "Upload failed");
    else router.refresh();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canEdit) return;
    setError(null);
    setLoading(true);
    try {
      await uploadPhotoFile(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  async function openWebcam() {
    if (!canEdit || !webcamAvailable()) return;
    setError(null);
    setWebcamStarting(true);
    try {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
      } catch {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = stream;
      }
      setWebcamOpen(true);
    } catch {
      setError(
        "Could not use the camera. Allow access in the browser, use HTTPS (or localhost), or choose a file instead.",
      );
    } finally {
      setWebcamStarting(false);
    }
  }

  async function captureWebcam() {
    const video = videoRef.current;
    if (!video || !canEdit) return;
    setError(null);
    setLoading(true);
    try {
      const file = await frameToJpegFile(video);
      closeWebcam();
      await uploadPhotoFile(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setLoading(false);
    }
  }

  async function onRemove() {
    if (!canEdit) return;
    setError(null);
    setLoading(true);
    try {
      await removeVisitorPhoto(visitorId);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setLoading(false);
    }
  }

  const showWebcam = canEdit && webcamAvailable();

  return (
    <div className="space-y-2">
      <span className="text-sm text-[var(--muted)]">Visitor photo (optional)</span>
      {hint ? <p className="text-[11px] leading-snug text-[var(--muted)]">{hint}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="h-24 w-20 overflow-hidden rounded border border-[var(--border)] bg-[var(--card)]">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">No photo</div>
          )}
        </div>
        {canEdit ? (
          <div className="flex flex-col gap-2">
            <label className="text-sm">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className={fieldClass}
                disabled={loading || webcamStarting}
                onChange={onFile}
              />
              <span className="mt-1 block text-[11px] text-[var(--muted)]">
                On a phone, this may open the camera; on a laptop it usually opens files — use{" "}
                <strong className="font-medium text-[var(--foreground)]">Webcam</strong> below to take a picture with
                your webcam. Max 2MB · JPG, PNG, WebP
              </span>
            </label>
            {showWebcam ? (
              <div>
                <button
                  type="button"
                  disabled={loading || webcamStarting || webcamOpen}
                  onClick={() => void openWebcam()}
                  className={`${secondarySkyButtonMd} text-sm`}
                >
                  {webcamStarting ? "Starting camera…" : "Take photo with webcam"}
                </button>
              </div>
            ) : null}
            {photoUrl ? (
              <button
                type="button"
                disabled={loading}
                onClick={onRemove}
                className="text-left text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-xs text-[var(--muted)]">Working…</p> : null}

      {webcamOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Webcam capture"
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg">
            <p className="text-sm font-medium text-[var(--foreground)]">Take visitor photo</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Position the visitor in frame, then capture.</p>
            <div className="mt-3 overflow-hidden rounded-md border border-[var(--border)] bg-black">
              <video
                ref={setVideoRef}
                className="aspect-video w-full object-cover"
                playsInline
                muted
                autoPlay
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void captureWebcam()} disabled={loading} className={primaryButtonMd}>
                {loading ? "Uploading…" : "Capture & upload"}
              </button>
              <button
                type="button"
                onClick={closeWebcam}
                disabled={loading}
                className={secondarySkyButtonMd}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
