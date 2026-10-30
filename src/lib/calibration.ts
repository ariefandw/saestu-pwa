/**
 * Kalibrasi kamera untuk estimasi tinggi badan.
 *
 * `maxDimCm` = panjang nyata (cm) dari sisi TERPANJANG frame kamera pada bidang matras.
 * Disimpan sebagai panjang nyata (bukan px/cm) supaya tidak bergantung resolusi kamera.
 * Default 100 cm = asumsi lama edge; ganti sesuai tinggi/zoom kamera di fixture kamu.
 */
export const CALIBRATION_STORAGE_KEY = "saestu.calibration.v1";
export const DEFAULT_MAX_DIM_CM = 100;
export const MIN_MAX_DIM_CM = 10;
export const MAX_MAX_DIM_CM = 500;

export interface Calibration {
  maxDimCm: number;
}

export function isValidMaxDimCm(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_MAX_DIM_CM && value <= MAX_MAX_DIM_CM;
}

export function defaultCalibration(): Calibration {
  return { maxDimCm: DEFAULT_MAX_DIM_CM };
}

export function loadCalibration(): Calibration {
  if (typeof window === "undefined") return defaultCalibration();
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return defaultCalibration();
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "maxDimCm" in parsed &&
      typeof (parsed as { maxDimCm: unknown }).maxDimCm === "number" &&
      isValidMaxDimCm((parsed as { maxDimCm: number }).maxDimCm)
    ) {
      return { maxDimCm: (parsed as { maxDimCm: number }).maxDimCm };
    }
  } catch {
    // localStorage diblokir / JSON rusak: jatuh ke default
  }
  return defaultCalibration();
}

export function saveCalibration(calibration: Calibration): void {
  if (typeof window === "undefined" || !isValidMaxDimCm(calibration.maxDimCm)) return;
  try {
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibration));
  } catch {
    // quota / private mode: abaikan, kalibrasi tetap berlaku di sesi ini
  }
}

export function resetCalibration(): Calibration {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    } catch {
      // abaikan
    }
  }
  return defaultCalibration();
}

