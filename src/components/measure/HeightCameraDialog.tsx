"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  RefreshCw,
  Settings2,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Cpu,
  Scan,
  Layers,
  Video,
  Upload,
} from "lucide-react";
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
    <Modal isOpen={isOpen} onClose={onClose} title="Ukur Tinggi via Kamera / Upload Gambar" maxWidth="max-w-4xl">
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("live");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);

  // Daftar perangkat kamera (misal: Webcam Logitech USB vs Kamera internal)
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [result, setResult] = useState<EstimateResponse | null>(null);

  const [showCalibration, setShowCalibration] = useState(false);
  const [calib, setCalib] = useState(() => loadCalibration());
  const [maxDimInput, setMaxDimInput] = useState<string>(() => String(loadCalibration().maxDimCm));
  const [markerSizeInput, setMarkerSizeInput] = useState<string>(() => String(loadCalibration().markerSizeCm));

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (targetDeviceId?: string) => {
    stopCamera();
    setCameraError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser tidak mendukung WebRTC Camera. Pastikan website diakses melalui HTTPS.");
      return;
    }

    try {
      let stream: MediaStream;

      if (targetDeviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } else {
        // 1. Coba ideal environment (kamera belakang smartphone) tanpa constraint kaku
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // 2. Fallback laptop / USB webcam tanpa facingMode
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
          } catch {
            // 3. Fallback absolut apa saja yang tersedia
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Deteksi list kamera yang tersedia di perangkat
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        setVideoDevices(cams);
        if (!targetDeviceId && cams.length > 0) {
          const currentTrack = stream.getVideoTracks()[0];
          const currentId = currentTrack?.getSettings()?.deviceId;
          if (currentId) setSelectedDeviceId(currentId);
        }
      } catch (e) {
        console.warn("Gagal mendata daftar kamera:", e);
      }
    } catch (err: unknown) {
      console.error("Akses kamera gagal:", err);
      const e = err as { name?: string; message?: string };
      if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
        setCameraError("Izin kamera diblokir. Klik ikon gembok di sebelah URL browser dan izinkan akses Kamera.");
      } else if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
        setCameraError("Kamera tidak ditemukan. Pastikan webcam sudah dicolok.");
      } else if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
        setCameraError("Kamera sedang dipakai aplikasi lain. Tutup aplikasi yang menggunakan kamera.");
      } else {
        setCameraError(e?.message || "Gagal mengakses kamera. Periksa izin di browser.");
      }
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    void startCamera(deviceId);
  };

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File harus berformat gambar (JPG, PNG, WebP).");
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

    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setUploadedPreviewUrl(preview);
    lastCapturedBlobRef.current = file;

    // Reset input agar bisa pilih ulang file yang sama jika diinginkan
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    await executeEstimate(file, calib.method);
  };

  const retake = () => {
    if (uploadedPreviewUrl) {
      URL.revokeObjectURL(uploadedPreviewUrl);
      setUploadedPreviewUrl(null);
    }
    lastCapturedBlobRef.current = null;
    setResult(null);
    setHeightInput("");
    setError(null);
    setPhase("live");
    void startCamera(selectedDeviceId);
  };

  useEffect(() => {
    return () => {
      if (uploadedPreviewUrl) {
        URL.revokeObjectURL(uploadedPreviewUrl);
      }
    };
  }, [uploadedPreviewUrl]);

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
      {/* Responsive Grid: Desktop berdampingan (7:5), Mobile bertumpuk */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* KOLOM KIRI: Kamera & Visualisasi Hasil (Lebar & Leluasa) */}
        <div className="md:col-span-7 space-y-3">
          {/* Pilihan Perangkat Kamera (Jika ada lebih dari 1 kamera, misal Logitech C920) */}
          {videoDevices.length > 1 && (
            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl text-xs">
              <Video className="w-4 h-4 text-slate-600 shrink-0" />
              <label className="font-bold text-slate-700 shrink-0">Sumber Kamera:</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-semibold text-slate-800 flex-1 truncate focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {videoDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId}>
                    {dev.label || `Kamera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Viewport Video / Foto Anotasi */}
          <div className="rounded-2xl overflow-hidden bg-slate-950 relative aspect-video shadow-md border border-slate-800 flex items-center justify-center">
            {phase === "result" && result?.annotated_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.annotated_image}
                alt="Visualisasi pengukuran"
                className="w-full h-full object-contain bg-black"
              />
            ) : uploadedPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={uploadedPreviewUrl}
                alt="Preview upload gambar"
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            {phase === "processing" && (
              <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white p-4 text-center z-10">
                <RefreshCw className="w-9 h-9 animate-spin text-teal-400" />
                <p className="text-sm font-bold tracking-wide">Menganalisis dengan {currentMethodObj.name}...</p>
                <p className="text-xs text-slate-400">Server edge sedang memproses gambar</p>
              </div>
            )}
            {cameraError && !uploadedPreviewUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-900 text-rose-200 gap-3 z-10">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
                <p className="text-xs font-semibold leading-relaxed max-w-sm">{cameraError}</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Upload Foto Anak
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void startCamera(selectedDeviceId)}
                    className="text-xs text-white border-white/20 hover:bg-white/10"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Coba Lagi
                  </Button>
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleFileUpload(e)}
          />

          {error && (
            <div className="flex gap-2 items-start rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {phase !== "result" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                className="flex-1 h-12 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs"
                onClick={() => void captureAndMeasure()}
                isLoading={phase === "processing" && !uploadedPreviewUrl}
                disabled={phase === "processing" || (cameraError !== null && !uploadedPreviewUrl)}
              >
                <Camera className="w-4 h-4 mr-2" /> Ambil Foto &amp; Ukur ({currentMethodObj.badge})
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 px-4 border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 rounded-xl"
                onClick={() => fileInputRef.current?.click()}
                disabled={phase === "processing"}
                isLoading={phase === "processing" && !!uploadedPreviewUrl}
              >
                <Upload className="w-4 h-4 mr-1.5 text-slate-600" /> Upload Gambar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={retake}>
                <RefreshCw className="w-4 h-4 mr-1.5" /> Foto Ulang
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-1.5" /> Ganti Foto
              </Button>
              <Button
                type="button"
                className="flex-1 h-11 font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
                onClick={handleApply}
                disabled={!heightValid || !weightValid}
              >
                Pakai Hasil
              </Button>
            </div>
          )}
        </div>

        {/* KOLOM KANAN: Kontrol Metode, BB, Hasil TB, dan Kalibrasi */}
        <div className="md:col-span-5 space-y-4">
          {/* 1. Pemilih Metode Pengukuran */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Metode Computer Vision
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
              {ESTIMATION_METHODS.map((m) => {
                const isSelected = calib.method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => (phase === "result" ? void retestWithMethod(m.id) : handleMethodChange(m.id))}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-center transition-all ${
                      isSelected
                        ? "bg-white text-slate-900 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {m.id === "mediapipe" && <Cpu className="w-3 h-3 text-teal-600" />}
                      {m.id === "contour_caliper" && <Layers className="w-3 h-3 text-sky-600" />}
                      {m.id === "aruco_marker" && <Scan className="w-3 h-3 text-purple-600" />}
                      <span className="text-[11px] truncate">{m.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-normal mt-0.5">{m.badge}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{currentMethodObj.description}</p>
          </div>

          {/* 2. Hasil TB (Jika sudah dihitung) */}
          {phase === "result" && result && (
            <div className="space-y-2.5 bg-teal-50/60 p-3.5 rounded-xl border border-teal-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 bg-white px-2 py-0.5 rounded-md border border-teal-200">
                    {result.method_name || currentMethodObj.name}
                  </span>
                  <p className="text-xs font-bold text-slate-900 mt-1">Tinggi Badan Terukur (cm)</p>
                </div>
                <div className="text-right">
                  <Badge variant={needsReview ? "danger" : "success"} className="text-[10px]">
                    Confidence {Math.round((result.confidence ?? 0) * 100)}%
                  </Badge>
                  {result.marker_id !== undefined && (
                    <p className="text-[10px] text-purple-700 font-bold mt-0.5">ArUco #{result.marker_id}</p>
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
                className="h-12 text-2xl font-black tabular-nums bg-white border-teal-300 text-teal-950"
              />
              {needsReview ? (
                <div className="flex gap-2 items-start rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {result.plausible === false
                      ? "Hasil di luar rentang wajar (20-130 cm). "
                      : "Keyakinan rendah. "}
                    Coba ganti metode di tab atas untuk evaluasi komparatif.
                  </span>
                </div>
              ) : (
                <div className="flex gap-1.5 items-center text-[11px] text-emerald-800">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Estimasi selesai. Bisa diedit manual sebelum disimpan.</span>
                </div>
              )}
            </div>
          )}

          {/* 3. Input BB Manual */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Berat Badan (kg) <span className="font-normal normal-case text-slate-400">- opsional</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="mt-1 h-11 text-base font-bold tabular-nums"
            />
            {!weightValid && <p className="text-xs text-rose-600 mt-1">BB harus angka positif.</p>}
          </div>

          {/* 4. Panel Kalibrasi Skala */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCalibration((v) => !v)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-500" />
                <span>Pengaturan Kalibrasi Skala</span>
              </span>
              <span className="text-slate-400 font-normal">
                {calib.method === "aruco_marker"
                  ? markerSizeValid ? `${markerSizeValue} cm` : "invalid"
                  : maxDimValid ? `${maxDimValue} cm` : "invalid"}
              </span>
            </button>

            {showCalibration && (
              <div className="p-3.5 space-y-2.5 border-t border-slate-100 bg-slate-50/50">
                {calib.method === "aruco_marker" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block">Ukuran Fisik Marker ArUco (cm)</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        min={MIN_MARKER_SIZE_CM}
                        max={MAX_MARKER_SIZE_CM}
                        inputMode="decimal"
                        value={markerSizeInput}
                        onChange={(e) => handleMarkerSizeChange(e.target.value)}
                        className="h-9 text-xs font-semibold bg-white"
                      />
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={handleResetCalibration}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Cetak marker ArUco (misal 10x10 cm) dan letakkan di matras dekat bayi.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 block">
                      Panjang <b>sisi terpanjang frame</b> pada matras (cm)
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
                        className="h-9 text-xs font-semibold bg-white"
                      />
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={handleResetCalibration}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Ukur bentangan frame kamera di atas matras dengan meteran. Tersimpan di localStorage browser.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
