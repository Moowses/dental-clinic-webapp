"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { signInAction } from "@/app/actions/auth-actions";
import { useAuth } from "@/lib/hooks/useAuth";

export default function AdminLoginPage() {
  const router = useRouter();
  const { user, role, loading, logout } = useAuth();

  // same pattern as backend-test signin
  const [state, formAction, isPending] = useActionState(signInAction, {
    success: false,
  });

  // If already logged in as staff, go dashboard
  useEffect(() => {
    if (loading) return;
    if (!user) return;

    const isStaff = role && role !== "client";
    if (isStaff) router.replace("/admin-dashboard");
  }, [user, role, loading, router]);

  // If just signed in successfully, go dashboard
  useEffect(() => {
    if (state.success) {
      router.push("/admin-dashboard");
    }
  }, [state.success, router]);

  if (loading) {
    return (
      <div className="p-20 text-center text-gray-500 font-bold animate-pulse">
        Initializing Admin Portal...
      </div>
    );
  }

  // Logged in but client -> block admin portal
  if (user && role === "client") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest font-black text-gray-400">
                Access Denied
              </p>
              <p className="font-extrabold text-gray-900">
                You are signed in as a client.
              </p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-black text-xs hover:bg-red-100 transition uppercase tracking-wider"
            >
              Sign Out
            </button>
          </div>

          <p className="text-sm text-gray-600">
            Please sign in with a staff account (Admin / Dentist / Front Desk).
          </p>

          <Link
            href="/"
            className="block text-center px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-sm"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Logged in staff -> quick continue
  if (user && role && role !== "client") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest font-black text-gray-400">
                Active Session
              </p>
              <p className="font-extrabold text-gray-900">
                {user.email}{" "}
                <span className="text-blue-600 ml-1">[{role.toUpperCase()}]</span>
              </p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-black text-xs hover:bg-red-100 transition uppercase tracking-wider"
            >
              Sign Out
            </button>
          </div>

          <button
            onClick={() => router.replace("/admin-dashboard")}
            className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition shadow-lg shadow-blue-200"
          >
            Continue to Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Logged out -> show login form (same structure as backend-test/signin)
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6 bg-gradient-to-b from-white to-gray-50">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-black">
            DC
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
              Staff Portal
            </p>
            <h1 className="text-xl font-extrabold text-gray-900">
              Admin / Dentist / Front Desk
            </h1>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
            />
          </div>

          {state.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-2 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/backend-test/auth/signup"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign up
          </Link>
        </div>

        <p className="text-[11px] text-gray-400 text-center">
          Tip: staff accounts should be created by Admin from the dashboard (recommended).
        </p>
      </div>
    </div>
  );
}
