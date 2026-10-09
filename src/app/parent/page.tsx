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
      
      {/* 1. HEADER SECTION */}
      <div className="flex items-center justify-between mt-2">
        <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{greeting}</p>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Ibu {userProfile?.name?.split(' ')[0]}
            </h1>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-700 font-bold text-sm">
            {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
        </div>
      </div>

      {/* 2. EMPTY STATE (ONBOARDING) */}
      {!child && (
        <Card className="p-6 border-dashed border-2 border-slate-200 bg-white rounded-2xl mt-6">
           <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mb-4 border border-slate-200">
               <AlertCircle className="w-6 h-6 text-amber-600" />
           </div>
           <h3 className="font-bold text-slate-900 text-base mb-1.5">Belum Terhubung Data Anak</h3>
           <p className="text-xs text-slate-600 leading-relaxed mb-5">
             Data antropometri anak belum terdaftar pada akun ini. Lakukan sinkronisasi di Posyandu:
           </p>
           <ul className="space-y-2.5">
              <li className="flex gap-3 text-xs text-slate-700 font-medium bg-slate-50 border border-slate-200 p-3 rounded-xl">
                 <span className="w-5 h-5 bg-white border border-slate-200 rounded-md flex items-center justify-center font-bold text-slate-900 shrink-0 text-xs">1</span>
                 Kunjungi jadwal Posyandu terdekat untuk penimbangan resmi.
              </li>
              <li className="flex gap-3 text-xs text-slate-700 font-medium bg-slate-50 border border-slate-200 p-3 rounded-xl">
                 <span className="w-5 h-5 bg-white border border-slate-200 rounded-md flex items-center justify-center font-bold text-slate-900 shrink-0 text-xs">2</span>
                 <div>
                    Berikan alamat email akun kepada Kader:
                    <span className="font-semibold text-slate-900 text-xs mt-1 block font-mono bg-white border border-slate-200 px-2 py-0.5 rounded w-fit">{userProfile?.email}</span>
                 </div>
              </li>
           </ul>
        </Card>
      )}

      {/* 3. DASHBOARD CONTENT */}
      {child && (
        <div className="space-y-5">
            
            {/* A. KARTU IDENTITAS ANAK (CLEAN CLINICAL CARD) */}
            <Card className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl shadow-xs text-slate-900">
                <div className="flex justify-between items-start mb-3">
                    <Badge variant="neutral" className="bg-slate-100 text-slate-700 border-slate-200 px-2.5 py-0.5 font-semibold text-xs">
                        Profil Anak
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> 
                        <span>Pemeriksaan: {formatDate(lastMeasurement?.date)}</span>
                    </div>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-slate-900">{child.name}</h2>
                <p className="text-slate-500 text-xs font-medium flex items-center gap-2 mt-1">
                    <span className="font-semibold text-slate-700">
                        {child.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>Usia {lastMeasurement?.ageInMonths || 0} Bulan</span>
                </p>

                {/* Data Box */}
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
                      <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                              <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Berat Badan</p>
                                  <Scale className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                                  {lastMeasurement?.weight || "-"} <span className="text-xs font-normal text-slate-500">kg</span>
                              </p>
                              <div className="mt-2.5 flex flex-col gap-1">
                                  <Badge 
                                      variant={!isUnderweight ? 'success' : 'danger'}
                                      className="text-xs font-semibold px-2 py-0.5 w-fit"
                                  >
                                      {!isUnderweight ? 'BB Normal' : 'BB Kurang'}
                                  </Badge>
                                  {zWFA !== undefined && (
                                      <span className="text-xs text-slate-600 font-medium tabular-nums">
                                          Z: {zWFA > 0 ? `+${zWFA}` : zWFA} SD
                                      </span>
                                  )}
                              </div>
                          </div>

                          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                              <div className="flex items-center justify-between mb-1">
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tinggi Badan</p>
                                  <Ruler className="w-4 h-4 text-slate-400" />
                              </div>
                              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                                  {lastMeasurement?.height || "-"} <span className="text-xs font-normal text-slate-500">cm</span>
                              </p>
                              <div className="mt-2.5 flex flex-col gap-1">
                                  <Badge 
                                      variant={!isStunted ? 'success' : 'danger'}
                                      className="text-xs font-semibold px-2 py-0.5 w-fit"
                                  >
                                      {!isStunted ? 'TB Normal' : 'Stunting'}
                                  </Badge>
                                  {zHFA !== undefined && (
                                      <span className="text-xs text-slate-600 font-medium tabular-nums">
                                          Z: {zHFA > 0 ? `+${zHFA}` : zHFA} SD
                                      </span>
                                  )}
                              </div>
                          </div>
                      </div>
                    );
                })()}
            </Card>

            {/* B. NUTRITION CONSULTATION QUICK ACCESS */}
            <Link href="/parent/nutrition" className="block group">
                <Card className="bg-slate-900 hover:bg-slate-800 text-white p-5 rounded-2xl border border-slate-800 shadow-xs transition-colors">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1 pr-3">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4 text-teal-400" />
                                Konsultasi Gizi & Panduan MPASI
                            </h3>
                            <p className="text-xs text-slate-300 leading-relaxed font-normal">
                                Rekomendasi nutrisi klinis dan menu pangan lokal terukur sesuai status antropometri anak.
                            </p>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-800 text-white shrink-0 group-hover:bg-slate-700 transition-colors">
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </div>
                </Card>
            </Link>

            {/* C. JADWAL POSYANDU */}
            <div className="space-y-2.5">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jadwal Posyandu</h4>
               <Card className="p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4 bg-white">
                   <div className="bg-slate-100 p-2.5 rounded-xl text-center min-w-[3.5rem] border border-slate-200 shrink-0">
                       <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Tgl</span>
                       <span className="block text-xl font-bold text-slate-900 tabular-nums leading-none mt-0.5">15</span>
                   </div>
                   <div className="flex-1 min-w-0">
                       <h4 className="font-bold text-slate-900 text-sm">Penimbangan & Pengukuran Rutin</h4>
                       <p className="text-xs text-slate-500 mt-0.5">Bawa Buku KIA saat berkunjung</p>
                       <div className="flex items-center gap-2 mt-1.5">
                           <Badge variant="neutral" className="bg-slate-50 text-slate-600 text-xs py-0.5 border-slate-200 font-medium">
                               <Clock className="w-3 h-3 mr-1 inline-block" /> 08:00 - Selesai
                           </Badge>
                       </div>
                   </div>
                   <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
               </Card>
            </div>

        </div>
      )}

    </div>
  );
}