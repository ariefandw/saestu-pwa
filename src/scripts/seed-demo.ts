import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  serverTimestamp, 
  Timestamp 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBH_SNdOT2uR0rJSGgdNhxm9ZX1oiYi99o",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "saestu-d0d90.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "saestu-d0d90",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "saestu-d0d90.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "358204423791",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:358204423791:web:ffcbdf7063845082bcd79a",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

async function getOrCreateUser(email: string, pass: string, name: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    console.log(`✅ User dibuat di Firebase Auth: ${email}`);
    return userCredential.user.uid;
  } catch (err: any) {
    if (err.code === "auth/email-already-in-use") {
      const signInCredential = await signInWithEmailAndPassword(auth, email, pass);
      console.log(`ℹ️ User sudah ada di Auth, login ulang: ${email}`);
      return signInCredential.user.uid;
    }
    throw err;
  }
}

async function seed() {
  console.log("🚀 MEMULAI SEEDING DEMO SAESTU KE FIRESTORE & AUTH...");

  const password = "password123";

  // 1. ENTITAS PUSKESMAS
  const puskesmasId = "puskesmas-demo-01";
  console.log("1. Membuat data Puskesmas...");
  await setDoc(doc(db, "puskesmas", puskesmasId), {
    id: puskesmasId,
    name: "Puskesmas Sukajadi Terpadu",
    district: "Sukajadi",
    address: "Jl. Sukajadi No. 12, Bandung",
    headName: "dr. Budi Santoso, Sp.A",
    createdAt: serverTimestamp(),
  });

  // 2. ENTITAS POSYANDU
  const posyanduId = "posyandu-demo-melati";
  console.log("2. Membuat data Posyandu...");
  await setDoc(doc(db, "posyandu", posyanduId), {
    id: posyanduId,
    name: "Posyandu Melati 01",
    village: "Kelurahan Sukagalih",
    district: "Sukajadi",
    address: "Jl. Sukagalih No. 45, Balai Warga RW 03",
    puskesmasId: puskesmasId,
    createdAt: serverTimestamp(),
  });

  // 3. SEED 4 AKUN DEMO
  console.log("3. Mendaftarkan 4 Akun Demo ke Firebase Auth & Firestore...");

  // A. Admin Master
  const masterUid = await getOrCreateUser("admin@saestu.com", password, "Super Admin Master");
  await setDoc(doc(db, "users", masterUid), {
    uid: masterUid,
    email: "admin@saestu.com",
    name: "Super Admin Master",
    role: "master",
    createdAt: serverTimestamp(),
  });

  // B. Petugas Puskesmas
  const puskesmasUid = await getOrCreateUser("puskesmas@saestu.com", password, "Bidan Puskesmas Sukajadi");
  await setDoc(doc(db, "users", puskesmasUid), {
    uid: puskesmasUid,
    email: "puskesmas@saestu.com",
    name: "Bidan Puskesmas Sukajadi",
    role: "puskesmas",
    puskesmasId: puskesmasId,
    createdAt: serverTimestamp(),
  });

  // C. Kader Posyandu
  const kaderUid = await getOrCreateUser("kader@saestu.com", password, "Ibu Kader Aminah");
  await setDoc(doc(db, "users", kaderUid), {
    uid: kaderUid,
    email: "kader@saestu.com",
    name: "Ibu Kader Aminah",
    role: "kader",
    posyanduId: posyanduId,
    puskesmasId: puskesmasId,
    createdAt: serverTimestamp(),
  });

  // D. Orang Tua / Ibu
  const parentUid = await getOrCreateUser("parent@saestu.com", password, "Ibu Siti Fatimah");
  await setDoc(doc(db, "users", parentUid), {
    uid: parentUid,
    email: "parent@saestu.com",
    name: "Ibu Siti Fatimah",
    role: "parent",
    posyanduId: posyanduId,
    createdAt: serverTimestamp(),
  });

  // 4. SEED SAMPLE DATA ANAK & PENGUKURAN (UNTUK GRAFIK & AI DEMO)
  console.log("4. Menyuntik data Balita & Rekam Medis Pengukuran...");
  const childId1 = "anak-demo-fikri";
  await setDoc(doc(db, "children", childId1), {
    id: childId1,
    name: "Ahmad Fikri",
    nik: "3273012501240001",
    gender: "L",
    pob: "Bandung",
    dob: Timestamp.fromDate(new Date("2024-04-15")),
    parentName: "Ibu Siti Fatimah",
    parentId: parentUid,
    posyanduId: posyanduId,
    initialWeight: 3.2,
    initialHeight: 49.5,
    lastWeight: 9.8,
    lastHeight: 77.2,
    lastWeightStatus: "adequate",
    lastLengthStatus: "adequate",
    lastMeasurementDate: serverTimestamp(),
    lastZScoreWFA: 0.15,
    lastZScoreHFA: 0.22,
    lastZScoreWFH: 0.05,
    lastNutritionStatus: "Gizi Baik (Normal)",
    isStunted: false,
    isWasted: false,
    createdAt: serverTimestamp(),
  });

  // Sample Riwayat Pengukuran Anak Fikri
  const measureId1 = "measure-fikri-01";
  await setDoc(doc(db, "measurements", measureId1), {
    id: measureId1,
    childId: childId1,
    posyanduId: posyanduId,
    date: Timestamp.fromDate(new Date("2024-10-15")),
    ageInMonths: 6,
    weight: 7.9,
    height: 67.5,
    headCircumference: 43.0,
    weightStatus: "adequate",
    lengthStatus: "adequate",
    zScoreWFA: 0.12,
    zScoreHFA: 0.18,
    zScoreWFH: 0.02,
    wfaStatus: "normal",
    hfaStatus: "normal",
    wfhStatus: "normal",
    nutritionSummary: "Status Gizi Baik, pertumbuhan sesuai kurva WHO.",
    notes: "Anak aktif dan nafsu makan baik.",
    createdBy: kaderUid,
    createdAt: serverTimestamp(),
  });

  const childId2 = "anak-demo-aisyah";
  await setDoc(doc(db, "children", childId2), {
    id: childId2,
    name: "Siti Aisyah",
    nik: "3273016802240002",
    gender: "P",
    pob: "Bandung",
    dob: Timestamp.fromDate(new Date("2024-02-10")),
    parentName: "Ibu Siti Fatimah",
    parentId: parentUid,
    posyanduId: posyanduId,
    initialWeight: 2.9,
    initialHeight: 48.0,
    lastWeight: 7.8,
    lastHeight: 71.0,
    lastWeightStatus: "inadequate",
    lastLengthStatus: "adequate",
    lastMeasurementDate: serverTimestamp(),
    lastZScoreWFA: -2.15,
    lastZScoreHFA: -1.2,
    lastZScoreWFH: -2.05,
    lastNutritionStatus: "Risiko Gizi Kurang (Faltering)",
    isStunted: false,
    isWasted: true,
    createdAt: serverTimestamp(),
  });

  console.log("✨ SEEDING LENGKAP & BERHASIL 100%!");
  console.log("Semua role kini valid di database live!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Fatal Error Seeding:", err);
  process.exit(1);
});
