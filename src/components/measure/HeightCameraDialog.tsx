"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Settings2, AlertTriangle, CheckCircle, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  DEFAULT_MAX_DIM_CM,
  MAX_MAX_DIM_CM,
  MIN_MAX_DIM_CM,
  isValidMaxDimCm,
  loadCalibration,
  resetCalibration,
  saveCalibration,
} from "@/lib/calibration";

export interface HeightCameraResult {
  heightCm: number;
  /** null = BB tidak diisi di dialog, form induk tidak boleh menimpa BB yang sudah ada */
  weightKg: number | null;
}

interface HeightCameraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: HeightCameraResult) => void;
  edgeUrl: string;
}

interface EstimateResponse {
  success: boolean;
  length_cm?: number;
  confidence?: number;
  plausible?: boolean;
  low_confidence?: boolean;
  annotated_image?: string;
  error?: string;
}

type Phase = "live" | "processing" | "result";

const REQUEST_TIMEOUT_MS = 30_000;

function isEstimateResponse(value: unknown): value is EstimateResponse {
  return typeof value === "object" && value !== null && typeof (value as { success?: unknown }).success === "boolean";
}

export function HeightCameraDialog({ isOpen, onClose, onApply, edgeUrl }: HeightCameraDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ukur Tinggi via Kamera">
      {/* Body hanya di-mount saat dialog terbuka -> kamera otomatis mati saat ditutup */}
      {isOpen && <DialogBody onClose={onClose} onApply={onApply} edgeUrl={edgeUrl} />}
    </Modal>
  );
}

function DialogBody({
  onClose,
  onApply,
  edgeUrl,
}: Pick<HeightCameraDialogProps, "onClose" | "onApply" | "edgeUrl">) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("live");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [result, setResult] = useState<EstimateResponse | null>(null);

  const [showCalibration, setShowCalibration] = useState(false);
  const [maxDimInput, setMaxDimInput] = useState<string>(() => String(loadCalibration().maxDimCm));

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Akses kamera ditolak:", err);
      setCameraError("Gagal mengakses kamera. Periksa izin kamera (butuh HTTPS).");
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const maxDimValue = Number(maxDimInput);
  const maxDimValid = isValidMaxDimCm(maxDimValue);

  const handleMaxDimChange = (value: string) => {
    setMaxDimInput(value);
    const n = Number(value);
    if (isValidMaxDimCm(n)) saveCalibration({ maxDimCm: n });
  };

  const handleResetCalibration = () => {
    setMaxDimInput(String(resetCalibration().maxDimCm));
  };

  const captureAndMeasure = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      setError("Kamera belum siap.");
      return;
    }
    if (!maxDimValid) {
      setShowCalibration(true);
      setError(`Kalibrasi harus ${MIN_MAX_DIM_CM}-${MAX_MAX_DIM_CM} cm.`);
      return;
    }

    setError(null);
    setPhase("processing");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("Gagal mengambil gambar dari kamera.");
      setPhase("live");
      return;
    }

    const form = new FormData();
    form.append("photo", blob, "capture.jpg");
    form.append("max_dim_cm", String(maxDimValue));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${edgeUrl}/api/v1/estimate-length`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const body: unknown = await res.json().catch(() => null);
      if (!isEstimateResponse(body)) {
        throw new Error(`Respons edge tidak valid (HTTP ${res.status})`);
      }
      if (!body.success || typeof body.length_cm !== "number") {
        throw new Error(body.error ?? `Estimasi gagal (HTTP ${res.status})`);
      }
      setResult(body);
      setHeightInput(body.length_cm.toFixed(1));
      stopCamera();
      setPhase("result");
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "AbortError"
          ? "Edge tidak merespons (timeout)."
          : err instanceof Error
            ? err.message
            : "Gagal menghubungi edge.";
      setError(msg);
      setPhase("live");
    } finally {
      clearTimeout(timer);
    }
  };

  const retake = () => {
    setResult(null);
    setHeightInput("");
    setError(null);
    setPhase("live");
    void startCamera();
  };

  const heightValue = Number(heightInput);
  const heightValid = Number.isFinite(heightValue) && heightValue > 0;
  const weightValue = weightInput.trim() === "" ? null : Number(weightInput);
  const weightValid = weightValue === null || (Number.isFinite(weightValue) && weightValue > 0);
  const needsReview = result !== null && (result.low_confidence === true || result.plausible === false);

  const handleApply = () => {
    if (!heightValid || !weightValid) return;
    onApply({ heightCm: heightValue, weightKg: weightValue });
    onClose();
  };

  return (
    <div className="space-y-5">
      {/* BB manual (opsional) */}
      <div>
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Berat Badan (kg) <span className="font-normal normal-case text-slate-400">- opsional, isi manual</span>
        </label>
        <Input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="0.00"
          value={weightInput}
          onChange={(e) => setWeightInput(e.target.value)}
          className="mt-1.5 h-12 text-lg font-bold tabular-nums"
        />
        {!weightValid && <p className="text-xs text-rose-600 mt-1">BB harus berupa angka positif.</p>}
      </div>

      {/* Kamera / hasil */}
      <div className="rounded-2xl overflow-hidden bg-slate-900 relative aspect-video">
        {/* Selalu ter-mount (hanya disembunyikan) supaya stream bisa dipasang ulang saat Foto Ulang */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${phase === "result" ? "hidden" : ""}`}
        />
        {phase === "result" && result?.annotated_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.annotated_image} alt="Hasil deteksi pose" className="w-full h-full object-contain" />
        )}
        {phase === "processing" && (
          <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center gap-2 text-white">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p className="text-xs font-semibold">Menganalisis pose...</p>
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-rose-200">
            {cameraError}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <div className="flex gap-2 items-start rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {phase === "live" && (
        <p className="text-xs text-slate-500">
          Bayi berbaring lurus, seluruh badan (kepala sampai tumit) masuk frame, kamera tegak lurus dari atas.
        </p>
      )}

      {/* Hasil TB */}
      {phase === "result" && result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Tinggi Badan (cm) <span className="font-normal normal-case text-slate-400">- bisa dikoreksi</span>
            </label>
            <Badge variant={needsReview ? "danger" : "success"} className="text-[10px]">
              Keyakinan {Math.round((result.confidence ?? 0) * 100)}%
            </Badge>
          </div>
          <Input
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            className="h-12 text-lg font-bold tabular-nums"
          />
          {needsReview ? (
            <div className="flex gap-2 items-start rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {result.plausible === false
                  ? "Hasil di luar rentang wajar bayi/balita (20-130 cm). "
                  : "Keyakinan deteksi rendah. "}
                Periksa gambar, cek kalibrasi, atau ukur manual dengan infantometer.
              </span>
            </div>
          ) : (
            <div className="flex gap-2 items-center text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              <span>Estimasi kamera. Tetap verifikasi bila hasil dipakai untuk keputusan klinis.</span>
            </div>
          )}
        </div>
      )}

      {/* Kalibrasi */}
      <div className="border border-slate-200 rounded-xl">
        <button
          type="button"
          onClick={() => setShowCalibration((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-slate-700"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Kalibrasi kamera
          </span>
          <span className="text-slate-400 font-normal">
            {maxDimValid ? `${maxDimValue} cm` : "tidak valid"}
          </span>
        </button>
        {showCalibration && (
          <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3">
            <label className="text-xs text-slate-600">
              Panjang <b>sisi terpanjang frame</b> pada bidang matras (cm)
            </label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.5"
                min={MIN_MAX_DIM_CM}
                max={MAX_MAX_DIM_CM}
                inputMode="decimal"
                value={maxDimInput}
                onChange={(e) => handleMaxDimChange(e.target.value)}
                className="h-10"
              />
              <Button type="button" variant="outline" size="sm" className="h-10" onClick={handleResetCalibration}>
                <RotateCcw className="w-3.5 h-3.5" /> Default
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Cara mengukur: letakkan penggaris/meteran di matras, lihat berapa cm yang terlihat sepanjang sisi
              terpanjang gambar kamera. Default {DEFAULT_MAX_DIM_CM} cm hanyalah tebakan. Nilai disimpan di
              browser ini (localStorage) dan harus diulang bila kamera dipindah atau di-zoom.
            </p>
            {!maxDimValid && (
              <p className="text-[11px] text-rose-600">
                Harus {MIN_MAX_DIM_CM}-{MAX_MAX_DIM_CM} cm.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Aksi */}
      <div className="flex gap-2">
        {phase !== "result" ? (
          <Button
            type="button"
            className="flex-1"
            onClick={() => void captureAndMeasure()}
            isLoading={phase === "processing"}
            disabled={phase === "processing" || cameraError !== null}
          >
            <Camera className="w-4 h-4" /> Ambil &amp; Ukur
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={retake}>
              <RefreshCw className="w-4 h-4" /> Foto Ulang
            </Button>
            <Button type="button" className="flex-1" onClick={handleApply} disabled={!heightValid || !weightValid}>
              Pakai Hasil
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
