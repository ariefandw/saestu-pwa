"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Users, UserCircle, Settings, Activity, ScanLine, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface KaderSidebarProps {
  onQuickActionClick: () => void;
}

export function KaderSidebar({ onQuickActionClick }: KaderSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const menuItems = [
    { href: "/posyandu", label: "Beranda", icon: LayoutDashboard },
    { href: "/posyandu/children", label: "Data Balita", icon: Users },
    { href: "/posyandu/parents", label: "Orang Tua", icon: UserCircle },
    { href: "/posyandu/profile", label: "Pengaturan", icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-72 bg-slate-900 border-r border-slate-800 h-screen sticky top-0 z-40 text-white print:hidden shadow-2xl">
      <div className="p-8 border-b border-white/10 flex items-center gap-4">
        <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-900/50">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-black text-white text-2xl tracking-tight">SAESTU</h1>
          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">Portal Kader</p>
        </div>
      </div>
      
      <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all group", isActive ? "bg-blue-600 text-white shadow-md translate-x-1" : "text-slate-400 hover:bg-white/5 hover:text-white")}>
              <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
        
        <div className="pt-6 mt-6 border-t border-white/10">
          <button onClick={onQuickActionClick} className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-900/50 active:scale-95">
            <ScanLine className="h-5 w-5" /> Ukur Sekarang
          </button>
        </div>
      </nav>

      <div className="p-6 border-t border-white/10">
         <button onClick={() => logout()} className="flex items-center justify-center gap-2 w-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 py-3 rounded-xl text-sm font-bold transition-colors">
            <LogOut className="w-4 h-4" /> Keluar Sistem
         </button>
      </div>
    </aside>
  );
}