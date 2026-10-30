"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Child } from "@/types/schema";
import { addMeasurement } from "@/lib/services/measurements";
import { calculateChildZScores } from "@/lib/who-standards";
import { differenceInMonths } from "date-fns";
import { 
  ArrowLeft, Save, Calendar, Weight, Ruler, Camera, Upload, X, RefreshCw, Brain, ScanLine, AlertCircle, CheckCircle, AlertTriangle, Wifi, Cpu
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Toast, ToastType } from "@/components/ui/Toast";
import { HeightCameraDialog, HeightCameraResult } from "@/components/measure/HeightCameraDialog";
import { cn } from "@/lib/utils";

// Komponen Utama dengan Suspense Wrapper
export default function MeasurePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-teal-600" /></div>}>
      <MeasurementForm />
    </Suspense>
  );
}

function MeasurementForm() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile } = useAuth();
  
  const [child, setChild] = useState<Child | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- SMART SCAN (VISION) STATE ---
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<"weight" | "height" | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: "", type: "success", isVisible: false,
  });

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type, isVisible: true });
  };

  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    date: today,
    weight: "",
    height: "",
    headCircumference: "",
  });

  const [isSyncingIoT, setIsSyncingIoT] = useState(false);
  const [isHeightDialogOpen, setIsHeightDialogOpen] = useState(false);
  const [heightDialogMode, setHeightDialogMode] = useState<"camera" | "upload">("camera");

  const openHeightDialog = (mode: "camera" | "upload") => {
    setHeightDialogMode(mode);
    setIsHeightDialogOpen(true);
  };
  const edgeUrl = process.env.NEXT_PUBLIC_EDGE_SCALE_URL || "https://scale.technosmart.id";

  const handleApplyCameraResult = ({ heightCm, weightKg }: HeightCameraResult) => {
    setFormData(prev => ({
      ...prev,
      height: heightCm.toFixed(1),
      // BB opsional di dialog: kosong = jangan timpa BB yang sudah terisi
      ...(weightKg !== null ? { weight: weightKg.toFixed(2) } : {}),
    }));
    showToast(
      `Hasil kamera dipakai: TB ${heightCm.toFixed(1)} cm${weightKg !== null ? `, BB ${weightKg.toFixed(2)} kg` : ""}`,
      "success"
    );
  };

  const syncWithIoTScale = async () => {
    setIsSyncingIoT(true);
    try {
      const edgeUrl = process.env.NEXT_PUBLIC_EDGE_SCALE_URL || "https://scale.technosmart.id";
      // Umur data (max_age_sec) dihitung oleh server edge, bukan jam HP kader (anti clock-skew).
      // Filter mock di client tetap dipertahankan sebagai sabuk pengaman untuk edge versi lama.
      const res = await fetch(`${edgeUrl}/api/v1/measurements?limit=10&filter=real&max_age_sec=300`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Gagal mengambil data dari Timbangan IoT");
      const list: unknown = await res.json();
      if (!Array.isArray(list) || list.length === 0) {
        showToast("Belum ada data dari timbangan IoT. Silakan timbang balita.", "info");
        return;
      }

      const isMock = (m: { device_id?: string; notes?: string }) =>
        (m.device_id ?? "").toUpperCase().startsWith("MOCK") || /simulasi|mock/i.test(m.notes ?? "");

      const candidates = (list as any[])
        .filter((m) => !isMock(m))
        .filter((m) => Number.isFinite(Date.parse(m.created_at)))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

      if (candidates.length === 0) {
        showToast("Tidak ada penimbangan baru (maks. 5 menit terakhir). Timbang balita dulu, lalu tekan lagi.", "info");
        return;
      }

      const latest = candidates[0];
      const weightKg = latest.weight_grams ? (latest.weight_grams / 1000).toFixed(2) : "";
      const lengthCm = latest.length_cm ? latest.length_cm.toFixed(1) : "";
      const weighedAt = new Date(latest.created_at).toLocaleTimeString("id-ID");

      const hasManual = formData.weight !== "" || formData.height !== "";
      const ok = window.confirm(
        `Pakai data timbangan ${latest.device_id}?\n` +
        `Berat: ${weightKg || "-"} kg\nPanjang: ${lengthCm || "-"} cm\n` +
        `Ditimbang pukul ${weighedAt}.\n` +
        (hasManual ? "\nPERINGATAN: nilai yang sudah diisi akan ditimpa." : "") +
        `\nPastikan ini data untuk ${child?.name ?? "anak ini"}.`
      );
      if (!ok) return;

      setFormData(prev => ({
        ...prev,
        ...(weightKg ? { weight: weightKg } : {}),
        ...(lengthCm && parseFloat(lengthCm) > 0 ? { height: lengthCm } : {}),
      }));

      showToast(`Data IoT diterima: ${weightKg || '-'} kg, ${lengthCm || '-'} cm (${latest.device_id})`, "success");
    } catch (err: any) {
      console.error(err);
      showToast("Koneksi ke Timbangan IoT gagal. Pastikan terhubung internet.", "error");
    } finally {
      setIsSyncingIoT(false);
    }
  };


  // Fetch data anak
  useEffect(() => {
    const fetchChild = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "children", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setChild({ id: docSnap.id, ...docSnap.data() } as Child);
        }
      } catch (err) {
        console.error(err);
        showToast("Gagal memuat data anak.", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchChild();
  }, [id]);

  // --- CAMERA LOGIC ---
  const openCamera = async (target: "weight" | "height") => {
    setScanTarget(target);
    setIsCameraOpen(true);
    
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser tidak mendukung kamera WebRTC (butuh HTTPS).");
      }
      let stream: MediaStream;
      try {
        // Coba kamera belakang (HP), gunakan ideal agar tidak gagal di laptop/webcam PC
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        // Fallback laptop / webcam USB
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Akses kamera gagal:", err);
      const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      const msg = isDenied
        ? "Izin kamera diblokir. Klik ikon gembok di URL browser untuk mengizinkan akses kamera."
        : "Gagal membuka kamera. Pastikan browser diizinkan dan kamera tidak dipakai aplikasi lain.";
      showToast(msg, "error");
      closeCamera();
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setScanTarget(null);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const autoScan = searchParams.get('autoScan');
    if (autoScan === 'true') {
      const timer = setTimeout(() => {
        openCamera('weight');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || !scanTarget) return;

    setIsProcessingImage(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Image = canvas.toDataURL("image/jpeg", 0.7);
      closeCamera();
      showToast("AI sedang menganalisis foto...", "info");

      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses gambar");

      setFormData(prev => ({
        ...prev,
        [scanTarget]: data.value.toString()
      }));

      showToast(`Berhasil! Angka terbaca: ${data.value}`, "success");
    } catch (err: any) {
      showToast(err.message || "Gagal membaca layar. Silakan input manual.", "error");
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.posyanduId || !id) {
        showToast("Error: Data sesi tidak lengkap.", "error");
        return;
    }

    setIsSubmitting(true);
    try {
      await addMeasurement({
        childId: id as string,
        posyanduId: userProfile.posyanduId,
        kaderId: userProfile.uid,
        date: formData.date,
        weight: parseFloat(formData.weight),
        height: parseFloat(formData.height),
        headCircumference: formData.headCircumference ? parseFloat(formData.headCircumference) : undefined,
      });

      showToast("Data pengukuran berhasil disimpan! ✅", "success");
      setTimeout(() => router.push(`/posyandu/children/${id}`), 1500);
      
    } catch (err: any) {
      showToast("Gagal menyimpan data pengukuran.", "error");
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-teal-100 rounded-full relative">
           <div className="absolute inset-[-4px] border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Menyiapkan Formulir</p>
      </div>
    </div>
  );

  if (!child) return <div className="p-8 text-center font-bold text-slate-500">Data anak tidak ditemukan.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative flex flex-col pb-28 md:pb-8">
        
        {/* --- HEADER --- */}
        <div className="flex items-center gap-4 bg-white/90 backdrop-blur-xl p-4 md:px-8 sticky top-0 z-20 shadow-sm border-b border-slate-200/60">
            <div className="max-w-4xl mx-auto w-full flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2.5 rounded-2xl bg-slate-50 text-slate-600 active:bg-teal-50 transition-all border border-slate-100">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">Input Pengukuran</h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="neutral" className="bg-teal-50 text-teal-700 border-0 text-[10px] font-black uppercase tracking-widest py-0.5">{child.name}</Badge>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex-1 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                

                <form id="measurement-form" onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* --- IOT SCALE INTEGRATION BANNER --- */}
                    <Card className="p-4 sm:p-5 border-teal-200/80 shadow-xs rounded-2xl bg-gradient-to-r from-teal-50/70 via-white to-emerald-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-xs">
                                <Cpu className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900">Timbangan & Kamera IoT Saestu</h4>
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">Ambil data berat (g) dan panjang badan otomatis dari hardware posyandu.</p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            onClick={syncWithIoTScale}
                            disabled={isSyncingIoT}
                            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                        >
                            <Wifi className={cn("w-4 h-4", isSyncingIoT && "animate-pulse")} />
                            <span>{isSyncingIoT ? "Sinkronisasi..." : "Tarik Data IoT"}</span>
                        </Button>
                    </Card>

                    {/* --- UKUR TB VIA KAMERA (BB manual opsional) --- */}
                    <Card className="p-4 sm:p-5 border-slate-200 shadow-xs rounded-2xl bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-xs">
                                <Camera className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900">Ukur Tinggi via Kamera / Upload Foto</h4>
                                <p className="text-xs text-slate-500">TB dideteksi dari kamera, BB diisi manual (opsional). Ada pengaturan kalibrasi.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => openHeightDialog("camera")}
                                className="flex-1 sm:flex-none"
                            >
                                <Camera className="w-4 h-4 mr-1.5" />
                                <span>Buka Kamera</span>
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => openHeightDialog("upload")}
                                className="flex-1 sm:flex-none border-slate-300 text-slate-700 hover:bg-slate-100"
                            >
                                <Upload className="w-4 h-4 mr-1.5 text-teal-600" />
                                <span>Upload Gambar</span>
                            </Button>
                        </div>
                    </Card>

                    {/* --- TANGGAL --- */}
                    <Card className="p-5 border-slate-200 shadow-xs rounded-2xl bg-white">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-2 mb-2.5">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            Tanggal Kunjungan Posyandu
                        </label>
                        <Input 
                            type="date" 
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                            className="h-12 text-sm bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-slate-900/10 transition-all font-semibold text-slate-800"
                        />
                    </Card>

                    {/* --- INPUT BB & TB (GRID) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        {/* BERAT BADAN */}
                        <Card className="bg-white border-slate-200 shadow-xs rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
                                        <Weight className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                            Berat Badan (BB)
                                        </label>
                                        <p className="text-xs text-slate-500">Timbangan terkalibrasi</p>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => openCamera('weight')} 
                                    disabled={isProcessingImage} 
                                    className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <ScanLine className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Scan OCR</span>
                                </button>
                            </div>
                            
                            <div className="relative">
                                <Input 
                                    type="number" step="0.01" placeholder="0.00" required
                                    value={formData.weight}
                                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                                    className="pr-16 pl-4 text-2xl font-bold h-16 bg-white border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-slate-900/10 tabular-nums"
                                />
                                <Badge variant="neutral" className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-xs">kg</Badge>
                            </div>
                        </Card>

                        {/* TINGGI BADAN */}
                        <Card className="bg-white border-slate-200 shadow-xs rounded-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
                                        <Ruler className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                            Tinggi Badan (TB/PB)
                                        </label>
                                        <p className="text-xs text-slate-500">Infantometer / Stadiometer</p>
                                    </div>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => openCamera('height')} 
                                    disabled={isProcessingImage} 
                                    className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <ScanLine className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Scan OCR</span>
                                </button>
                            </div>

                            <div className="relative">
                                <Input 
                                    type="number" step="0.1" placeholder="0.0" required
                                    value={formData.height}
                                    onChange={(e) => setFormData({...formData, height: e.target.value})}
                                    className="pr-16 pl-4 text-2xl font-bold h-16 bg-white border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-slate-900/10 tabular-nums"
                                />
                                <Badge variant="neutral" className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-xs">cm</Badge>
                            </div>
                        </Card>
                    </div>

                    {/* --- LINGKAR KEPALA --- */}
                    <Card className="bg-white border-slate-200 shadow-xs rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
                                <Brain className="w-4 h-4" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                    Lingkar Kepala (Opsional)
                                </label>
                                <p className="text-xs text-slate-500">Pita ukur non-elastis</p>
                            </div>
                        </div>
                        <div className="relative">
                            <Input 
                                type="number" step="0.1" placeholder="0.0"
                                value={formData.headCircumference}
                                onChange={(e) => setFormData({...formData, headCircumference: e.target.value})}
                                className="pr-16 pl-4 h-14 text-xl font-bold bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 text-slate-900 tabular-nums"
                            />
                            <Badge variant="neutral" className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md text-xs">cm</Badge>
                        </div>
                    </Card>

                    {/* --- LIVE Z-SCORE PREVIEW --- */}
                    {(() => {
                        const numWeight = parseFloat(formData.weight);
                        const numHeight = parseFloat(formData.height);
                        if (!child || isNaN(numWeight) || numWeight <= 0 || isNaN(numHeight) || numHeight <= 0) {
                            return null;
                        }

                        const childDob = (child.dob as any)?.toDate ? (child.dob as any).toDate() : new Date(child.dob as any);
                        const measDate = formData.date ? new Date(formData.date) : new Date();
                        const ageInMonths = differenceInMonths(measDate, childDob);
                        const numHead = formData.headCircumference ? parseFloat(formData.headCircumference) : undefined;

                        const assessment = calculateChildZScores({
                            gender: child.gender,
                            ageInMonths,
                            weight: numWeight,
                            height: numHeight,
                            headCircumference: numHead,
                        });

                        const isAlert = assessment.isStunted || assessment.isWasted || assessment.isUnderweight;

                        return (
                            <Card className={cn(
                                "p-5 rounded-2xl border transition-all shadow-xs",
                                isAlert ? "bg-rose-50/40 border-rose-200" : "bg-emerald-50/40 border-emerald-200"
                            )}>
                                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        {isAlert ? (
                                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                                        )}
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                            Analisis Z-Score Seketika (WHO / Kemenkes)
                                        </p>
                                    </div>
                                    <Badge 
                                        variant={isAlert ? "danger" : "success"}
                                        className="text-xs font-semibold px-2.5 py-0.5"
                                    >
                                        Usia {ageInMonths} Bulan
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* TB/U - Stunting */}
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">TB/U (Stunting)</p>
                                        <p className={cn("text-xl font-bold tabular-nums", assessment.hfa.zScore < -2 ? "text-rose-600" : "text-slate-900")}>
                                            {assessment.hfa.zScore > 0 ? `+${assessment.hfa.zScore}` : assessment.hfa.zScore} <span className="text-xs font-normal text-slate-500">SD</span>
                                        </p>
                                        <p className={cn("text-xs font-medium mt-1", assessment.hfa.zScore < -2 ? "text-rose-700" : "text-slate-600")}>
                                            {assessment.hfa.label}
                                        </p>
                                    </div>

                                    {/* BB/U - Underweight */}
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">BB/U (Berat)</p>
                                        <p className={cn("text-xl font-bold tabular-nums", assessment.wfa.zScore < -2 ? "text-amber-600" : "text-slate-900")}>
                                            {assessment.wfa.zScore > 0 ? `+${assessment.wfa.zScore}` : assessment.wfa.zScore} <span className="text-xs font-normal text-slate-500">SD</span>
                                        </p>
                                        <p className={cn("text-xs font-medium mt-1", assessment.wfa.zScore < -2 ? "text-amber-700" : "text-slate-600")}>
                                            {assessment.wfa.label}
                                        </p>
                                    </div>

                                    {/* BB/TB - Wasting */}
                                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">BB/TB (Gizi/Wasting)</p>
                                        <p className={cn("text-xl font-bold tabular-nums", assessment.wfh.zScore < -2 ? "text-rose-600" : "text-slate-900")}>
                                            {assessment.wfh.zScore > 0 ? `+${assessment.wfh.zScore}` : assessment.wfh.zScore} <span className="text-xs font-normal text-slate-500">SD</span>
                                        </p>
                                        <p className={cn("text-xs font-medium mt-1", assessment.wfh.zScore < -2 ? "text-rose-700" : "text-slate-600")}>
                                            {assessment.wfh.label}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between">
                                    <span className="text-xs text-slate-600 font-medium">Kesimpulan Klinis:</span>
                                    <span className={cn("text-xs font-bold uppercase tracking-wide", isAlert ? "text-rose-700" : "text-emerald-700")}>
                                        {assessment.summaryDiagnosis}
                                    </span>
                                </div>
                            </Card>
                        );
                    })()}

                    {/* --- DESKTOP SUBMIT BUTTON --- */}
                    <div className="hidden md:flex justify-end pt-2">
                        <Button 
                            type="submit" 
                            className="h-12 px-8 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all active:scale-95" 
                            isLoading={isSubmitting}
                        >
                            <Save className="mr-2 h-4 w-4" />
                            Simpan & Hitung Z-Score
                        </Button>
                    </div>
                </form>
            </div>
        </div>

        {/* --- STICKY ACTION BUTTON (FIXED FOR MOBILE ONLY) --- */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 pb-safe shadow-lg">
            <div className="max-w-2xl mx-auto">
                <Button 
                    type="submit" 
                    form="measurement-form"
                    className="w-full h-12 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all active:scale-[0.98]" 
                    isLoading={isSubmitting}
                >
                    <Save className="mr-2 h-4 w-4" />
                    Simpan & Analisis
                </Button>
            </div>
        </div>

        {/* --- CAMERA OVERLAY (NATIVE SCANNER STYLE) --- */}
        {isCameraOpen && (
          <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-300">
             <div className="p-6 pt-12 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent absolute top-0 w-full z-10">
                <div className="text-white">
                   <p className="text-[10px] font-black text-teal-400 uppercase tracking-[0.2em] mb-1 text-shadow-sm flex items-center gap-1.5"><Brain className="w-3 h-3" /> AI Vision Scanner</p>
                   <p className="text-xl font-black">Arahkan ke Angka {scanTarget === 'weight' ? 'Timbangan' : 'Alat Ukur Tinggi'}</p>
                </div>
                <button onClick={closeCamera} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white backdrop-blur-md transition-all active:scale-90 border border-white/20">
                   <X className="w-6 h-6" />
                </button>
             </div>

             <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="min-w-full min-h-full object-cover"
                />
                
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                   <div className="w-72 h-32 border-2 border-teal-400/80 rounded-[2rem] relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-teal-400 rounded-tl-[2rem]"></div>
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-teal-400 rounded-tr-[2rem]"></div>
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-teal-400 rounded-bl-[2rem]"></div>
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-teal-400 rounded-br-[2rem]"></div>
                      
                      {/* Animasi Garis Scanner */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-teal-400 shadow-[0_0_8px_2px_rgba(45,212,191,0.8)] animate-scan-line"></div>

                      <p className="absolute -bottom-12 w-full text-center text-white text-xs font-bold bg-slate-900/80 py-2 px-4 rounded-full shadow-lg backdrop-blur-md">
                         Posisikan angka digital di dalam kotak
                      </p>
                   </div>
                </div>
             </div>

             <div className="p-10 pb-16 bg-black flex justify-center items-center relative">
                <button 
                  onClick={captureAndScan}
                  className="w-20 h-20 rounded-full border-[6px] border-white/30 flex items-center justify-center hover:scale-110 transition-all active:scale-95"
                >
                   <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-white/50">
                     <Camera className="w-6 h-6 text-slate-900" />
                   </div>
                </button>
             </div>
             
             <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* --- AI PROCESSING OVERLAY --- */}
        {isProcessingImage && (
          <div className="fixed inset-0 z-[110] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
             <div className="relative">
                <div className="w-24 h-24 bg-teal-50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-teal-100 shadow-inner">
                    <RefreshCw className="w-10 h-10 text-teal-600 animate-spin" />
                </div>
                <div className="absolute -top-2 -right-2 bg-slate-900 text-teal-400 p-2 rounded-full animate-bounce shadow-lg">
                    <Brain className="w-5 h-5" />
                </div>
             </div>
             <h3 className="text-2xl font-black text-slate-900 tracking-tight">Menganalisis Angka</h3>
             <p className="text-slate-500 text-sm mt-2 font-bold flex items-center gap-2">
                Gemini AI Vision sedang bekerja <span className="flex gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: '0ms'}}></span><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: '150ms'}}></span><span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: '300ms'}}></span></span>
             </p>
          </div>
        )}

        <HeightCameraDialog
            isOpen={isHeightDialogOpen}
            initialMode={heightDialogMode}
            onClose={() => setIsHeightDialogOpen(false)}
            onApply={handleApplyCameraResult}
            edgeUrl={edgeUrl}
        />

        <Toast 
            message={toast.message} type={toast.type} 
            isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
        />
    </div>
  );
}