import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where,
  orderBy, 
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserProfile } from "@/types/schema";
import { createAccountForOthers } from "@/lib/auth-helper";

const COLLECTION_NAME = "users";

export const createParentAccount = async (posyanduId: string, data: { name: string, email: string, password: string }) => {
  try {
    // 1. Buat Auth
    const uid = await createAccountForOthers(data.email, data.password);

    // 2. Simpan Profil (Role: parent, terikat PosyanduId)
    const userData: UserProfile = {
      uid: uid,
      email: data.email,
      name: data.name,
      role: "parent",
      posyanduId: posyanduId,
      createdAt: serverTimestamp() as any,
    };

    await setDoc(doc(db, COLLECTION_NAME, uid), userData);
    return uid;
  } catch (error) {
    console.error("Error creating parent:", error);
    throw error;
  }
};

export const getParentsByPosyandu = async (posyanduId: string): Promise<UserProfile[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where("posyanduId", "==", posyanduId),
      where("role", "==", "parent")
    );
    const querySnapshot = await getDocs(q);
    const list = querySnapshot.docs.map((doc) => doc.data() as UserProfile);
    list.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : 0;
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : 0;
      return timeB - timeA;
    });
    return list;
  } catch (error) {
    console.error("Error fetching parents:", error);
    throw error;
  }
};