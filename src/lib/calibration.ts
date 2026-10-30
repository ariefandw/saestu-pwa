/**
 * Kalibrasi kamera & konfigurasi metode pengukuran tinggi badan Saestu.
 *
 * Mendukung 3 metode komparatif untuk riset & uji validitas:
 *  1. mediapipe       : BlazePose Deep Learning Keypoint (33 landmark)
 *  2. contour_caliper : Morfologi Siluet & Caliper Kontur (bebas landmark)
 *  3. aruco_marker    : Kalibrasi Metrologi Fisik via Marker ArUco (misal 10x10 cm)
 */

export type EstimationMethod = "mediapipe" | "contour_caliper" | "aruco_marker";

export interface MethodOption {
  id: EstimationMethod;
  name: string;
  badge: string;
  description: string;
}

export const ESTIMATION_METHODS: MethodOption[] = [
  {
    id: "mediapipe",
    name: "MediaPipe Pose",
    badge: "AI Keypoint",
    description: "Estimasi sendi tulang (33 landmark) berbasis Deep Learning BlazePose.",
  },
  {
    id: "contour_caliper",
    name: "Siluet Kontur",
    badge: "Bebas Landmark",
    description: "Deteksi kontur fisik ujung kepala hingga tumit secara langsung tanpa sendi.",
  },
  {
    id: "aruco_marker",
    name: "ArUco Metrologi",
    badge: "Marker Fisik",
    description: "Kalibrasi skala otomatis menggunakan marker ArUco fisik di samping bayi.",
  },
];

export const CALIBRATION_STORAGE_KEY = "saestu.calibration.v2";
export const DEFAULT_MAX_DIM_CM = 100;
export const MIN_MAX_DIM_CM = 10;
export const MAX_MAX_DIM_CM = 500;

export const DEFAULT_MARKER_SIZE_CM = 10.0;
export const MIN_MARKER_SIZE_CM = 2.0;
export const MAX_MARKER_SIZE_CM = 50.0;

export interface Calibration {
  method: EstimationMethod;
  maxDimCm: number;
  markerSizeCm: number;
}

export function isValidMaxDimCm(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_MAX_DIM_CM && value <= MAX_MAX_DIM_CM;
}

export function isValidMarkerSizeCm(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_MARKER_SIZE_CM && value <= MAX_MARKER_SIZE_CM;
}

export function defaultCalibration(): Calibration {
  return {
    method: "mediapipe",
    maxDimCm: DEFAULT_MAX_DIM_CM,
    markerSizeCm: DEFAULT_MARKER_SIZE_CM,
  };
}

export function loadCalibration(): Calibration {
  if (typeof window === "undefined") return defaultCalibration();
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return defaultCalibration();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const p = parsed as Partial<Calibration>;
      const method: EstimationMethod =
        p.method === "contour_caliper" || p.method === "aruco_marker" ? p.method : "mediapipe";
      const maxDimCm = typeof p.maxDimCm === "number" && isValidMaxDimCm(p.maxDimCm) ? p.maxDimCm : DEFAULT_MAX_DIM_CM;
      const markerSizeCm =
        typeof p.markerSizeCm === "number" && isValidMarkerSizeCm(p.markerSizeCm)
          ? p.markerSizeCm
          : DEFAULT_MARKER_SIZE_CM;
      return { method, maxDimCm, markerSizeCm };
    }
  } catch {
    // localStorage diblokir / JSON rusak: jatuh ke default
  }
  return defaultCalibration();
}

export function saveCalibration(calibration: Calibration): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibration));
  } catch {
    // quota / private mode: abaikan
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
