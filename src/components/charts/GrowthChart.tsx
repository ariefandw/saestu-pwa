'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Measurement } from '@/types/schema';
import {
  WFA_BOYS_TABLE,
  WFA_GIRLS_TABLE,
  LHFA_BOYS_TABLE,
  LHFA_GIRLS_TABLE,
  calculateChildZScores
} from '@/lib/who-standards';

interface GrowthChartProps {
  measurements: Measurement[];
  gender: "L" | "P";
  type: "weight" | "length";
}

type TimeFilter = '6m' | '1y' | 'all';

export default function GrowthChart({ measurements, gender, type }: GrowthChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => { if (measurements.length > 5) setTimeFilter('6m'); }, [measurements.length]);

  const chartData = useMemo(() => {
    if (!measurements || measurements.length === 0) return [];

    let processedData = measurements.map(m => {
        let dateObj: Date;
        const rawDate = m.date as any;
        if (rawDate && typeof rawDate.toDate === 'function') dateObj = rawDate.toDate();
        else if (rawDate instanceof Date) dateObj = rawDate;
        else dateObj = new Date(rawDate);

        let rawValue = type === "weight" ? m.weight : m.height;
        let value = typeof rawValue === 'string' ? parseFloat((rawValue as string).replace(',', '.')) : Number(rawValue);
        
        return {
            original: m,
            dateObj: dateObj,
            timestamp: !isNaN(dateObj.getTime()) ? dateObj.getTime() : 0,
            value: !isNaN(value) ? value : 0,
            age: m.ageInMonths
        };
    })
    .filter(item => item.timestamp > 0 && item.value > 0)
    .sort((a, b) => a.timestamp - b.timestamp);

    if (processedData.length > 0) {
        const latestDate = processedData[processedData.length - 1].dateObj;
        if (timeFilter === '6m') {
            const sixMonthsAgo = new Date(latestDate);
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            processedData = processedData.filter(d => d.dateObj >= sixMonthsAgo);
        } else if (timeFilter === '1y') {
            const oneYearAgo = new Date(latestDate);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            processedData = processedData.filter(d => d.dateObj >= oneYearAgo);
        }
    }

    const refTable = type === "weight"
      ? (gender === "L" ? WFA_BOYS_TABLE : WFA_GIRLS_TABLE)
      : (gender === "L" ? LHFA_BOYS_TABLE : LHFA_GIRLS_TABLE);

    return processedData.map(item => {
      const ageClamped = Math.min(60, Math.max(0, Math.round(item.age)));
      const whoRef = refTable[ageClamped.toString()] || refTable["0"];

      // Hitung / Ambil Z-Score
      let zScore = type === "weight" ? item.original.zScoreWFA : item.original.zScoreHFA;
      let zLabel = "";

      if (zScore === undefined) {
        const assessment = calculateChildZScores({
          gender,
          ageInMonths: item.age,
          weight: type === "weight" ? item.value : (item.original.weight || 0),
          height: type === "length" ? item.value : (item.original.height || 0),
        });
        zScore = type === "weight" ? assessment.wfa.zScore : assessment.hfa.zScore;
        zLabel = type === "weight" ? assessment.wfa.label : assessment.hfa.label;
      } else {
        zLabel = type === "weight"
          ? (item.original.wfaStatus || "Z-Score").replace(/_/g, ' ')
          : (item.original.hfaStatus || "Z-Score").replace(/_/g, ' ');
      }

      return {
        ...item,
        displayDate: item.dateObj.toLocaleDateString("id-ID", { month: 'short' }),
        fullDate: item.dateObj.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }),
        status: type === "weight" ? item.original.weightStatus : item.original.lengthStatus,
        zScore,
        zLabel,
        whoMedian: whoRef ? whoRef.sd0 : undefined,
        whoSD2neg: whoRef ? whoRef.sd2neg : undefined,
        whoSD3neg: whoRef ? whoRef.sd3neg : undefined,
        whoSD2pos: whoRef ? whoRef.sd2 : undefined,
      };
    });
  }, [measurements, type, timeFilter, gender]);

  const lineColor = gender === 'L' ? "#2563eb" : "#ec4899"; 
  const labelY = type === "weight" ? "Berat (kg)" : "Tinggi (cm)";

  if (!isMounted) return <div className="h-full w-full bg-slate-50 animate-pulse rounded-2xl"></div>;

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="flex-1 w-full ml-[-15px]">
        {chartData.length === 0 ? (
           <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
             <p>Data belum cukup.</p>
           </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                dy={10}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                width={35}
              />
              <Tooltip 
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    let statusBg = "bg-slate-100 text-slate-600";
                    let statusLabel = "Data";
                    if (data.status === 'adequate') { statusBg = "bg-emerald-100 text-emerald-700"; statusLabel = "Adekuat"; }
                    else if (data.status === 'inadequate') { statusBg = "bg-rose-100 text-rose-700"; statusLabel = "Seret"; }
                    else if (data.status === 'excess') { statusBg = "bg-amber-100 text-amber-700"; statusLabel = "Berlebih"; }

                    return (
                      <div className="bg-white p-3.5 border border-slate-100 shadow-xl rounded-2xl text-xs z-50 min-w-[190px]">
                        <p className="font-black text-slate-800 border-b border-slate-50 pb-2 mb-2">{data.fullDate}</p>
                        <div className="space-y-1.5 font-medium">
                            <div className="flex justify-between gap-4"><span className="text-slate-400">Usia</span><span className="text-slate-700 font-bold">{data.age} Bln</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-400">{labelY}</span><span className="font-black" style={{color: lineColor}}>{data.value}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-slate-400">Median WHO (0 SD)</span><span className="font-bold text-emerald-600">{data.whoMedian ?? '-'}</span></div>
                            <div className="flex justify-between gap-4 border-t border-slate-50 pt-1.5">
                              <span className="text-slate-400">Z-Score</span>
                              <span className={`font-black ${data.zScore < -2 ? 'text-rose-600' : 'text-slate-800'}`}>
                                {data.zScore !== undefined ? (data.zScore > 0 ? `+${data.zScore}` : data.zScore) : '-'} SD
                              </span>
                            </div>
                            {data.zLabel && (
                              <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-right">{data.zLabel}</p>
                            )}
                            <div className={`text-center mt-2 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusBg}`}>
                              Velocity: {statusLabel}
                            </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              
              {/* Kurva Standar WHO (KMS) */}
              <Line 
                type="monotone" 
                dataKey="whoMedian" 
                stroke="#10b981" 
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="whoSD2neg" 
                stroke="#f59e0b" 
                strokeWidth={1.2}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="whoSD3neg" 
                stroke="#ef4444" 
                strokeWidth={1.2}
                strokeDasharray="2 2"
                dot={false}
                isAnimationActive={false}
              />

              {/* Garis Ukur Aktual Anak */}
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={lineColor} 
                strokeWidth={3.5}
                isAnimationActive={true} 
                activeDot={{ r: 7, strokeWidth: 0, fill: lineColor }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx === undefined || cy === undefined || isNaN(Number(cx)) || isNaN(Number(cy))) {
                      return null;
                  }

                  let fill = '#cbd5e1';
                  if (payload.status === 'adequate') fill = '#10b981';
                  else if (payload.status === 'inadequate') fill = '#f43f5e';
                  else if (payload.status === 'excess') fill = '#f59e0b';
                  
                  return <circle key={payload.fullDate} cx={Number(cx)} cy={Number(cy)} r={5} fill={fill} stroke="#fff" strokeWidth={2} />;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend Standar Pertumbuhan KMS */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-4 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded" style={{ backgroundColor: lineColor }}></span>
          <span className="text-[9px] font-black text-slate-600 uppercase tracking-wider">Hasil Ukur</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-emerald-500"></span>
          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">0 SD (Median)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-amber-500"></span>
          <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">-2 SD (Waspada)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-t border-dashed border-rose-500"></span>
          <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">-3 SD (Kritis)</span>
        </div>
      </div>
    </div>
  );
}