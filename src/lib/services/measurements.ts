import { 
  collection, 
  addDoc, 
  doc, 
  getDoc,
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc, // Tambahkan updateDoc
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Measurement, Child } from "@/types/schema";
import { calculateGrowthStatus, calculateChildZScores } from "@/lib/who-standards";
import { differenceInMonths } from "date-fns";

const COLLECTION_NAME = "measurements";

export interface CreateMeasurementInput {
  childId: string;
  posyanduId: string;
  date: string; 
  weight: number;
  height: number;
  headCircumference?: number;
  kaderId: string;
}

export const addMeasurement = async (data: CreateMeasurementInput) => {
  try {
    const childRef = doc(db, "children", data.childId);
    const childSnap = await getDoc(childRef);
    if (!childSnap.exists()) throw new Error("Data anak tidak ditemukan");
    
    const child = childSnap.data() as Child;
    const childDob = child.dob instanceof Timestamp ? child.dob.toDate() : new Date(child.dob);
    const currentMeasDate = new Date(data.date); 

    const q = query(
      collection(db, COLLECTION_NAME),
      where("childId", "==", data.childId),
      where("date", "<", Timestamp.fromDate(currentMeasDate)), 
      orderBy("date", "desc"),
      limit(1)
    );
    
    const prevSnap = await getDocs(q);
    
    let prevDate: Date;
    let prevWeight: number;
    let prevHeight: number;

    if (!prevSnap.empty) {
      const prevData = prevSnap.docs[0].data() as Measurement;
      prevDate = prevData.date instanceof Timestamp ? prevData.date.toDate() : new Date(prevData.date);
      prevWeight = prevData.weight;
      prevHeight = prevData.height;
    } else {
      prevDate = childDob;
      prevWeight = child.initialWeight;
      prevHeight = child.initialHeight;
    }

    const weightAnalysis = calculateGrowthStatus(
      child.gender, childDob, prevDate, currentMeasDate,
      prevWeight, data.weight, "weight"
    );

    const lengthAnalysis = calculateGrowthStatus(
      child.gender, childDob, prevDate, currentMeasDate,
      prevHeight, data.height, "length"
    );

    const ageInMonths = differenceInMonths(currentMeasDate, childDob);
    const zScoreAssessment = calculateChildZScores({
      gender: child.gender,
      ageInMonths,
      weight: data.weight,
      height: data.height,
      headCircumference: data.headCircumference,
    });

    const combinedNotes = `[AUTO] Z-Score: ${zScoreAssessment.summaryDiagnosis} | Vel BB: ${weightAnalysis.message} | Vel TB: ${lengthAnalysis.message}`;

    const docData: Record<string, any> = {
      childId: data.childId,
      posyanduId: data.posyanduId,
      date: Timestamp.fromDate(currentMeasDate),
      ageInMonths,
      weight: data.weight,
      height: data.height,
      headCircumference: data.headCircumference || 0,
      weightStatus: weightAnalysis.status,
      lengthStatus: lengthAnalysis.status,
      weightIncrement: weightAnalysis.actualIncrement,
      lengthIncrement: lengthAnalysis.actualIncrement,
      
      // Z-Score Standard WHO & Kemenkes
      zScoreWFA: zScoreAssessment.wfa.zScore,
      zScoreHFA: zScoreAssessment.hfa.zScore,
      zScoreWFH: zScoreAssessment.wfh.zScore,
      zScoreHCFA: zScoreAssessment.hcfa?.zScore,
      wfaStatus: zScoreAssessment.wfa.status,
      hfaStatus: zScoreAssessment.hfa.status,
      wfhStatus: zScoreAssessment.wfh.status,
      nutritionSummary: zScoreAssessment.summaryDiagnosis,

      notes: combinedNotes,
      createdAt: serverTimestamp(), 
      createdBy: data.kaderId
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);

    // --- [SYNC] Update Dokumen Anak dengan Data Terakhir ---
    await updateDoc(childRef, {
        lastWeight: data.weight,
        lastHeight: data.height,
        lastWeightStatus: weightAnalysis.status,
        lastLengthStatus: lengthAnalysis.status,
        lastZScoreWFA: zScoreAssessment.wfa.zScore,
        lastZScoreHFA: zScoreAssessment.hfa.zScore,
        lastZScoreWFH: zScoreAssessment.wfh.zScore,
        lastNutritionStatus: zScoreAssessment.summaryDiagnosis,
        isStunted: zScoreAssessment.isStunted,
        isWasted: zScoreAssessment.isWasted,
        lastMeasurementDate: Timestamp.fromDate(currentMeasDate)
    });

    return docRef.id;

  } catch (error) {
    console.error("Error adding measurement:", error);
    throw error;
  }
};

// --- [BARU] Ambil semua pengukuran di satu Posyandu untuk Dashboard ---
export const getMeasurementsByPosyandu = async (posyanduId: string): Promise<Measurement[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("posyanduId", "==", posyanduId),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate(),
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()
      } as Measurement;
    });
  } catch (error) {
    console.error("Error fetching measurements by posyandu:", error);
    throw error;
  }
};

export const getMeasurementsByChild = async (childId: string): Promise<Measurement[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("childId", "==", childId),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: (data.date as Timestamp).toDate(),
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()
      } as Measurement;
    });
  } catch (error) {
    console.error("Error fetching measurements:", error);
    throw error;
  }
};