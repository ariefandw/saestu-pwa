"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Posyandu } from "@/types/schema";
import { getChildrenByPosyandu } from "@/lib/services/children";
import { getParentsByPosyandu } from "@/lib/services/parents";
import { 
  Bell, MapPin, Calendar, Users, Baby, ChevronRight, AlertCircle, CheckCircle2, 
  Activity, Scale, BookOpen, Clock
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default function KaderDashboard() {
  const { userProfile, loading } = useAuth();
  const [posyandu, setPosyandu] = useState<Posyandu | null>(null);
  
  const [stats, setStats] = useState({
    totalKids: 0,
    totalParents: 0,
    measuredThisMonth: 0
  });

  const [greeting, setGreeting] = useState("Halo");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) setGreeting("Selamat Pagi");
    else if (hour >= 11 && hour < 15) setGreeting("Selamat Siang");
    else if (hour >= 15 && hour < 18) setGreeting("Selamat Sore");
    else setGreeting("Selamat Malam");
  }, []);

  useEffect(() => {
    const init = async () => {
      if (userProfile?.posyanduId) {
        try {
          const docRef = doc(db, "posyandus", userProfile.posyanduId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setPosyandu({ id: docSnap.id, ...docSnap.data() } as Posyandu);

          const [kids, parents] = await Promise.all([
            getChildrenByPosyandu(userProfile.posyanduId),
            getParentsByPosyandu(userProfile.posyanduId)
          ]);

          const currentMonth = new Date().getMonth();
          const measured = kids.filter(k => {
             if(!k.lastMeasurementDate) return false;
             const d = (k.lastMeasurementDate as any).toDate ? (k.lastMeasurementDate as any).toDate() : new Date(k.lastMeasurementDate as any);
             return d.getMonth() === currentMonth;
          }).length;

          setStats({
            totalKids: kids.length,
            totalParents: parents.length,
            measuredThisMonth: measured
          });
        } catch (e) { console.error(e); }
      }
    };
    if (!loading) init();
  }, [userProfile, loading]);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="relative w-16 h-16">
         <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
         <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-sm font-bold text-slate-500 animate-pulse">Memuat Portal Kader...</p>
    </div>
  );

  const progressPercent = stats.totalKids > 0 ? Math.round((stats.measuredThisMonth / stats.totalKids) * 100) : 0;
  const isComplete = stats.totalKids > 0 && stats.measuredThisMonth >= stats.totalKids;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 pb-28 max-w-7xl mx-auto font-sans">
      
      {/* 1. HEADER HALAMAN */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
             <Badge className="bg-blue-100 text-blue-700 border-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                Portal Petugas
             </Badge>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{greeting},</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
             Ibu {userProfile?.name?.split(' ')[0]}
          </h1>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 sm:flex-none">
             <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
             <span className="text-xs font-bold text-slate-700 truncate">{posyandu?.name || "Memuat..."}</span>
          </div>
          
          {/* Lonceng Desktop (Di Mobile disembunyikan karena dipindah ke KaderHeader.tsx) */}
          <button className="hidden md:block bg-white p-2.5 rounded-xl shadow-sm border border-slate-200 relative group shrink-0 hover:bg-slate-50 transition-colors">
             <Bell className="w-5 h-5 text-slate-600 group-hover:text-slate-900" />
             <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 border-2 border-white rounded-full animate-pulse"></span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
         
         <div className="lg:col-span-8 space-y-6">
            
            {/* HERO CARD */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-6 sm:p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Activity className="w-48 h-48" /></div>
               <div className="absolute -bottom-20 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
               
               <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start justify-between">
                  
                  <div className="space-y-4 text-center md:text-left w-full">
                     <div>
                        <p className="text-blue-200 text-sm font-bold mb-1 tracking-wide uppercase">Capaian Penimbangan Bulan Ini</p>
                        <h2 className="text-3xl sm:text-4xl font-black mb-2 leading-none">
                           {stats.measuredThisMonth} <span className="text-lg text-blue-200 font-bold">/ {stats.totalKids} Balita</span>
                        </h2>
                     </div>
                     
                     <div className="w-full bg-black/20 rounded-full h-3 mb-2 overflow-hidden border border-white/10">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isComplete ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${progressPercent}%` }}></div>
                     </div>
                     <p className="text-xs font-medium text-blue-100 mb-6">Target cakupan wilayah kerja mencapai {progressPercent}%</p>

                     <Link href="/posyandu/children/add" className="inline-flex w-full md:w-auto items-center justify-center gap-2 bg-white text-blue-700 px-6 py-3.5 rounded-xl font-black text-sm hover:bg-blue-50 transition-colors active:scale-95 shadow-md">
                        <Scale className="w-5 h-5" /> Input Hasil Pengukuran Baru
                     </Link>
                  </div>

                  <div className="shrink-0 relative flex items-center justify-center">
                     <svg className="w-32 h-32 sm:w-40 sm:h-40 transform -rotate-90">
                        <circle cx="50%" cy="50%" r="45%" className="fill-transparent stroke-black/20 stroke-[12]" />
                        <circle cx="50%" cy="50%" r="45%" className={`fill-transparent stroke-[12] transition-all duration-1000 ${isComplete ? 'stroke-emerald-400' : 'stroke-white'}`}
                           strokeDasharray="283" strokeDashoffset={283 - (283 * progressPercent) / 100} strokeLinecap="round" 
                        />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl sm:text-3xl font-black">{progressPercent}%</span>
                     </div>
                  </div>

               </div>
            </div>

            {/* ALERTS */}
            {!isComplete && stats.totalKids > 0 && (
               <div className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-sm">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                     <h4 className="font-bold text-amber-800 text-sm">Tugas Belum Selesai</h4>
                     <p className="text-xs text-amber-700/80 mt-1 leading-relaxed">
                        Segera tindak lanjuti <strong>{stats.totalKids - stats.measuredThisMonth} balita</strong> yang belum diukur bulan ini agar laporan wilayah mencapai 100%.
                     </p>
                  </div>
               </div>
            )}
            
            {isComplete && stats.totalKids > 0 && (
               <div className="p-4 sm:p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                     <h4 className="font-bold text-emerald-800 text-sm">Target Tercapai Luar Biasa!</h4>
                     <p className="text-xs text-emerald-700/80 mt-1 leading-relaxed">
                        Terima kasih Kader! Seluruh balita terdaftar telah diukur bulan ini. Laporan SI Posyandu sudah siap.
                     </p>
                  </div>
               </div>
            )}

            {/* QUICK ACTIONS */}
            <div>
               <h3 className="text-sm font-bold text-slate-800 mb-3 px-1">Manajemen Data</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link href="/posyandu/children" className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3 hover:border-blue-300 hover:shadow-md transition-all active:scale-95 group">
                     <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Baby className="w-7 h-7" />
                     </div>
                     <span className="font-black text-slate-700 text-xs uppercase tracking-wider">Data Balita</span>
                  </Link>
                  <Link href="/posyandu/parents" className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3 hover:border-orange-300 hover:shadow-md transition-all active:scale-95 group">
                     <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                        <Users className="w-7 h-7" />
                     </div>
                     <span className="font-black text-slate-700 text-xs uppercase tracking-wider">Data Ortu</span>
                  </Link>
                  <Link href="#" className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3 hover:border-emerald-300 hover:shadow-md transition-all active:scale-95 group">
                     <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <BookOpen className="w-7 h-7" />
                     </div>
                     <span className="font-black text-slate-700 text-xs uppercase tracking-wider">Edukasi KIA</span>
                  </Link>
                  <Link href="#" className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center gap-3 hover:border-indigo-300 hover:shadow-md transition-all active:scale-95 group">
                     <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Activity className="w-7 h-7" />
                     </div>
                     <span className="font-black text-slate-700 text-xs uppercase tracking-wider">Laporan</span>
                  </Link>
               </div>
            </div>

         </div>

         <div className="lg:col-span-4 space-y-6">
            
            {/* SCHEDULE CARD */}
            <Card className="p-5 rounded-3xl border-slate-200 shadow-sm bg-white">
               <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-slate-800 text-sm">Agenda Terdekat</h3>
                  <button className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-wider hover:bg-blue-100">Lihat Semua</button>
               </div>
               
               <div className="space-y-4">
                  <div className="flex gap-4 group">
                     <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-2xl text-center min-w-[3.5rem] shrink-0 group-hover:bg-rose-50 transition-colors">
                        <span className="block text-[9px] font-black text-slate-400 group-hover:text-rose-500 uppercase tracking-widest mb-0.5">Hari ini</span>
                        <span className="block text-xl font-black text-slate-800 group-hover:text-rose-700 leading-none">15</span>
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-blue-700 transition-colors">Posyandu Balita Melati</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1">
                           <Clock className="w-3.5 h-3.5" /> 08:00 - 11:00 WIB
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                           <MapPin className="w-3.5 h-3.5" /> Balai Desa {posyandu?.village}
                        </div>
                     </div>
                  </div>
                  
                  <div className="flex gap-4 group opacity-60">
                     <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-2xl text-center min-w-[3.5rem] shrink-0">
                        <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Senin</span>
                        <span className="block text-xl font-black text-slate-800 leading-none">20</span>
                     </div>
                     <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1">Rekap Laporan Puskesmas</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                           <Clock className="w-3.5 h-3.5" /> 13:00 - Selesai
                        </div>
                     </div>
                  </div>
               </div>
            </Card>

            {/* INFO PANEL */}
            <Card className="p-5 rounded-3xl border-slate-200 shadow-sm bg-slate-900 text-white relative overflow-hidden">
               <div className="absolute -right-4 -bottom-4 opacity-10"><Activity className="w-32 h-32" /></div>
               <div className="relative z-10 space-y-2">
                  <h4 className="text-[10px] font-black text-teal-400 uppercase tracking-widest flex items-center gap-2">
                     <CheckCircle2 className="w-3.5 h-3.5" /> Tips Kader
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium">
                     Pastikan seluruh data anak diukur tanpa busana berlebih agar hasil AI Deteksi <span className="text-white font-bold italic">Weight Faltering</span> lebih akurat.
                  </p>
               </div>
            </Card>

         </div>

      </div>
    </div>
  );
}