"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, UserCircle, Settings, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

interface KaderBottomNavProps {
  onQuickActionClick: () => void;
}

export function KaderBottomNav({ onQuickActionClick }: KaderBottomNavProps) {
  const pathname = usePathname();

  const menuItems = [
    { href: "/posyandu", label: "Beranda", icon: LayoutDashboard },
    { href: "/posyandu/children", label: "Balita", icon: Users },
    { href: "action", label: "Ukur", icon: ScanLine, isSpecial: true },
    { href: "/posyandu/parents", label: "Orang Tua", icon: UserCircle },
    { href: "/posyandu/profile", label: "Profil", icon: Settings },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none print:hidden">
      <nav className="w-full max-w-md bg-white/95 backdrop-blur-xl border-t border-slate-200/60 px-5 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-between items-center pointer-events-auto shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          
          if (item.isSpecial) {
            return (
              <button key={item.label} onClick={onQuickActionClick} className="flex flex-col items-center justify-center -mt-6 group relative z-10 transition-transform active:scale-95">
                <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center shadow-md text-white border-2 border-white">
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold mt-1 text-slate-600">{item.label}</span>
              </button>
            )
          }

          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 group relative transition-all duration-200 w-14">
              <div className={cn("p-1 rounded-lg transition-all", isActive ? "text-slate-900 bg-slate-100" : "text-slate-400 hover:text-slate-600")}>
                <item.icon className={cn("w-5 h-5", isActive ? "stroke-[2.2px]" : "stroke-[1.8px]")} />
              </div>
              <span className={cn("text-xs transition-colors", isActive ? "text-slate-900 font-semibold" : "text-slate-500 font-normal")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}