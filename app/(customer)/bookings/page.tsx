"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";

interface Court {
  id: number;
  name: string;
  category: { name: string; iconUrl: string };
  facility: { id: number; name: string; address: string };
}

interface Service {
  id: number;
  name: string;
  type: string;
  price: string;
  stockQuantity: number;
}

export default function BookingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const courtId = searchParams.get("courtId");
  const date = searchParams.get("date");
  const startTime = searchParams.get("start");
  const endTime = searchParams.get("end");
  const priceParam = searchParams.get("price");

  const [court, setCourt] = useState<Court | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<{ id: number; quantity: number }[]>([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherMsg, setVoucherMsg] = useState("");
  const [discount, setDiscount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const courtPrice = Number(priceParam) || 0;
  const serviceTotal = selectedServices.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.id);
    return sum + (svc ? Number(svc.price) * item.quantity : 0);
  }, 0);
  const totalPrice = courtPrice + serviceTotal;
  const finalTotal = Math.max(totalPrice - discount, 0);

  useEffect(() => {
    if (!courtId) return;
    fetch(`/api/facilities/${courtId}`)
      .then((r) => r.json())
      .then((data) => {
        // Lấy thông tin court từ facility detail
        setCourt({
          id: Number(courtId),
          name: data.courts?.[0]?.name || "Sân",
          category: data.courts?.[0]?.category || { name: "", iconUrl: "" },
          facility: { id: data.id, name: data.name, address: data.address },
        });
        setServices(data.services || []);
      });

    // Lấy số dư ví
    fetch("/api/wallet")
      .then((r) => r.json())
      .then((data) => setWalletBalance(Number(data.balance) || 0));
  }, [courtId]);

  function toggleService(serviceId: number) {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === serviceId);
      if (exists) return prev.filter((s) => s.id !== serviceId);
      return [...prev, { id: serviceId, quantity: 1 }];
    });
  }

  function updateQty(serviceId: number, qty: number) {
    if (qty < 1) return;
    setSelectedServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, quantity: qty } : s))
    );
  }

  async function applyVoucher() {
    if (!voucherCode) return;
    const res = await fetch(`/api/vouchers/check?code=${voucherCode}&total=${totalPrice}`);
    const data = await res.json();
    if (!res.ok) {
      setVoucherMsg(data.error);
      setDiscount(0);
    } else {
      setDiscount(data.discount);
      setVoucherMsg(`✅ Giảm ${data.discount.toLocaleString("vi-VN")}đ`);
    }
  }

  async function handleBooking() {
    if (!session) {
      router.push("/login");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courtId: Number(courtId),
        bookingDate: date,
        startTime,
        endTime,
        totalPrice: finalTotal,
        serviceIds: selectedServices,
        voucherCode: voucherCode || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      alert(data.error || "Đặt sân thất bại!");
    }
  }

  if (success) {
    return (
      <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="border border-gray-300 rounded-2xl p-10" style={{ background: "#E0EEE0" }}>
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-black mb-2">Đặt sân thành công!</h2>
            <p className="text-gray-600 text-sm mb-6">Email xác nhận đã được gửi về hộp thư của bạn.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push("/profile")}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Xem lịch đặt sân
              </button>
              <button
                onClick={() => router.push("/")}
                className="bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 px-6 py-2.5 rounded-xl text-sm transition-colors"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-black mb-6">Xác nhận đặt sân</h1>

        {/* Thông tin sân */}
        <div className="border border-gray-300 rounded-2xl p-5 mb-4" style={{ background: "#E0EEE0" }}>
          <h2 className="font-semibold text-black mb-3">📋 Thông tin đặt sân</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Cơ sở</span>
              <span className="font-medium text-black">{court?.facility.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sân</span>
              <span className="font-medium text-black">{court?.name} · {court?.category.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Ngày</span>
              <span className="font-medium text-black">
                {date ? new Date(date).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Giờ</span>
              <span className="font-medium text-black">{startTime} – {endTime}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
              <span className="text-gray-600">Tiền sân</span>
              <span className="font-semibold text-emerald-600">{courtPrice.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
        </div>

        {/* Dịch vụ kèm */}
        {services.length > 0 && (
          <div className="border border-gray-300 rounded-2xl p-5 mb-4" style={{ background: "#E0EEE0" }}>
            <h2 className="font-semibold text-black mb-3">🛒 Dịch vụ kèm theo</h2>
            <div className="space-y-3">
              {services.map((svc) => {
                const selected = selectedServices.find((s) => s.id === svc.id);
                return (
                  <div key={svc.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleService(svc.id)}
                        className="w-4 h-4 accent-emerald-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-black">{svc.name}</p>
                        <p className="text-xs text-emerald-600">{Number(svc.price).toLocaleString("vi-VN")}đ/{svc.type === "RENTAL" ? "lần thuê" : "cái"}</p>
                      </div>
                    </div>
                    {selected && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(svc.id, selected.quantity - 1)} className="w-7 h-7 bg-gray-200 rounded-full text-sm font-bold hover:bg-gray-300">-</button>
                        <span className="text-sm font-medium w-5 text-center">{selected.quantity}</span>
                        <button onClick={() => updateQty(svc.id, selected.quantity + 1)} className="w-7 h-7 bg-gray-200 rounded-full text-sm font-bold hover:bg-gray-300">+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voucher */}
        <div className="border border-gray-300 rounded-2xl p-5 mb-4" style={{ background: "#E0EEE0" }}>
          <h2 className="font-semibold text-black mb-3">🎁 Mã giảm giá</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder="Nhập mã voucher..."
              className="flex-1 bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
            />
            <button
              onClick={applyVoucher}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Áp dụng
            </button>
          </div>
          {voucherMsg && (
            <p className={`text-xs mt-2 ${discount > 0 ? "text-emerald-600" : "text-red-500"}`}>
              {voucherMsg}
            </p>
          )}
        </div>

        {/* Tổng tiền + Thanh toán */}
        <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
          <h2 className="font-semibold text-black mb-3">💳 Thanh toán</h2>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Tiền sân</span>
              <span>{courtPrice.toLocaleString("vi-VN")}đ</span>
            </div>
            {serviceTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Dịch vụ</span>
                <span>{serviceTotal.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Giảm giá</span>
                <span>-{discount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-2">
              <span>Tổng cộng</span>
              <span className="text-emerald-600">{finalTotal.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>

          {/* Số dư ví */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4">
            <div>
              <p className="text-sm font-medium text-black">💰 Ví SportHub</p>
              <p className="text-xs text-gray-500">Số dư: {walletBalance.toLocaleString("vi-VN")}đ</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${walletBalance >= finalTotal ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
              {walletBalance >= finalTotal ? "Đủ số dư" : "Không đủ"}
            </span>
          </div>

          {walletBalance < finalTotal && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-xs text-yellow-700">
              ⚠️ Số dư ví không đủ. Vui lòng nạp thêm tiền vào ví trước khi đặt sân.
              <button onClick={() => router.push("/profile")} className="ml-2 underline font-medium">Nạp tiền ngay</button>
            </div>
          )}

          <button
            onClick={handleBooking}
            disabled={loading || walletBalance < finalTotal}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? "Đang xử lý..." : `Xác nhận đặt sân · ${finalTotal.toLocaleString("vi-VN")}đ`}
          </button>
        </div>

        <button onClick={() => router.back()} className="mt-5 text-sm text-gray-500 hover:text-black transition-colors">
          ← Quay lại
        </button>
      </div>
    </div>
  );
}