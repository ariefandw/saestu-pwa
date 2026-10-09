import {
  WHOReferencePoint,
  WFA_BOYS_TABLE,
  WFA_GIRLS_TABLE,
  LHFA_BOYS_TABLE,
  LHFA_GIRLS_TABLE,
  WFL_BOYS_TABLE,
  WFL_GIRLS_TABLE,
  WFH_BOYS_TABLE,
  WFH_GIRLS_TABLE,
  HCFA_BOYS_TABLE,
  HCFA_GIRLS_TABLE,
} from "./tables";
import {
  Gender,
  WFAStatus,
  HFAStatus,
  WFHStatus,
  HCFAStatus,
  ZScoreResult,
  ComprehensiveGrowthAssessment,
} from "./types";

/**
 * Menghitung Z-Score berdasarkan parameter Box-Cox Power Transformation (L, M, S)
 * dari WHO Child Growth Standards (2006).
 * 
 * Untuk metrik berat badan (WFA, WFL, WFH), WHO menerapkan Restricted Standard Deviation
 * jika |z| > 3 untuk mengoreksi skewness distribusi populasi.
 */
export function calculateLMSZScore(
  y: number,
  ref: WHOReferencePoint,
  isWeightMetric: boolean = true
): number {
  const { l, m, s } = ref;
  if (!m || !s || y <= 0) return 0;

  // Rumus dasar LMS
  let z = l === 0 ? Math.log(y / m) / s : (Math.pow(y / m, l) - 1) / (l * s);

  // Koreksi ekor kurva ekstrim WHO (|z| > 3) untuk berat badan
  if (isWeightMetric) {
    if (z > 3) {
      const sd3pos = m * Math.pow(1 + l * s * 3, 1 / l);
      const sd2pos = m * Math.pow(1 + l * s * 2, 1 / l);
      const sd23pos = sd3pos - sd2pos;
      if (sd23pos > 0) {
        z = 3 + (y - sd3pos) / sd23pos;
      }
    } else if (z < -3) {
      const sd3neg = m * Math.pow(1 - l * s * 3, 1 / l);
      const sd2neg = m * Math.pow(1 - l * s * 2, 1 / l);
      const sd23neg = sd2neg - sd3neg;
      if (sd23neg > 0) {
        z = -3 + (y - sd3neg) / sd23neg;
      }
    }
  }

  return parseFloat(z.toFixed(2));
}

// --- KLASIFIKASI STANDAR KEMENKES RI (Permenkes No. 2 Tahun 2020) ---

export function classifyWFA(z: number): ZScoreResult<WFAStatus> {
  if (z < -3) {
    return { zScore: z, status: "severely_underweight", label: "Berat Badan Sangat Kurang", badgeVariant: "danger" };
  }
  if (z < -2) {
    return { zScore: z, status: "underweight", label: "Berat Badan Kurang", badgeVariant: "warning" };
  }
  if (z <= 1) {
    return { zScore: z, status: "normal", label: "Berat Badan Normal", badgeVariant: "success" };
  }
  return { zScore: z, status: "overweight_risk", label: "Risiko BB Lebih", badgeVariant: "warning" };
}

export function classifyHFA(z: number): ZScoreResult<HFAStatus> {
  if (z < -3) {
    return { zScore: z, status: "severely_stunted", label: "Sangat Pendek (Severely Stunted)", badgeVariant: "danger" };
  }
  if (z < -2) {
    return { zScore: z, status: "stunted", label: "Pendek (Stunted)", badgeVariant: "danger" };
  }
  if (z <= 3) {
    return { zScore: z, status: "normal", label: "Tinggi Normal", badgeVariant: "success" };
  }
  return { zScore: z, status: "tall", label: "Tinggi", badgeVariant: "neutral" };
}

export function classifyWFH(z: number): ZScoreResult<WFHStatus> {
  if (z < -3) {
    return { zScore: z, status: "severely_wasted", label: "Gizi Buruk (Severely Wasted)", badgeVariant: "danger" };
  }
  if (z < -2) {
    return { zScore: z, status: "wasted", label: "Gizi Kurang (Wasted)", badgeVariant: "danger" };
  }
  if (z <= 1) {
    return { zScore: z, status: "normal", label: "Gizi Baik (Normal)", badgeVariant: "success" };
  }
  if (z <= 2) {
    return { zScore: z, status: "overweight_risk", label: "Berisiko Gizi Lebih", badgeVariant: "warning" };
  }
  if (z <= 3) {
    return { zScore: z, status: "overweight", label: "Gizi Lebih (Overweight)", badgeVariant: "warning" };
  }
  return { zScore: z, status: "obese", label: "Obesitas", badgeVariant: "danger" };
}

export function classifyHCFA(z: number): ZScoreResult<HCFAStatus> {
  if (z < -2) {
    return { zScore: z, status: "microcephaly", label: "Mikrosefali (< -2 SD)", badgeVariant: "danger" };
  }
  if (z <= 2) {
    return { zScore: z, status: "normal", label: "Normal", badgeVariant: "success" };
  }
  return { zScore: z, status: "macrocephaly", label: "Makrosefali (> +2 SD)", badgeVariant: "warning" };
}

// --- HELPER LOOKUP TABLES ---

function formatLengthKey(val: number, minVal: number, maxVal: number): string {
  const clamped = Math.min(maxVal, Math.max(minVal, val));
  const rounded = Math.round(clamped * 2) / 2;
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
}

/**
 * Kalkulasi lengkap antropometri anak balita (0-60 bulan)
 */
export function calculateChildZScores(params: {
  gender: Gender;
  ageInMonths: number;
  weight: number; // kg
  height: number; // cm
  headCircumference?: number; // cm
}): ComprehensiveGrowthAssessment {
  const { gender, weight, height, headCircumference } = params;
  const age = Math.max(0, Math.min(60, Math.round(params.ageInMonths)));
  const monthKey = age.toString();

  // 1. BB/U (Weight-for-Age)
  const wfaTable = gender === "L" ? WFA_BOYS_TABLE : WFA_GIRLS_TABLE;
  const wfaRef = wfaTable[monthKey] || wfaTable["0"];
  const wfaZ = calculateLMSZScore(weight, wfaRef, true);
  const wfaResult = classifyWFA(wfaZ);

  // 2. TB/U atau PB/U (Length/Height-for-Age) -> Stunting
  const lhfaTable = gender === "L" ? LHFA_BOYS_TABLE : LHFA_GIRLS_TABLE;
  const lhfaRef = lhfaTable[monthKey] || lhfaTable["0"];
  // Tinggi badan distribusinya normal (L=1), tidak perlu koreksi skew
  const lhfaZ = calculateLMSZScore(height, lhfaRef, false);
  const hfaResult = classifyHFA(lhfaZ);

  // 3. BB/TB atau BB/PB (Weight-for-Length/Height) -> Wasting & Gizi
  // Usia < 24 bulan: Weight-for-Length (45 - 110 cm)
  // Usia >= 24 bulan: Weight-for-Height (65 - 120 cm)
  let wfhRef: WHOReferencePoint;
  if (age < 24) {
    const table = gender === "L" ? WFL_BOYS_TABLE : WFL_GIRLS_TABLE;
    const key = formatLengthKey(height, 45, 110);
    wfhRef = table[key] || table["45"];
  } else {
    const table = gender === "L" ? WFH_BOYS_TABLE : WFH_GIRLS_TABLE;
    const key = formatLengthKey(height, 65, 120);
    wfhRef = table[key] || table["65"];
  }
  const wfhZ = calculateLMSZScore(weight, wfhRef, true);
  const wfhResult = classifyWFH(wfhZ);

  // 4. LK/U (Head Circumference-for-Age) opsional
  let hcfaResult: (ZScoreResult<HCFAStatus>) | undefined = undefined;
  if (headCircumference && headCircumference > 0) {
    const hcfaTable = gender === "L" ? HCFA_BOYS_TABLE : HCFA_GIRLS_TABLE;
    const hcfaRef = hcfaTable[monthKey] || hcfaTable["0"];
    const hcfaZ = calculateLMSZScore(headCircumference, hcfaRef, false);
    hcfaResult = classifyHCFA(hcfaZ);
  }

  // Ringkasan Diagnosa Cepat
  const isSeverelyStunted = hfaResult.status === "severely_stunted";
  const isStunted = isSeverelyStunted || hfaResult.status === "stunted";
  const isSeverelyWasted = wfhResult.status === "severely_wasted";
  const isWasted = isSeverelyWasted || wfhResult.status === "wasted";
  const isUnderweight = wfaResult.status === "severely_underweight" || wfaResult.status === "underweight";
  const isOverweightOrObese = wfhResult.status === "overweight" || wfhResult.status === "obese";

  let summaryDiagnosis = "Pertumbuhan Normal";
  if (isSeverelyStunted && isSeverelyWasted) {
    summaryDiagnosis = "🚨 DARURAT: Severely Stunted & Severely Wasted";
  } else if (isSeverelyStunted) {
    summaryDiagnosis = "⚠️ Stunting Sangat Pendek (Severely Stunted)";
  } else if (isStunted) {
    summaryDiagnosis = "⚠️ Terindikasi Stunting (Pendek)";
  } else if (isSeverelyWasted) {
    summaryDiagnosis = "🚨 Gizi Buruk (Severely Wasted)";
  } else if (isWasted) {
    summaryDiagnosis = "⚠️ Gizi Kurang (Wasted)";
  } else if (isOverweightOrObese) {
    summaryDiagnosis = "⚠️ Risiko Gizi Lebih / Obesitas";
  } else if (isUnderweight) {
    summaryDiagnosis = "⚠️ Berat Badan Kurang (Underweight)";
  }

  return {
    ageInMonths: age,
    gender,
    weight,
    height,
    headCircumference,
    wfa: wfaResult,
    hfa: hfaResult,
    wfh: wfhResult,
    hcfa: hcfaResult,
    isStunted,
    isSeverelyStunted,
    isWasted,
    isSeverelyWasted,
    isUnderweight,
    isOverweightOrObese,
    summaryDiagnosis,
  };
}
