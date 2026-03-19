"use client";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function BookingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  return (
    <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="border border-gray-300 rounded-2xl p-10" style={{ background: "#E0EEE0" }}>
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-black mb-2">Đặt sân thành công!</h2>
          <p className="text-gray-600 text-sm mb-2">Mã booking: <span className="font-bold text-emerald-600">#{id}</span></p>
          <p className="text-gray-600 text-sm mb-6">Thanh toán VNPay thành công!</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/profile?tab=bookings")}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Xem lịch đặt sân
            </button>
            <button onClick={() => router.push("/")}
              className="bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 px-6 py-2.5 rounded-xl text-sm transition-colors">
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}