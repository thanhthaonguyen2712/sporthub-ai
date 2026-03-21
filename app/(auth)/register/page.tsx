"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("auth");

  const ROLES = [
    {
      id: "CUSTOMER",
      label: t("customer"),
      desc: t("customerDesc"),
      features: [t("customerFeat1"), t("customerFeat2"), t("customerFeat3"), t("customerFeat4")],
    },
    {
      id: "OWNER",
      label: t("owner"),
      desc: t("ownerDesc"),
      features: [t("ownerFeat1"), t("ownerFeat2"), t("ownerFeat3"), t("ownerFeat4")],
      highlight: true,
    },
  ];

  const [role, setRole] = useState<"CUSTOMER" | "OWNER">("CUSTOMER");
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) { setError(t("passwordMismatch")); return; }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: form.fullName, email: form.email, phone: form.phone, password: form.password, role }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) setError(data.error || t("registerFailed"));
    else router.push("/login?registered=true");
  }

  const fields = [
    { label: t("fullName"), key: "fullName", type: "text", placeholder: "Nguyễn Văn A" },
    { label: t("email"), key: "email", type: "email", placeholder: "example@gmail.com" },
    { label: t("phone"), key: "phone", type: "tel", placeholder: "0901234567" },
    { label: t("password"), key: "password", type: "password", placeholder: "••••••••" },
    { label: t("confirmPassword"), key: "confirmPassword", type: "password", placeholder: "••••••••" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <img src="/logo.png" className="w-10 h-10 rounded-xl" alt="SportHub Logo" />
            <span className="text-black text-2xl font-bold tracking-tight">
              Sport<span className="text-emerald-600">Hub</span>
            </span>
          </div>
          <p className="text-gray-600 text-sm">{t("registerFree")}</p>
        </div>

        <div className="border border-gray-300 rounded-2xl p-8 shadow-lg" style={{ background: "#E0EEE0" }}>
          <h1 className="text-black text-2xl font-bold mb-1">{t("registerTitle")}</h1>
          <p className="text-gray-600 text-sm mb-6">{t("chooseAccountType")}</p>

          {/* Chọn loại tài khoản */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id as "CUSTOMER" | "OWNER")}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  role === r.id
                    ? r.highlight
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-emerald-500 bg-emerald-50"
                    : "border-gray-300 bg-white hover:border-gray-400"
                }`}
              >
                <div className="text-2xl mb-1.5">{r.icon}</div>
                <p className={`text-sm font-semibold mb-1 ${role === r.id ? "text-emerald-700" : "text-gray-800"}`}>
                  {r.label}
                </p>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">{r.desc}</p>
                <ul className="space-y-0.5">
                  {r.features.map((f) => (
                    <li key={f} className="text-xs text-gray-500 flex items-center gap-1">
                      <span className={role === r.id ? "text-emerald-500" : "text-gray-400"}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                {role === r.id && (
                  <div className="mt-2 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</span>
                    {t("selected")}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Note cho owner */}
          {role === "OWNER" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 text-xs text-emerald-700">
              {t("ownerNote")}
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-gray-700 text-sm font-medium block mb-1.5">{field.label}</label>
                <input
                  type={field.type}
                  value={form[field.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  required
                  className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 transition-all"
                />
              </div>
            ))}

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm mt-2">
              {loading ? t("registering") : role === "OWNER" ? t("createOwnerAccount") : t("createCustomerAccount")}
            </button>
          </form>

          <p className="text-center text-gray-600 text-sm mt-6">
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
              {t("loginNow")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
