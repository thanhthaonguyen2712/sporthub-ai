"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useTranslations } from "next-intl";

interface Province { code: number; name: string; }
interface District { code: number; name: string; }

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
  latitude: string | null;
  longitude: string | null;
  sports: { id: number; name: string; slug: string; icon: string }[];
  courtCount: number;
  avgRating: string | null;
  reviewCount: number;
  distance?: number | null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function HomePage() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [allProvinces, setAllProvinces] = useState<Province[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const t = useTranslations("home");
  const tSports = useTranslations("sports");

  useEffect(() => {
    fetch("/api/sports").then((r) => r.json()).then(setSports);
  }, []);

  useEffect(() => {
    fetch("https://provinces.open-api.vn/api/p/")
      .then(r => r.json()).then(setAllProvinces).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProvince) { setDistricts([]); setSelectedDistrict(null); return; }
    fetch(`https://provinces.open-api.vn/api/p/${selectedProvince.code}?depth=2`)
      .then(r => r.json()).then(data => setDistricts(data.districts || [])).catch(() => {});
    setSelectedDistrict(null);
  }, [selectedProvince]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedSport) params.set("sport", selectedSport);
    if (search) params.set("search", search);
    fetch(`/api/facilities?${params}`)
      .then((r) => r.json())
      .then((data) => { setFacilities(data); setLoading(false); });
  }, [selectedSport, search]);

  function getNearMe() {
    if (!navigator.geolocation) { alert("Trình duyệt không hỗ trợ định vị!"); return; }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortByDistance(true);
        setLocationLoading(false);
      },
      () => { alert("Không thể lấy vị trí!"); setLocationLoading(false); }
    );
  }

  async function getAiSuggestion() {
    setAiLoading(true);
    setAiSuggestion("");

    // Lấy vị trí nếu chưa có
    let location = userLocation;
    if (!location && navigator.geolocation) {
      location = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null)
        );
      });
      if (location) {
        setUserLocation(location);
        setSortByDistance(true);
      }
    }

    const params = new URLSearchParams();
    if (location) {
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));
    }

    const res = await fetch(`/api/facilities/available?${params}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      setAiSuggestion("Hiện tại không có sân trống nào phù hợp. Vui lòng thử lại sau!");
      setAiLoading(false);
      return;
    }

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeStr = `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;

    const topFacilities = data.slice(0, 5);
    setAiSuggestion(JSON.stringify({ time: timeStr, facilities: topFacilities, hasLocation: !!userLocation }));
    setAiLoading(false);
  }

  function normalizePlace(name: string) {
    return name
      .replace(/^(Thành phố|Tỉnh|TP\.|TP|Quận|Huyện|Thị xã|Thị trấn|Phường|Xã)\s+/i, "")
      .toLowerCase().trim();
  }

  // Tính khoảng cách + sort
  const facilitiesWithDistance: Facility[] = facilities.map((f) => ({ ...f,
    distance: userLocation && f.latitude && f.longitude ? haversine(userLocation.lat, userLocation.lng, Number(f.latitude), Number(f.longitude)): null,
  }));
  const sortedFacilities = sortByDistance && userLocation ? [...facilitiesWithDistance].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999)): facilitiesWithDistance;

  const NEAR_ME_RADIUS_KM = 50;
  const displayedFacilities = sortedFacilities.filter(f => {
    const addr = f.address.toLowerCase();
    if (selectedProvince && !addr.includes(normalizePlace(selectedProvince.name))) return false;
    if (selectedDistrict && !addr.includes(normalizePlace(selectedDistrict.name))) return false;
    if (sortByDistance && userLocation) {
      if (f.distance == null || f.distance > NEAR_ME_RADIUS_KM) return false;
    }
    return true;
  });
  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      {/* Hero */}
      <div className="py-16 px-6" style={{ background: "#E0EEE0" }}>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-3 text-black">
            {t("title")} <span className="text-emerald-600">{t("highlight")}</span>
          </h1>

         <p className="text-gray-600 mb-8 text-lg">{t("subtitle")}</p>
          <div className="flex gap-3 max-w-2xl">
            <input
              type="text"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-white border border-gray-300 text-black placeholder-gray-400 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-emerald-400 transition-all"
            />
           <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3.5 rounded-xl text-sm font-semibold transition-colors">
            {t("searchBtn")}
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
              selectedSport === "" ? "bg-emerald-500 text-white" : "bg-white text-gray-600 hover:text-black border border-gray-300"
            }`}
          >
            <img src="https://cdn-icons-png.flaticon.com/128/9385/9385212.png" className="w-5 h-5" />
            {t("allSports")}
          </button>
          {sports.map((sport) => (
            <button
              key={sport.id}
              onClick={() => setSelectedSport(selectedSport === sport.slug ? "" : sport.slug)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedSport === sport.slug ? "bg-emerald-500 text-white" : "bg-white text-gray-600 hover:text-black border border-gray-300"
              }`}
            >
              <img src={sport.iconUrl} className="w-5 h-5" />
              {tSports(sport.name)}
            </button>
          ))}
        </div>

        {/* Bộ lọc địa điểm */}
        <div className="flex gap-3 flex-wrap mb-4">
          <select
            value={selectedProvince?.code ?? ""}
            onChange={e => setSelectedProvince(allProvinces.find(p => p.code === +e.target.value) ?? null)}
            className="bg-white border border-gray-300 text-gray-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-400"
          >
            <option value="">Tỉnh / Thành phố</option>
            {allProvinces.map(p => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
          <select
            value={selectedDistrict?.code ?? ""}
            onChange={e => setSelectedDistrict(districts.find(d => d.code === +e.target.value) ?? null)}
            disabled={!selectedProvince || districts.length === 0}
            className="bg-white border border-gray-300 text-gray-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-400 disabled:opacity-40"
          >
            <option value="">Quận / Huyện</option>
            {districts.map(d => (
              <option key={d.code} value={d.code}>{d.name}</option>
            ))}
          </select>
          {(selectedProvince || selectedDistrict) && (
            <button
              onClick={() => { setSelectedProvince(null); setSelectedDistrict(null); }}
              className="px-3 py-2 rounded-xl text-sm border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
            >
              ✕ Xoá bộ lọc
            </button>
          )}
        </div>

        {/* Header + buttons */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-black">
            {loading ? "..." : `${displayedFacilities.length} ${t("courts")}`}
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => sortByDistance ? (setSortByDistance(false), setUserLocation(null)) : getNearMe()}
              disabled={locationLoading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                sortByDistance ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"
              }`}>
              {t("nearMe")}
            </button>
            <button
              onClick={getAiSuggestion}
              disabled={aiLoading || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors">
              {aiLoading ? "..." : t("aiSuggest")}
            </button>
          </div>
        </div>

        {/* AI suggestion box */}
        {aiSuggestion && (() => {
          try {
    const parsed = JSON.parse(aiSuggestion);
    return (
      <div className="mb-5 bg-purple-50 border border-purple-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-purple-700">
            Lúc {parsed.time} hôm nay, các sân còn trống{parsed.hasLocation ? " gần bạn" : ""}:
          </p>
          <button onClick={() => setAiSuggestion("")}
            className="text-xs font-medium text-purple-500 border border-purple-300 bg-white rounded-lg px-2.5 py-1 hover:bg-purple-100 transition-colors">
            Đóng ✕
          </button>
        </div>
        <div className="space-y-2">
          {parsed.facilities.map((f: any, i: number) => (
            <Link key={f.id} href={`/facilities/${f.id}`}
              className="flex items-center justify-between bg-white border border-purple-100 hover:border-emerald-400 rounded-xl px-4 py-2.5 transition-colors group">
              <div>
                <p className="text-sm font-medium text-black group-hover:text-emerald-600 transition-colors">
                  {i+1}. {f.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {f.availableSports.join(", ")} • còn {f.availableCourts}/{f.totalCourts} sân
                  {f.distance != null && ` • cách ${f.distance.toFixed(1)}km`}
                </p>
              </div>
              <span className="text-emerald-500 text-xs font-medium group-hover:underline">Đặt ngay →</span>
            </Link>
          ))}
        </div>
      </div>
    );
          }catch {
            return (
            <div className="mb-5 bg-purple-50 border border-purple-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-700">{aiSuggestion}</p>
                <button onClick={() => setAiSuggestion("")}
                  className="text-xs font-medium text-purple-500 border border-purple-300 bg-white rounded-lg px-2.5 py-1 hover:bg-purple-100 transition-colors ml-3 shrink-0">
                  Đóng ✕
                </button>
              </div>
            </div>
            );
          }
        })()}
        
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"> {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl h-56 animate-pulse" style={{ background: "#E0EEE0" }} />
            ))}
          </div>) : displayedFacilities.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <div className="flex justify-center mb-4"><img src="/list.png" className="w-12 h-12 opacity-40" alt="" /></div>
              <p>{t("noResult")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayedFacilities.map((facility) => (
              <Link
                key={facility.id}
                href={`/facilities/${facility.id}`}
                className="border border-gray-300 rounded-2xl p-5 hover:border-emerald-400 transition-all group"
                style={{ background: "#E0EEE0" }} >
                <div className="w-full h-36 bg-white rounded-xl mb-4 flex items-center justify-center border border-gray-200">
                  {facility.sports[0]?.icon
                    ? <img src={facility.sports[0].icon} className="w-16 h-16 opacity-80" />
                    : <img src="/placeholder.png" className="w-12 h-12 opacity-30" alt="" />
                  }
                </div>
                <h3 className="font-semibold text-black group-hover:text-emerald-600 transition-colors mb-1 line-clamp-1">
                  {facility.name}
                </h3>
                <p className="text-gray-500 text-xs line-clamp-1 flex items-start gap-1"><img src="/placeholder.png" className="w-3 h-3 flex-shrink-0 mt-0.5" alt="location" /> {facility.address}</p>
                {facility.distance != null
                  ? <p className="text-emerald-600 text-xs font-semibold mb-3">Cách {facility.distance.toFixed(1)} km</p>
                  : <div className="mb-3" />
                }
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {facility.sports.map((s) => (
                    <span key={s.id} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                      <img src={s.icon} className="w-3.5 h-3.5" />
                      {s.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{facility.courtCount} sân</span>
                  <span className="flex items-center gap-1">{facility.avgRating ? <><img src="/star.png" alt="" className="w-3 h-3 inline" />{facility.avgRating} ({facility.reviewCount})</> : "Chưa có đánh giá"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}