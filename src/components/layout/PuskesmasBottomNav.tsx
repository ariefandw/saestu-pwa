"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Utensils, Building2, Users, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PuskesmasBottomNav() {
  const pathname = usePathname();

  const menuItems = [
    { href: "/puskesmas", label: "Dashboard", icon: LayoutDashboard },
    { href: "/puskesmas/posyandu", label: "Posyandu", icon: Building2 },
    { href: "/puskesmas/nutrition", label: "Gizi", icon: Utensils },
    { href: "/puskesmas/kaders", label: "Kader", icon: Users },
    { href: "/puskesmas/profile", label: "Profil", icon: UserCircle },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none print:hidden">
      <nav className="w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/60 px-2 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-between items-center pointer-events-auto shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
        {menuItems.map((item) => {
          const isActive = item.href === "/puskesmas" 
            ? pathname === "/puskesmas" 
            : pathname.startsWith(item.href);
          
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 group relative transition-all duration-200 w-16">
              <div className={cn("p-1 rounded-lg transition-all", isActive ? "bg-slate-100 text-emerald-700" : "text-slate-400 hover:text-slate-600")}>
                <item.icon className={cn("w-5 h-5", isActive ? "stroke-[2.2px]" : "stroke-[1.8px]")} />
              </div>
              <span className={cn("text-xs transition-colors", isActive ? "text-emerald-700 font-semibold" : "text-slate-500 font-normal")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}