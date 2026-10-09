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
              <div className="flex bg-slate-100 p-1 rounded-xl w-full mb-4">
                 <button
                   onClick={() => setChartType('weight')}
                   className={cn(
                     "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                     chartType === 'weight' ? "bg-white shadow-xs text-emerald-700" : "text-slate-500"
                   )}
                 >
                   Kurva Berat Badan
                 </button>
                 <button
                   onClick={() => setChartType('length')}
                   className={cn(
                     "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                     chartType === 'length' ? "bg-white shadow-xs text-blue-700" : "text-slate-500"
                   )}
                 >
                   Kurva Tinggi Badan
                 </button>
              </div>
              
              {/* Area Grafik */}
              <div className="bg-white rounded-2xl border border-slate-200 p-2 sm:p-4 pt-4 pb-14 h-[400px] w-full relative">
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
                className="w-full h-12 text-sm bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-xs mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Input Data Timbang Baru
              </Button>
            )}
          </div>
        )}

        {/* TAB 2: RIWAYAT LIST */}
        {activeTab === 'history' && (
          <div className="space-y-4">
             {measurements.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                   <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                   <p className="text-slate-500 font-semibold uppercase text-xs tracking-wider">Belum ada riwayat pengukuran</p>
                </div>
             ) : (
               measurements.map((m) => (
                  <Card key={m.id} className="relative overflow-hidden group border-slate-200 bg-white rounded-2xl p-0 shadow-xs">
                     
                     {/* Color Bar Indicator di sebelah Kiri */}
                     <div className={cn(
                       "absolute left-0 top-0 bottom-0 w-1.5 transition-colors",
                       m.weightStatus === 'adequate' ? 'bg-emerald-500' : 
                       m.weightStatus === 'inadequate' ? 'bg-amber-500' : 'bg-rose-500'
                     )} />

                     <div className="p-4 sm:p-5 pl-5 sm:pl-6 space-y-3">
                        {/* Header Riwayat (Tanggal & Usia) */}
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                           <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                 <CalendarDays className="w-4 h-4" />
                              </div>
                              <div>
                                 <p className="text-sm font-bold text-slate-900">
                                   {ensureDate(m.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                                 </p>
                                 <p className="text-xs text-slate-500 font-medium mt-0.5">Usia {m.ageInMonths} Bulan</p>
                              </div>
                           </div>
                           
                           {/* Aksi Edit/Delete */}
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
                           <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Berat Badan</p>
                              <div className="flex items-end gap-2">
                                 <p className="text-xl font-bold text-slate-900 leading-none tabular-nums">{m.weight} <span className="text-xs text-slate-500 font-normal">kg</span></p>
                                 {m.weightIncrement !== undefined && (
                                   <div className={cn(
                                      "flex items-center text-xs font-semibold px-1.5 py-0.5 rounded border mb-0.5 tabular-nums",
                                      m.weightIncrement > 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"
                                   )}>
                                     {m.weightIncrement > 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                                     {m.weightIncrement > 0 ? "+" : ""}{m.weightIncrement}g
                                   </div>
                                 )}
                              </div>
                           </div>
                           
                           <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tinggi Badan</p>
                              <p className="text-xl font-bold text-slate-900 leading-none tabular-nums">{m.height} <span className="text-xs text-slate-500 font-normal">cm</span></p>
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
                            <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
                              {/* Z-Score Indicators */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Z-Score:</span>
                                <Badge 
                                  variant={zHFA < -2 ? "danger" : "neutral"} 
                                  className="text-xs border-0 py-0.5 font-medium"
                                >
                                  TB/U: {zHFA > 0 ? `+${zHFA}` : zHFA} SD {zHFA < -3 ? '(Severely Stunted)' : zHFA < -2 ? '(Stunted)' : '(Normal)'}
                                </Badge>
                                <Badge 
                                  variant={zWFA < -2 ? "warning" : "neutral"} 
                                  className="text-xs border-0 py-0.5 font-medium"
                                >
                                  BB/U: {zWFA > 0 ? `+${zWFA}` : zWFA} SD
                                </Badge>
                                {zWFH !== undefined && (
                                  <Badge 
                                    variant={zWFH < -2 ? "danger" : zWFH > 2 ? "warning" : "success"} 
                                    className="text-xs border-0 py-0.5 font-medium"
                                  >
                                    BB/TB: {zWFH > 0 ? `+${zWFH}` : zWFH} SD
                                  </Badge>
                                )}
                              </div>

                              {/* Growth Velocity */}
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Laju Tumbuh:</span>
                                <Badge variant={getStatusVariant(m.weightStatus)} className="text-xs border-0 py-0.5 font-medium">
                                  BB: {getStatusLabel(m.weightStatus)}
                                </Badge>
                                <Badge variant={getStatusVariant(m.lengthStatus)} className="text-xs border-0 py-0.5 font-medium">
                                  TB: {getStatusLabel(m.lengthStatus)}
                                </Badge>
                              </div>
                            </div>
                          );
                        })()}
                        
                        {/* Catatan (Jika ada) */}
                        {m.notes && (
                          <div className="mt-2.5 p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-xl flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-900 font-medium leading-relaxed">"{m.notes}"</p>
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