"use client";

import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { 
  Activity, 
  AlertTriangle, 
  Fingerprint, 
  ChevronRight, 
  ChevronDown, 
  Loader2, 
  ShieldCheck, 
  Building2, 
  HeartHandshake, 
  Users 
} from "lucide-react";
import Link from "next/link";

// [NEW IMPORT]: Ambil AuthContext untuk mengecek apakah user sudah login
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const DEMO_ACCOUNTS = [
  { 
    role: "Admin Master", 
    email: "admin@saestu.com", 
    password: "password123", 
    desc: "Akses pusat sistem & konfigurasi", 
    icon: ShieldCheck, 
    badgeColor: "bg-purple-100 text-purple-700 border-purple-200" 
  },
  { 
    role: "Petugas Puskesmas", 
    email: "puskesmas@saestu.com", 
    password: "password123", 
    desc: "Monitoring wilayah & Posyandu", 
    icon: Building2, 
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200" 
  },
  { 
    role: "Kader Posyandu", 
    email: "kader@saestu.com", 
    password: "password123", 
    desc: "Input balita & antropometri", 
    icon: HeartHandshake, 
    badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200" 
  },
  { 
    role: "Orang Tua / Ibu", 
    email: "parent@saestu.com", 
    password: "password123", 
    desc: "Buku KMS digital & nutrisi anak", 
    icon: Users, 
    badgeColor: "bg-rose-100 text-rose-700 border-rose-200" 
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // [NEW LOGIC]: Cek status login saat ini
  const { userProfile, loading: authLoading } = useAuth();

  // [NEW EFFECT]: Auto-Redirect jika user sebenarnya sudah login
  useEffect(() => {
    if (!authLoading && userProfile) {
        if (userProfile.role === "master") router.push("/master");
        else if (userProfile.role === "puskesmas") router.push("/puskesmas");
        else if (userProfile.role === "kader") router.push("/posyandu");
        else if (userProfile.role === "parent") router.push("/parent");
    }
  }, [userProfile, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Login ke Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Ambil data jabatan (role) dari Firestore
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const role = docSnap.data().role;

        // 3. Arahkan sesuai jabatan (Smart Role Routing)
        if (role === "master") router.push("/master");
        else if (role === "puskesmas") router.push("/puskesmas");
        else if (role === "kader") router.push("/posyandu");
        else if (role === "parent") router.push("/parent");
        else router.push("/"); 
      } else {
        setError("Akun valid, tapi data profil tidak ditemukan.");
      }

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError("Email atau kata sandi yang Anda masukkan salah.");
      } else {
        setError("Terjadi kesalahan pada sistem. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Jika sistem masih mengecek status sesi (loading awal buka web)
  // Tampilkan layar loading polos agar form login tidak berkedip
  if (authLoading || userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
         <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col relative max-w-md mx-auto shadow-2xl">
      
      {/* 1. TOP HEADER BRANDING (NATIVE APP STYLE) */}
      <div className="h-[35vh] bg-gradient-to-br from-emerald-500 to-teal-700 relative overflow-hidden rounded-b-[2.5rem] flex flex-col items-center justify-center px-6 text-white shrink-0">
        
        {/* Dekorasi Latar Belakang */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-300/20 rounded-full blur-2xl"></div>

        <div className="relative z-10 flex flex-col items-center text-center -mt-4">
           <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/20 mb-4">
              <Activity className="h-8 w-8 text-white" />
           </div>
           <h1 className="text-3xl font-black tracking-tight leading-none mb-1">
              SAESTU
           </h1>
           <p className="text-teal-100 text-sm font-medium tracking-wide">
              Sistem Digital Posyandu Terpadu
           </p>
        </div>
      </div>

      {/* 2. OVERLAPPING FORM CARD */}
      <div className="flex-1 px-4 sm:px-6 -mt-12 relative z-20">
        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-6 sm:p-8 border border-slate-100">
            
            <div className="mb-8">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Selamat Datang!</h2>
               <p className="text-sm text-slate-500 mt-1 font-medium">Masuk untuk melanjutkan akses Anda.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
               <div className="space-y-4">
                  
                  {/* Field Email */}
                  <div>
                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label>
                     <div className="relative" ref={dropdownRef}>
                        <Input 
                           type="email" 
                           placeholder="Masukkan alamat email" 
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           required
                           className="h-14 bg-slate-50 border-slate-200 focus:bg-white text-sm rounded-2xl pr-12 w-full text-slate-900 font-medium placeholder:text-slate-400"
                        />
                        {/* Tombol Chevron Down Murni */}
                        <button 
                           type="button"
                           aria-label="Pilih akun demo"
                           onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                           className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-slate-400 hover:text-teal-600 transition-colors focus:outline-none"
                        >
                           <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                        </button>

                        {/* Custom Modern Dropdown Menu */}
                        {isDropdownOpen && (
                           <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                              <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                 Pilih Akun Demo Instan
                              </div>
                              {DEMO_ACCOUNTS.map((acc) => {
                                 const IconComponent = acc.icon;
                                 return (
                                    <button
                                       key={acc.email}
                                       type="button"
                                       onClick={() => {
                                          setEmail(acc.email);
                                          setPassword(acc.password);
                                          setError("");
                                          setIsDropdownOpen(false);
                                       }}
                                       className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-slate-50 transition-colors group"
                                    >
                                       <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${acc.badgeColor}`}>
                                          <IconComponent className="w-4 h-4" />
                                       </div>
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between">
                                             <p className="text-xs font-bold text-slate-900 group-hover:text-teal-700">
                                                {acc.role}
                                             </p>
                                          </div>
                                          <p className="text-[11px] font-mono text-slate-600 truncate mt-0.5">
                                             {acc.email}
                                          </p>
                                       </div>
                                       <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 shrink-0" />
                                    </button>
                                 );
                              })}
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Field Password */}
                  <div>
                     <div className="flex justify-between items-center mb-2 ml-1">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Kata Sandi</label>
                     </div>
                     <Input 
                        type="password" 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-14 bg-slate-50 border-slate-200 focus:bg-white text-sm tracking-widest rounded-2xl"
                     />
                  </div>
               </div>

               {/* Pesan Error Cerdas */}
               {error && (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-start gap-3 animate-in slide-in-from-top-2">
                     <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                     <span className="font-bold leading-relaxed">{error}</span>
                  </div>
               )}

               {/* Tombol Login */}
               <Button 
                  type="submit" 
                  className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-base shadow-lg shadow-slate-900/20 mt-2 flex items-center justify-center gap-2 transition-all active:scale-95" 
                  disabled={loading}
               >
                  {loading ? (
                     <Activity className="w-5 h-5 animate-spin" />
                  ) : (
                     <>
                        <Fingerprint className="w-5 h-5" />
                        Masuk Aplikasi
                     </>
                  )}
               </Button>
            </form>

        </div>

        {/* 3. BANTUAN / FOOTER BAWAH */}
        <div className="mt-8 text-center pb-8">
           <Link href="/" className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 px-4 py-2 rounded-full transition-colors">
              <span className="text-slate-500 font-medium">Lupa Kata Sandi?</span> Hubungi Admin <ChevronRight className="w-3 h-3" />
           </Link>
        </div>

      </div>
    </div>
  );
}