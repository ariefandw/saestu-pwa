"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, TrendingUp, Sparkles, BookOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function ParentBottomNav() {
  const pathname = usePathname();

  const menuItems = [
    { href: "/parent", label: "Beranda", icon: Home },
    { href: "/parent/growth", label: "Tumbuh", icon: TrendingUp },
    { href: "/parent/nutrition", label: "AI Gizi", icon: Sparkles, isSpecial: true },
    { href: "/parent/education", label: "Edukasi", icon: BookOpen },
    { href: "/parent/profile", label: "Profil", icon: User },
  ];

  return (
    // Membungkus nav dengan w-full flex justify-center agar tetap di tengah (max-w-md) walau di layar PC
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none print:hidden">
      
      <nav className="w-full max-w-md bg-white/95 backdrop-blur-xl border-t border-slate-200/60 px-6 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-between items-center pointer-events-auto shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          
          // Render khusus untuk tombol tengah (AI Gizi) -> Floating Action Button (FAB)
          if (item.isSpecial) {
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center -mt-6 group relative z-10">
                <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center shadow-md text-white group-active:scale-95 transition-transform">
                  <item.icon className="w-5 h-5" />
                </div>
                <span className={cn(
                  "text-xs font-semibold mt-1 transition-colors",
                  isActive ? "text-teal-700" : "text-slate-500"
                )}>{item.label}</span>
              </Link>
            )
          }

          // Render menu reguler
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className="flex flex-col items-center gap-0.5 group relative transition-all duration-200 w-14"
            >
              <div className={cn(
                "p-1 rounded-lg transition-all",
                isActive ? "text-teal-700" : "text-slate-400 hover:text-slate-600"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "stroke-[2.2px]" : "stroke-[1.8px]")} />
              </div>
              <span className={cn(
                "text-xs transition-colors",
                isActive ? "text-teal-700 font-semibold" : "text-slate-500 font-normal"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      
    </div>
  );
}