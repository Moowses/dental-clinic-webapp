"use client";

import { useActionState } from "react";
import { signInAction, signUpAction } from "@/app/actions/auth-actions";

type State = {
  success: boolean;
  error?: string;
};

function SignInForm() {
  const [state, formAction] = useActionState<State, FormData>(signInAction, {
    success: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Sign In</h2>
      <form action={formAction} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-40"
        >
          Sign In
        </button>
      </form>
      {state.success && (
        <p className="text-green-500">Signed in successfully!</p>
      )}
      {state.error && <p className="text-red-500">{state.error[0]}</p>}
    </div>
  );
}

function SignUpForm() {
  const [state, formAction] = useActionState<State, FormData>(signUpAction, {
    success: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-bold">Sign Up</h2>
      <form action={formAction} className="flex flex-col gap-4">
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <input
          name="confirmPassword"
          type="password"
          placeholder="Confirm Password"
          className="rounded-md border border-zinc-300 px-4 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-40"
        >
          Sign Up
        </button>
      </form>
      {state.success && (
        <p className="text-green-500">Signed up successfully!</p>
      )}
      {state.error && <p className="text-red-500">{JSON.parse(state.error)}</p>}
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <SignInForm />
        <SignUpForm />
      </div>
    </div>
  );
}
