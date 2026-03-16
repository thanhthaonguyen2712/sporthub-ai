"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface Sport {
  id: number;
  name: string;
  slug: string;
  iconUrl: string;
}

interface Facility {
  id: number;
  name: string;
  address: string;
  description: string;
  sports: { id: number; name: string; slug: string; icon: string }[];
  courtCount: number;
  avgRating: string | null;
  reviewCount: number;
}

export default function HomePage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sports")
      .then((r) => r.json())
      .then(setSports);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSport) params.set("sport", selectedSport);
    if (search) params.set("search", search);

    fetch(`/api/facilities?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setFacilities(data);
        setLoading(false);
      });
  }, [selectedSport, search]);

  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />

      {/* Hero */}
      <div className="py-16 px-6" style={{ background: "#E0EEE0" }}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-3 text-black">
            Đặt sân thể thao <span className="text-emerald-600">dễ dàng</span>
          </h1>
          <p className="text-gray-600 mb-8 text-lg">Tìm và đặt sân bóng đá, cầu lông, pickleball... gần bạn nhất</p>

          {/* Search bar */}
          <div className="flex gap-3 max-w-2xl">
            <input
              type="text"
              placeholder="Tìm tên sân hoặc địa chỉ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-emerald-400 transition-all"
            />
            <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3.5 rounded-xl text-sm font-semibold transition-colors">
              Tìm kiếm
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Filter môn thể thao */}
        <div className="flex gap-3 flex-wrap mb-8">
          <button
            onClick={() => setSelectedSport("")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedSport === ""
                ? "bg-emerald-500 text-white"
                : "bg-white text-gray-600 hover:text-black border border-gray-300"
            }`}
          >
            <img src="https://cdn-icons-png.flaticon.com/128/9385/9385212.png" className="w-5 h-5" />
            Tất cả
          </button>
          {sports.map((sport) => (
            <button
              key={sport.id}
              onClick={() => setSelectedSport(selectedSport === sport.slug ? "" : sport.slug)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedSport === sport.slug
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-gray-600 hover:text-black border border-gray-300"
              }`}
            >
              <img src={sport.iconUrl} className="w-5 h-5" />
              {sport.name}
            </button>
          ))}
        </div>

        {/* Danh sách sân */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-black">
            {loading ? "Đang tải..." : `${facilities.length} cơ sở sân`}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl h-56 animate-pulse" style={{ background: "#E0EEE0" }} />
            ))}
          </div>
        ) : facilities.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <div className="text-5xl mb-4">🔍</div>
            <p>Không tìm thấy sân phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {facilities.map((facility) => (
              <Link
                key={facility.id}
                href={`/facilities/${facility.id}`}
                className="border border-gray-300 rounded-2xl p-5 hover:border-emerald-400 transition-all group"
                style={{ background: "#E0EEE0" }}
              >
                {/* Placeholder image */}
                <div className="w-full h-36 bg-white rounded-xl mb-4 flex items-center justify-center border border-gray-200">
                  {facility.sports[0]?.icon
                    ? <img src={facility.sports[0].icon} className="w-16 h-16 opacity-80" />
                    : <span className="text-4xl">🏟️</span>
                  }
                </div>

                <h3 className="font-semibold text-black group-hover:text-emerald-600 transition-colors mb-1 line-clamp-1">
                  {facility.name}
                </h3>
                <p className="text-gray-500 text-xs mb-3 line-clamp-1">📍 {facility.address}</p>

                {/* Sports tags */}
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {facility.sports.map((s) => (
                    <span key={s.id} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      <img src={s.icon} className="w-3.5 h-3.5" />
                      {s.name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>🏸 {facility.courtCount} sân</span>
                  <span>
                    {facility.avgRating
                      ? `⭐ ${facility.avgRating} (${facility.reviewCount})`
                      : "Chưa có đánh giá"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}