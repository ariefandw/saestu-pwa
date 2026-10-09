"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Child, Measurement } from "@/types/schema";
import { calculateChildZScores } from "@/lib/who-standards";
import { 
  Baby, 
  Scale, 
  Ruler, 
  AlertCircle,
  ChevronRight,
  Sparkles,
  CalendarDays,
  Heart,
  Clock,
  Activity,
  ArrowRight,
  BrainCircuit
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

export default function ParentDashboard() {
  const { userProfile, loading: authLoading } = useAuth();
  const [child, setChild] = useState<Child | null>(null);
  const [lastMeasurement, setLastMeasurement] = useState<Measurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Halo");

  // Efek Sapaan Pintar berdasarkan Waktu
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) setGreeting("Selamat Pagi");
    else if (hour >= 11 && hour < 15) setGreeting("Selamat Siang");
    else if (hour >= 15 && hour < 18) setGreeting("Selamat Sore");
    else setGreeting("Selamat Malam");
  }, []);

  useEffect(() => {
    const fetchMyChild = async () => {
      if (!userProfile?.uid) return;
      try {
        const childQ = query(
          collection(db, "children"), 
          where("parentId", "==", userProfile.uid),
          limit(1)
        );
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
            setLastMeasurement({ id: measSnap.docs[0].id, ...measSnap.docs[0].data() } as Measurement);
          }
        }
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetchMyChild();
  }, [userProfile, authLoading]);

  // Fungsi helper untuk memformat tanggal
  const formatDate = (dateData: any) => {
    if (!dateData) return "-";
    const date = dateData instanceof Date ? dateData : new Date(dateData.toMillis());
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return (
    <div className="h-[80vh] flex items-center justify-center">
        <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 font-sans pb-28 max-w-md mx-auto">
      
      {/* 1. SMART WELCOME SECTION */}
      <div className="flex items-center justify-between mt-2 animate-in slide-in-from-top-4 duration-500">
        <div className="space-y-0.5">
            <h2 className="text-[11px] sm:text-xs font-black text-emerald-600 uppercase tracking-widest">{greeting},</h2>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-none">
              Bunda {userProfile?.name?.split(' ')[0]}!
            </h1>
        </div>
        <div className="w-12 h-12 rounded-[1.2rem] bg-rose-50 flex items-center justify-center border border-rose-100 shadow-sm shrink-0 relative overflow-hidden group">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500 animate-pulse" />
        </div>
      </div>

      {/* 2. EMPTY STATE (ENTERPRISE ONBOARDING) */}
      {!child && (
        <Card className="p-6 border-dashed border-2 border-slate-200 bg-white rounded-[2rem] animate-in fade-in duration-700 mt-8">
           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
               <AlertCircle className="w-8 h-8 text-amber-500" />
           </div>
           <h3 className="font-black text-slate-800 text-lg mb-2">Belum Terhubung</h3>
           <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
             Data anak Bunda belum muncul di aplikasi. Silakan lakukan 2 langkah mudah ini:
           </p>
           <ul className="space-y-3">
              <li className="flex gap-3 text-sm text-slate-700 font-medium bg-slate-50 p-3 rounded-xl">
                 <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center font-bold text-emerald-600 shrink-0 shadow-sm">1</span>
                 Datang ke jadwal Posyandu terdekat.
              </li>
              <li className="flex gap-3 text-sm text-slate-700 font-medium bg-slate-50 p-3 rounded-xl">
                 <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center font-bold text-emerald-600 shrink-0 shadow-sm">2</span>
                 Beritahu Kader email Bunda: <br/> <span className="font-bold text-emerald-700 text-xs mt-1 block bg-emerald-100 px-2 py-1 rounded w-fit">{userProfile?.email}</span>
              </li>
           </ul>
        </Card>
      )}

      {/* 3. DASHBOARD CONTENT */}
      {child && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-700">
            
            {/* A. KARTU IDENTITAS ANAK (PREMIUM GLASSMORPHISM) */}
            <Card className="relative overflow-hidden bg-slate-900 border-0 p-5 sm:p-6 rounded-[2rem] shadow-xl text-white shadow-slate-200">
                {/* Abstract Backgrounds */}
                <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Baby className="w-40 h-40" />
                </div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl"></div>
                <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-blue-500/20 rounded-full blur-2xl"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <Badge className="bg-white/10 text-emerald-300 border border-white/10 px-2.5 py-1 font-black text-[9px] uppercase tracking-widest backdrop-blur-sm">
                            Profil Utama
                        </Badge>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-black/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                            <Clock className="w-3 h-3" /> {formatDate(lastMeasurement?.date)}
                        </div>
                    </div>

                    <h2 className="text-3xl font-black mb-1 tracking-tight text-white">{child.name}</h2>
                    <p className="text-slate-300 text-xs font-bold flex items-center gap-1.5 opacity-90">
                        <span className={`${child.gender === 'L' ? 'text-blue-400' : 'text-rose-400'}`}>
                            {child.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                        <span className="text-slate-500">•</span>
                        {lastMeasurement?.ageInMonths || 0} Bulan
                    </p>

                    {/* Data Box (Glassmorphism) */}
                    {(() => {
                        let zHFA = lastMeasurement?.zScoreHFA;
                        let zWFA = lastMeasurement?.zScoreWFA;
                        let zWFH = lastMeasurement?.zScoreWFH;

                        if (lastMeasurement && (zHFA === undefined || zWFA === undefined)) {
                            const assessed = calculateChildZScores({
                                gender: child.gender,
                                ageInMonths: lastMeasurement.ageInMonths,
                                weight: lastMeasurement.weight,
                                height: lastMeasurement.height,
                            });
                            zHFA = assessed.hfa.zScore;
                            zWFA = assessed.wfa.zScore;
                            zWFH = assessed.wfh.zScore;
                        }

                        const isStunted = zHFA !== undefined ? zHFA < -2 : false;
                        const isUnderweight = zWFA !== undefined ? zWFA < -2 : false;

                        return (
                          <div className="mt-6 grid grid-cols-2 gap-3">
                              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10 relative overflow-hidden group">
                                  <div className="absolute top-2 right-2 opacity-20 group-hover:scale-110 transition-transform"><Scale className="w-8 h-8" /></div>
                                  <p className="text-[9px] sm:text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 relative z-10">Berat Badan</p>
                                  <p className="text-xl sm:text-2xl font-black relative z-10">{lastMeasurement?.weight || "-"} <span className="text-[10px] font-medium opacity-60">kg</span></p>
                                  <div className="mt-2 relative z-10 flex flex-col gap-1">
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md w-fit ${!isUnderweight ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                          {!isUnderweight ? '✅ BB Normal' : '⚠️ BB Kurang'}
                                      </span>
                                      {zWFA !== undefined && (
                                          <span className="text-[8px] font-bold text-slate-300 opacity-80">
                                              Z: {zWFA > 0 ? `+${zWFA}` : zWFA} SD
                                          </span>
                                      )}
                                  </div>
                              </div>
                              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10 relative overflow-hidden group">
                                  <div className="absolute top-2 right-2 opacity-20 group-hover:scale-110 transition-transform"><Ruler className="w-8 h-8" /></div>
                                  <p className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 relative z-10">Tinggi Badan</p>
                                  <p className="text-xl sm:text-2xl font-black relative z-10">{lastMeasurement?.height || "-"} <span className="text-[10px] font-medium opacity-60">cm</span></p>
                                  <div className="mt-2 relative z-10 flex flex-col gap-1">
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md w-fit ${!isStunted ? 'bg-blue-500/20 text-blue-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                          {!isStunted ? '✅ TB Normal' : '⚠️ Stunting'}
                                      </span>
                                      {zHFA !== undefined && (
                                          <span className="text-[8px] font-bold text-slate-300 opacity-80">
                                              Z: {zHFA > 0 ? `+${zHFA}` : zHFA} SD
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>
                        );
                    })()}
                </div>
            </Card>

            {/* B. AI QUICK ACCESS (HERO ACTION) */}
            <Link href="/parent/nutrition" className="block group">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-[2rem] p-5 sm:p-6 text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 relative overflow-hidden border border-indigo-500/50">
                    <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[150%] bg-white/10 rotate-12 blur-xl"></div>
                    <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:rotate-12 transition-transform duration-500">
                        <Sparkles className="w-20 h-20" />
                    </div>
                    
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="space-y-1.5 pr-4">
                            <h3 className="text-base sm:text-lg font-black flex items-center gap-2 tracking-tight">
                                <div className="bg-white/20 p-1.5 rounded-lg"><BrainCircuit className="w-4 h-4 text-amber-300" /></div>
                                Tanya Ahli Gizi AI
                            </h3>
                            <p className="text-indigo-100 text-[11px] sm:text-xs leading-relaxed font-medium">Dapatkan resep MPASI lokal khusus untuk {child.name} hari ini.</p>
                        </div>
                        <div className="bg-white text-indigo-600 p-2 sm:p-2.5 rounded-full shadow-md shrink-0 group-hover:translate-x-1 transition-transform">
                            <ArrowRight className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </Link>

            {/* C. NEXT SCHEDULE CARD */}
            <div className="space-y-3">
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Jadwal Terdekat</h4>
               <Card className="p-4 rounded-[1.5rem] border-slate-100 shadow-sm flex items-center gap-4 bg-white hover:border-emerald-200 transition-colors active:scale-95">
                   <div className="bg-emerald-50 p-3 rounded-2xl text-center min-w-[3.5rem] border border-emerald-100 shrink-0">
                       <span className="block text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Tgl</span>
                       <span className="block text-xl font-black text-emerald-700 leading-none">15</span>
                   </div>
                   <div className="flex-1 min-w-0">
                       <h4 className="font-black text-slate-800 text-sm">Penimbangan Posyandu</h4>
                       <p className="text-[11px] text-slate-500 mt-0.5 truncate">Pastikan bawa buku KIA (opsional)</p>
                       <div className="flex items-center gap-2 mt-2">
                           <Badge variant="neutral" className="bg-slate-50 text-slate-500 text-[9px] py-0.5 border-slate-200">
                               <Clock className="w-3 h-3 mr-1 inline-block" /> 08:00 - Selesai
                           </Badge>
                       </div>
                   </div>
                   <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
               </Card>
            </div>

        </div>
      )}

    </div>
  );
}