'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/Card'; 

const data = [
  { name: 'Jan', pengukuran: 400 },
  { name: 'Feb', pengukuran: 420 },
  { name: 'Mar', pengukuran: 380 },
  { name: 'Apr', pengukuran: 450 },
  { name: 'Mei', pengukuran: 460 },
  { name: 'Jun', pengukuran: 410 },
];

export default function ActivityTrendChart() {
  return (
    <Card className="p-5 sm:p-6 border-slate-100 shadow-sm rounded-3xl bg-white">
      <div className="mb-6">
        <h3 className="text-base font-black text-slate-900 tracking-tight">Tren Partisipasi</h3>
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">Jumlah balita diukur 6 bln terakhir</p>
      </div>

      <div className="h-[250px] w-full ml-[-15px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorPengukuran" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                dy={10}
            />
            <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                width={40}
            />
            <Tooltip 
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                itemStyle={{ color: '#059669' }}
            />
            <Area 
                type="monotone" 
                dataKey="pengukuran" 
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorPengukuran)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#059669' }} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}