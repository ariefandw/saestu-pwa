// WHO Growth Standards Engine - Main Controller (REVISED)
import { differenceInDays, differenceInMonths } from "date-fns";

// Import Semua Data Weight
import { GIRLS_1MO_INCREMENT_PERCENTILES } from "./weight-velocity/girls-1mo-percentiles";
import { BOYS_1MO_INCREMENT_PERCENTILES } from "./weight-velocity/boys-1mo-percentiles";
import { GIRLS_2MO_INCREMENT_PERCENTILES } from "./weight-velocity/girls-2mo-percentiles";
import { BOYS_2MO_INCREMENT_PERCENTILES } from "./weight-velocity/boys-2mo-percentiles";
import { GIRLS_3MO_INCREMENT_PERCENTILES } from "./weight-velocity/girls-3mo-percentiles";
import { BOYS_3MO_INCREMENT_PERCENTILES } from "./weight-velocity/boys-3mo-percentiles";
import { GIRLS_4MO_INCREMENT_PERCENTILES } from "./weight-velocity/girls-4mo-percentiles";
import { BOYS_4MO_INCREMENT_PERCENTILES } from "./weight-velocity/boys-4mo-percentiles";
import { GIRLS_6MO_INCREMENT_PERCENTILES } from "./weight-velocity/girls-6mo-percentiles";
import { BOYS_6MO_INCREMENT_PERCENTILES } from "./weight-velocity/boys-6mo-percentiles";

// Import Semua Data Length
import { GIRLS_2MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/girls-2mo-percentiles";
import { BOYS_2MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/boys-2mo-percentiles";
import { GIRLS_3MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/girls-3mo-percentiles";
import { BOYS_3MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/boys-3mo-percentiles";
import { GIRLS_4MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/girls-4mo-percentiles";
import { BOYS_4MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/boys-4mo-percentiles";
import { GIRLS_6MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/girls-6mo-percentiles";
import { BOYS_6MO_LENGTH_INCREMENT_PERCENTILES } from "./length-velocity/boys-6mo-percentiles";

type Gender = "L" | "P";
type MeasurementType = "weight" | "length";
type IntervalKey = "1mo" | "2mo" | "3mo" | "4mo" | "6mo" | "irregular";

// Interface untuk Struktur Data Tabel WHO
interface WHOTableData {
  [key: string]: {
    p5: number;
    p50: number;
    p95: number;
  };
}

export interface GrowthStatus {
  status: "adequate" | "inadequate" | "excess" | "unknown";
  targetP5: number;
  targetP50: number;
  actualIncrement: number;
  intervalUsed: string;
  message: string;
}

export const calculateAgeInMonths = (dob: Date, targetDate: Date = new Date()): number => {
  return differenceInMonths(targetDate, dob);
};

export const calculateGrowthStatus = (
  gender: Gender,
  dob: Date,
  prevDate: Date,
  currDate: Date,
  prevValue: number,
  currValue: number,
  type: MeasurementType
): GrowthStatus => {
  
  // 1. Hitung Interval & Increment
  const diffDays = differenceInDays(currDate, prevDate);
  // Fix: Handle floating point precision issue (e.g. 0.300000004)
  const actualIncrement = parseFloat((currValue - prevValue).toFixed(2));
  const incrementToCompare = type === "weight" ? actualIncrement * 1000 : actualIncrement; // Gram vs Cm

  const ageInMonthsStart = differenceInMonths(prevDate, dob);
  
  // 2. Tentukan Interval ("Bucket") dengan Range yang Kontinu (Menutup Celah)
  let intervalKey: IntervalKey = "irregular";

  // Perbaikan Logika Range: Menggunakan '<' untuk batas atas agar tidak ada celah
  if (diffDays >= 20 && diffDays < 48) intervalKey = "1mo";      // Target: 30 hari
  else if (diffDays >= 48 && diffDays < 78) intervalKey = "2mo"; // Target: 61 hari
  else if (diffDays >= 78 && diffDays < 108) intervalKey = "3mo"; // Target: 91 hari
  else if (diffDays >= 108 && diffDays < 138) intervalKey = "4mo"; // Target: 122 hari
  else if (diffDays >= 150 && diffDays < 210) intervalKey = "6mo"; // Target: 183 hari (Range lebar untuk 6 bln)

  // Validasi Khusus Length (Tidak ada data 1 bulan)
  if (type === "length" && intervalKey === "1mo") {
    // Fallback: Jika interval 1 bulan tapi ukur tinggi, kita anggap unknown atau paksa cek manual
    return {
      status: "unknown", targetP5: 0, targetP50: 0, actualIncrement,
      intervalUsed: "1-month (N/A for Length)",
      message: "WHO tidak menyediakan standar velocity tinggi badan per 1 bulan."
    };
  }

  if (intervalKey === "irregular") {
     return {
      status: "unknown", targetP5: 0, targetP50: 0, actualIncrement,
      intervalUsed: `${diffDays} days`,
      message: `Interval ${diffDays} hari terlalu jauh dari standar (1, 2, 3, 4, 6 bln).`
    };
  }

  // 3. Pilih Tabel yang Tepat (Strict Typing)
  let selectedTable: WHOTableData | null = null;
  
  if (type === "weight") {
    if (intervalKey === "1mo") selectedTable = gender === "L" ? BOYS_1MO_INCREMENT_PERCENTILES : GIRLS_1MO_INCREMENT_PERCENTILES;
    if (intervalKey === "2mo") selectedTable = gender === "L" ? BOYS_2MO_INCREMENT_PERCENTILES : GIRLS_2MO_INCREMENT_PERCENTILES;
    if (intervalKey === "3mo") selectedTable = gender === "L" ? BOYS_3MO_INCREMENT_PERCENTILES : GIRLS_3MO_INCREMENT_PERCENTILES;
    if (intervalKey === "4mo") selectedTable = gender === "L" ? BOYS_4MO_INCREMENT_PERCENTILES : GIRLS_4MO_INCREMENT_PERCENTILES;
    if (intervalKey === "6mo") selectedTable = gender === "L" ? BOYS_6MO_INCREMENT_PERCENTILES : GIRLS_6MO_INCREMENT_PERCENTILES;
  } else { // Length
    if (intervalKey === "2mo") selectedTable = gender === "L" ? BOYS_2MO_LENGTH_INCREMENT_PERCENTILES : GIRLS_2MO_LENGTH_INCREMENT_PERCENTILES;
    if (intervalKey === "3mo") selectedTable = gender === "L" ? BOYS_3MO_LENGTH_INCREMENT_PERCENTILES : GIRLS_3MO_LENGTH_INCREMENT_PERCENTILES;
    if (intervalKey === "4mo") selectedTable = gender === "L" ? BOYS_4MO_LENGTH_INCREMENT_PERCENTILES : GIRLS_4MO_LENGTH_INCREMENT_PERCENTILES;
    if (intervalKey === "6mo") selectedTable = gender === "L" ? BOYS_6MO_LENGTH_INCREMENT_PERCENTILES : GIRLS_6MO_LENGTH_INCREMENT_PERCENTILES;
  }

  if (!selectedTable) return {
    status: "unknown", targetP5: 0, targetP50: 0, actualIncrement, intervalUsed: "No Table", message: "Tabel referensi tidak ditemukan."
  };

  // 4. Generate Lookup Key (Smart Lookup)
  let endMonth = ageInMonthsStart + parseInt(intervalKey.replace("mo", ""));
  
  // Format Logic Generator
  let primaryKey = `${ageInMonthsStart}-${endMonth} mo`; // Format standard "0-2 mo" (pakai spasi)
  
  // Khusus 1 bulan
  if (intervalKey === "1mo") {
    if (ageInMonthsStart === 0) primaryKey = "0-4 w"; // Format tabel biasanya 0-4 minggu
    else if (ageInMonthsStart === 1 && diffDays < 45) primaryKey = "4 w-2 mo";
    else primaryKey = `${ageInMonthsStart}-${endMonth} mo`;
  }

  // 5. Data Retrieval dengan Fallback Keys
  // Kita coba beberapa variasi key format karena file TS mungkin beda-beda
  const possibleKeys = [
    primaryKey,                                // "0-2 mo"
    primaryKey.replace(" ", ""),               // "0-2mo"
    primaryKey.replace(" mo", "m"),            // "0-2m"
    primaryKey.replace(" w", "w"),             // "0-4w"
    `${ageInMonthsStart}-${endMonth}m`         // "0-2m" simple
  ];

  let standardData = null;
  let usedKey = "";

  for (const key of possibleKeys) {
    if (selectedTable[key]) {
      standardData = selectedTable[key];
      usedKey = key;
      break;
    }
  }

  if (!standardData) {
    return {
      status: "unknown", targetP5: 0, targetP50: 0, actualIncrement,
      intervalUsed: intervalKey,
      message: `Data standar tidak tersedia untuk key: ${possibleKeys.join(" OR ")}`
    };
  }

  // 6. Penentuan Status Akhir
  const { p5, p50, p95 } = standardData;

  let status: GrowthStatus["status"] = "adequate";
  let message = "Pertumbuhan Optimal (Adekuat) ✅";

  if (incrementToCompare < p5) {
    status = "inadequate";
    message = type === "weight" 
      ? `⚠️ WEIGHT FALTERING: Naik ${incrementToCompare.toFixed(0)}g (Target Min: ${p5}g)` 
      : `⚠️ LENGTH DECELERATION: Tumbuh ${incrementToCompare.toFixed(1)}cm (Target Min: ${p5}cm)`;
  } else if (incrementToCompare > p95) {
    status = "excess";
    message = "⚠️ Risiko Obesitas (Pertumbuhan diatas P95)";
  } else {
    message = `✅ ADEKUAT. Naik ${incrementToCompare.toFixed(0)}${type==='weight'?'g':'cm'} (Median: ${p50})`;
  }

  return {
    status,
    targetP5: p5,
    targetP50: p50,
    actualIncrement: incrementToCompare,
    intervalUsed: `${intervalKey} (${usedKey})`,
    message
  };
};

export * from "./z-score";