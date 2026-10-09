import { Timestamp } from "firebase/firestore";

// --- USER & AUTH ---
export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: "master" | "puskesmas" | "kader" | "parent";
  posyanduId?: string; 
  puskesmasId?: string; // Menghubungkan akun petugas dengan entitas Puskesmas
  createdAt: Timestamp | Date;
}

// --- [BARU] ENTITAS PUSKESMAS ---
// Dibuat oleh Master Admin untuk mendefinisikan wilayah kerja
export interface Puskesmas {
  id: string;
  name: string;
  address: string;
  headName: string; // Nama Kepala Puskesmas
  district: string; // Kecamatan
  createdAt: Timestamp | Date;
}

// --- MASTER DATA POSYANDU ---
export interface Posyandu {
  id: string;
  name: string;
  village: string;
  district: string;
  address: string;
  puskesmasId: string; // WAJIB: Penanda Posyandu ini di bawah Puskesmas mana
  createdAt: Timestamp | Date;
}

// --- DATA ANAK ---
export interface Child {
  id: string;
  name: string;
  nik: string;
  gender: "L" | "P";
  pob: string; 
  dob: Timestamp | Date;
  
  parentName: string;
  parentId?: string; 
  
  posyanduId: string;
  initialWeight: number;
  initialHeight: number;
  createdAt: Timestamp | Date;

  lastWeightStatus?: "adequate" | "inadequate" | "excess" | "unknown";
  lastLengthStatus?: "adequate" | "inadequate" | "unknown";
  lastMeasurementDate?: Timestamp | Date;

  lastWeight?: number;
  lastHeight?: number;

  // --- [Z-SCORE STANDARDS] Antropometri Kemenkes & WHO ---
  lastZScoreWFA?: number; // BB/U
  lastZScoreHFA?: number; // TB/U (Stunting Indicator)
  lastZScoreWFH?: number; // BB/TB (Wasting Indicator)
  lastNutritionStatus?: string;
  isStunted?: boolean;
  isWasted?: boolean;
}

// --- PENGUKURAN (CORE LOGIC) ---
export interface Measurement {
  id: string;
  childId: string;
  posyanduId: string;
  date: Timestamp | Date; 
  ageInMonths: number;    
  
  weight: number;          
  height: number;          
  headCircumference?: number; 

  weightStatus: "adequate" | "inadequate" | "excess" | "unknown";
  lengthStatus: "adequate" | "inadequate" | "excess" | "unknown";
  
  weightIncrement?: number; 
  lengthIncrement?: number; 

  // --- [Z-SCORE ENGINE] WHO 2006 & Permenkes No. 2/2020 ---
  zScoreWFA?: number; // Berat Badan menurut Umur (BB/U)
  zScoreHFA?: number; // Tinggi/Panjang Badan menurut Umur (TB/U - Indikator Stunting)
  zScoreWFH?: number; // Berat Badan menurut Tinggi Badan (BB/TB - Indikator Wasting)
  zScoreHCFA?: number; // Lingkar Kepala menurut Umur (LK/U)

  wfaStatus?: "severely_underweight" | "underweight" | "normal" | "overweight_risk";
  hfaStatus?: "severely_stunted" | "stunted" | "normal" | "tall";
  wfhStatus?: "severely_wasted" | "wasted" | "normal" | "overweight_risk" | "overweight" | "obese";
  nutritionSummary?: string;
  
  notes?: string;          
  createdAt: Timestamp | Date;
  createdBy: string;       
}

// --- LOG INTERVENSI PUSKESMAS ---
export interface InterventionLog {
  id: string;
  childId: string;
  posyanduId: string;
  puskesmasId: string;
  type: "pmt" | "kunjungan" | "edukasi" | "rujukan";
  notes: string;
  date: Timestamp | Date;
  status: "pending" | "completed";
  createdAt: Timestamp | Date;
  createdBy: string;
}

// --- DATABASE MAKANAN LOKAL ---
export interface MasterFood {
  id: string;
  code: string;       
  name: string;       
  energyKJ: number;   
  protein: number;    
  fat: number;        
  carbs: number;      
  puskesmasId: string; 
  createdAt: Timestamp | Date;
}