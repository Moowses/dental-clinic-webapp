"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import {
  logout,
  loginWithGoogle,
  updateUserProfile,
  sendVerificationEmail,
} from "@/lib/services/auth-service";
import { getUserProfile } from "@/lib/services/user-service";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { updateProfileSchema } from "@/lib/validations/auth";
import { UserRole } from "@/lib/types/user";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  logout: () => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: z.infer<typeof updateProfileSchema>) => Promise<{ success: boolean; error?: string }>;
  verifyEmail: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      await currentUser.reload(); //  refresh para sa emailVerified + latest auth state 
    }

    setUser(currentUser);

    if (currentUser) {
      const profile = await getUserProfile(currentUser.uid);
      if (profile.success && profile.data) setRole(profile.data.role);
      else setRole("client");
    } else {
      setRole(null);
    }

    setLoading(false);
  });

  return () => unsubscribe();
}, []);

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      setRole(null);
      router.push("/");
      router.refresh();
    }
    return result;
  };

const handleGoogleLogin = async () => {
  const result = await loginWithGoogle();
  if (result.success) {
    const u = auth.currentUser;
    if (u) await u.reload();

    if (u && !u.emailVerified) {
      router.push("/?verify=1");
      return result;
    }

    router.push("/client-dashboard");
  }
  return result;
};

  const handleUpdateProfile = async (data: z.infer<typeof updateProfileSchema>) => {
    if (!user) return { success: false, error: "No user logged in" };
    return await updateUserProfile(user, data);
  };

  const handleVerifyEmail = async () => {
    if (!user) return { success: false, error: "No user logged in" };
    return await sendVerificationEmail(user);
  };

  const value = {
    user,
    role,
    loading,
    logout: handleLogout,
    loginWithGoogle: handleGoogleLogin,
    updateProfile: handleUpdateProfile,
    verifyEmail: handleVerifyEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
