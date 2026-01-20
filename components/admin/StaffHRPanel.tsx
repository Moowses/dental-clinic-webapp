"use client";

import React, { useEffect, useState } from "react";
import { useActionState } from "react";

import { useAuth } from "@/lib/hooks/useAuth";
import { createEmployeeAction } from "@/app/actions/admin-actions";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300";

export default function StaffHRPanel() {
  const { user } = useAuth();
  const [token, setToken] = useState("");

  const [state, formAction, isPending] = useActionState(createEmployeeAction, {
    success: false,
  });

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(setToken);
  }, [user]);

  return (
    <Card title="Add User" subtitle="Admin • Create dentist / front desk / admin accounts">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="idToken" value={token} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            name="displayName"
            placeholder="Full Name"
            className={inputBase}
            required
          />
          <input
            name="email"
            type="email"
            placeholder="Email"
            className={inputBase}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            name="password"
            type="password"
            placeholder="Temporary Password"
            className={inputBase}
            required
          />
          <select name="role" className={inputBase} defaultValue="dentist">
            <option value="dentist">Dentist</option>
            <option value="front-desk">Front Desk</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl bg-slate-900 text-white py-2.5 font-extrabold hover:bg-black disabled:opacity-60"
        >
          {isPending ? "Creating..." : "Create Staff Account"}
        </button>

        {state.success ? (
          <p className="text-emerald-700 text-xs font-extrabold text-center">
            Account created successfully.
          </p>
        ) : null}

        {state.error ? (
          <p className="text-red-700 text-xs font-extrabold text-center">{state.error}</p>
        ) : null}

        <p className="text-xs text-slate-500">
          Tip: Use a temporary password and ask staff to change it on first login (if you’ll add
          that setting later).
        </p>
      </form>
    </Card>
  );
}
