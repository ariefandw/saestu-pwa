"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Settings2, AlertTriangle, CheckCircle, RotateCcw, Cpu, Scan, Layers } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  DEFAULT_MAX_DIM_CM,
  DEFAULT_MARKER_SIZE_CM,
  MAX_MAX_DIM_CM,
  MIN_MAX_DIM_CM,
  MAX_MARKER_SIZE_CM,
  MIN_MARKER_SIZE_CM,
  ESTIMATION_METHODS,
  EstimationMethod,
  isValidMaxDimCm,
  isValidMarkerSizeCm,
  loadCalibration,
  resetCalibration,
  saveCalibration,
} from "@/lib/calibration";

export interface HeightCameraResult {
  heightCm: number;
  /** null = BB tidak diisi di dialog, form induk tidak boleh menimpa BB yang sudah ada */
  weightKg: number | null;
  methodUsed?: string;
}

interface HeightCameraDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: HeightCameraResult) => void;
  edgeUrl: string;
}

interface EstimateResponse {
  success: boolean;
  method?: string;
  method_name?: string;
  length_cm?: number;
  confidence?: number;
  ppm?: number;
  marker_id?: number;
  marker_side_px?: number;
  marker_size_cm?: number;
  plausible?: boolean;
  low_confidence?: boolean;
  annotated_image?: string;
  error?: string;
}

type Phase = "live" | "processing" | "result";

const REQUEST_TIMEOUT_MS = 35_000;

function isEstimateResponse(value: unknown): value is EstimateResponse {
  return typeof value === "object" && value !== null && typeof (value as { success?: unknown }).success === "boolean";
}

export function HeightCameraDialog({ isOpen, onClose, onApply, edgeUrl }: HeightCameraDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ukur Tinggi via Kamera">
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
  const lastCapturedBlobRef = useRef<Blob | null>(null);

  const [phase, setPhase] = useState<Phase>("live");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [result, setResult] = useState<EstimateResponse | null>(null);

  const [showCalibration, setShowCalibration] = useState(false);
  const [calib, setCalib] = useState(() => loadCalibration());
  const [maxDimInput, setMaxDimInput] = useState<string>(() => String(loadCalibration().maxDimCm));
  const [markerSizeInput, setMarkerSizeInput] = useState<string>(() => String(loadCalibration().markerSizeCm));

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
  const markerSizeValue = Number(markerSizeInput);
  const markerSizeValid = isValidMarkerSizeCm(markerSizeValue);

  const handleMethodChange = (newMethod: EstimationMethod) => {
    const updated = { ...calib, method: newMethod };
    setCalib(updated);
    saveCalibration(updated);
  };

  const handleMaxDimChange = (value: string) => {
    setMaxDimInput(value);
    const n = Number(value);
    if (isValidMaxDimCm(n)) {
      const updated = { ...calib, maxDimCm: n };
      setCalib(updated);
      saveCalibration(updated);
    }
  };

  const handleMarkerSizeChange = (value: string) => {
    setMarkerSizeInput(value);
    const n = Number(value);
    if (isValidMarkerSizeCm(n)) {
      const updated = { ...calib, markerSizeCm: n };
      setCalib(updated);
      saveCalibration(updated);
    }
  };

  const handleResetCalibration = () => {
    const def = resetCalibration();
    setCalib(def);
    setMaxDimInput(String(def.maxDimCm));
    setMarkerSizeInput(String(def.markerSizeCm));
  };

  const executeEstimate = async (blob: Blob, targetMethod: EstimationMethod) => {
    setError(null);
    setPhase("processing");

    const form = new FormData();
    form.append("photo", blob, "capture.jpg");
    form.append("method", targetMethod);
    form.append("max_dim_cm", String(maxDimValue));
    form.append("marker_size_cm", String(markerSizeValue));

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
      // Jika sebelumnya sudah ada gambar yang ditangkap, tetap di result agar kader bisa ganti metode
      if (!lastCapturedBlobRef.current) {
        setPhase("live");
      } else {
        setPhase("result");
      }
    } finally {
      clearTimeout(timer);
    }
  };

  const captureAndMeasure = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      setError("Kamera belum siap.");
      return;
    }
    if (calib.method !== "aruco_marker" && !maxDimValid) {
      setShowCalibration(true);
      setError(`Kalibrasi skala harus ${MIN_MAX_DIM_CM}-${MAX_MAX_DIM_CM} cm.`);
      return;
    }
    if (calib.method === "aruco_marker" && !markerSizeValid) {
      setShowCalibration(true);
      setError(`Ukuran marker ArUco harus ${MIN_MARKER_SIZE_CM}-${MAX_MARKER_SIZE_CM} cm.`);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      setError("Gagal mengambil gambar dari kamera.");
      return;
    }

    lastCapturedBlobRef.current = blob;
    await executeEstimate(blob, calib.method);
  };

  const retestWithMethod = async (newMethod: EstimationMethod) => {
    handleMethodChange(newMethod);
    if (lastCapturedBlobRef.current) {
      await executeEstimate(lastCapturedBlobRef.current, newMethod);
    }
  };

  const retake = () => {
    lastCapturedBlobRef.current = null;
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
    onApply({
      heightCm: heightValue,
      weightKg: weightValue,
      methodUsed: result?.method_name || calib.method,
    });
    onClose();
  };

  const currentMethodObj = ESTIMATION_METHODS.find((m) => m.id === calib.method) ?? ESTIMATION_METHODS[0];

  return (
    <div className="space-y-4">
      {/* 1. Pemilih Metode Pengukuran (Tab Pill) */}
      <div>
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
          Metode Computer Vision (Riset &amp; Komparasi)
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
          {ESTIMATION_METHODS.map((m) => {
            const isSelected = calib.method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => (phase === "result" ? void retestWithMethod(m.id) : handleMethodChange(m.id))}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-center transition-all ${
                  isSelected ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-1">
                  {m.id === "mediapipe" && <Cpu className="w-3.5 h-3.5 text-teal-600" />}
                  {m.id === "contour_caliper" && <Layers className="w-3.5 h-3.5 text-sky-600" />}
                  {m.id === "aruco_marker" && <Scan className="w-3.5 h-3.5 text-purple-600" />}
                  <span className="text-xs truncate">{m.name}</span>
                </div>
                <span className="text-[9px] text-slate-400 font-normal mt-0.5">{m.badge}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{currentMethodObj.description}</p>
      </div>

      {/* 2. BB Manual (Opsional) */}
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
          className="mt-1.5 h-11 text-base font-bold tabular-nums"
        />
        {!weightValid && <p className="text-xs text-rose-600 mt-1">BB harus berupa angka positif.</p>}
      </div>

      {/* 3. Viewport Kamera / Hasil Anotasi */}
      <div className="rounded-2xl overflow-hidden bg-slate-900 relative aspect-video shadow-inner">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${phase === "result" ? "hidden" : ""}`}
        />
        {phase === "result" && result?.annotated_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.annotated_image} alt="Hasil visualisasi pengukuran" className="w-full h-full object-contain" />
        )}
        {phase === "processing" && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-400" />
            <p className="text-xs font-bold tracking-wide">Menganalisis dengan {currentMethodObj.name}...</p>
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
        <p className="text-[11px] text-slate-500">
          {calib.method === "aruco_marker"
            ? "Letakkan marker ArUco di samping bayi (pada matras), pastikan seluruh badan bayi dan marker masuk dalam frame."
            : "Posisikan bayi berbaring lurus di matras yang kontras, kamera tepat tegak lurus dari atas."}
        </p>
      )}

      {/* 4. Hasil Estimasi TB */}
      {phase === "result" && result && (
        <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                {result.method_name || currentMethodObj.name}
              </span>
              <p className="text-xs font-bold text-slate-800 mt-1">Tinggi Badan Terukur (cm)</p>
            </div>
            <div className="text-right">
              <Badge variant={needsReview ? "danger" : "success"} className="text-[10px]">
                Confidence {Math.round((result.confidence ?? 0) * 100)}%
              </Badge>
              {result.marker_id !== undefined && (
                <p className="text-[10px] text-purple-700 font-bold mt-0.5">ArUco ID #{result.marker_id}</p>
              )}
            </div>
          </div>
          <Input
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            className="h-12 text-xl font-black tabular-nums bg-white border-slate-300"
          />
          {needsReview ? (
            <div className="flex gap-2 items-start rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {result.plausible === false
                  ? "Hasil di luar rentang wajar balita (20-130 cm). "
                  : "Tingkat keyakinan rendah. "}
                Cek kalibrasi atau coba bandingkan dengan metode lain di tab atas.
              </span>
            </div>
          ) : (
            <div className="flex gap-2 items-center text-xs text-emerald-700">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Estimasi berhasil dihitung. Nilai dapat disesuaikan manual sebelum disimpan.</span>
            </div>
          )}
        </div>
      )}

      {/* 5. Panel Kalibrasi & Metrologi */}
      <div className="border border-slate-200 rounded-xl">
        <button
          type="button"
          onClick={() => setShowCalibration((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-xl transition"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-500" />
            <span>Pengaturan Kalibrasi Skala ({calib.method === "aruco_marker" ? "Marker Fisik" : "Panjang Frame"})</span>
          </span>
          <span className="text-slate-400 font-normal">
            {calib.method === "aruco_marker"
              ? markerSizeValid ? `${markerSizeValue} cm` : "invalid"
              : maxDimValid ? `${maxDimValue} cm` : "invalid"}
          </span>
        </button>

        {showCalibration && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
            {calib.method === "aruco_marker" ? (
              <div className="space-y-2">
                <label className="text-xs text-slate-600 block">
                  Ukuran Fisik Marker ArUco di Matras (cm)
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    min={MIN_MARKER_SIZE_CM}
                    max={MAX_MARKER_SIZE_CM}
                    inputMode="decimal"
                    value={markerSizeInput}
                    onChange={(e) => handleMarkerSizeChange(e.target.value)}
                    className="h-10 text-sm font-semibold"
                  />
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={handleResetCalibration}>
                    <RotateCcw className="w-3.5 h-3.5" /> Default
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Cetak marker ArUco (misal 10x10 cm) dan tempel di matras. Sistem secara matematis menghitung
                  skala pixel-per-cm dari ukuran fisik marker ini, bebas dari perkiraan manual.
                </p>
                {!markerSizeValid && (
                  <p className="text-[11px] text-rose-600">Harus {MIN_MARKER_SIZE_CM}-{MAX_MARKER_SIZE_CM} cm.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs text-slate-600 block">
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
                    className="h-10 text-sm font-semibold"
                  />
                  <Button type="button" variant="outline" size="sm" className="h-10" onClick={handleResetCalibration}>
                    <RotateCcw className="w-3.5 h-3.5" /> Default
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Letakkan meteran di matras dan ukur berapa cm bentangan frame kamera di sisi terpanjangnya. Default{" "}
                  {DEFAULT_MAX_DIM_CM} cm disimpan di browser (localStorage) ini.
                </p>
                {!maxDimValid && (
                  <p className="text-[11px] text-rose-600">Harus {MIN_MAX_DIM_CM}-{MAX_MAX_DIM_CM} cm.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Tombol Aksi */}
      <div className="flex gap-2 pt-1">
        {phase !== "result" ? (
          <Button
            type="button"
            className="flex-1 h-12 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
            onClick={() => void captureAndMeasure()}
            isLoading={phase === "processing"}
            disabled={phase === "processing" || cameraError !== null}
          >
            <Camera className="w-4 h-4 mr-1.5" /> Ambil Foto &amp; Ukur ({currentMethodObj.badge})
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" className="h-12" onClick={retake}>
              <RefreshCw className="w-4 h-4" /> Foto Ulang
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
              onClick={handleApply}
              disabled={!heightValid || !weightValid}
            >
              Pakai Hasil
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
