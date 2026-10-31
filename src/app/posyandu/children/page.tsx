"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  Plus, 
  Search, 
  Baby, 
  ChevronRight, 
  Filter,
  Calendar,
  User as UserIcon,
  Users, // [FIX]: Tambahkan Users di sini
  MapPin,
  Scale,
  ArrowUpDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Toast, ToastType } from "@/components/ui/Toast";

// Services
import { getChildrenByPosyandu, addChild, CreateChildInput } from "@/lib/services/children";
import { getParentsByPosyandu } from "@/lib/services/parents";
import { Child, UserProfile } from "@/types/schema";
import { calculateAgeInMonths } from "@/lib/who-standards";
import { cn } from "@/lib/utils";

export default function ChildrenPage() {
  const router = useRouter();
  const { userProfile } = useAuth();
  
  // Data State
  const [children, setChildren] = useState<Child[]>([]);
  const [parents, setParents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "L" | "P">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "normal" | "waspada" | "unmeasured">("all");
  const [sortBy, setSortBy] = useState<"newest" | "nameAsc" | "ageAsc">("newest");

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: "",
    type: "success",
    isVisible: false,
  });

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type, isVisible: true });
  };

  // Form State
  const [formData, setFormData] = useState<CreateChildInput>({
    name: "", nik: "", gender: "L", pob: "", dob: "",
    parentName: "", parentId: "", posyanduId: "",
    initialWeight: 0, initialHeight: 0,
  });

  const fetchData = async () => {
    if (!userProfile?.posyanduId) return;
    try {
      const [childrenData, parentsData] = await Promise.all([
        getChildrenByPosyandu(userProfile.posyanduId),
        getParentsByPosyandu(userProfile.posyanduId)
      ]);
      setChildren(childrenData);
      setParents(parentsData);
    } catch (err) {
      console.error(err);
      showToast("Gagal mengambil data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.posyanduId) return;

    setIsSubmitting(true);
    try {
      let parentName = formData.parentName;
      if (formData.parentId) {
        const selectedParent = parents.find(p => p.uid === formData.parentId);
        if (selectedParent) parentName = selectedParent.name;
      }

      await addChild({
        ...formData,
        posyanduId: userProfile.posyanduId,
        parentName: parentName,
      });
      
      await fetchData();
      setIsModalOpen(false);
      resetForm();
      showToast("Data Balita berhasil ditambahkan! 🎉", "success");
    } catch (err) {
      showToast("Gagal menambah data anak.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "", nik: "", gender: "L", pob: "", dob: "",
      parentName: "", parentId: "", posyanduId: "",
      initialWeight: 0, initialHeight: 0
    });
  };

  // -------------------------------------------------------------
  // LOGIKA SMART FILTERING & SORTING (ENTERPRISE)
  // -------------------------------------------------------------
  const processedChildren = useMemo(() => {
    let result = [...children];

    // 1. Search Filter
    if (searchTerm) {
        result = result.filter(c => 
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.nik.includes(searchTerm)
        );
    }

    // 2. Gender Filter
    if (genderFilter !== "all") {
        result = result.filter(c => c.gender === genderFilter);
    }

    // 3. Status Filter
    if (statusFilter !== "all") {
        result = result.filter(c => {
           const hasData = Boolean(
             (c.lastWeight !== undefined && c.lastWeight !== null && c.lastWeight > 0) ||
             (c.lastHeight !== undefined && c.lastHeight !== null && c.lastHeight > 0) ||
             c.lastMeasurementDate ||
             (c.lastWeightStatus && c.lastWeightStatus !== 'unknown') ||
             c.lastNutritionStatus
           );

           if (statusFilter === "unmeasured") return !hasData;
           if (!hasData) return false;

           const isWaspada = c.lastWeightStatus === 'inadequate' || c.lastLengthStatus === 'inadequate' || c.isStunted || c.isWasted;
           if (statusFilter === "waspada") return isWaspada;
           if (statusFilter === "normal") return !isWaspada && c.lastWeightStatus !== 'excess';
           return true;

        });
    }

    // 4. Sort Filter
    if (sortBy === "nameAsc") {
        result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "ageAsc") {
        result.sort((a, b) => {
           const ageA = calculateAgeInMonths(a.dob instanceof Date ? a.dob : (a.dob as any).toDate());
           const ageB = calculateAgeInMonths(b.dob instanceof Date ? b.dob : (b.dob as any).toDate());
           return ageA - ageB;
        });
    }

    return result;
  }, [children, searchTerm, genderFilter, statusFilter, sortBy]);


  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans pb-28 max-w-4xl mx-auto">
      
      {/* 1. COMPACT HERO SECTION */}
      <div className="relative rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 p-6 sm:p-8 shadow-lg shadow-teal-500/20 overflow-hidden">
        
        <div className="absolute top-[-20%] right-[-5%] w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-4 right-4 opacity-20 pointer-events-none">
           <Baby className="w-32 h-32 text-white transform rotate-12" />
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
           <div className="space-y-2 w-full">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-widest">
                 <MapPin className="w-3 h-3" /> Data Wilayah
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">Manajemen Balita</h1>
              <p className="text-teal-50 text-xs sm:text-sm max-w-md leading-relaxed font-medium">
                 Kelola data tumbuh kembang anak secara digital, akurat, dan terintegrasi untuk generasi bebas stunting.
              </p>
           </div>

           <div className="flex flex-row sm:flex-col gap-3 w-full sm:w-auto shrink-0">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex-1 sm:flex-none">
                 <div className="bg-white/20 p-2 rounded-xl text-white">
                    <Users className="w-5 h-5" />
                 </div>
                 <div>
                    <p className="text-[10px] text-teal-100 font-bold uppercase tracking-widest">Total Anak</p>
                    <p className="text-xl font-black text-white leading-none mt-0.5">{children.length}</p>
                 </div>
              </div>

              <Button 
                 className="h-auto py-3 bg-white text-teal-700 hover:bg-teal-50 active:scale-95 border-0 shadow-lg font-black transition-transform flex-1 sm:flex-none rounded-xl"
                 onClick={() => setIsModalOpen(true)}
              >
                 <Plus className="h-5 w-5 mr-1" />
                 Balita Baru
              </Button>
           </div>
        </div>
      </div>

      {/* 2. STICKY TOOLS SECTION (SEARCH & FILTER) */}
      <div className="sticky top-[60px] md:top-0 z-20 bg-slate-50/90 backdrop-blur-xl py-3 -mx-4 px-4 sm:mx-0 sm:px-0 space-y-3 shadow-sm border-b border-slate-200/50 md:border-0 md:shadow-none md:bg-transparent">
        
        {/* Search Bar */}
        <div className="relative shadow-sm rounded-2xl group transition-shadow focus-within:shadow-md bg-white">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center text-slate-400 group-focus-within:text-teal-500 transition-colors">
            <Search className="h-5 w-5" />
          </div>
          <Input 
            placeholder="Cari nama balita atau NIK..." 
            className="pl-12 h-14 rounded-2xl border-slate-200 bg-transparent focus:bg-white focus:ring-2 focus:ring-teal-500/20 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter & Sort Bar (Scrollable X on Mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-500 shrink-0 hover:bg-slate-50 transition-colors">
               <ArrowUpDown className="w-4 h-4" />
               <select 
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer appearance-none pr-4"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
               >
                  <option value="newest">Terbaru</option>
                  <option value="nameAsc">A - Z</option>
                  <option value="ageAsc">Usia Termuda</option>
               </select>
            </div>
            
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-500 shrink-0 hover:bg-slate-50 transition-colors">
               <Filter className="w-4 h-4" />
               <select 
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer appearance-none pr-4"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
               >
                  <option value="all">Semua Status</option>
                  <option value="waspada">⚠️ Waspada / Pantau</option>
                  <option value="normal">✅ Normal</option>
                  <option value="unmeasured">Belum Ada Data</option>
               </select>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-500 shrink-0 hover:bg-slate-50 transition-colors">
               <Baby className="w-4 h-4" />
               <select 
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer appearance-none pr-4"
                  value={genderFilter}
                  onChange={(e) => setGenderFilter(e.target.value as any)}
               >
                  <option value="all">Semua Gender</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
               </select>
            </div>

            {/* Total Results Badge */}
            <div className="ml-auto bg-teal-50 text-teal-600 px-3 py-2 rounded-xl text-xs font-black border border-teal-100 shrink-0">
                {processedChildren.length} Hasil
            </div>
        </div>
      </div>

      {/* 3. LIST CONTENT */}
      <div className="space-y-3">
        {loading ? (
          // SKELETON LOADER
          [1, 2, 3].map((i) => (
            <Card key={i} className="flex gap-4 items-center animate-pulse border-slate-100 p-4 rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-slate-100"></div>
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-slate-100 rounded-md w-1/3"></div>
                <div className="h-3 bg-slate-100 rounded-md w-1/4"></div>
              </div>
            </Card>
          ))
        ) : processedChildren.length === 0 ? (
          // EMPTY STATE
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border border-dashed border-slate-200 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
               <Baby className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-slate-800 font-black text-lg">Pencarian Kosong</h3>
            <p className="text-slate-500 text-sm max-w-xs mx-auto mt-1 leading-relaxed">
              Tidak ada balita yang cocok dengan filter atau kata kunci Anda.
            </p>
          </div>
        ) : (
          // DATA LIST (CONTACT STYLE)
          processedChildren.map((child) => {
            const age = calculateAgeInMonths(child.dob instanceof Date ? child.dob : (child.dob as any).toDate());
            const hasData = Boolean(
              (child.lastWeight !== undefined && child.lastWeight !== null && child.lastWeight > 0) ||
              (child.lastHeight !== undefined && child.lastHeight !== null && child.lastHeight > 0) ||
              child.lastMeasurementDate ||
              (child.lastWeightStatus && child.lastWeightStatus !== 'unknown') ||
              child.lastNutritionStatus
            );

            const isWaspada = hasData && (
              child.lastLengthStatus === 'inadequate' || 
              child.lastWeightStatus === 'inadequate' || 
              child.isStunted || 
              child.isWasted
            );

            const isExcess = hasData && !isWaspada && child.lastWeightStatus === 'excess';
            
            return (
              <Card 
                key={child.id} 
                onClick={() => router.push(`/posyandu/children/${child.id}`)}
                className="group relative cursor-pointer active:scale-[0.99] transition-all border-slate-100 hover:border-teal-300 rounded-2xl p-3 sm:p-4 bg-white shadow-sm"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar Gender (Warna dinamis L/P) */}
                  <div className={cn(
                    "h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-black text-white shadow-sm shrink-0",
                    child.gender === 'L' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-pink-400 to-pink-500'
                  )}>
                    {child.name.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0">
                           <h3 className="font-black text-slate-800 text-sm sm:text-base truncate group-hover:text-teal-700 transition-colors">
                             {child.name}
                           </h3>
                           <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate mt-0.5">
                             NIK: {child.nik || "-"}
                           </p>
                        </div>
                        {/* Status Badge: Yang ada datanya ada statusnya, yang tidak ada datanya tidak ada statusnya */}
                        {hasData && (
                          isWaspada ? (
                            <Badge variant="danger" className="text-[9px] px-2 h-5 border-0 animate-pulse bg-rose-100 text-rose-700 shrink-0">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Waspada
                            </Badge>

                          ) : isExcess ? (
                            <Badge variant="warning" className="text-[9px] px-2 h-5 border-0 bg-amber-100 text-amber-700 shrink-0">
                              <AlertCircle className="w-3 h-3 mr-1" /> Berlebih
                            </Badge>

                          ) : (
                            <Badge variant="success" className="text-[9px] px-2 h-5 border-0 bg-emerald-100 text-emerald-700 shrink-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Normal
                            </Badge>

                          )

                        )}
                    </div>
                    
                    {/* Meta Info Box */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" /> {age} Bln
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold text-slate-600">
                        <Scale className="w-3 h-3 text-slate-400" /> {child.lastWeight ? `${child.lastWeight} kg` : "-"}
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold text-slate-600 truncate max-w-[100px] sm:max-w-none">
                        <UserIcon className="w-3 h-3 text-slate-400" /> {child.parentName || "Tanpa Ortu"}
                      </div>
                    </div>
                  </div>

                  {/* Action Arrow */}
                  <div className="text-slate-300 group-hover:text-teal-500 transition-colors group-hover:translate-x-1 shrink-0 hidden sm:block">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* --- MODAL TAMBAH NATIVE STYLE --- */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Registrasi Balita Baru"
      >
        <form onSubmit={handleSubmit} className="space-y-6 px-1 pb-1">
          
          {/* Section 1: Identitas Dasar */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="bg-teal-50 text-teal-600 p-1.5 rounded-lg"><Baby className="w-4 h-4" /></div>
                <h3 className="font-black text-slate-800 text-sm">Identitas Dasar</h3>
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
                <Input 
                  required 
                  placeholder="Contoh: Budi Santoso"
                  className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-14 rounded-2xl text-sm font-medium"
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                />
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">NIK (Opsional)</label>
                   <Input 
                      placeholder="16 Digit NIK"
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-14 rounded-2xl font-mono text-sm"
                      value={formData.nik} 
                      onChange={(e) => setFormData({...formData, nik: e.target.value})} 
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Jenis Kelamin</label>
                   <div className="relative">
                      <select 
                        className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-teal-500/20 outline-none px-4 text-sm font-bold appearance-none cursor-pointer text-slate-700"
                        value={formData.gender} 
                        onChange={(e) => setFormData({...formData, gender: e.target.value as "L"|"P"})}
                      >
                        <option value="L">Laki-laki</option>
                        <option value="P">Perempuan</option>
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                   </div>
                </div>
             </div>
          </div>

          {/* Section 2: Kelahiran */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg"><Calendar className="w-4 h-4" /></div>
                <h3 className="font-black text-slate-800 text-sm">Data Kelahiran</h3>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tempat Lahir</label>
                   <Input 
                      placeholder="Nama Kota"
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-14 rounded-2xl text-sm font-medium"
                      value={formData.pob} 
                      onChange={(e) => setFormData({...formData, pob: e.target.value})} 
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal Lahir</label>
                   <Input 
                      type="date" 
                      required 
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-14 rounded-2xl text-sm font-medium text-slate-700"
                      value={formData.dob} 
                      onChange={(e) => setFormData({...formData, dob: e.target.value})} 
                   />
                </div>
             </div>

             <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-teal-700 uppercase tracking-widest ml-1">Berat Lahir (kg)</label>
                   <Input 
                      type="number" step="0.01" required 
                      placeholder="0.00"
                      className="bg-white border-teal-200 text-center font-black text-lg h-14 rounded-xl focus:ring-teal-500/30"
                      value={formData.initialWeight || ""} 
                      onChange={(e) => setFormData({...formData, initialWeight: parseFloat(e.target.value)})} 
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-black text-teal-700 uppercase tracking-widest ml-1">Panjang Lahir (cm)</label>
                   <Input 
                      type="number" step="0.1" required 
                      placeholder="0.0"
                      className="bg-white border-teal-200 text-center font-black text-lg h-14 rounded-xl focus:ring-teal-500/30"
                      value={formData.initialHeight || ""} 
                      onChange={(e) => setFormData({...formData, initialHeight: parseFloat(e.target.value)})} 
                   />
                </div>
             </div>
          </div>

          {/* Section 3: Orang Tua */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="bg-orange-50 text-orange-600 p-1.5 rounded-lg"><UserIcon className="w-4 h-4" /></div>
                <h3 className="font-black text-slate-800 text-sm">Orang Tua / Wali</h3>
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tautkan ke Akun Ortu</label>
                <div className="relative">
                   <select 
                      className="w-full h-14 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-teal-500/20 outline-none px-4 text-sm font-bold appearance-none cursor-pointer text-slate-700"
                      value={formData.parentId} 
                      onChange={(e) => setFormData({...formData, parentId: e.target.value})}
                   >
                      <option value="">-- Input Manual (Belum Punya Akun) --</option>
                      {parents.map(p => <option key={p.uid} value={p.uid}>{p.name} ({p.email})</option>)}
                   </select>
                   <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-400 px-1 mt-1 font-medium">Memilih dari daftar akan mengizinkan orang tua mengakses data anak di HP mereka.</p>
             </div>
             
             {!formData.parentId && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Ibu / Wali (Manual)</label>
                   <Input 
                      required={!formData.parentId} 
                      placeholder="Masukkan nama wali..."
                      className="bg-slate-50 border-slate-200 focus:bg-white transition-all h-14 rounded-2xl text-sm font-medium"
                      value={formData.parentName} 
                      onChange={(e) => setFormData({...formData, parentName: e.target.value})} 
                   />
                </div>
             )}
          </div>

          <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 border-t border-slate-100">
            <Button 
               type="button" 
               variant="outline" 
               className="h-12 rounded-xl text-slate-600 border-slate-200 font-bold hover:bg-slate-50 w-full sm:w-auto"
               onClick={() => setIsModalOpen(false)}
            >
               Batal
            </Button>
            <Button 
               type="submit" 
               isLoading={isSubmitting}
               className="h-12 bg-teal-600 hover:bg-teal-700 px-8 text-white font-black shadow-lg shadow-teal-200 rounded-xl w-full sm:w-auto"
            >
               Simpan Data Balita
            </Button>
          </div>
        </form>
      </Modal>

      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />
    </div>
  );
}