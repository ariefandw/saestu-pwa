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
  ArrowLeft, Save, Calendar, Weight, Ruler, Camera, X, RefreshCw, Brain, ScanLine, AlertCircle, CheckCircle, AlertTriangle
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Toast, ToastType } from "@/components/ui/Toast";
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Akses kamera ditolak:", err);
      showToast("Gagal mengakses kamera. Periksa izin kamera.", "error");
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
                
                {/* Banner Edukasi */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                   <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                   <div>
                      <p className="text-sm font-bold text-blue-900">Petunjuk Pengukuran</p>
                      <p className="text-[11px] text-blue-700/80 font-medium leading-relaxed mt-1">Pastikan timbangan di angka 0.00 sebelum balita naik. Lepas alas kaki dan pakaian tebal balita untuk hasil deteksi AI yang akurat.</p>
                   </div>
                </div>

                <form id="measurement-form" onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* --- TANGGAL --- */}
                    <Card className="p-6 border-slate-100 shadow-sm rounded-3xl bg-white">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 text-teal-600" />
                            Tanggal Kunjungan Posyandu
                        </label>
                        <Input 
                            type="date" 
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                            className="h-14 text-base bg-slate-50 border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-teal-500/20 transition-all font-bold text-slate-800"
                        />
                    </Card>

                    {/* --- INPUT BB & TB (GRID) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* BERAT BADAN */}
                        <Card className="bg-white border-slate-100 shadow-sm rounded-3xl overflow-hidden p-0 hover:border-blue-200 transition-colors">
                            <div className="p-6 space-y-5">
                                <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600"><Weight className="w-5 h-5" /></div>
                                      <label className="text-sm font-black text-blue-700 uppercase tracking-widest">
                                          Berat (BB)
                                      </label>
                                    </div>
                                    <button type="button" onClick={() => openCamera('weight')} disabled={isProcessingImage} className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95">
                                      <ScanLine className="w-4 h-4 text-blue-400" /> <span className="text-[10px] font-black uppercase tracking-wider">Scan Angka</span>
                                    </button>
                                </div>
                                
                                <div className="relative">
                                    <Input 
                                        type="number" step="0.01" placeholder="0.00" required
                                        value={formData.weight}
                                        onChange={(e) => setFormData({...formData, weight: e.target.value})}
                                        className="pr-16 pl-6 text-3xl font-black h-20 bg-slate-50 border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                                    />
                                    <Badge variant="neutral" className="absolute right-4 top-1/2 -translate-y-1/2 font-black bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg shadow-sm">kg</Badge>
                                </div>
                            </div>
                        </Card>

                        {/* TINGGI BADAN */}
                        <Card className="bg-white border-slate-100 shadow-sm rounded-3xl overflow-hidden p-0 hover:border-pink-200 transition-colors">
                            <div className="p-6 space-y-5">
                                <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2.5 bg-pink-50 rounded-xl text-pink-600"><Ruler className="w-5 h-5" /></div>
                                      <label className="text-sm font-black text-pink-700 uppercase tracking-widest">
                                          Tinggi (TB)
                                      </label>
                                    </div>
                                    <button type="button" onClick={() => openCamera('height')} disabled={isProcessingImage} className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95">
                                      <ScanLine className="w-4 h-4 text-pink-400" /> <span className="text-[10px] font-black uppercase tracking-wider">Scan Angka</span>
                                    </button>
                                </div>

                                <div className="relative">
                                    <Input 
                                        type="number" step="0.1" placeholder="0.0" required
                                        value={formData.height}
                                        onChange={(e) => setFormData({...formData, height: e.target.value})}
                                        className="pr-16 pl-6 text-3xl font-black h-20 bg-slate-50 border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500/20"
                                    />
                                    <Badge variant="neutral" className="absolute right-4 top-1/2 -translate-y-1/2 font-black bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg shadow-sm">cm</Badge>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* --- LINGKAR KEPALA --- */}
                    <Card className="bg-white border-slate-100 shadow-sm rounded-3xl p-6">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                            <Brain className="w-4 h-4 text-purple-500" />
                            Lingkar Kepala (Opsional)
                        </label>
                        <div className="relative">
                            <Input 
                                type="number" step="0.1" placeholder="0.0"
                                value={formData.headCircumference}
                                onChange={(e) => setFormData({...formData, headCircumference: e.target.value})}
                                className="pr-16 pl-6 h-16 text-xl font-black bg-slate-50 border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 text-slate-800"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">CM</span>
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
                                "p-6 rounded-3xl border-2 transition-all shadow-sm animate-in fade-in slide-in-from-bottom-2",
                                isAlert ? "bg-rose-50/50 border-rose-200" : "bg-emerald-50/50 border-emerald-200"
                            )}>
                                <div className="flex items-center justify-between border-b border-slate-200/60 pb-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        {isAlert ? (
                                            <AlertTriangle className="w-5 h-5 text-rose-500" />
                                        ) : (
                                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        )}
                                        <p className="text-xs font-black uppercase tracking-wider text-slate-800">
                                            Analisis Z-Score Seketika (WHO / Kemenkes)
                                        </p>
                                    </div>
                                    <Badge 
                                        variant={isAlert ? "danger" : "success"}
                                        className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1"
                                    >
                                        Usia {ageInMonths} Bulan
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* TB/U - Stunting */}
                                    <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">TB/U (Stunting)</p>
                                        <p className={cn("text-xl font-black", assessment.hfa.zScore < -2 ? "text-rose-600" : "text-slate-800")}>
                                            {assessment.hfa.zScore > 0 ? `+${assessment.hfa.zScore}` : assessment.hfa.zScore} <span className="text-xs font-bold opacity-60">SD</span>
                                        </p>
                                        <p className={cn("text-[10px] font-black uppercase mt-1", assessment.hfa.zScore < -2 ? "text-rose-600" : "text-slate-600")}>
                                            {assessment.hfa.label}
                                        </p>
                                    </div>

                                    {/* BB/U - Underweight */}
                                    <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">BB/U (Berat)</p>
                                        <p className={cn("text-xl font-black", assessment.wfa.zScore < -2 ? "text-amber-600" : "text-slate-800")}>
                                            {assessment.wfa.zScore > 0 ? `+${assessment.wfa.zScore}` : assessment.wfa.zScore} <span className="text-xs font-bold opacity-60">SD</span>
                                        </p>
                                        <p className={cn("text-[10px] font-black uppercase mt-1", assessment.wfa.zScore < -2 ? "text-amber-600" : "text-slate-600")}>
                                            {assessment.wfa.label}
                                        </p>
                                    </div>

                                    {/* BB/TB - Wasting */}
                                    <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">BB/TB (Gizi/Wasting)</p>
                                        <p className={cn("text-xl font-black", assessment.wfh.zScore < -2 ? "text-rose-600" : "text-slate-800")}>
                                            {assessment.wfh.zScore > 0 ? `+${assessment.wfh.zScore}` : assessment.wfh.zScore} <span className="text-xs font-bold opacity-60">SD</span>
                                        </p>
                                        <p className={cn("text-[10px] font-black uppercase mt-1", assessment.wfh.zScore < -2 ? "text-rose-600" : "text-slate-600")}>
                                            {assessment.wfh.label}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-600">Kesimpulan Klinis:</span>
                                    <span className={cn("text-xs font-black uppercase tracking-wide", isAlert ? "text-rose-700" : "text-emerald-700")}>
                                        {assessment.summaryDiagnosis}
                                    </span>
                                </div>
                            </Card>
                        );
                    })()}

                    {/* --- DESKTOP SUBMIT BUTTON --- */}
                    <div className="hidden md:flex justify-end pt-4">
                        <Button 
                            type="submit" 
                            className="h-16 px-10 text-lg font-black shadow-xl shadow-teal-500/30 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl transition-all active:scale-95" 
                            isLoading={isSubmitting}
                        >
                            <Save className="mr-2 h-6 w-6" />
                            Simpan & Hitung Z-Score
                        </Button>
                    </div>
                </form>
            </div>
        </div>

        {/* --- STICKY ACTION BUTTON (FIXED FOR MOBILE ONLY) --- */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-xl border-t border-slate-200/50 z-30 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="max-w-2xl mx-auto">
                <Button 
                    type="submit" 
                    form="measurement-form"
                    className="w-full h-14 text-base font-black shadow-xl shadow-teal-500/30 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl transition-all active:scale-[0.97]" 
                    isLoading={isSubmitting}
                >
                    <Save className="mr-2 h-5 w-5" />
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

        <Toast 
            message={toast.message} type={toast.type} 
            isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
        />
    </div>
  );
}