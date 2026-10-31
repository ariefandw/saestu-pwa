"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, deleteDoc, query, collection, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Child, Measurement } from "@/types/schema";
import { getMeasurementsByChild } from "@/lib/services/measurements";
import { deleteChild } from "@/lib/services/children"; 
import { calculateAgeInMonths } from "@/lib/who-standards";
import ChildMedicalHistory from "@/components/medical/ChildMedicalHistory";
import { 
  ArrowLeft, 
  Baby, 
  Calendar, 
  User,
  Trash2,
  Edit2,
  AlertCircle,
  FileText,
  Activity,
  Info,
  MapPin,
  Scale,
  CalendarDays,
  Hash,
  PenTool
} from "lucide-react";
import { cn } from "@/lib/utils";

// UI Components
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal"; 
import { Input } from "@/components/ui/Input"; 
import { Toast, ToastType } from "@/components/ui/Toast"; 

export default function ChildDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  // --- STATE DATA ---
  const [child, setChild] = useState<Child | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  // --- STATE UI ---
  const [activeTab, setActiveTab] = useState<"medical" | "details">("medical");

  // Edit Biodata State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "", nik: "", pob: "", dob: "", parentName: "",
  });

  // Edit/Delete Measurement State
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [measurementFormData, setMeasurementFormData] = useState({
    id: "", date: "", weight: "", height: "", notes: ""
  });

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: "", type: "success", isVisible: false,
  });

  const showToast = (message: string, type: ToastType = "success") => {
    setToast({ message, type, isVisible: true });
  };

  const ensureDate = (date: any): Date => {
    if (date instanceof Date) return date;
    if (date && typeof date.toDate === 'function') return date.toDate();
    return new Date(date);
  };

  const initData = async () => {
    if (!params.id) return;
    try {
      const childRef = doc(db, "children", params.id as string);
      const childSnap = await getDoc(childRef);
      
      if (childSnap.exists()) {
        const childData = { 
          id: childSnap.id, 
          ...childSnap.data(),
          dob: ensureDate(childSnap.data().dob)
        } as Child;
        setChild(childData);

        const history = await getMeasurementsByChild(childData.id);
        
        // Sorting manual untuk berjaga-jaga
        const sortedHistory = history.sort((a, b) => {
           const dateA = ensureDate(a.date).getTime();
           const dateB = ensureDate(b.date).getTime();
           return dateB - dateA; // Descending (terbaru di atas)
        });
        
        setMeasurements(sortedHistory);
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal memuat rekam medis.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initData();
  }, [params.id]);

  // --- SINKRONISASI DATA TERAKHIR KE DOKUMEN ANAK ---
  const syncChildLastStatus = async (childId: string) => {
    const mRef = collection(db, "measurements");
    const q = query(mRef, where("childId", "==", childId), orderBy("date", "desc"), limit(1));
    const snap = await getDocs(q);
    
    const childRef = doc(db, "children", childId);
    if (!snap.empty) {
      const last = snap.docs[0].data() as Measurement;
      await updateDoc(childRef, {
        lastWeight: last.weight,
        lastHeight: last.height,
        lastWeightStatus: last.weightStatus,
        lastLengthStatus: last.lengthStatus,
        lastMeasurementDate: last.date
      });
    } else {
      await updateDoc(childRef, {
        lastWeight: null,
        lastHeight: null,
        lastWeightStatus: "unknown",
        lastLengthStatus: "unknown",
        lastMeasurementDate: null
      });
    }
  };

  // --- HANDLER HAPUS DATA ANAK ---
  const handleDeleteChild = async () => {
    if (!child) return;
    if (confirm(`PERINGATAN: Anda yakin ingin menghapus seluruh data rekam medis ${child.name}? Tindakan ini tidak bisa dibatalkan.`)) {
      try {
        await deleteChild(child.id);
        router.replace("/posyandu/children");
      } catch (err) {
        console.error(err);
        showToast("Terjadi kesalahan saat menghapus data anak.", "error");
      }
    }
  };

  // --- HANDLER EDIT BIODATA ---
  const handleOpenEdit = () => {
    if (!child) return;
    const dobDate = ensureDate(child.dob);
    const dobString = dobDate.toISOString().split('T')[0];

    setEditFormData({
      name: child.name, nik: child.nik || "", pob: child.pob || "",
      dob: dobString, parentName: child.parentName || "",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!child) return;
    setIsEditing(true);

    try {
      const childRef = doc(db, "children", child.id);
      const updatedDob = new Date(editFormData.dob);
      const updatePayload = {
        name: editFormData.name, 
        nik: editFormData.nik, 
        pob: editFormData.pob,
        dob: updatedDob, 
        parentName: editFormData.parentName
      };

      await updateDoc(childRef, updatePayload);
      setChild({ ...child, ...updatePayload });
      setIsEditModalOpen(false);
      showToast("Biodata berhasil diperbarui! ✅", "success");
    } catch (error) {
      showToast("Gagal memperbarui biodata.", "error");
    } finally {
      setIsEditing(false);
    }
  };

  // --- HANDLER HAPUS MEASUREMENT ---
  const handleDeleteMeasurement = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus riwayat pengukuran ini?")) {
      try {
        await deleteDoc(doc(db, "measurements", id));
        showToast("Riwayat pengukuran dihapus.", "success");
        await syncChildLastStatus(params.id as string);
        initData(); 
      } catch (error) {
        showToast("Gagal menghapus riwayat.", "error");
      }
    }
  };

  // --- HANDLER EDIT MEASUREMENT ---
  const handleOpenEditMeasurement = (m: Measurement) => {
    const d = ensureDate(m.date);
    const dateString = d.toISOString().split('T')[0];
    
    setMeasurementFormData({
      id: m.id,
      date: dateString,
      weight: m.weight.toString(),
      height: m.height.toString(),
      notes: m.notes || ""
    });
    setIsMeasurementModalOpen(true);
  };

  const handleMeasurementEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMeasurement(true);
    try {
      const mRef = doc(db, "measurements", measurementFormData.id);
      const updatedDate = new Date(measurementFormData.date);
      const updatedWeight = parseFloat(measurementFormData.weight);
      const updatedHeight = parseFloat(measurementFormData.height);

      await updateDoc(mRef, {
        date: updatedDate,
        weight: updatedWeight,
        height: updatedHeight,
        notes: measurementFormData.notes
      });

      setIsMeasurementModalOpen(false);
      showToast("Koreksi data berhasil disimpan! ✅", "success");
      await syncChildLastStatus(params.id as string);
      initData(); 
    } catch (error) {
      showToast("Gagal mengoreksi data.", "error");
    } finally {
      setIsSavingMeasurement(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 border-4 border-teal-100 rounded-full relative">
           <div className="absolute inset-[-4px] border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Menyiapkan Rekam Medis</p>
      </div>
    </div>
  );

  if (!child) return <div className="p-8 text-center text-slate-500 font-bold">Rekam medis tidak ditemukan.</div>;

  const currentAge = calculateAgeInMonths(ensureDate(child.dob));

  return (
    <div className="bg-slate-50 min-h-screen pb-28 font-sans">
      
      {/* 1. COMPACT HEADER NAVIGASI */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button 
            onClick={() => router.back()} 
            className="p-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600 transition-colors active:scale-95 border border-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-slate-800 text-base leading-tight">Rekam Medis Anak</h1>
            <p className="text-[9px] text-teal-600 font-bold uppercase tracking-widest flex items-center gap-1">
               <Info className="w-3 h-3" /> Panel Kader Digital
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        
        {/* 2. HERO PROFILE CARD */}
        <Card className="bg-white overflow-hidden relative border-slate-100 shadow-sm p-5 sm:p-6 rounded-[2rem]">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Baby className="w-40 h-40 text-teal-900 transform rotate-12" />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 relative z-10 text-center sm:text-left">
            <div className={cn(
              "w-20 h-20 sm:w-24 sm:h-24 rounded-[1.5rem] flex items-center justify-center text-4xl sm:text-5xl font-black text-white shadow-xl shadow-slate-200 shrink-0",
              child.gender === 'L' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-pink-400 to-pink-600'
            )}>
              {child.name.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1 min-w-0 w-full">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 truncate tracking-tight uppercase mb-1">{child.name}</h2>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-4">
                <Badge variant="neutral" className="bg-slate-50 text-slate-600 border-slate-200 py-1 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-teal-500" /> {currentAge} Bulan
                </Badge>
                <Badge variant="neutral" className="bg-slate-50 text-slate-600 border-slate-200 py-1 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                  <User className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> {child.parentName}
                </Badge>
              </div>

              <div className="flex gap-2 justify-center sm:justify-start">
                 <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleOpenEdit}
                  className="rounded-xl border-slate-200 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-colors font-bold px-4 h-10 w-full sm:w-auto"
                 >
                   <Edit2 className="w-4 h-4 mr-2" /> Edit Biodata
                 </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. SEGMENTED TABS NAVIGATOR */}
        <div className="flex p-1.5 bg-slate-100 rounded-[1.25rem] border border-slate-200">
           <button 
            onClick={() => setActiveTab("medical")}
            className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all duration-300 tracking-wider uppercase",
                activeTab === "medical" ? "bg-white text-teal-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
           >
              <Activity className="w-4 h-4" /> Medis & Grafik
           </button>
           <button 
            onClick={() => setActiveTab("details")}
            className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black transition-all duration-300 tracking-wider uppercase",
                activeTab === "details" ? "bg-white text-blue-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
           >
              <FileText className="w-4 h-4" /> Detail Identitas
           </button>
        </div>

        {/* --- TAB CONTENT: MEDICAL HISTORY --- */}
        {activeTab === "medical" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ChildMedicalHistory 
                child={child}
                measurements={measurements}
                onAddMeasurement={() => router.push(`/posyandu/children/${child.id}/measure`)}
                onEditMeasurement={handleOpenEditMeasurement}
                onDeleteMeasurement={handleDeleteMeasurement}
            />
          </div>
        )}

        {/* --- TAB CONTENT: BIODATA DETAILS --- */}
        {activeTab === "details" && (
          <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
            <Card className="p-6 sm:p-8 rounded-[2rem] border-slate-100 shadow-sm bg-white">
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-6">
                   <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Info className="w-5 h-5" /></div>
                   <div>
                      <h3 className="font-black text-slate-800 text-base">Informasi Identitas</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Data kependudukan awal</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                    <InfoItem label="NIK Anak" value={child.nik || "Tidak tersedia"} icon={Hash} />
                    <InfoItem label="Nama Orang Tua" value={child.parentName} icon={User} />
                    <InfoItem label="Tempat Lahir" value={child.pob || "Tidak tersedia"} icon={MapPin} />
                    <InfoItem label="Tanggal Lahir" value={ensureDate(child.dob).toLocaleDateString('id-ID', { dateStyle: 'long' })} icon={CalendarDays} />
                    <div className="h-px bg-slate-50 col-span-1 sm:col-span-2 my-2"></div>
                    <InfoItem label="Berat Lahir Awal" value={`${child.initialWeight} kg`} icon={Scale} />
                    <InfoItem label="Panjang Lahir Awal" value={`${child.initialHeight} cm`} icon={Activity} />
                </div>

                {/* DANGER ZONE */}
                <div className="mt-10 pt-6 border-t border-rose-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-rose-50/50 p-6 rounded-3xl">
                    <div className="space-y-1.5">
                        <p className="text-xs font-black text-rose-700 flex items-center gap-1.5 uppercase tracking-widest">
                           <AlertCircle className="w-4 h-4" /> Zona Berbahaya
                        </p>
                        <p className="text-[11px] text-rose-600/80 font-medium leading-relaxed max-w-sm">
                           Hapus akun akan menghilangkan rekam jejak grafik dan data ukur secara permanen.
                        </p>
                    </div>
                    <Button 
                        variant="danger" 
                        onClick={handleDeleteChild}
                        className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white border-0 font-black px-6 h-12 rounded-xl shadow-lg shadow-rose-200 transition-all hover:scale-105 active:scale-95 shrink-0"
                    >
                        <Trash2 className="w-4 h-4 mr-2" /> Hapus Data
                    </Button>
                </div>
            </Card>
          </div>
        )}
      </div>

      {/* --- MODAL EDIT BIODATA NATIVE STYLE --- */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Biodata Anak">
        <form onSubmit={handleEditSubmit} className="space-y-5 px-1 pb-1">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
            <div className="relative">
               <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
               <Input 
                 required 
                 value={editFormData.name} 
                 onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} 
                 className="bg-slate-50 border-slate-200 focus:bg-white h-14 pl-11 rounded-2xl text-sm font-medium" 
               />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">NIK</label>
                <Input 
                  value={editFormData.nik} 
                  // [FIX TERHADAP ERROR]: Diubah menjadi setEditFormData
                  onChange={(e) => setEditFormData({...editFormData, nik: e.target.value})} 
                  className="bg-slate-50 border-slate-200 focus:bg-white h-14 rounded-2xl font-mono text-sm" 
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tgl Lahir</label>
                <Input 
                  type="date" 
                  required 
                  value={editFormData.dob} 
                  onChange={(e) => setEditFormData({...editFormData, dob: e.target.value})} 
                  className="bg-slate-50 border-slate-200 focus:bg-white h-14 rounded-2xl text-sm font-medium text-slate-700" 
                />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tempat Lahir</label>
            <div className="relative">
               <MapPin className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
               <Input 
                 value={editFormData.pob} 
                 onChange={(e) => setEditFormData({...editFormData, pob: e.target.value})} 
                 className="bg-slate-50 border-slate-200 focus:bg-white h-14 pl-11 rounded-2xl text-sm font-medium" 
               />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Orang Tua/Wali</label>
            <div className="relative">
               <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
               <Input 
                 required 
                 value={editFormData.parentName} 
                 onChange={(e) => setEditFormData({...editFormData, parentName: e.target.value})} 
                 className="bg-slate-50 border-slate-200 focus:bg-white h-14 pl-11 rounded-2xl text-sm font-medium" 
               />
            </div>
          </div>

          <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 border-t border-slate-100">
            <Button type="button" variant="outline" className="h-12 rounded-xl text-slate-600 font-bold hover:bg-slate-50 w-full sm:w-auto" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            <Button type="submit" isLoading={isEditing} className="h-12 bg-teal-600 hover:bg-teal-700 text-white px-8 shadow-lg shadow-teal-200 rounded-xl font-black w-full sm:w-auto">Simpan Perubahan</Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL KOREKSI MEASUREMENT NATIVE STYLE --- */}
      <Modal isOpen={isMeasurementModalOpen} onClose={() => setIsMeasurementModalOpen(false)} title="Koreksi Data Pengukuran">
        <form onSubmit={handleMeasurementEditSubmit} className="space-y-5 px-1 pb-1">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3 mb-2 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
              <strong>Peringatan Sistem:</strong> Perubahan angka berat/tinggi badan akan memicu kalkulasi ulang status gizi dan kurva pertumbuhan (Z-Score) secara otomatis.
            </p>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal Kunjungan</label>
            <Input 
               type="date" required 
               value={measurementFormData.date} 
               onChange={(e) => setMeasurementFormData({...measurementFormData, date: e.target.value})} 
               className="bg-slate-50 border-slate-200 focus:bg-white h-14 rounded-2xl text-sm font-medium text-slate-700" 
            />
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Berat (kg)</label>
                <Input 
                  type="number" step="0.01" required 
                  value={measurementFormData.weight} 
                  onChange={(e) => setMeasurementFormData({...measurementFormData, weight: e.target.value})} 
                  className="bg-white border-emerald-200 text-center font-black text-lg h-14 rounded-xl focus:ring-emerald-500/30" 
                />
            </div>
            <div className="space-y-1.5">
                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Tinggi (cm)</label>
                <Input 
                  type="number" step="0.1" required 
                  value={measurementFormData.height} 
                  onChange={(e) => setMeasurementFormData({...measurementFormData, height: e.target.value})} 
                  className="bg-white border-blue-200 text-center font-black text-lg h-14 rounded-xl focus:ring-blue-500/30" 
                />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Catatan Tambahan</label>
            <div className="relative">
               <PenTool className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
               <Input 
                 placeholder="Opsional..."
                 value={measurementFormData.notes} 
                 onChange={(e) => setMeasurementFormData({...measurementFormData, notes: e.target.value})} 
                 className="bg-slate-50 border-slate-200 focus:bg-white h-14 pl-11 rounded-2xl text-sm font-medium" 
               />
            </div>
          </div>
          
          <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-6 border-t border-slate-100">
            <Button type="button" variant="outline" className="h-12 rounded-xl text-slate-600 font-bold hover:bg-slate-50 w-full sm:w-auto" onClick={() => setIsMeasurementModalOpen(false)}>Batal</Button>
            <Button type="submit" isLoading={isSavingMeasurement} className="h-12 bg-blue-600 hover:bg-blue-700 text-white px-8 shadow-lg shadow-blue-200 rounded-xl font-black w-full sm:w-auto">Perbarui Angka</Button>
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

function InfoItem({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
    return (
        <div className="flex items-start gap-4 group">
            <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 border border-slate-100 group-hover:text-teal-500 group-hover:bg-teal-50 transition-colors">
                <Icon className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{label}</p>
                <p className="text-sm font-extrabold text-slate-800 leading-tight uppercase truncate">{value}</p>
            </div>
        </div>
    )
}