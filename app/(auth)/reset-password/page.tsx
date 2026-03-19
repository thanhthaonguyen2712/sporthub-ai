"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!token) setError("Link không hợp lệ!");
  }, [token]);

  async function handleReset() {
    if (!password || !confirm) { setError("Vui lòng điền đầy đủ!"); return; }
    if (password !== confirm) { setError("Mật khẩu xác nhận không khớp!"); return; }
    if (password.length < 6) { setError("Mật khẩu phải ít nhất 6 ký tự!"); return; }

    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } else {
      setError(data.error || "Có lỗi xảy ra!");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <div className="w-full max-w-md border border-gray-300 rounded-2xl p-8" style={{ background: "#E0EEE0" }}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-2xl font-bold text-black">Đặt lại mật khẩu</h1>
        </div>

        {success ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="font-semibold text-black mb-2">Đặt lại mật khẩu thành công!</p>
            <p className="text-gray-500 text-sm mb-4">Đang chuyển về trang đăng nhập...</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block font-medium">Mật khẩu mới</label>
                <div className="relative">
                  <input type={show ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới..."
                    className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 pr-10" />
                  <button onClick={() => setShow(!show)}
                    className="absolute right-3 top-3 text-gray-400 text-sm">{show ? "🙈" : "👁️"}</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1.5 block font-medium">Xác nhận mật khẩu</label>
                <input type={show ? "text" : "password"} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Nhập lại mật khẩu..."
                  className="w-full bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400" />
              </div>
            </div>

            {error && <p className="text-red-500 text-xs mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button onClick={handleReset} disabled={loading || !token}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
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