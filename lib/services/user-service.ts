import { db } from "../firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, limit } from "firebase/firestore";
import { UserProfile, UserRole } from "../types/user";

export async function createUserDocument(uid: string, email: string, role: UserRole = "client") {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      uid, // Still keeping this for convenience, though redundant with doc ID
      email,
      role,
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error creating user document:", error);
    return { success: false, error: "Failed to create user profile" };
  }
}

export async function getUserProfile(uid: string): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  try {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      return { success: true, data: snap.data() as UserProfile };
    } else {
      return { success: false, error: "User profile not found" };
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return { success: false, error: "Failed to fetch user profile" };
  }
}

// Advanced search for MVP (Parallel Email and Name matching)

export async function searchPatients(searchTerm?: string) {

  try {

    const usersRef = collection(db, "users");

    const term = searchTerm?.trim();



    if (!term) {

      const q = query(usersRef, where("role", "==", "client"), limit(10));

      const snap = await getDocs(q);

      return { success: true, data: snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)) };

    }



    // Firestore doesn't support 'OR' for partial strings on different fields natively.

    // We run two queries in parallel.

    const termLower = term.toLowerCase(); // Note: Firestore is case-sensitive, this assumes data is lowercased or we just search as is

    

    const emailQuery = query(

      usersRef,

      where("role", "==", "client"),

      where("email", ">=", term),

      where("email", "<=", term + "\uf8ff"),

      limit(5)

    );



    const nameQuery = query(

      usersRef,

      where("role", "==", "client"),

      where("displayName", ">=", term),

      where("displayName", "<=", term + "\uf8ff"),

      limit(5)

    );



    const [emailSnap, nameSnap] = await Promise.all([

      getDocs(emailQuery),

      getDocs(nameQuery)

    ]);



    // Merge and deduplicate results by UID

    const resultsMap = new Map<string, UserProfile>();

    

    emailSnap.docs.forEach(doc => resultsMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile));

    nameSnap.docs.forEach(doc => resultsMap.set(doc.id, { uid: doc.id, ...doc.data() } as UserProfile));



    return { success: true, data: Array.from(resultsMap.values()) };

  } catch (error) {

    console.error("Error searching patients:", error);

    return { success: false, error: "Search failed" };

  }

}
