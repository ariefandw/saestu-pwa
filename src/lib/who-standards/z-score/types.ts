export type Gender = "L" | "P";

// Kategori Status Antropometri Kemenkes RI (Permenkes No. 2 Tahun 2020)
export type WFAStatus = 
  | "severely_underweight" // BB Sangat Kurang (< -3 SD)
  | "underweight"          // BB Kurang (-3 SD sd < -2 SD)
  | "normal"               // BB Normal (-2 SD sd +1 SD)
  | "overweight_risk";     // Risiko BB Lebih (> +1 SD)

export type HFAStatus = 
  | "severely_stunted"     // Sangat Pendek (< -3 SD)
  | "stunted"              // Pendek (-3 SD sd < -2 SD)
  | "normal"               // Normal (-2 SD sd +3 SD)
  | "tall";                // Tinggi (> +3 SD)

export type WFHStatus = 
  | "severely_wasted"      // Gizi Buruk (< -3 SD)
  | "wasted"               // Gizi Kurang (-3 SD sd < -2 SD)
  | "normal"               // Gizi Baik (-2 SD sd +1 SD)
  | "overweight_risk"      // Berisiko Gizi Lebih (> +1 SD sd +2 SD)
  | "overweight"           // Gizi Lebih (> +2 SD sd +3 SD)
  | "obese";               // Obesitas (> +3 SD)

export type HCFAStatus = 
  | "microcephaly"         // Mikrosefali (< -2 SD)
  | "normal"               // Normal (-2 SD sd +2 SD)
  | "macrocephaly";        // Makrosefali (> +2 SD)

export interface ZScoreResult<T = string> {
  zScore: number;
  status: T;
  label: string;
  badgeVariant: "success" | "warning" | "danger" | "neutral" | "info";
}

export interface ComprehensiveGrowthAssessment {
  ageInMonths: number;
  gender: Gender;
  weight: number;
  height: number;
  headCircumference?: number;

  // 3 Pilar Utama Antropometri WHO / Kemenkes
  wfa: ZScoreResult<WFAStatus>; // BB/U (Weight-for-Age)
  hfa: ZScoreResult<HFAStatus>; // TB/U atau PB/U (Height/Length-for-Age) -> Deteksi Stunting
  wfh: ZScoreResult<WFHStatus>; // BB/TB atau BB/PB (Weight-for-Height/Length) -> Deteksi Wasting
  hcfa?: ZScoreResult<HCFAStatus>; // LK/U (Head Circumference-for-Age)

  // Ringkasan Diagnosa Cepat untuk Dashboard & UI
  isStunted: boolean;
  isSeverelyStunted: boolean;
  isWasted: boolean;
  isSeverelyWasted: boolean;
  isUnderweight: boolean;
  isOverweightOrObese: boolean;
  summaryDiagnosis: string;
}
