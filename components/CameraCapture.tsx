"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { barcodeDigits, barcodeSupported, createBarcodeDetector } from "@/lib/ocr";

type Mode = "photo" | "barcode";

interface Props {
  mock: React.ReactNode;
  photoHint: string;
  heightClass: string;
  tips?: React.ReactNode;
  showModeSwitch?: boolean;
  initialMode?: Mode;
  autoUpload?: boolean;
  busy?: string | null;
  onPhoto: (file: Blob) => void;
  onBarcode: (code: string) => void;
}

/** Live camera viewfinder with photo + barcode capture, upload, and manual barcode entry fallbacks. */
export function CameraCapture({ mock, photoHint, heightClass, tips, showModeSwitch, initialMode = "photo", autoUpload, busy, onPhoto, onBarcode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const handled = useRef(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [live, setLive] = useState(false);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");

  // Start the rear camera. If it is unavailable, the shutter falls back to the phone's camera app.
  useEffect(() => {
    let cancelled = false;
    const start = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      : Promise.reject(new Error("no camera API"));
    start
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorch({ supported: Boolean(caps.torch), on: false });
        setLive(true);
      })
      .catch(() => !cancelled && setMessage("Camera is off. Tap Take photo or Upload instead."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Opened from an "Upload photo" button: go straight to the file picker.
  useEffect(() => {
    if (autoUpload) uploadInput.current?.click();
  }, [autoUpload]);

  const emitBarcode = useCallback(
    (raw: string) => {
      if (handled.current) return;
      handled.current = true;
      onBarcode(barcodeDigits(raw));
    },
    [onBarcode],
  );

  // Barcode mode: scan the live video a few times per second.
  useEffect(() => {
    if (mode !== "barcode" || !live) return;
    const detector = createBarcodeDetector();
    if (!detector) return; // message is shown from render below
    handled.current = false;
    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || handled.current) return;
      try {
        const found = await detector.detect(video);
        if (found[0]?.rawValue) emitBarcode(found[0].rawValue);
      } catch {
        /* keep trying */
      }
    }, 450);
    return () => window.clearInterval(timer);
  }, [mode, live, emitBarcode]);

  useEffect(() => {
    if (!busy) handled.current = false;
  }, [busy]);

  const switchMode = (m: Mode) => {
    setMessage(null);
    setMode(m);
    if (m === "barcode" && !live) setTimeout(() => codeInput.current?.focus(), 50);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      setMessage("The flash could not be turned on.");
    }
  };

  const capture = () => {
    if (mode === "barcode") {
      if (!live) codeInput.current?.focus();
      return;
    }
    const video = videoRef.current;
    if (!live || !video || !video.videoWidth) {
      cameraInput.current?.click();
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((b) => (b ? onPhoto(b) : setMessage("Could not take the photo. Please try again.")), "image/jpeg", 0.92);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setMessage("Please choose a photo.");
    if (mode === "photo") return onPhoto(file);
    const detector = createBarcodeDetector();
    if (!detector) return setMessage("This browser cannot read barcodes from photos. Type the numbers under the barcode below.");
    try {
      const found = await detector.detect(await createImageBitmap(file));
      if (found[0]?.rawValue) emitBarcode(found[0].rawValue);
      else setMessage("No barcode found in that photo. Try again or type the numbers.");
    } catch {
      setMessage("No barcode found in that photo. Try again or type the numbers.");
    }
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = code.replace(/[^\d-]/g, "");
    if (digits.replace(/-/g, "").length < 8) return setMessage("Please type all the numbers under the barcode.");
    handled.current = false;
    emitBarcode(digits);
  };

  const hint = mode === "barcode" ? "Line up the barcode inside the frame" : photoHint;
  const status =
    message ?? (mode === "barcode" && live && !barcodeSupported() ? "This browser cannot read barcodes from the camera. Type the numbers under the barcode below." : null);

  return (
    <div>
      <div className={`relative overflow-hidden rounded-[30px] bg-teal-deep ${heightClass}`}>
        <video ref={videoRef} playsInline muted className={`absolute inset-0 size-full object-cover ${live ? "" : "hidden"}`} />
        {!live && <div className="absolute inset-0 grid place-items-center">{mock}</div>}

        {/* Corner brackets */}
        <div className={`pointer-events-none absolute ${mode === "barcode" ? "inset-x-[12%] inset-y-[30%]" : "inset-[9%]"}`} aria-hidden="true">
          {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl"].map((c) => (
            <span key={c} className={`absolute size-10 border-white ${c}`} />
          ))}
        </div>

        {torch.supported && (
          <button
            type="button"
            onClick={toggleTorch}
            aria-label={torch.on ? "Turn flash off" : "Turn flash on"}
            aria-pressed={torch.on}
            className={`glass-dark absolute right-4 top-4 grid size-12 place-items-center rounded-full ${torch.on ? "text-amber-soft" : ""}`}
          >
            <Icon name="flash" />
          </button>
        )}

        {status && (
          <p role="status" className="glass-dark absolute inset-x-4 top-4 z-10 mr-14 rounded-2xl bg-teal-deep/90 px-3 py-2 text-[0.88rem]">
            {status}
          </p>
        )}

        <p className="glass-dark absolute inset-x-6 bottom-4 mx-auto w-fit rounded-full px-4 py-2 text-center text-[0.88rem] font-bold">{hint}</p>

        {busy && (
          <div role="status" className="absolute inset-0 grid place-items-center bg-teal-deep/75 text-white">
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <span className="size-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              <span className="font-bold">{busy}</span>
            </div>
          </div>
        )}
      </div>

      {tips}

      {showModeSwitch && (
        <div role="tablist" aria-label="Scan mode" className="glass mx-auto mt-5 grid max-w-xs grid-cols-2 gap-1 rounded-full p-1">
          {(["photo", "barcode"] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`min-h-11 rounded-full font-bold ${mode === m ? "bg-teal text-white" : "text-teal"}`}
            >
              {m === "photo" ? "Photo" : "Barcode"}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 items-start justify-items-center gap-2">
        <RoundControl icon="upload" label="Upload" onClick={() => uploadInput.current?.click()} disabled={Boolean(busy)} />
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={capture}
            disabled={Boolean(busy)}
            aria-label={mode === "barcode" ? "Scan barcode" : "Take photo"}
            className="grid size-[min(5.5rem,92px)] place-items-center rounded-full border-4 border-teal bg-white disabled:opacity-50"
          >
            <span className="grid size-[min(4.25rem,72px)] place-items-center rounded-full bg-teal text-white">
              <Icon name={mode === "barcode" ? "barcode" : "camera"} size={28} />
            </span>
          </button>
          <span className="text-center text-[0.9rem] font-bold leading-tight text-teal">{mode === "barcode" ? "Scan barcode" : "Take photo"}</span>
        </div>
        <RoundControl
          icon={mode === "barcode" ? "camera" : "barcode"}
          label={mode === "barcode" ? "Photo" : "Barcode"}
          onClick={() => switchMode(mode === "barcode" ? "photo" : "barcode")}
          disabled={Boolean(busy)}
        />
      </div>

      {mode === "barcode" && (
        <form onSubmit={submitCode} className="mt-5 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="barcode-number">Numbers under the barcode</label>
          <input
            id="barcode-number"
            ref={codeInput}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Or type the numbers under the barcode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="field min-w-[min(100%,15rem)] flex-1 rounded-full"
          />
          <button type="submit" className="btn glass-teal grow px-5 sm:grow-0" disabled={Boolean(busy)}>Look up</button>
        </form>
      )}

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={uploadInput} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}

function RoundControl({ icon, label, onClick, disabled }: { icon: "upload" | "barcode" | "camera"; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-3">
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className="glass grid size-[min(4rem,68px)] place-items-center rounded-full text-teal disabled:opacity-50">
        <Icon name={icon} size={26} />
      </button>
      <span className="text-center text-[0.9rem] font-bold leading-tight text-teal">{label}</span>
    </div>
  );
}
