"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PricingRule {
  id: number;
  startTime: string;
  endTime: string;
  pricePerHour: number;
  dayType: string;
}

interface Court {
  id: number;
  name: string;
  category: { name: string; iconUrl: string; slug: string };
  pricingRules: PricingRule[];
}

interface Service {
  id: number;
  name: string;
  type: string;
  price: number;
}

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  customer: { fullName: string };
}

interface Facility {
  id: number;
  name: string;
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  sports: { id: number; name: string; iconUrl: string; slug: string }[];
  courts: Court[];
  services: Service[];
  reviews: Review[];
  avgRating: string | null;
  owner: { fullName: string; phone: string };
}

function formatTime(isoTime: string) {
  const d = new Date(isoTime);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("vi-VN").format(price) + "đ";
}

export default function FacilityDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"courts" | "services" | "reviews">("courts");

  useEffect(() => {
    fetch(`/api/facilities/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setFacility(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Đang tải...</div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Không tìm thấy sân</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-sm">⚡</div>
            <span className="font-bold text-lg">Sport<span className="text-emerald-400">Hub</span></span>
          </Link>
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      </nav>

      {/* Hero banner */}
      <div className="bg-gradient-to-br from-slate-800 to-emerald-900/30 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start gap-6">
            {/* Icon */}
            <div className="w-20 h-20 bg-slate-700/60 rounded-2xl flex items-center justify-center flex-shrink-0">
              {facility.sports?.[0]?.iconUrl
                ? <img src={facility.sports[0].iconUrl} className="w-10 h-10" />
                : <span className="text-3xl"></span>
              }
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{facility.name}</h1>
              <p className="text-slate-400 text-sm mb-3">📍 {facility.address}</p>

              {/* Sports */}
              <div className="flex gap-2 flex-wrap mb-3">
                {(facility.sports || []).map((s) => (
                  <span key={s.id} className="flex items-center gap-1 bg-slate-700/60 text-slate-300 text-xs px-3 py-1 rounded-full">
                    <img src={s.iconUrl} className="w-3.5 h-3.5" />
                    {s.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm">
                {facility.avgRating && (
                  <span className="text-yellow-400">⭐ {facility.avgRating} ({facility.reviews?.length || 0} đánh giá)</span>
                )}
                <span className="text-slate-400">🏸 {facility.courts?.length || 0} sân</span>
                <span className="text-slate-400">📞 {facility.owner?.phone}</span>
              </div>
            </div>

            {/* Booking button */}
            <button className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex-shrink-0">
              Đặt sân ngay
            </button>
          </div>

          {facility.description && (
            <p className="text-slate-400 text-sm mt-4 max-w-2xl">{facility.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 mb-6 w-fit">
          {(["courts", "services", "reviews"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab === "courts" ? `🏸 Danh sách sân (${facility.courts?.length || 0})` :
                tab === "services" ? `🛒 Dịch vụ (${facility.services?.length || 0})` :
                `⭐ Đánh giá (${facility.reviews?.length || 0})`}
            </button>
          ))}
        </div>

        {/* Tab: Courts */}
        {activeTab === "courts" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {facility.courts.map((court) => (
              <div key={court.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <img src={court.category.iconUrl} className="w-8 h-8" />
                  <div>
                    <h3 className="font-semibold">{court.name}</h3>
                    <p className="text-slate-400 text-xs">{court.category.name}</p>
                  </div>
                </div>

                {/* Pricing rules */}
                {court.pricingRules.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Bảng giá</p>
                    {court.pricingRules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between bg-slate-700/40 rounded-lg px-3 py-2">
                        <span className="text-slate-300 text-xs">
                          {formatTime(rule.startTime)} – {formatTime(rule.endTime)}
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                            rule.dayType === "WEEKEND"
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}>
                            {rule.dayType === "WEEKEND" ? "Cuối tuần" : "Ngày thường"}
                          </span>
                        </span>
                        <span className="text-emerald-400 font-semibold text-sm">
                          {formatPrice(rule.pricePerHour)}/giờ
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-xs">Chưa có bảng giá</p>
                )}

                <button className="w-full mt-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm py-2 rounded-xl transition-colors">
                  Đặt sân này
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Services */}
        {activeTab === "services" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {facility.services.length === 0 ? (
              <p className="text-slate-500 col-span-3">Chưa có dịch vụ</p>
            ) : (
              facility.services.map((s) => (
                <div key={s.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                      s.type === "RENTAL"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {s.type === "RENTAL" ? "Cho thuê" : "Sản phẩm"}
                    </span>
                  </div>
                  <span className="text-emerald-400 font-semibold">{formatPrice(s.price)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Reviews */}
        {activeTab === "reviews" && (
          <div className="space-y-4">
            {facility.reviews.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p className="text-3xl mb-2">⭐</p>
                <p>Chưa có đánh giá nào</p>
              </div>
            ) : (
              facility.reviews.map((r) => (
                <div key={r.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{r.customer.fullName}</span>
                    <span className="text-yellow-400">{"⭐".repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p className="text-slate-400 text-sm">{r.comment}</p>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}