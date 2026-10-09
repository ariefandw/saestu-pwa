'use client';

import React, { useState } from 'react';
import { Child, Measurement } from '@/types/schema';
import GrowthChart from '@/components/charts/GrowthChart';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { 
  Activity, 
  History, 
  Plus, 
  AlertCircle,
  Edit2,
  Trash2,
  CalendarDays,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { calculateChildZScores } from '@/lib/who-standards';

interface ChildMedicalHistoryProps {
  child: Child;
  measurements: Measurement[];
  readOnly?: boolean;
  onEditMeasurement?: (m: Measurement) => void;
  onDeleteMeasurement?: (id: string) => void;
  onAddMeasurement?: () => void;
}

export default function ChildMedicalHistory({
  child,
  measurements,
  readOnly = false,
  onEditMeasurement,
  onDeleteMeasurement,
  onAddMeasurement
}: ChildMedicalHistoryProps) {
  const [activeTab, setActiveTab] = useState<'chart' | 'history'>('chart');
  const [chartType, setChartType] = useState<'weight' | 'length'>('weight');

  // Helper Date Safety
  const ensureDate = (date: any): Date => {
    if (date instanceof Date) return date;
    if (date && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'adequate': return 'success';
      case 'inadequate': return 'danger';
      case 'excess': return 'warning';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'adequate': return 'Normal';
      case 'inadequate': return 'Waspada';
      case 'excess': return 'Berlebih';
      default: return 'Data Awal';
    }
  };

  return (
    <div className="space-y-4">
      
      {/* --- TABS NAVIGATION (IOS SEGMENTED CONTROL STYLE) --- */}
      <div className="flex p-1.5 bg-slate-100 rounded-[1.25rem] border border-slate-200">
        <button
          onClick={() => setActiveTab('chart')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all duration-300",
            activeTab === 'chart' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Activity className="w-4 h-4" />
          Grafik WHO
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all duration-300",
            activeTab === 'history' 
              ? "bg-white text-slate-900 shadow-sm" 
              : "text-slate-400 hover:text-slate-600"
          )}
        >
          <History className="w-4 h-4" />
          Log Bulanan
        </button>
      </div>

      {/* --- CONTENT AREA --- */}
      <div>
        
        {/* TAB 1: GRAFIK */}
        {activeTab === 'chart' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            
            <Card className="p-0 border-0 shadow-none overflow-hidden bg-transparent">
              
              {/* Chart Type Toggle */}
              <div className="flex bg-slate-100 p-1.5 rounded-[1.2rem] w-full mb-4">
                 <button
                   onClick={() => setChartType('weight')}
                   className={cn(
                     "flex-1 py-2 text-[10px] sm:text-xs font-black rounded-xl transition-all uppercase tracking-wider",
                     chartType === 'weight' ? "bg-white shadow-sm text-emerald-600" : "text-slate-400"
                   )}
                 >
                   Kurva Berat Badan
                 </button>
                 <button
                   onClick={() => setChartType('length')}
                   className={cn(
                     "flex-1 py-2 text-[10px] sm:text-xs font-black rounded-xl transition-all uppercase tracking-wider",
                     chartType === 'length' ? "bg-white shadow-sm text-blue-600" : "text-slate-400"
                   )}
                 >
                   Kurva Tinggi Badan
                 </button>
              </div>
              
              {/* Area Grafik (Tinggi disesuaikan agar pas di layar HP tanpa harus scroll pusing) */}
              <div className="bg-white rounded-3xl border border-slate-100 p-2 sm:p-4 pt-4 pb-14 h-[400px] w-full relative">
                <GrowthChart 
                  measurements={measurements} 
                  gender={child.gender} 
                  type={chartType} 
                />
              </div>

            </Card>

            {/* Tombol Input (Hanya muncul jika bukan ReadOnly) */}
            {!readOnly && onAddMeasurement && (
              <Button
                onClick={onAddMeasurement} 
                className="w-full h-14 text-sm bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all active:scale-95 shadow-md mt-4"
              >
                <Plus className="w-5 h-5 mr-2" />
                Input Data Timbang Baru
              </Button>
            )}
          </div>
        )}

        {/* TAB 2: RIWAYAT LIST */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-in slide-in-from-right-8 duration-300">
             {measurements.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                   <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Belum ada riwayat ukur</p>
                </div>
             ) : (
               measurements.map((m) => (
                  <Card key={m.id} className="relative overflow-hidden group border-slate-100 bg-white rounded-3xl p-0 shadow-sm">
                     
                     {/* Color Bar Indicator di sebelah Kiri */}
                     <div className={cn(
                       "absolute left-0 top-0 bottom-0 w-2 transition-colors",
                       m.weightStatus === 'adequate' ? 'bg-emerald-500' : 
                       m.weightStatus === 'inadequate' ? 'bg-amber-500' : 'bg-rose-500'
                     )} />

                     <div className="p-4 sm:p-5 pl-6 sm:pl-7">
                        
                        {/* Header Riwayat (Tanggal & Usia) */}
                        <div className="flex justify-between items-start border-b border-slate-50 pb-3 mb-3">
                           <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-slate-50 rounded-xl text-slate-400">
                                 <CalendarDays className="w-4 h-4" />
                              </div>
                              <div>
                                 <p className="text-xs sm:text-sm font-black text-slate-800">
                                   {ensureDate(m.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                                 </p>
                                 <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Usia {m.ageInMonths} Bulan</p>
                              </div>
                           </div>
                           
                           {/* Aksi Edit/Delete (Jika bukan readonly) */}
                           {!readOnly && (
                             <div className="flex items-center gap-1">
                               <button onClick={() => onEditMeasurement?.(m)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-all active:scale-95">
                                 <Edit2 className="w-3.5 h-3.5" />
                               </button>
                               <button onClick={() => onDeleteMeasurement?.(m.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 rounded-lg transition-all active:scale-95">
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           )}
                        </div>

                        {/* Data Box (BB, TB, Kenaikan) */}
                        <div className="grid grid-cols-2 gap-3">
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Berat Badan</p>
                              <div className="flex items-end gap-2">
                                 <p className="text-lg font-black text-slate-800 leading-none">{m.weight} <span className="text-[10px] text-slate-500 font-bold">kg</span></p>
                                 {m.weightIncrement !== undefined && (
                                   <div className={cn(
                                      "flex items-center text-[9px] font-black px-1.5 py-0.5 rounded border mb-0.5",
                                      m.weightIncrement > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-rose-600 bg-rose-50 border-rose-100"
                                   )}>
                                     {m.weightIncrement > 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                                     {m.weightIncrement > 0 ? "+" : ""}{m.weightIncrement}g
                                   </div>
                                 )}
                              </div>
                           </div>
                           
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tinggi Badan</p>
                              <p className="text-lg font-black text-slate-800 leading-none">{m.height} <span className="text-[10px] text-slate-500 font-bold">cm</span></p>
                           </div>
                        </div>

                        {/* Status Badges Antropometri (Z-Score & Velocity) */}
                        {(() => {
                          let zHFA = m.zScoreHFA;
                          let zWFA = m.zScoreWFA;
                          let zWFH = m.zScoreWFH;

                          if (zHFA === undefined || zWFA === undefined) {
                            const assessed = calculateChildZScores({
                              gender: child.gender,
                              ageInMonths: m.ageInMonths,
                              weight: m.weight,
                              height: m.height,
                              headCircumference: m.headCircumference,
                            });
                            zHFA = assessed.hfa.zScore;
                            zWFA = assessed.wfa.zScore;
                            zWFH = assessed.wfh.zScore;
                          }

                          return (
                            <div className="space-y-2 mt-4 pt-3 border-t border-slate-50">
                              {/* Z-Score Indicators */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Z-Score:</span>
                                <Badge 
                                  variant={zHFA < -2 ? "danger" : "neutral"} 
                                  className="text-[8px] sm:text-[9px] border-0 py-0.5"
                                >
                                  TB/U: {zHFA > 0 ? `+${zHFA}` : zHFA} SD {zHFA < -3 ? '(Severely Stunted)' : zHFA < -2 ? '(Stunted)' : '(Normal)'}
                                </Badge>
                                <Badge 
                                  variant={zWFA < -2 ? "warning" : "neutral"} 
                                  className="text-[8px] sm:text-[9px] border-0 py-0.5"
                                >
                                  BB/U: {zWFA > 0 ? `+${zWFA}` : zWFA} SD
                                </Badge>
                                {zWFH !== undefined && (
                                  <Badge 
                                    variant={zWFH < -2 ? "danger" : zWFH > 2 ? "warning" : "success"} 
                                    className="text-[8px] sm:text-[9px] border-0 py-0.5"
                                  >
                                    BB/TB: {zWFH > 0 ? `+${zWFH}` : zWFH} SD
                                  </Badge>
                                )}
                              </div>

                              {/* Growth Velocity */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Velocity:</span>
                                <Badge variant={getStatusVariant(m.weightStatus)} className="text-[8px] sm:text-[9px] border-0 py-0.5">
                                  BB: {getStatusLabel(m.weightStatus)}
                                </Badge>
                                <Badge variant={getStatusVariant(m.lengthStatus)} className="text-[8px] sm:text-[9px] border-0 py-0.5">
                                  TB: {getStatusLabel(m.lengthStatus)}
                                </Badge>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Catatan (Jika ada) */}
                        {m.notes && (
                          <div className="mt-3 p-3 bg-amber-50 rounded-xl flex gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-800 italic font-medium leading-relaxed">"{m.notes}"</p>
                          </div>
                        )}
                     </div>
                  </Card>
               ))
             )}
          </div>
        )}
      </div>
    </div>
  );
}