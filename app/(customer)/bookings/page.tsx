"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useTranslations } from "next-intl";

interface Court {
  id: number;
  name: string;
  category: { id: number; name: string; iconUrl: string };
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
  const facilityId = searchParams.get("facilityId");
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
  const [paymentMethod, setPaymentMethod] = useState<"WALLET" | "QR">("WALLET");
  const [loading, setLoading] = useState(false);
  const [successBookingId, setSuccessBookingId] = useState<number | null>(null);
  const [teammateStep, setTeammateStep] = useState<"ask" | "form" | "done">("ask");
  const [tmForm, setTmForm] = useState({ requiredPlayers: "4", level: "BEGINNER", description: "" });
  const [tmSubmitting, setTmSubmitting] = useState(false);
  const t = useTranslations("booking");

  const courtPrice = Number(priceParam) || 0;
  const serviceTotal = selectedServices.reduce((sum, item) => {
    const svc = services.find((s) => s.id === item.id);
    return sum + (svc ? Number(svc.price) * item.quantity : 0);
  }, 0);
  const totalPrice = courtPrice + serviceTotal;
  const finalTotal = Math.max(totalPrice - discount, 0);

  useEffect(() => {
    if (!courtId || !facilityId) return;
    fetch(`/api/facilities/${facilityId}`)
      .then((r) => r.json())
      .then((data) => {
        const courtData = data.courts?.find((c: any) => c.id === Number(courtId));
        setCourt({
          id: Number(courtId),
          name: courtData?.name || "Sân",
          category: courtData?.category || { id: 0, name: "", iconUrl: "" },
          facility: { id: data.id, name: data.name, address: data.address },
        });
        const uniqueServices = (data.services || []).filter(
          (s: any, index: number, self: any[]) =>
            index === self.findIndex((t: any) => t.name === s.name)
        );
        setServices(uniqueServices);
      });

    fetch("/api/wallet")
      .then((r) => r.json())
      .then((data) => setWalletBalance(Number(data.balance) || 0));
  }, [courtId, facilityId]);

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
      setVoucherMsg(`Giảm ${data.discount.toLocaleString("vi-VN")}đ`);
    }
  }

  async function handleBooking() {
    if (!session) { router.push("/login"); return; }
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
        paymentMethod: "WALLET",
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setSuccessBookingId(data.bookingId);
    else alert(data.error || "Đặt sân thất bại!");
  }

  async function handleVNPay() {
    setLoading(true);
    const res = await fetch("/api/payment/vnpay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: finalTotal,
        orderInfo: `Dat san ${court?.name} - ${court?.facility.name}`,
        bookingData: {
          courtId,
          bookingDate: date,
          startTime,
          endTime,
          totalPrice: finalTotal,
          serviceIds: selectedServices,
          voucherCode: voucherCode || undefined,
        },
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.payUrl) {
      window.location.href = data.payUrl;
    } else {
      alert(data.error || "Lỗi kết nối VNPay!");
    }
  }

  async function handleTeammatePost() {
    if (!successBookingId || !court) return;
    setTmSubmitting(true);
    const numRequired = Number(tmForm.requiredPlayers);
    const pricePerPerson = numRequired > 1 ? Math.ceil(finalTotal / numRequired) : 0;
    const res = await fetch("/api/match-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: court.facility.id,
        categoryId: court.category.id,
        matchDate: date,
        startTime,
        endTime,
        level: tmForm.level,
        requiredPlayers: numRequired,
        description: tmForm.description,
        bookingId: successBookingId,
        courtName: court.name,
        totalPrice: finalTotal,
      }),
    });
    setTmSubmitting(false);
    if (res.ok) setTeammateStep("done");
    else {
      const d = await res.json();
      alert(d.error || "Không thể đăng bài!");
    }
  }

  if (successBookingId !== null) {
    const pricePerPerson = Number(tmForm.requiredPlayers) > 1
      ? Math.ceil(finalTotal / Number(tmForm.requiredPlayers))
      : 0;

    if (teammateStep === "done") {
      return (
        <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
          <Navbar />
          <div className="max-w-lg mx-auto px-6 py-20 text-center">
            <div className="border border-gray-300 rounded-2xl p-10" style={{ background: "#E0EEE0" }}>
              <div className="flex justify-center mb-4"><img src="/group.png" className="w-16 h-16" alt="" /></div>
              <h2 className="text-2xl font-bold text-black mb-2">Đã đăng tìm đồng đội!</h2>
              <p className="text-gray-600 text-sm mb-6">Bài đăng của bạn đã được công khai. Người khác sẽ thấy và tham gia nhóm.</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => router.push("/profile?tab=bookings")}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {t("viewBookings")}
                </button>
                <button onClick={() => router.push("/")}
                  className="bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 px-6 py-2.5 rounded-xl text-sm transition-colors">
                  {t("backHome")}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (teammateStep === "form") {
      return (
        <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
          <Navbar />
          <div className="max-w-lg mx-auto px-6 py-8">
            <div className="border border-gray-300 rounded-2xl p-6" style={{ background: "#E0EEE0" }}>
              <div className="flex items-center gap-3 mb-5">
                <img src="/group.png" className="w-8 h-8" alt="" />
                <h2 className="text-xl font-bold text-black">Tìm đồng đội</h2>
              </div>

              {/* Thông tin sân đã đặt */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <img src="/placeholder.png" className="w-4 h-4 flex-shrink-0" alt="" />
                  <span className="font-medium">{court?.name}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{court?.facility.name}</span>
                </div>
                <div className="text-gray-500 pl-6">{court?.facility.address}</div>
                <div className="flex items-center gap-2 text-gray-700">
                  <img src="/calendar.png" className="w-4 h-4 flex-shrink-0" alt="" />
                  <span>
                    {date ? new Date(date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }) : ""}
                    {" · "}{startTime} – {endTime}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-700 border-t border-gray-100 pt-2">
                  <img src="/atm-card.png" className="w-4 h-4 flex-shrink-0" alt="" />
                  <span>Tổng đã trả: <span className="font-semibold text-emerald-600">{finalTotal.toLocaleString("vi-VN")}đ</span></span>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Cần bao nhiêu người? (bao gồm bạn)</label>
                  <input type="number" min="2" max="30"
                    value={tmForm.requiredPlayers}
                    onChange={(e) => setTmForm((f) => ({ ...f, requiredPlayers: e.target.value }))}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>

                {/* Giá mỗi người */}
                {pricePerPerson > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-emerald-700 font-medium">
                      Mỗi người trả: <span className="text-base font-bold">{pricePerPerson.toLocaleString("vi-VN")}đ</span>
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      = {finalTotal.toLocaleString("vi-VN")}đ ÷ {tmForm.requiredPlayers} người · Thanh toán qua ví SportHub
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Trình độ</label>
                  <select value={tmForm.level} onChange={(e) => setTmForm((f) => ({ ...f, level: e.target.value }))}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400">
                    <option value="BEGINNER">Người mới</option>
                    <option value="INTERMEDIATE">Trung bình</option>
                    <option value="PRO">Chuyên nghiệp</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Mô tả (không bắt buộc)</label>
                  <textarea value={tmForm.description}
                    onChange={(e) => setTmForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="VD: Tìm 3 bạn cùng chơi cầu lông, vui vẻ là chính..."
                    rows={3}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button onClick={handleTeammatePost} disabled={tmSubmitting}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
                    {tmSubmitting ? "Đang đăng..." : "Đăng tìm đồng đội"}
                  </button>
                  <button onClick={() => router.push("/profile?tab=bookings")}
                    className="flex-1 bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 py-3 rounded-xl text-sm transition-colors">
                    Bỏ qua
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // teammateStep === "ask"
    return (
      <div className="min-h-screen" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-6 py-20 text-center">
          <div className="border border-gray-300 rounded-2xl p-10" style={{ background: "#E0EEE0" }}>
            <div className="flex justify-center mb-4"><img src="/giftbox.png" className="w-16 h-16" alt="" /></div>
            <h2 className="text-2xl font-bold text-black mb-2">{t("success")}</h2>
            <p className="text-gray-600 text-sm mb-6">{t("successMsg")}</p>

            {/* Tìm đồng đội CTA */}
            <div className="bg-white border border-emerald-200 rounded-xl px-5 py-4 mb-6 text-left">
              <div className="flex items-center gap-2 mb-2">
                <img src="/group.png" className="w-5 h-5" alt="" />
                <span className="font-semibold text-black text-sm">Bạn muốn tìm đồng đội?</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">Đăng bài để mọi người cùng tham gia và chia sẻ chi phí sân.</p>
              <button onClick={() => setTeammateStep("form")}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                <img src="/group.png" className="w-4 h-4" alt="" />
                Tìm đồng đội
              </button>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={() => router.push("/profile?tab=bookings")}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
                {t("viewBookings")}
              </button>
              <button onClick={() => router.push("/")}
                className="bg-white border border-gray-300 text-gray-600 hover:border-emerald-400 px-6 py-2.5 rounded-xl text-sm transition-colors">
                {t("backHome")}
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
        <h1 className="text-2xl font-bold text-black mb-6">{t("confirm")}</h1>

        {/* Thông tin sân */}
        <div className="border border-gray-300 rounded-2xl p-5 mb-4" style={{ background: "#E0EEE0" }}>
          <h2 className="font-semibold text-black mb-3">{t("courtInfo")}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("facility")}</span>
              <span className="font-medium text-black">{court?.facility.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("court")}</span>
              <span className="font-medium text-black">{court?.name} · {court?.category.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("date")}</span>
              <span className="font-medium text-black">
                {date ? new Date(date).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("time")}</span>
              <span className="font-medium text-black">{startTime} – {endTime}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2">
              <span className="text-gray-600">{t("courtFee")}</span>
              <span className="font-semibold text-emerald-600">{courtPrice.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>
        </div>

        {/* Dịch vụ kèm */}
        {services.length > 0 && (
          <div className="border border-gray-300 rounded-2xl p-5 mb-4" style={{ background: "#E0EEE0" }}>
            <h2 className="font-semibold text-black mb-3">{t("services")}</h2>
            <div className="space-y-3">
              {services.map((svc) => {
                const selected = selectedServices.find((s) => s.id === svc.id);
                return (
                  <div key={svc.id} onClick={() => toggleService(svc.id)}
                    className={`flex items-center justify-between border rounded-xl px-4 py-3 cursor-pointer transition-colors ${selected ? "bg-emerald-50 border-emerald-400" : "bg-white border-gray-200 hover:border-emerald-300"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${selected ? "bg-emerald-500 border-emerald-500" : "border-gray-300"}`}>
                        {selected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-black">{svc.name}</p>
                        <p className="text-xs text-emerald-600">{Number(svc.price).toLocaleString("vi-VN")}đ/{svc.type === "RENTAL" ? t("rental") : t("piece")}</p>
                      </div>
                    </div>
                    {selected && (
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); updateQty(svc.id, selected.quantity - 1); }} className="w-7 h-7 bg-gray-200 rounded-full text-sm font-bold hover:bg-gray-300">-</button>
                        <span className="text-sm font-medium w-5 text-center">{selected.quantity}</span>
                        <button onClick={(e) => { e.stopPropagation(); updateQty(svc.id, selected.quantity + 1); }} className="w-7 h-7 bg-gray-200 rounded-full text-sm font-bold hover:bg-gray-300">+</button>
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
          <h2 className="font-semibold text-black mb-3 flex items-center gap-2">
            <img src="/giftbox.png" alt="" className="w-5 h-5" />
            {t("voucher")}
          </h2>
          <div className="flex gap-2">
            <input type="text" value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder={t("voucherPlaceholder")}
              className="flex-1 bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
            <button onClick={applyVoucher}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
              {t("apply")}
            </button>
          </div>
          {voucherMsg && (
            <p className={`text-xs mt-2 ${discount > 0 ? "text-emerald-600" : "text-red-500"}`}>{voucherMsg}</p>
          )}
        </div>

        {/* Tổng tiền + Thanh toán */}
        <div className="border border-gray-300 rounded-2xl p-5" style={{ background: "#E0EEE0" }}>
          <h2 className="font-semibold text-black mb-3 flex items-center gap-2">
            <img src="/atm-card.png" alt="" className="w-5 h-5" />
            {t("payment")}
          </h2>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">{t("courtFee")}</span>
              <span>{courtPrice.toLocaleString("vi-VN")}đ</span>
            </div>
            {serviceTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">{t("service")}</span>
                <span>{serviceTotal.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>{t("discount")}</span>
                <span>-{discount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-300 pt-2 mt-2">
              <span>{t("total")}</span>
              <span className="text-emerald-600">{finalTotal.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>

          {/* Chọn phương thức thanh toán */}
          <div className="space-y-2 mb-4">
            {/* Ví SportHub */}
            <div onClick={() => setPaymentMethod("WALLET")}
              className={`flex items-center justify-between bg-white border rounded-xl px-4 py-3 cursor-pointer transition-colors ${paymentMethod === "WALLET" ? "border-emerald-400 bg-emerald-50" : "border-gray-200"}`}>
              <div className="flex items-center gap-3">
                <input type="radio" checked={paymentMethod === "WALLET"} onChange={() => setPaymentMethod("WALLET")} className="accent-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-black flex items-center gap-1.5">
                    <img src="/wallet.png" alt="" className="w-4 h-4" />
                    {t("walletSportHub")}
                  </p>
                  <p className="text-xs text-gray-500">{t("walletBalance")} {walletBalance.toLocaleString("vi-VN")}đ</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${walletBalance >= finalTotal ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                {walletBalance >= finalTotal ? t("sufficient") : t("insufficient")}
              </span>
            </div>

            {/* VNPay */}
            <div onClick={() => setPaymentMethod("QR")}
              className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 cursor-pointer transition-colors ${paymentMethod === "QR" ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
              <input type="radio" checked={paymentMethod === "QR"} onChange={() => setPaymentMethod("QR")} className="accent-blue-500" />
              <div className="flex items-center gap-2">
                <img src="/vnpay.png" className="w-8 h-8 object-contain rounded" alt="VNPay" />
                <div>
                  <p className="text-sm font-medium text-black">{t("vnpayPayment")}</p>
                  <p className="text-xs text-gray-500">{t("atm")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cảnh báo số dư ví */}
          {paymentMethod === "WALLET" && walletBalance < finalTotal && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-4 text-xs text-yellow-700">
              {t("insufficientMsg")}
              <button onClick={() => router.push("/profile?tab=wallet")} className="ml-2 underline font-medium">{t("topupNow")}</button>
            </div>
          )}

          <button
            onClick={paymentMethod === "QR" ? handleVNPay : handleBooking}
            disabled={loading || (paymentMethod === "WALLET" && walletBalance < finalTotal)}
            className={`w-full font-semibold py-3 rounded-xl transition-colors text-sm ${
              paymentMethod === "QR"
                ? "bg-blue-500 hover:bg-blue-400 text-white"
                : "bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-300 disabled:cursor-not-allowed text-white"
            }`}>
            {loading ? t("processing") : paymentMethod === "QR"
            ? `${t("vnpayBtn")} · ${finalTotal.toLocaleString("vi-VN")}đ`
            : `${t("confirmBtn")} · ${finalTotal.toLocaleString("vi-VN")}đ`}
          </button>
        </div>

        <button onClick={() => router.back()} className="mt-5 text-sm text-gray-500 hover:text-black transition-colors">
          {t("back")}
        </button>
      </div>
    </div>
  );
}
