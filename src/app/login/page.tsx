"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-info-bg">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-border p-8 shadow-sm">
        <div className="text-center mb-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.svg" alt="" aria-hidden="true" className="h-20 w-20 mb-2" />
          <h1 className="font-display text-3xl text-forest leading-tight">
            ألبان وأجبان القصر
          </h1>
          <p className="text-muted text-xs mt-1">عرّابة — جنين</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-ink mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm text-ink mb-1">كلمة المرور</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-danger text-sm p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-primary text-white font-semibold py-3 shadow-sm hover:bg-primary-dk transition-colors disabled:opacity-60"
          >
            {isPending ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </main>
  );
}
