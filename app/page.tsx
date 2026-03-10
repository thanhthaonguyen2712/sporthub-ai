"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-sm">⚡</div>
            <span className="font-bold text-lg">Sport<span className="text-emerald-400">Hub</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-slate-400 hover:text-white text-sm transition-colors">
              Đăng nhập
            </Link>
            <Link href="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Đăng ký
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900/40 py-16 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto relative">
          <h1 className="text-4xl font-bold mb-3">
            Đặt sân thể thao <span className="text-emerald-400">dễ dàng</span>
          </h1>
          <p className="text-slate-400 mb-8 text-lg">Tìm và đặt sân bóng đá, cầu lông, pickleball... gần bạn nhất</p>

          {/* Search bar */}
          <div className="flex gap-3 max-w-2xl">
            <input
              type="text"
              placeholder="Tìm tên sân hoặc địa chỉ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-600/50 text-white placeholder-slate-500 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
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
                : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
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
                  : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
              }`}
            >
              <img src={sport.iconUrl} className="w-5 h-5" />
              {sport.name}
            </button>
          ))}
        </div>

        {/* Danh sách sân */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {loading ? "Đang tải..." : `${facilities.length} cơ sở sân`}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-800 rounded-2xl h-56 animate-pulse" />
            ))}
          </div>
        ) : facilities.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <div className="text-5xl mb-4"></div>
            <p>Không tìm thấy sân phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {facilities.map((facility) => (
              <Link
                key={facility.id}
                href={`/facilities/${facility.id}`}
                className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 hover:border-emerald-500/40 hover:bg-slate-800 transition-all group"
              >
                {/* Placeholder image */}
                <div className="w-full h-36 bg-gradient-to-br from-emerald-900/40 to-slate-700/40 rounded-xl mb-4 flex items-center justify-center">
                  {facility.sports[0]?.icon
                    ? <img src={facility.sports[0].icon} className="w-16 h-16 opacity-80" />
                    : <span className="text-4xl"></span>
                  }
                </div>

                <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors mb-1 line-clamp-1">
                  {facility.name}
                </h3>
                <p className="text-slate-400 text-xs mb-3 line-clamp-1">📍 {facility.address}</p>

                {/* Sports tags */}
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {facility.sports.map((s) => (
                    <span key={s.id} className="flex items-center gap-1 bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
                      <img src={s.icon} className="w-3.5 h-3.5" />
                      {s.name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
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