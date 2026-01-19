"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/hooks/useAuth";

const BRAND = "#0E4B5A";

export default function SiteHeader() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");

  // When modal closes, re-check auth state (covers successful login via modal)
  useEffect(() => {
    if (!authOpen) router.refresh();
  }, [authOpen, router]);

  const handleLogout = async () => {
    try {
      await logout?.();
    } finally {
      router.refresh();
      router.push("/");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-[72px] items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10">
                <Image
                  src="/dclogo.png"
                  alt="J4 Dental Clinic"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-extrabold tracking-wide text-slate-900">
                  J4 Dental Clinic
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  Gentle care • Modern clinic
                </div>
              </div>
            </Link>

            <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex">
              <Link href="/about" className="hover:text-slate-900">
                About Us
              </Link>
              <Link href="/services" className="hover:text-slate-900">
                Services
              </Link>
              <Link href="/contact" className="hover:text-slate-900">
                Contact Us
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              {!loading && user && (
                <>
                  <Link
                    href="/client-dashboard"
                    className="hidden rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 sm:inline-flex"
                    style={{ backgroundColor: BRAND }}
                  >
                    Account
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                  >
                    Logout
                  </button>
                </>
              )}

              {!loading && !user && (
                <>
                  <button
                    onClick={() => {
                      setAuthTab("login");
                      setAuthOpen(true);
                    }}
                    className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                  >
                    Log in
                  </button>

                  <button
                    onClick={() => {
                      setAuthTab("signup");
                      setAuthOpen(true);
                    }}
                    className="inline-flex rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                    style={{ backgroundColor: BRAND }}
                  >
                    Sign up
                  </button>
                </>
              )}

              <Link
                href="/menu"
                className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:hidden"
              >
                Menu
              </Link>
            </div>
          </div>
        </div>
      </header>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultTab={authTab}
      />
    </>
  );
}
