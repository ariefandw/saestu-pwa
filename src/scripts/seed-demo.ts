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
  Timestamp,
  collection,
  getDocs,
  deleteDoc
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
    console.log(`✅ User dibuat di Auth: ${email}`);
    return userCredential.user.uid;
  } catch (err: any) {
    if (err.code === "auth/email-already-in-use") {
      const signInCredential = await signInWithEmailAndPassword(auth, email, pass);
      console.log(`ℹ️ User sudah terdaftar di Auth, sync UID: ${email}`);
      return signInCredential.user.uid;
    }
    throw err;
  }
}

async function cleanCollection(collectionName: string) {
  console.log(`🧹 Membersihkan koleksi: ${collectionName}...`);
  const snapshot = await getDocs(collection(db, collectionName));
  const deletePromises = snapshot.docs.map((d) => deleteDoc(doc(db, collectionName, d.id)));
  await Promise.all(deletePromises);
  console.log(`   Selesai: ${snapshot.docs.length} dokumen di ${collectionName} dihapus.`);
}

async function seed() {
  console.log("==================================================================");
  console.log("🚀 MEMULAI RESET & SEEDING DEMO SAESTU LENGKAP MULTI-ENTITY...");
  console.log("==================================================================");

  // 0. BERSIHKAN DATA SEBELUMNYA (KECUALI USERS KARENA AUTH SUDAH TERIKAT)
  const collectionsToClean = [
    "puskesmas",
    "posyandus",
    "children",
    "measurements",
    "master_foods",
    "interventions"
  ];
  for (const col of collectionsToClean) {
    await cleanCollection(col);
  }

  const defaultPassword = "password123";

  // 1. DATA PUSKESMAS (2 Faskes: 1 Puskesmas Utama Demo, 1 Puskesmas Pembanding)
  console.log("\n🏥 1. Membuat Data Puskesmas (2 Unit)...");
  const pusk1Id = "pusk-sukajadi-01";
  await setDoc(doc(db, "puskesmas", pusk1Id), {
    id: pusk1Id,
    name: "Puskesmas Sukajadi Terpadu",
    district: "Sukajadi",
    address: "Jl. Sukajadi No. 12, Kota Bandung",
    headName: "dr. Budi Santoso, Sp.A",
    createdAt: serverTimestamp(),
  });

  const pusk2Id = "pusk-coblong-02";
  await setDoc(doc(db, "puskesmas", pusk2Id), {
    id: pusk2Id,
    name: "Puskesmas Coblong Sehat",
    district: "Coblong",
    address: "Jl. Ir. H. Djuanda No. 120, Kota Bandung",
    headName: "dr. Siti Aminah, M.Kes",
    createdAt: serverTimestamp(),
  });

  // 2. DATA POSYANDU (3 Posyandu di bawah Puskesmas)
  console.log("🏠 2. Membuat Data Posyandu (3 Posyandu)...");
  const posyanduMelatiId = "posyandu-melati-01";
  await setDoc(doc(db, "posyandus", posyanduMelatiId), {
    id: posyanduMelatiId,
    name: "Posyandu Melati 01",
    village: "Kelurahan Sukagalih",
    district: "Sukajadi",
    address: "Balai Warga RW 03, Sukagalih",
    puskesmasId: pusk1Id,
    createdAt: serverTimestamp(),
  });

  const posyanduMawarId = "posyandu-mawar-02";
  await setDoc(doc(db, "posyandus", posyanduMawarId), {
    id: posyanduMawarId,
    name: "Posyandu Mawar 02",
    village: "Kelurahan Pasteur",
    district: "Sukajadi",
    address: "Jl. Pasteur No. 88 RW 05",
    puskesmasId: pusk1Id,
    createdAt: serverTimestamp(),
  });

  const posyanduAnggrekId = "posyandu-anggrek-03";
  await setDoc(doc(db, "posyandus", posyanduAnggrekId), {
    id: posyanduAnggrekId,
    name: "Posyandu Anggrek 01",
    village: "Kelurahan Dago",
    district: "Coblong",
    address: "Jl. Dago Asri No. 15",
    puskesmasId: pusk2Id,
    createdAt: serverTimestamp(),
  });

  // 3. SEED 4 AKUN LOGIN DEMO UTAMA (TETAP 4 AKUN INSTAN)
  console.log("\n👤 3. Menghubungkan 4 Akun Utama Demo...");
  // A. Admin Master
  const masterUid = await getOrCreateUser("admin@saestu.com", defaultPassword, "Super Admin Master");
  await setDoc(doc(db, "users", masterUid), {
    uid: masterUid,
    email: "admin@saestu.com",
    name: "Super Admin Master",
    role: "master",
    createdAt: serverTimestamp(),
  });

  // B. Petugas Puskesmas
  const puskesmasUid = await getOrCreateUser("puskesmas@saestu.com", defaultPassword, "Bidan Puskesmas Sukajadi");
  await setDoc(doc(db, "users", puskesmasUid), {
    uid: puskesmasUid,
    email: "puskesmas@saestu.com",
    name: "Bidan Ratna Sari, S.Tr.Keb",
    role: "puskesmas",
    puskesmasId: pusk1Id,
    createdAt: serverTimestamp(),
  });

  // C. Kader Posyandu
  const kaderUid = await getOrCreateUser("kader@saestu.com", defaultPassword, "Ibu Kader Aminah");
  await setDoc(doc(db, "users", kaderUid), {
    uid: kaderUid,
    email: "kader@saestu.com",
    name: "Ibu Kader Aminah",
    role: "kader",
    posyanduId: posyanduMelatiId,
    puskesmasId: pusk1Id,
    createdAt: serverTimestamp(),
  });

  // D. Orang Tua / Ibu Demo
  const parentUid = await getOrCreateUser("parent@saestu.com", defaultPassword, "Ibu Siti Fatimah");
  await setDoc(doc(db, "users", parentUid), {
    uid: parentUid,
    email: "parent@saestu.com",
    name: "Ibu Siti Fatimah",
    role: "parent",
    posyanduId: posyanduMelatiId,
    createdAt: serverTimestamp(),
  });

  // 3B. AKUN ORANG TUA KEDUA (Agar di posyandu & puskesmas terlihat multi-keluarga)
  const parent2Uid = "parent-rina-lestari-uid";
  await setDoc(doc(db, "users", parent2Uid), {
    uid: parent2Uid,
    email: "rina.lestari@gmail.com",
    name: "Ibu Rina Lestari",
    role: "parent",
    posyanduId: posyanduMelatiId,
    createdAt: serverTimestamp(),
  });

  // 4. DATA ANAK / BALITA (4 Balita: 2 anak milik Ibu Siti, 2 anak keluarga lain)
  console.log("\n👶 4. Menyuntik Data Balita (4 Anak dengan variasi status gizi)...");
  
  // Anak 1: Ahmad Fikri (Milik Ibu Siti - Status: Normal / Gizi Baik)
  const child1Id = "child-fikri";
  await setDoc(doc(db, "children", child1Id), {
    id: child1Id,
    name: "Ahmad Fikri",
    nik: "3273012501240001",
    gender: "L",
    pob: "Bandung",
    dob: Timestamp.fromDate(new Date("2024-04-15")), // Usia ~6-7 Bulan
    parentName: "Ibu Siti Fatimah",
    parentId: parentUid,
    posyanduId: posyanduMelatiId,
    initialWeight: 3.2,
    initialHeight: 49.5,
    lastWeight: 8.3,
    lastHeight: 69.2,
    lastWeightStatus: "adequate",
    lastLengthStatus: "adequate",
    lastMeasurementDate: serverTimestamp(),
    lastZScoreWFA: 0.25,
    lastZScoreHFA: 0.15,
    lastZScoreWFH: 0.28,
    lastNutritionStatus: "Gizi Baik (Normal)",
    isStunted: false,
    isWasted: false,
    createdAt: serverTimestamp(),
  });

  // Anak 2: Siti Aisyah (Milik Ibu Siti - Status: Faltering / Risiko Stunting)
  const child2Id = "child-aisyah";
  await setDoc(doc(db, "children", child2Id), {
    id: child2Id,
    name: "Siti Aisyah",
    nik: "3273016802240002",
    gender: "P",
    pob: "Bandung",
    dob: Timestamp.fromDate(new Date("2024-02-10")), // Usia ~8-9 Bulan
    parentName: "Ibu Siti Fatimah",
    parentId: parentUid,
    posyanduId: posyanduMelatiId,
    initialWeight: 2.9,
    initialHeight: 48.0,
    lastWeight: 6.9,
    lastHeight: 66.5,
    lastWeightStatus: "inadequate",
    lastLengthStatus: "adequate",
    lastMeasurementDate: serverTimestamp(),
    lastZScoreWFA: -2.35,
    lastZScoreHFA: -1.45,
    lastZScoreWFH: -2.15,
    lastNutritionStatus: "Risiko Gizi Kurang (Faltering)",
    isStunted: false,
    isWasted: true,
    createdAt: serverTimestamp(),
  });

  // Anak 3: Budi Santoso (Milik Ibu Rina - Status: Stunted / Pendek)
  const child3Id = "child-budi";
  await setDoc(doc(db, "children", child3Id), {
    id: child3Id,
    name: "Budi Santoso",
    nik: "3273011208230003",
    gender: "L",
    pob: "Bandung",
    dob: Timestamp.fromDate(new Date("2023-08-12")), // Usia ~14 Bulan
    parentName: "Ibu Rina Lestari",
    parentId: parent2Uid,
    posyanduId: posyanduMelatiId,
    initialWeight: 3.1,
    initialHeight: 49.0,
    lastWeight: 8.8,
    lastHeight: 72.0,
    lastWeightStatus: "adequate",
    lastLengthStatus: "inadequate",
    lastMeasurementDate: serverTimestamp(),
    lastZScoreWFA: -1.2,
    lastZScoreHFA: -2.45,
    lastZScoreWFH: -0.35,
    lastNutritionStatus: "Pendek (Stunted)",
    isStunted: true,
    isWasted: false,
    createdAt: serverTimestamp(),
  });

  // Anak 4: Citra Lestari (Milik Ibu Rina - Status: Normal)
  const child4Id = "child-citra";
  await setDoc(doc(db, "children", child4Id), {
    id: child4Id,
    name: "Citra Lestari",
    nik: "3273014411230004",
    gender: "P",
    pob: "Bandung",
    dob: Timestamp.fromDate(new Date("2023-11-20")), // Usia ~11 Bulan
    parentName: "Ibu Rina Lestari",
    parentId: parent2Uid,
    posyanduId: posyanduMelatiId,
    initialWeight: 3.0,
    initialHeight: 48.5,
    lastWeight: 8.9,
    lastHeight: 73.5,
    lastWeightStatus: "adequate",
    lastLengthStatus: "adequate",
    lastMeasurementDate: serverTimestamp(),
    lastZScoreWFA: 0.1,
    lastZScoreHFA: 0.3,
    lastZScoreWFH: -0.1,
    lastNutritionStatus: "Gizi Baik (Normal)",
    isStunted: false,
    isWasted: false,
    createdAt: serverTimestamp(),
  });

  // 5. RIWAYAT PENGUKURAN (MULTI BULAN UNTUK MEMBENTUK KURVA GRAFIK PERTUMBUHAN)
  console.log("\n📈 5. Menyuntik Riwayat Pengukuran (History KMS Multi-Bulan)...");

  // A. History Pengukuran Fikri (3 Bulan berturut-turut - Tren Positif)
  await setDoc(doc(db, "measurements", "meas-fikri-m4"), {
    id: "meas-fikri-m4",
    childId: child1Id,
    posyanduId: posyanduMelatiId,
    date: Timestamp.fromDate(new Date("2024-08-15")),
    ageInMonths: 4,
    weight: 6.8,
    height: 63.5,
    headCircumference: 41.5,
    weightStatus: "adequate",
    lengthStatus: "adequate",
    zScoreWFA: 0.18,
    zScoreHFA: 0.12,
    zScoreWFH: 0.15,
    wfaStatus: "normal",
    hfaStatus: "normal",
    wfhStatus: "normal",
    nutritionSummary: "Pertumbuhan normal sesuai standar WHO.",
    notes: "Imunisasi DPT-2 & Polio 3 diberikan.",
    createdBy: kaderUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "measurements", "meas-fikri-m5"), {
    id: "meas-fikri-m5",
    childId: child1Id,
    posyanduId: posyanduMelatiId,
    date: Timestamp.fromDate(new Date("2024-09-15")),
    ageInMonths: 5,
    weight: 7.5,
    height: 66.0,
    headCircumference: 42.3,
    weightStatus: "adequate",
    lengthStatus: "adequate",
    zScoreWFA: 0.22,
    zScoreHFA: 0.14,
    zScoreWFH: 0.20,
    wfaStatus: "normal",
    hfaStatus: "normal",
    wfhStatus: "normal",
    nutritionSummary: "Kenaikan BB adekuat (N).",
    notes: "Mulai diedukasi persiapan MPASI 6 bulan.",
    createdBy: kaderUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "measurements", "meas-fikri-m6"), {
    id: "meas-fikri-m6",
    childId: child1Id,
    posyanduId: posyanduMelatiId,
    date: Timestamp.fromDate(new Date("2024-10-15")),
    ageInMonths: 6,
    weight: 8.3,
    height: 69.2,
    headCircumference: 43.1,
    weightStatus: "adequate",
    lengthStatus: "adequate",
    zScoreWFA: 0.25,
    zScoreHFA: 0.15,
    zScoreWFH: 0.28,
    wfaStatus: "normal",
    hfaStatus: "normal",
    wfhStatus: "normal",
    nutritionSummary: "Status Gizi Sangat Baik.",
    notes: "MPASI berjalan lancar, makan telur & hati ayam.",
    createdBy: kaderUid,
    createdAt: serverTimestamp(),
  });

  // B. History Pengukuran Aisyah (Penurunan Berat Badan / Faltering)
  await setDoc(doc(db, "measurements", "meas-aisyah-m7"), {
    id: "meas-aisyah-m7",
    childId: child2Id,
    posyanduId: posyanduMelatiId,
    date: Timestamp.fromDate(new Date("2024-09-10")),
    ageInMonths: 7,
    weight: 7.1,
    height: 65.5,
    headCircumference: 41.8,
    weightStatus: "inadequate",
    lengthStatus: "adequate",
    zScoreWFA: -1.8,
    zScoreHFA: -1.2,
    zScoreWFH: -1.75,
    wfaStatus: "underweight",
    hfaStatus: "normal",
    wfhStatus: "wasted",
    nutritionSummary: "Kenaikan berat badan tidak cukup (T).",
    notes: "Anak sempat batuk pilek 1 minggu.",
    createdBy: kaderUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "measurements", "meas-aisyah-m8"), {
    id: "meas-aisyah-m8",
    childId: child2Id,
    posyanduId: posyanduMelatiId,
    date: Timestamp.fromDate(new Date("2024-10-10")),
    ageInMonths: 8,
    weight: 6.9,
    height: 66.5,
    headCircumference: 42.0,
    weightStatus: "inadequate",
    lengthStatus: "adequate",
    zScoreWFA: -2.35,
    zScoreHFA: -1.45,
    zScoreWFH: -2.15,
    wfaStatus: "underweight",
    hfaStatus: "normal",
    wfhStatus: "wasted",
    nutritionSummary: "Berat badan turun drastis. Indikasi Risiko Stunting / Gizi Kurang.",
    notes: "Perlu rujukan PMT Pemulihan Tinggi Kalori.",
    createdBy: kaderUid,
    createdAt: serverTimestamp(),
  });

  // 6. DATABASE PANGAN LOKAL (MASTER FOODS UNTUK AI PMT)
  console.log("\n🍲 6. Menyuntik Master Data Pangan Lokal (15 Bahan Pangan)...");
  const masterFoodsData = [
    { code: "B001", name: "Telur Ayam Ras", energyKJ: 649, protein: 12.6, fat: 10.6, carbs: 1.1 },
    { code: "H001", name: "Hati Ayam Rebus", energyKJ: 650, protein: 24.0, fat: 6.0, carbs: 1.0 },
    { code: "D001", name: "Ikan Kembung Segar", energyKJ: 850, protein: 19.0, fat: 8.0, carbs: 4.0 },
    { code: "D002", name: "Ikan Lele Segar", energyKJ: 1050, protein: 18.0, fat: 15.0, carbs: 5.0 },
    { code: "G001", name: "Dada Ayam Fillet", energyKJ: 600, protein: 23.0, fat: 1.5, carbs: 0.0 },
    { code: "C001", name: "Tempe Kedelai Murni", energyKJ: 800, protein: 19.0, fat: 11.0, carbs: 9.0 },
    { code: "C002", name: "Tahu Putih Segar", energyKJ: 330, protein: 8.0, fat: 4.8, carbs: 1.9 },
    { code: "A001", name: "Nasi Putih Pulen", energyKJ: 544, protein: 2.7, fat: 0.3, carbs: 28.0 },
    { code: "U001", name: "Ubi Jalar Kuning", energyKJ: 480, protein: 1.5, fat: 0.5, carbs: 25.0 },
    { code: "E001", name: "Sayur Bayam Hijau", energyKJ: 150, protein: 1.5, fat: 0.2, carbs: 3.0 },
    { code: "E002", name: "Wortel Segar", energyKJ: 160, protein: 1.0, fat: 0.2, carbs: 9.0 },
    { code: "F001", name: "Pisang Ambon", energyKJ: 385, protein: 1.0, fat: 0.2, carbs: 23.0 },
    { code: "F002", name: "Pepaya California", energyKJ: 190, protein: 0.5, fat: 0.0, carbs: 10.0 },
    { code: "K001", name: "Kacang Hijau Kupas", energyKJ: 450, protein: 7.0, fat: 0.5, carbs: 18.0 },
    { code: "M001", name: "Minyak Kelapa / Santan", energyKJ: 3600, protein: 0.0, fat: 100.0, carbs: 0.0 },
  ];

  for (let i = 0; i < masterFoodsData.length; i++) {
    const item = masterFoodsData[i];
    await setDoc(doc(db, "master_foods", `food-${item.code.toLowerCase()}`), {
      id: `food-${item.code.toLowerCase()}`,
      ...item,
      puskesmasId: pusk1Id,
      createdAt: serverTimestamp(),
    });
  }

  // 7. RIWAYAT INTERVENSI GIZI & PMT (INTERVENTIONS)
  console.log("\n💊 7. Menyuntik Log Intervensi Medis & PMT...");
  await setDoc(doc(db, "interventions", "interv-01"), {
    id: "interv-01",
    childId: child2Id, // Aisyah (Butuh intervensi gizi)
    type: "pmt",
    title: "Pemberian Makanan Tambahan (PMT) Pemulihan",
    description: "Paket PMT Bahan Lokal Tinggi Protein Hewani (Telur + Ikan Kembung) selama 14 hari.",
    date: Timestamp.fromDate(new Date("2024-10-11")),
    status: "in_progress",
    notes: "Ibu diedukasi cara membuat bubur padat kalori dengan santan dan telur.",
    createdBy: puskesmasUid,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "interventions", "interv-02"), {
    id: "interv-02",
    childId: child1Id, // Fikri
    type: "vitamin",
    title: "Pemberian Kapsul Vitamin A Biru",
    description: "Vitamin A Dosis 100.000 IU untuk balita 6-11 bulan.",
    date: Timestamp.fromDate(new Date("2024-10-15")),
    status: "completed",
    notes: "Telah diminumkan langsung oleh kader di Posyandu.",
    createdBy: kaderUid,
    createdAt: serverTimestamp(),
  });

  console.log("\n==================================================================");
  console.log("✨ RESET & SEEDING DEMO 100% SUKSES!");
  console.log("Semua 7 tabel Firestore kini terisi penuh dengan data riil & terhubung!");
  console.log("==================================================================");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Fatal Error Seeding:", err);
  process.exit(1);
});
