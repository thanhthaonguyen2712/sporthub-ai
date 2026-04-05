"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError(t("wrongCredentials"));
    } else {
      const session = await getSession();
      const role = (session?.user as any)?.role;
      if (role === "ADMIN") router.push("/admin/dashboard");
      else if (role === "OWNER") router.push("/owner/dashboard");
      else if (role === "STAFF" || role === "WAREHOUSE_MANAGER") router.push("/staff/dashboard");
      else router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <div className="relative w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <img src="/logo.png" className="w-10 h-10 rounded-xl" alt="SportHub Logo" />
            </div>
            <span className="text-black text-2xl font-bold tracking-tight">
              Sport<span className="text-emerald-600">Hub</span>
            </span>
          </div>
          <p className="text-gray-600 text-sm">{t("platform")}</p>
        </div>

        {/* Card */}
        <div className="border border-gray-300 rounded-2xl p-8 shadow-lg" style={{ background: "#E0EEE0" }}>
          <h1 className="text-black text-2xl font-bold mb-1">{t("loginTitle")}</h1>
          <p className="text-gray-600 text-sm mb-6">{t("loginSubtitle")}</p>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("email")}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="example@gmail.com"
                required
                className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 transition-all"
              />
            </div>

            <div>
              <label className="text-gray-700 text-sm font-medium block mb-1.5">{t("password")}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
                className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 transition-all"
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm mt-2">
              {loading ? t("logging") : t("loginBtn")}
            </button>
          </form>

          <p className="text-right mt-3">
            <Link href="/forgot-password" className="text-sm text-emerald-600 hover:underline">
              {t("forgotPassword")}
            </Link>
          </p>
          <p className="text-center text-gray-600 text-sm mt-2">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-emerald-600 hover:text-emerald-700 font-medium ml-1">
              {t("registerNow")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}