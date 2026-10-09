"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  Activity, 
  Utensils, 
  Baby, 
  Users, 
  AlertTriangle, 
  MapPin, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight,
  Siren,
  Building2,
  PieChart
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import RegionalHealthChart from "@/components/charts/RegionalHealthChart";
import ActivityTrendChart from "@/components/charts/ActivityTrendChart";
import { cn } from "@/lib/utils";

// Services
import { getPosyandusByPuskesmas } from "@/lib/services/posyandu";
import { getAllChildren } from "@/lib/services/children";
import { getKadersByPuskesmas } from "@/lib/services/users";

// Tipe data lokal untuk dashboard
interface DashboardStats {
  totalBalita: number;
  totalPengukuran: number;
  totalStunting: number;
  totalKader: number;
  posyanduCount: number;
}

export default function PuskesmasDashboard() {
  const { userProfile, loading: authLoading } = useAuth();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalBalita: 0,
    totalPengukuran: 0,
    totalStunting: 0,
    totalKader: 0,
    posyanduCount: 0
  });
  
  const [highRiskChildren, setHighRiskChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "intervention">("overview");

  // State untuk Real Data Chart
  const [chartDataWeight, setChartDataWeight] = useState<any[]>([]);
  const [chartDataHeight, setChartDataHeight] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!userProfile?.puskesmasId) return;

      try {
        // 1. Ambil Posyandu milik Puskesmas ini
        const myPosyandus = await getPosyandusByPuskesmas(userProfile.puskesmasId);
        const myPosyanduIds = myPosyandus.map(p => p.id);

        // 2. Ambil Data Anak & Kader
        const [allChildren, myKaders] = await Promise.all([
            getAllChildren(),
            getKadersByPuskesmas(userProfile.puskesmasId)
        ]);

        // 3. Filter Data Anak berdasarkan Posyandu ID
        const myChildren = allChildren.filter(c => myPosyanduIds.includes(c.posyanduId));
        
        // 4. Identifikasi Kasus Stunting Nyata & Anak Berisiko Tinggi
        const stuntedChildren = myChildren.filter(c => 
            c.isStunted === true || (c.lastZScoreHFA !== undefined && c.lastZScoreHFA < -2)
        );

        const riskList = myChildren.filter(c => 
            c.isStunted === true || 
            (c.lastZScoreHFA !== undefined && c.lastZScoreHFA < -2) ||
            c.isWasted === true ||
            (c.lastZScoreWFH !== undefined && c.lastZScoreWFH < -2) ||
            c.lastLengthStatus === 'inadequate' || 
            c.lastWeightStatus === 'inadequate'
        ).map(child => {
            const posyanduName = myPosyandus.find(p => p.id === child.posyanduId)?.name || "Unknown";
            return { ...child, posyanduName };
        });

        // 5. Hitung Statistik Overview
        const currentMonth = new Date().getMonth();
        const activeMeasurementCount = myChildren.filter(c => {
            if (!c.lastMeasurementDate) return false;
            const d = (c.lastMeasurementDate as any).toDate ? (c.lastMeasurementDate as any).toDate() : new Date(c.lastMeasurementDate as any);
            return d.getMonth() === currentMonth;
        }).length;

        setStats({
            totalBalita: myChildren.length,
            totalPengukuran: activeMeasurementCount,
            totalStunting: stuntedChildren.length,
            totalKader: myKaders.length,
            posyanduCount: myPosyandus.length
        });

        setHighRiskChildren(riskList);

        // 6. Siapkan Data Agregat untuk Chart Berdasarkan Standar WHO / Kemenkes
        let wNormal = 0, wKurang = 0, wLebih = 0, wAwal = 0;
        let hNormal = 0, hStunting = 0, hAwal = 0;

        myChildren.forEach(c => {
           // Aggregasi Berat (WFA / Velocity)
           if (c.lastZScoreWFA !== undefined) {
              if (c.lastZScoreWFA < -2) wKurang++;
              else if (c.lastZScoreWFA > 1) wLebih++;
              else wNormal++;
           } else {
              const weightStatus = c.lastWeightStatus as string;
              if (weightStatus === 'adequate') wNormal++;
              else if (weightStatus === 'inadequate') wKurang++;
              else if (weightStatus === 'excess') wLebih++;
              else wAwal++;
           }

           // Aggregasi Tinggi (HFA / Stunting vs Normal)
           if (c.lastZScoreHFA !== undefined) {
              if (c.lastZScoreHFA < -2) hStunting++;
              else hNormal++;
           } else if (c.isStunted) {
              hStunting++;
           } else if (c.lastLengthStatus === 'adequate') {
              hNormal++;
           } else if (c.lastLengthStatus === 'inadequate') {
              hStunting++;
           } else {
              hAwal++;
           }
        });

        setChartDataWeight([
           { name: 'Normal', value: wNormal, color: '#10b981' }, 
           { name: 'Risiko / Kurang', value: wKurang, color: '#f59e0b' },  
           { name: 'Berlebih', value: wLebih, color: '#6366f1' },   
           { name: 'Data Awal', value: wAwal, color: '#94a3b8' },   
        ]);

        setChartDataHeight([
           { name: 'Normal', value: hNormal, color: '#10b981' },
           { name: 'Stunting', value: hStunting, color: '#f43f5e' }, 
           { name: 'Data Awal', value: hAwal, color: '#94a3b8' }, 
        ]);

      } catch (error) {
        console.error("Gagal memuat dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
        fetchDashboardData();
    }
  }, [userProfile, authLoading]);

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 border-4 border-emerald-100 rounded-full relative">
               <div className="absolute inset-[-4px] border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse mt-2">Menyiapkan Dashboard</p>
        </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 font-sans pb-28 max-w-[1400px] mx-auto">
      
      {/* 1. HERO HEADER SECTION */}
      <div className="relative bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[2rem] p-6 sm:p-8 shadow-xl shadow-emerald-900/20 overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <PieChart className="w-64 h-64 text-white transform rotate-12 translate-x-10 -translate-y-10" />
         </div>
         <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>

         <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-3 w-full max-w-2xl">
               <div className="flex flex-wrap items-center gap-2 mb-1">
                   <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/50 backdrop-blur-md border border-emerald-500/30 text-emerald-100 text-[10px] font-black uppercase tracking-widest">
                       <Activity className="w-3 h-3 text-emerald-400 animate-pulse" /> Live Center
                   </div>
                   <span className="text-[10px] font-bold text-emerald-200/80 uppercase tracking-widest">
                       {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                   </span>
               </div>
               <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                  Halo, {userProfile?.name?.split(' ')[0] || "Petugas"}
               </h1>
               <p className="text-emerald-50/90 text-sm md:text-base leading-relaxed font-medium">
                  Anda sedang memantau kesehatan gizi agregat dari <strong className="text-white">{stats.posyanduCount} Posyandu</strong> di wilayah Puskesmas Anda.
               </p>
            </div>
            
            <div className="shrink-0 w-full md:w-auto">
               <Link href="/puskesmas/nutrition" className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-emerald-800 hover:bg-emerald-50 px-6 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-lg border-2 border-transparent hover:border-emerald-200">
                  <Utensils className="h-5 w-5" />
                  Database Gizi & Pangan
               </Link>
            </div>
         </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS (BENTO GRID) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
            title="Total Balita" 
            value={stats.totalBalita} 
            icon={Baby} 
            color="blue"
            trend={`${stats.posyanduCount} Posyandu`} 
            trendUp={true}
        />
        <StatsCard 
            title="Pengukuran Aktif" 
            value={stats.totalPengukuran} 
            icon={Activity} 
            color="emerald"
            trend="Bulan Ini" 
            trendUp={true}
        />
        <StatsCard 
            title="Kasus Berisiko" 
            value={stats.totalStunting} 
            icon={AlertTriangle} 
            color="rose"
            trend="Butuh Intervensi" 
            trendUp={false}
            highlight={stats.totalStunting > 0}
        />
        <StatsCard 
            title="Petugas Lapangan" 
            value={stats.totalKader} 
            icon={Users} 
            color="indigo"
            trend="Kader Aktif" 
            trendUp={true}
        />
      </div>

      {/* 3. TABS NAVIGATION */}
      <div className="flex p-1.5 bg-slate-100 rounded-[1.25rem] border border-slate-200 shadow-inner w-full lg:w-fit mx-auto lg:mx-0 mt-8">
         <button 
            onClick={() => setActiveTab("overview")}
            className={cn(
                "flex-1 lg:flex-none px-6 py-3 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-2 tracking-wider uppercase",
                activeTab === "overview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
            )}
         >
            <TrendingUp className="w-4 h-4" /> Overview Wilayah
         </button>
         <button 
            onClick={() => setActiveTab("intervention")}
            className={cn(
                "flex-1 lg:flex-none px-6 py-3 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center justify-center gap-2 tracking-wider uppercase",
                activeTab === "intervention" ? "bg-rose-600 text-white shadow-sm shadow-rose-200" : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
            )}
         >
            <Siren className={cn("w-4 h-4", activeTab === "intervention" && "animate-pulse")} /> 
            Zona Intervensi <span className={cn("px-1.5 py-0.5 rounded-md ml-1", activeTab === "intervention" ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-500")}>{stats.totalStunting}</span>
         </button>
      </div>

      {/* 4. TAB CONTENT */}
      {activeTab === "overview" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Left: Charts (Mengirim Real Data ke Chart) */}
            <div className="xl:col-span-2 space-y-6">
                <RegionalHealthChart 
                   weightData={chartDataWeight} 
                   heightData={chartDataHeight} 
                   totalBalita={stats.totalBalita} 
                />
            </div>

            {/* Right: Activity Trend & Info */}
            <div className="xl:col-span-1 space-y-6">
                <ActivityTrendChart />
                
                <Card className="p-6 bg-slate-900 text-white border-0 shadow-lg relative overflow-hidden rounded-3xl">
                    <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                        <Building2 className="w-32 h-32" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px]">
                        <div>
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-3 border border-indigo-500/30">
                               <Users className="w-3 h-3" /> SDM Kesehatan
                           </div>
                           <h3 className="text-xl font-black mb-2 tracking-tight">Manajemen Petugas</h3>
                           <p className="text-slate-400 text-xs leading-relaxed font-medium mb-6">
                               Kelola akun dan penempatan Kader untuk memastikan setiap Posyandu memiliki tenaga ukur yang cukup.
                           </p>
                        </div>
                        <Link href="/puskesmas/kaders">
                            <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 border-0 font-black h-12 rounded-xl transition-all active:scale-95 shadow-xl shadow-white/10">
                                Kelola Tim Kader Sekarang
                            </Button>
                        </Link>
                    </div>
                </Card>
            </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            {/* Intervention Header */}
            <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
                <div className="flex items-start sm:items-center gap-5">
                    <div className="p-4 bg-rose-200/50 text-rose-600 rounded-2xl shrink-0 border border-rose-200">
                        <Siren className="w-8 h-8 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-rose-950 tracking-tight">Zona Prioritas Penanganan</h3>
                        <p className="text-rose-700/80 text-xs sm:text-sm mt-1.5 font-medium max-w-xl leading-relaxed">
                            Daftar di bawah merupakan balita dengan indikasi <strong>Weight Faltering (Gizi Kurang)</strong> atau <strong>Stunting</strong> berdasarkan data ukur kader. Segera lakukan validasi lapangan dan PMT.
                        </p>
                    </div>
                </div>
            </div>

            {/* Intervention List Table */}
            <Card className="overflow-hidden border-slate-100 shadow-sm rounded-3xl p-0 bg-white">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identitas Balita</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Posyandu</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Indikasi Gizi</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Angka Terakhir</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aksi Tindak Lanjut</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {highRiskChildren.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100">
                                               <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                            </div>
                                            <p className="font-black text-slate-800 text-lg">Wilayah Anda Aman!</p>
                                            <p className="text-sm text-slate-500 font-medium mt-1">Tidak ada balita yang masuk dalam kategori berisiko tinggi bulan ini.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                highRiskChildren.map((child) => (
                                    <tr key={child.id} className="hover:bg-rose-50/30 transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-lg border border-rose-200 shrink-0">
                                                    {child.name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-800 truncate">{child.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mt-0.5 truncate">NIK: {child.nik || "-"}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg w-fit border border-slate-100">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate max-w-[150px]">{child.posyanduName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col gap-1.5 w-fit">
                                                {child.lastLengthStatus === 'inadequate' && (
                                                    <Badge variant="danger" className="text-[9px] px-2 py-0.5 border-0 shadow-sm animate-pulse">IND: STUNTING</Badge>
                                                )}
                                                {child.lastWeightStatus === 'inadequate' && (
                                                    <Badge variant="warning" className="text-[9px] px-2 py-0.5 border-0 shadow-sm bg-amber-100 text-amber-700">IND: GIZI KURANG</Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="inline-flex gap-4">
                                                <div className="text-center">
                                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Berat</p>
                                                   <p className="font-black text-slate-800 text-sm">{child.lastWeight} <span className="text-[10px] text-slate-500 font-bold">kg</span></p>
                                                </div>
                                                <div className="w-px bg-slate-200 h-8"></div>
                                                <div className="text-center">
                                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tinggi</p>
                                                   <p className="font-black text-slate-800 text-sm">{child.lastHeight} <span className="text-[10px] text-slate-500 font-bold">cm</span></p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <Link href={`/puskesmas/regional/child/${child.id}`}>
                                                <Button size="sm" variant="outline" className="border-slate-200 text-slate-700 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50 text-xs h-9 rounded-xl font-bold transition-all active:scale-95 shadow-sm">
                                                    Tinjau Kasus <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
      )}

    </div>
  );
}

// Reusable Stats Card Component
function StatsCard({ title, value, icon: Icon, color, trend, trendUp, highlight }: any) {
    const colorStyles: any = {
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        rose: "bg-rose-50 text-rose-600 border-rose-100",
        indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    };

    return (
        <Card className={cn(
            "p-5 sm:p-6 border shadow-sm transition-all duration-300 hover:shadow-md rounded-[1.5rem]",
            highlight ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50' : 'border-slate-100 bg-white hover:border-slate-200'
        )}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div className={`p-3 rounded-2xl ${colorStyles[color]} w-fit`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className={`w-fit flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {trend}
                </div>
            </div>
            <div>
                <h4 className="text-3xl sm:text-4xl font-black text-slate-900 mb-1 tracking-tight leading-none">{value}</h4>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">{title}</p>
            </div>
        </Card>
    );
}