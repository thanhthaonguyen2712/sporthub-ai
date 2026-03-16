"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Đăng ký thất bại");
    } else {
      router.push("/login?registered=true");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-10" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>

      <div className="relative w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <span className="text-white text-xl"><img src="/logo.png" className="w-10 h-10 rounded-xl" alt="SportHub Logo" /></span>
            </div>
            <span className="text-black text-2xl font-bold tracking-tight">
              Sport<span className="text-emerald-600">Hub</span>
            </span>
          </div>
          <p className="text-gray-600 text-sm">Tạo tài khoản miễn phí</p>
        </div>

        {/* Card */}
        <div className="border border-gray-300 rounded-2xl p-8 shadow-lg" style={{ background: "#E0EEE0" }}>
          <h1 className="text-black text-2xl font-bold mb-1">Đăng ký</h1>
          <p className="text-gray-600 text-sm mb-6">Điền thông tin để bắt đầu</p>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Họ và tên", key: "fullName", type: "text", placeholder: "Nguyễn Văn A" },
              { label: "Email", key: "email", type: "email", placeholder: "example@gmail.com" },
              { label: "Số điện thoại", key: "phone", type: "tel", placeholder: "0901234567" },
              { label: "Mật khẩu", key: "password", type: "password", placeholder: "••••••••" },
              { label: "Xác nhận mật khẩu", key: "confirmPassword", type: "password", placeholder: "••••••••" },
            ].map((field) => (
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white font-semibold py-3 rounded-xl transition-all duration-200 text-sm mt-2"
            >
              {loading ? "Đang đăng ký..." : "Tạo tài khoản"}
            </button>
          </form>

          <p className="text-center text-gray-600 text-sm mt-6">
            Đã có tài khoản?{" "}
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}