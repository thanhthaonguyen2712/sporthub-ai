"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email) { setError("Vui lòng nhập email!"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (res.ok) setSent(true);
    else setError("Có lỗi xảy ra, thử lại!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <div className="w-full max-w-md border border-gray-300 rounded-2xl p-8" style={{ background: "#E0EEE0" }}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold text-black">Quên mật khẩu</h1>
          <p className="text-gray-500 text-sm mt-1">Nhập email để nhận link đặt lại mật khẩu</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <p className="font-semibold text-black mb-2">Email đã được gửi!</p>
            <p className="text-gray-500 text-sm mb-6">Kiểm tra hộp thư <b>{email}</b> và click vào link để đặt lại mật khẩu. Link có hiệu lực trong 30 phút.</p>
            <Link href="/login" className="text-emerald-600 hover:underline text-sm">← Quay lại đăng nhập</Link>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1.5 block font-medium">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Nhập email của bạn..."
                className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 transition-all" />
            </div>

            {error && <p className="text-red-500 text-xs mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button onClick={handleSubmit} disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              <Link href="/login" className="text-emerald-600 hover:underline">← Quay lại đăng nhập</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}