"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Child, Measurement, Posyandu } from "@/types/schema";
import { getMasterFoods } from "@/lib/services/nutrition";
import { calculateAgeInMonths } from "@/lib/who-standards";

import { 
  Sparkles, 
  BrainCircuit, 
  Utensils, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Activity, 
  Clock,
  ChefHat,
  Info,
  Apple,
  History,
  Printer,       
  Scale,         
  Ruler,         
  CalendarDays,
  X 
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface AIRecommendation {
  statusAnalysis: string;
  recommendedFoods: { foodName: string; reason: string; portionTip: string }[];
  recipeSuggestion: { menuName: string; ingredients: string[]; instructions: string[] };
  warnings: string[];
}

export default function App() {
  const { userProfile } = useAuth();
  const [child, setChild] = useState<Child | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<Measurement | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIRecommendation | null>(null);
  const [aiError, setAiError] = useState("");
  const [isFromHistory, setIsFromHistory] = useState(false); 

  const [toast, setToast] = useState<{ title: string; message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const initData = async () => {
      if (!userProfile?.uid) return;
      try {
        const childQ = query(collection(db, "children"), where("parentId", "==", userProfile.uid), limit(1));
        const childSnap = await getDocs(childQ);
        
        if (!childSnap.empty) {
          const childData = { id: childSnap.docs[0].id, ...childSnap.docs[0].data() } as Child;
          setChild(childData);

          const measQ = query(
            collection(db, "measurements"), 
            where("childId", "==", childData.id), 
            orderBy("date", "desc"), 
            limit(1)
          );
          const measSnap = await getDocs(measQ);
          
          if (!measSnap.empty) {
            const measurementData = { id: measSnap.docs[0].id, ...measSnap.docs[0].data() } as Measurement;
            setLastMeasurement(measurementData);

            if ((measurementData as any).aiRecommendation) {
              setAiResult((measurementData as any).aiRecommendation);
              setIsFromHistory(true);
            }
          } else {
            const dob = childData.dob instanceof Date ? childData.dob : (childData.dob as any).toDate();
            const ageMonths = calculateAgeInMonths(dob);
            setLastMeasurement({
              id: "initial",
              childId: childData.id,
              posyanduId: childData.posyanduId,
              date: childData.dob,
              ageInMonths: ageMonths,
              weight: childData.initialWeight,
              height: childData.initialHeight,
              weightStatus: childData.lastWeightStatus || "unknown",
              lengthStatus: childData.lastLengthStatus || "unknown",
            } as Measurement);
          }
        }
      } catch (error) {
        console.error("Gagal inisialisasi data:", error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [userProfile]);

  const showToast = (title: string, message: string, type: "success" | "error" = "error") => {
    setToast({ title, message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleRegenerate = () => {
    setAiResult(null);
    setIsFromHistory(false);
  };

  // [ENTERPRISE LOGIC]: Memanggil PDF Vector Asli Bawaan Sistem
  const printDocument = () => {
    window.print();
    // Tampilkan notifikasi setelah jendela print tertutup
    setTimeout(() => {
        showToast("Proses Selesai", "Laporan PDF berhasil diproses oleh sistem.", "success");
    }, 1000);
  };

  const generateAIRecommendation = async () => {
    if (!child || !lastMeasurement) return;
    
    setAiLoading(true);
    setAiError("");

    try {
      const posyanduRef = doc(db, "posyandus", child.posyanduId);
      const posyanduSnap = await getDoc(posyanduRef);
      if (!posyanduSnap.exists()) throw new Error("Data wilayah tidak ditemukan.");
      const posyanduData = posyanduSnap.data() as Posyandu;

      const masterFoods = await getMasterFoods(posyanduData.puskesmasId);
      if (masterFoods.length === 0) {
        throw new Error("Puskesmas belum mengisi database gizi lokal.");
      }

      const payload = {
        childName: child.name,
        ageInMonths: lastMeasurement.ageInMonths,
        weight: lastMeasurement.weight,
        height: lastMeasurement.height,
        weightStatus: lastMeasurement.weightStatus,
        lengthStatus: lastMeasurement.lengthStatus,
        masterFoods: masterFoods
      };

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = typeof data.error === 'object' 
          ? data.error.message || JSON.stringify(data.error)
          : data.error;
        throw new Error(errorMessage || "Gagal mendapatkan analisis dari server AI.");
      }

      setAiResult(data);
      setIsFromHistory(false); 

      if (lastMeasurement.id !== "initial") {
        const measRef = doc(db, "measurements", lastMeasurement.id);
        updateDoc(measRef, {
          aiRecommendation: data
        }).catch(err => console.error("Gagal menyimpan riwayat AI:", err));
      }

    } catch (err: any) {
      console.error("AI Error:", err);
      setAiError(err.message || "Terjadi kendala saat menghubungi ahli gizi digital.");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  );

  return (
    // [UPDATE CSS]: Saat di-print, hilangkan padding bawaan layar HP (max-w-md), jadikan lebar penuh (w-full)
    <div className="p-4 sm:p-6 space-y-6 font-sans pb-28 max-w-md mx-auto relative print:p-0 print:max-w-none print:w-full print:bg-white print:text-black">
      
      {/* --- CSS SAKTI ENTERPRISE PDF MARGIN --- */}
      <style>{`
        @media print {
          /* Setup Kertas A4 dan Margin Resmi ala Laporan Medis */
          @page {
            size: A4 portrait;
            margin: 20mm; 
          }
          /* Paksa browser mencetak warna aslinya (tidak diputihkan semua) */
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: white !important;
          }
        }
      `}</style>
      {/* -------------------------------------- */}

      {/* CUSTOM TOAST NOTIFICATION (TIDAK MASUK PDF) */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-50 animate-in slide-in-from-top-10 fade-in duration-300 print:hidden">
          <div className={`p-4 rounded-2xl shadow-xl flex gap-3 border ${
            toast.type === "success" ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
          }`}>
            <div className={`mt-0.5 shrink-0 ${toast.type === "success" ? "text-emerald-500" : "text-rose-500"}`}>
              {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h4 className={`font-black text-sm ${toast.type === "success" ? "text-emerald-900" : "text-rose-900"}`}>
                {toast.title}
              </h4>
              <p className={`text-xs mt-0.5 leading-relaxed ${toast.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>
                {toast.message}
              </p>
            </div>
            <button 
              onClick={() => setToast(null)}
              className={`shrink-0 p-1 rounded-lg transition-colors ${
                toast.type === "success" ? "hover:bg-emerald-100 text-emerald-500" : "hover:bg-rose-100 text-rose-500"
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ----------------- KOP SURAT (HANYA MUNCUL DI PDF) ----------------- */}
      <div className="hidden print:block border-b-[3px] border-slate-800 pb-4 mb-8">
         <div className="flex justify-between items-end">
            <div>
               <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rekomendasi Gizi (AI)</h1>
               <p className="text-sm text-slate-600 mt-1 font-bold tracking-wide">SISTEM KESEHATAN DIGITAL SAESTU</p>
            </div>
            <div className="text-right">
               <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tanggal Cetak</p>
               <p className="text-sm font-black text-slate-900">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
         </div>
         
         <div className="grid grid-cols-4 gap-4 mt-6 bg-slate-100 p-4 rounded-xl border border-slate-200 print:break-inside-avoid">
            <div>
               <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Nama Anak</p>
               <p className="font-bold text-sm text-slate-900">{child?.name}</p>
            </div>
            <div>
               <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Usia</p>
               <p className="font-bold text-sm text-slate-900">{lastMeasurement?.ageInMonths} Bulan</p>
            </div>
            <div>
               <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Berat Badan</p>
               <p className="font-bold text-sm text-slate-900">{lastMeasurement?.weight} kg</p>
            </div>
            <div>
               <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Tinggi / Panjang</p>
               <p className="font-bold text-sm text-slate-900">{lastMeasurement?.height} cm</p>
            </div>
         </div>
      </div>
      {/* ----------------- END KOP SURAT ----------------- */}


      {/* Header Aplikasi (Sembunyikan di PDF) */}
      <div className="space-y-1 mt-2 print:hidden">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BrainCircuit className="text-indigo-600 w-7 h-7 sm:w-8 sm:h-8" /> Ahli Gizi AI
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
          Rekomendasi gizi spesifik untuk <span className="font-bold text-slate-700">{child?.name}</span>.
        </p>
      </div>

      {!aiResult && !aiLoading ? (
        <div className="space-y-4 print:hidden">
           <Card className="p-4 border border-slate-200 shadow-sm rounded-2xl bg-white flex items-center justify-between">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Data Terakhir</p>
                 <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-slate-700">
                       <CalendarDays className="w-4 h-4 text-indigo-500" />
                       <span className="text-xs font-bold">{lastMeasurement?.ageInMonths} Bln</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700">
                       <Scale className="w-4 h-4 text-emerald-500" />
                       <span className="text-xs font-bold">{lastMeasurement?.weight} kg</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700">
                       <Ruler className="w-4 h-4 text-blue-500" />
                       <span className="text-xs font-bold">{lastMeasurement?.height} cm</span>
                    </div>
                 </div>
              </div>
           </Card>

           <Card className="p-6 bg-gradient-to-br from-indigo-600 to-blue-700 border-0 shadow-xl rounded-3xl text-white relative overflow-hidden">
                <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <Sparkles className="w-8 h-8 text-amber-400 mb-4 animate-bounce" />
                <h3 className="text-xl font-black mb-2">Mulai Susun Menu</h3>
                <p className="text-indigo-100 text-xs sm:text-sm leading-relaxed mb-6 opacity-90">
                  AI akan meracik resep MPASI bergizi dari bahan lokal yang tersedia di wilayah Bunda.
                </p>
                <Button 
                   onClick={generateAIRecommendation} 
                   disabled={!child}
                   className="w-full h-14 bg-white text-indigo-700 font-black text-base rounded-2xl hover:bg-indigo-50 shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
                >
                   Analisis Sekarang
                </Button>
                {aiError && (
                   <div className="mt-4 p-3 bg-rose-500/20 rounded-xl border border-white/10 flex gap-2 items-start">
                       <AlertTriangle className="w-4 h-4 text-rose-200 shrink-0 mt-0.5" />
                       <p className="text-[11px] sm:text-xs font-bold text-rose-50 leading-tight">{aiError}</p>
                   </div>
                )}
           </Card>
        </div>
      ) : aiLoading ? (
        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 text-center space-y-5 shadow-sm my-8 print:hidden">
            <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-indigo-600 rounded-full w-full h-full flex items-center justify-center shadow-md">
                    <Sparkles className="w-8 h-8 text-white animate-pulse" />
                </div>
            </div>
            <div className="space-y-1">
                <h3 className="font-black text-lg text-slate-800 tracking-tight">AI Sedang Meracik...</h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                    Menyesuaikan kebutuhan gizi anak <br/> dengan ketersediaan pangan lokal.
                </p>
            </div>
        </div>
      ) : aiResult && (
        <div className="space-y-6">
            
            {isFromHistory && (
               <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl text-slate-600 print:hidden">
                   <History className="w-4 h-4" />
                   <p className="text-xs font-semibold">Memuat resep terakhir</p>
               </div>
            )}

            {/* KONDISI BALITA */}
            <div className="bg-emerald-50/70 border border-emerald-200 p-4 sm:p-5 rounded-2xl flex gap-3 shadow-xs print:bg-emerald-50 print:border-emerald-200 print:shadow-none print:break-inside-avoid">
                <div className="p-2 bg-emerald-100 rounded-xl h-fit text-emerald-700 shrink-0">
                    <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <h4 className="font-bold text-slate-900 text-sm">Analisis Kondisi Balita</h4>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                        {aiResult.statusAnalysis}
                    </p>
                </div>
            </div>

            {/* RESEP SPESIAL */}
            <Card className="bg-white text-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs print:border-2 print:border-slate-300 print:shadow-none print:break-inside-avoid">
                <div className="flex items-center justify-between mb-3">
                    <Badge variant="success" className="px-2.5 py-0.5 text-xs font-semibold">
                        Rekomendasi PMT Lokal
                    </Badge>
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-5 text-slate-900">
                    {aiResult.recipeSuggestion.menuName}
                </h3>
                
                <div className="space-y-5">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                            <Utensils className="w-3.5 h-3.5 text-slate-500" /> Bahan Utama
                        </p>
                        <ul className="grid grid-cols-1 gap-2">
                            {aiResult.recipeSuggestion.ingredients.map((ing, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-700 leading-relaxed">
                                    <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5 shrink-0" /> {ing}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500" /> Langkah Memasak
                        </p>
                        <ol className="space-y-2.5">
                            {aiResult.recipeSuggestion.instructions.map((step, i) => (
                                <li key={i} className="flex gap-2.5 text-xs text-slate-700 leading-relaxed">
                                    <span className="font-bold text-slate-900 shrink-0">{i + 1}.</span> {step}
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </Card>

            {/* NUTRISI PENTING */}
            <Card className="p-5 sm:p-6 rounded-2xl border-slate-200 shadow-xs bg-white print:border-slate-200 print:shadow-none print:break-inside-avoid">
                <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-4 text-xs uppercase tracking-wider">
                    <Apple className="w-4 h-4 text-emerald-600" /> Nutrisi Utama
                </h4>
                <div className="space-y-3.5">
                    {aiResult.recommendedFoods.map((food, idx) => (
                        <div key={idx} className="flex gap-3 items-start border-b border-slate-100 pb-3.5 last:border-0 last:pb-0">
                            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 mt-0.5">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-900 text-sm">{food.foodName}</p>
                                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                    {food.reason}
                                </p>
                                <Badge variant="neutral" className="mt-2 bg-slate-100 text-slate-700 border-0 text-xs font-medium">
                                    Porsi: {food.portionTip}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {aiResult.warnings.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-4 sm:p-5 rounded-2xl shadow-xs print:bg-white print:border-rose-200 print:shadow-none print:break-inside-avoid">
                    <h4 className="font-bold text-rose-900 text-xs flex items-center gap-2 mb-2 uppercase tracking-wider">
                        <AlertTriangle className="w-4 h-4 text-rose-600" /> Catatan Kesehatan
                    </h4>
                    <ul className="space-y-1.5">
                        {aiResult.warnings.map((warn, i) => (
                            <li key={i} className="text-xs text-rose-800 leading-relaxed flex gap-2 items-start">
                                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0" /> {warn}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ACTION BUTTONS (TIDAK MUNCUL SAAT DI-PRINT) */}
            <div className="flex flex-col gap-3 pt-2 print:hidden">
                <Button 
                    onClick={printDocument} 
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm tracking-tight shadow-sm flex items-center justify-center gap-2"
                >
                    <Printer className="w-4 h-4" />
                    Cetak Laporan PDF
                </Button>
                
                <Button 
                    variant="outline" 
                    onClick={handleRegenerate} 
                    className="w-full h-11 rounded-xl border-slate-200 text-slate-600 text-xs font-semibold tracking-tight hover:bg-slate-50"
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> Buat Resep Varian Lain
                </Button>
            </div>
        </div>
      )}

      {/* FOOTER APLIKASI (TIDAK MUNCUL SAAT DI-PRINT) */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex gap-2.5 mt-6 print:hidden">
         <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
         <p className="text-xs text-slate-600 font-medium leading-relaxed">
            Rekomendasi ini disusun berbasis panduan gizi dan ketersediaan pangan lokal. Selalu konsultasikan lebih lanjut dengan tenaga kesehatan di Puskesmas.
         </p>
      </div>
      
    </div>
  );
}