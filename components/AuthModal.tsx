"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { signInAction, signUpAction } from "@/app/actions/auth-actions";

type Tab = "login" | "signup";

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
          <div className="text-sm font-semibold text-slate-800">{message}</div>
        </div>
      </div>
    </div>
  );
}

function SuccessOverlay() {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur">
      <div className="rounded-2xl border border-emerald-200 bg-white px-6 py-5 shadow-lg">
        <div className="text-sm font-extrabold text-emerald-700">
          Success!
        </div>
        <div className="mt-1 text-sm text-slate-700">
          Redirecting to your dashboard…
        </div>
      </div>
    </div>
  );
}

function SignInForm({
  onSuccess,
  onBusyChange,
  onSuccessOverlay,
}: {
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
  onSuccessOverlay: () => void;
}) {
  const [state, formAction, isPending] = useActionState(signInAction, {
    success: false,
    error: null,
  });

  useEffect(() => {
    onBusyChange(isPending);
  }, [isPending, onBusyChange]);

  useEffect(() => {
    if (state.success) {
      onSuccessOverlay();
      onSuccess();
    }
  }, [state.success, onSuccess, onSuccessOverlay]);

  return (
    <form action={formAction} className="space-y-4">
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        disabled={isPending}
        className="w-full rounded-xl border px-4 py-3 text-sm disabled:opacity-60"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        disabled={isPending}
        className="w-full rounded-xl border px-4 py-3 text-sm disabled:opacity-60"
      />

      {state.error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-[#0E4B5A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}

function SignUpForm({
  onSuccess,
  onBusyChange,
  onSuccessOverlay,
}: {
  onSuccess: () => void;
  onBusyChange: (busy: boolean) => void;
  onSuccessOverlay: () => void;
}) {
  const [state, formAction, isPending] = useActionState(signUpAction, {
    success: false,
    error: null,
  });

  useEffect(() => {
    onBusyChange(isPending);
  }, [isPending, onBusyChange]);

  useEffect(() => {
    if (state.success) {
      onSuccessOverlay();
      onSuccess();
    }
  }, [state.success, onSuccess, onSuccessOverlay]);

  return (
    <form action={formAction} className="space-y-4">
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        disabled={isPending}
        className="w-full rounded-xl border px-4 py-3 text-sm disabled:opacity-60"
      />
      <input
        name="password"
        type="password"
        placeholder="Password"
        required
        disabled={isPending}
        className="w-full rounded-xl border px-4 py-3 text-sm disabled:opacity-60"
      />
      <input
        name="confirmPassword"
        type="password"
        placeholder="Confirm Password"
        required
        disabled={isPending}
        className="w-full rounded-xl border px-4 py-3 text-sm disabled:opacity-60"
      />

      {state.error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-[#0E4B5A] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}

export default function AuthModal({
  open,
  onClose,
  defaultTab = "login",
}: {
  open: boolean;
  onClose: () => void;
  defaultTab?: Tab;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(defaultTab);

  // overall UI states
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ✅ FIX: only reset tab when modal OPENS
  useEffect(() => {
    if (!open) return;
    setTab(defaultTab);
    setBusy(false);
    setShowSuccess(false);
  }, [open, defaultTab]);

  if (!open) return null;

  const handleSuccess = () => {
    // prevent double click + show success overlay, then redirect
    setShowSuccess(true);

    // small delay so user sees the success overlay (also prevents rapid clicks)
    setTimeout(() => {
      onClose();
      router.push("/client-dashboard");
      router.refresh();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* overlays */}
        {busy && <LoadingOverlay message="Processing..." />}
        {showSuccess && <SuccessOverlay />}

        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("login")}
              disabled={busy || showSuccess}
              className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                tab === "login"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Log in
            </button>
            <button
              onClick={() => setTab("signup")}
              disabled={busy || showSuccess}
              className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                tab === "signup"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              Sign up
            </button>
          </div>

          <button
            onClick={onClose}
            disabled={busy || showSuccess}
            className="text-slate-500 hover:text-slate-700 disabled:opacity-60"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6">
          {tab === "login" ? (
            <SignInForm
              onBusyChange={setBusy}
              onSuccessOverlay={() => setShowSuccess(true)}
              onSuccess={handleSuccess}
            />
          ) : (
            <SignUpForm
              onBusyChange={setBusy}
              onSuccessOverlay={() => setShowSuccess(true)}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
