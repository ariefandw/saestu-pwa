"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
// [FIX]: Menambahkan 'Activity' ke dalam import lucide-react
import { Search, Keyboard, Camera, Activity } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { getChildrenByPosyandu } from "@/lib/services/children";
import { Child } from "@/types/schema";

// Import Komponen Enterprise Layout
import { KaderHeader } from "@/components/layout/KaderHeader";
import { KaderSidebar } from "@/components/layout/KaderSidebar";
import { KaderBottomNav } from "@/components/layout/KaderBottomNav";

export default function PosyanduLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userProfile } = useAuth();
  
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [childList, setChildList] = useState<Child[]>([]);
  const [searchChild, setSearchChild] = useState("");
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);

  // Lazy load data anak hanya ketika tombol "Ukur Sekarang / Scan" diklik
  useEffect(() => {
    if (isQuickOpen && userProfile?.posyanduId && childList.length === 0) {
      setIsLoadingChildren(true);
      getChildrenByPosyandu(userProfile.posyanduId)
        .then(data => setChildList(data))
        .catch(err => console.error("Gagal load balita", err))
        .finally(() => setIsLoadingChildren(false));
    }
  }, [isQuickOpen, userProfile, childList.length]);

  const filteredChildren = childList.filter(c => 
    c.name.toLowerCase().includes(searchChild.toLowerCase()) || 
    c.nik.includes(searchChild)
  );

  return (
    <div className="min-h-screen bg-slate-50 md:flex font-sans">
      
      {/* 1. SIDEBAR DESKTOP (Otomatis Sembunyi di HP) */}
      <KaderSidebar onQuickActionClick={() => setIsQuickOpen(true)} />

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
        
        {/* 2. HEADER MOBILE (Otomatis Sembunyi di Desktop) */}
        <KaderHeader />

        <main className="flex-1 overflow-y-auto pb-24 md:pb-0 scroll-smooth print:bg-white">
          {children}
        </main>

        {/* 3. BOTTOM NAV MOBILE (Otomatis Sembunyi di Desktop) */}
        <KaderBottomNav onQuickActionClick={() => setIsQuickOpen(true)} />
      </div>

      {/* 4. MODAL QUICK ACTION (Pilih Balita untuk Diukur) */}
      <Modal isOpen={isQuickOpen} onClose={() => setIsQuickOpen(false)} title="Pilih Balita untuk Diukur">
         <div className="space-y-4 h-[60vh] flex flex-col">
            
            <div className="relative shrink-0">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
               <input 
                  autoFocus
                  type="text" 
                  placeholder="Cari nama balita atau NIK..." 
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={searchChild}
                  onChange={e => setSearchChild(e.target.value)}
               />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
               {isLoadingChildren ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                      <Activity className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-sm font-bold text-slate-500">Mencari data balita...</p>
                  </div>
               ) : filteredChildren.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                     <p className="text-sm text-slate-500 font-bold mb-2">Balita tidak ditemukan.</p>
                     <button onClick={() => { setIsQuickOpen(false); router.push('/posyandu/children'); }} className="text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-xs font-black transition-colors hover:bg-blue-100">
                        + Daftarkan Balita Baru
                     </button>
                  </div>
               ) : (
                  filteredChildren.map(child => (
                     <div key={child.id} className="p-3 bg-white border border-slate-100 shadow-sm rounded-2xl flex justify-between items-center hover:border-blue-300 transition-colors group">
                        <div className="min-w-0 pr-2">
                           <p className="font-bold text-slate-800 text-sm truncate">{child.name}</p>
                           <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5 truncate">Ortu: {child.parentName}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                           <button onClick={() => { setIsQuickOpen(false); router.push(`/posyandu/children/${child.id}/measure`); }} className="p-2.5 bg-slate-50 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors active:scale-95 group/btn border border-slate-100">
                              <Keyboard className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                           </button>
                           <button onClick={() => { setIsQuickOpen(false); router.push(`/posyandu/children/${child.id}/measure?autoScan=true`); }} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-colors active:scale-95 group/btn border border-blue-100">
                              <Camera className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                           </button>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </Modal>
      
    </div>
  );
}