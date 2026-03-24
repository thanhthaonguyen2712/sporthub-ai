"use client";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
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
          <div className="flex justify-center mb-4">
            <Image src="/giftbox.png" alt="Thành công" width={72} height={72} />
          </div>
          <h2 className="text-2xl font-bold text-black mb-4">Đặt sân thành công!</h2>
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Image src="/atm-card.png" alt="Thanh toán" width={20} height={20} />
              <span>Thanh toán VNPay thành công</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Image src="/list.png" alt="Mã booking" width={20} height={20} />
              <span>Mã booking: <span className="font-bold text-emerald-600">#{id}</span></span>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/profile?tab=bookings")}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
              <Image src="/list.png" alt="" width={16} height={16} />
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