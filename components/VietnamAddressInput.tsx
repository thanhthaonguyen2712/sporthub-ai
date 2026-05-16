"use client";
import { useState, useEffect, useRef, useCallback } from "react";

interface Province { code: number; name: string; }
interface District { code: number; name: string; }
interface Ward    { code: number; name: string; }

interface Props {
  onChange: (address: string) => void;
  onGeocoded?: (lat: string, lng: string) => void;
  streetPlaceholder?: string;
  value?: string;
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white text-black placeholder-gray-400";

export default function VietnamAddressInput({ onChange, onGeocoded, streetPlaceholder = "Số nhà, tên đường *" }: Props) {
  // ── Province autocomplete ──────────────────────────────────────────────────
  const [allProvinces, setAllProvinces]   = useState<Province[]>([]);
  const [provinceQuery, setProvinceQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);

  // ── District ───────────────────────────────────────────────────────────────
  const [districts, setDistricts]         = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);

  // ── Ward ──────────────────────────────────────────────────────────────────
  const [wards, setWards]                 = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard]   = useState<Ward | null>(null);

  // ── Street ────────────────────────────────────────────────────────────────
  const [street, setStreet] = useState("");

  // ── Geocoding state ───────────────────────────────────────────────────────
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tải danh sách tỉnh/thành một lần khi mount
  useEffect(() => {
    fetch("https://provinces.open-api.vn/api/p/")
      .then(r => r.json())
      .then(setAllProvinces)
      .catch(() => {});
  }, []);

  // Đóng gợi ý khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Tải danh sách quận/huyện khi tỉnh thay đổi
  useEffect(() => {
    if (!selectedProvince) { setDistricts([]); setSelectedDistrict(null); setWards([]); setSelectedWard(null); return; }
    fetch(`https://provinces.open-api.vn/api/p/${selectedProvince.code}?depth=2`)
      .then(r => r.json())
      .then(data => setDistricts(data.districts || []))
      .catch(() => {});
    setSelectedDistrict(null);
    setWards([]);
    setSelectedWard(null);
  }, [selectedProvince]);

  // Tải danh sách phường/xã khi quận/huyện thay đổi
  useEffect(() => {
    if (!selectedDistrict) { setWards([]); setSelectedWard(null); return; }
    fetch(`https://provinces.open-api.vn/api/d/${selectedDistrict.code}?depth=2`)
      .then(r => r.json())
      .then(data => setWards(data.wards || []))
      .catch(() => {});
    setSelectedWard(null);
  }, [selectedDistrict]);

  // Phát sự kiện địa chỉ đầy đủ mỗi khi bất kỳ thành phần nào thay đổi
  const buildAddress = useCallback((
    prov: Province | null,
    dist: District | null,
    ward: Ward | null,
    str: string
  ) => {
    const parts = [str, ward?.name, dist?.name, prov?.name].filter(Boolean);
    const address = parts.join(", ");
    onChange(address);

    // Auto-geocode khi có ít nhất tỉnh + quận
    if (onGeocoded && prov && dist) {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeTimerRef.current = setTimeout(async () => {
        setGeocodeStatus("loading");
        try {
          const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
          if (res.ok) {
            const { lat, lng } = await res.json();
            onGeocoded(lat, lng);
            setGeocodeStatus("done");
          } else {
            setGeocodeStatus("error");
          }
        } catch {
          setGeocodeStatus("error");
        }
      }, 800);
    }
  }, [onChange, onGeocoded]);

  const filteredProvinces = provinceQuery.trim()
    ? allProvinces.filter(p =>
        p.name.toLowerCase().includes(provinceQuery.toLowerCase())
      )
    : allProvinces.slice(0, 8);

  function selectProvince(p: Province) {
    setSelectedProvince(p);
    setProvinceQuery(p.name);
    setShowSuggestions(false);
    setGeocodeStatus("idle");
    buildAddress(p, null, null, street);
  }

  function handleProvinceInput(val: string) {
    setProvinceQuery(val);
    setShowSuggestions(true);
    if (selectedProvince && selectedProvince.name !== val) {
      setSelectedProvince(null);
      setDistricts([]);
      setSelectedDistrict(null);
      setWards([]);
      setSelectedWard(null);
      setGeocodeStatus("idle");
      buildAddress(null, null, null, street);
    }
  }

  function handleDistrictChange(code: string) {
    const d = districts.find(x => x.code === +code) ?? null;
    setSelectedDistrict(d);
    setGeocodeStatus("idle");
    buildAddress(selectedProvince, d, null, street);
  }

  function handleWardChange(code: string) {
    const w = wards.find(x => x.code === +code) ?? null;
    setSelectedWard(w);
    buildAddress(selectedProvince, selectedDistrict, w, street);
  }

  function handleStreetChange(val: string) {
    setStreet(val);
    buildAddress(selectedProvince, selectedDistrict, selectedWard, val);
  }

  return (
    <div className="space-y-2">
      {/* Province autocomplete */}
      <div className="relative" ref={wrapperRef}>
        <input
          className={INPUT}
          placeholder="Tỉnh / Thành phố *"
          value={provinceQuery}
          onChange={e => handleProvinceInput(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          autoComplete="off"
        />
        {showSuggestions && filteredProvinces.length > 0 && (
          <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
            {filteredProvinces.map(p => (
              <li
                key={p.code}
                onMouseDown={() => selectProvince(p)}
                className="px-3 py-2 text-sm text-black hover:bg-emerald-50 cursor-pointer"
              >
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* District */}
      <select
        className={INPUT}
        value={selectedDistrict?.code ?? ""}
        onChange={e => handleDistrictChange(e.target.value)}
        disabled={!selectedProvince || districts.length === 0}
      >
        <option value="">-- Quận / Huyện *</option>
        {districts.map(d => (
          <option key={d.code} value={d.code}>{d.name}</option>
        ))}
      </select>

      {/* Ward */}
      <select
        className={INPUT}
        value={selectedWard?.code ?? ""}
        onChange={e => handleWardChange(e.target.value)}
        disabled={!selectedDistrict || wards.length === 0}
      >
        <option value="">-- Phường / Xã</option>
        {wards.map(w => (
          <option key={w.code} value={w.code}>{w.name}</option>
        ))}
      </select>

      {/* Street */}
      <input
        className={INPUT}
        placeholder={streetPlaceholder}
        value={street}
        onChange={e => handleStreetChange(e.target.value)}
      />

      {/* Geocode status indicator */}
      {onGeocoded && geocodeStatus !== "idle" && (
        <div className={`text-xs flex items-center gap-1.5 ${
          geocodeStatus === "loading" ? "text-gray-400" :
          geocodeStatus === "done"    ? "text-emerald-600" :
                                        "text-red-500"
        }`}>
          {geocodeStatus === "loading" && (
            <><span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />Đang lấy tọa độ...</>
          )}
          {geocodeStatus === "done" && <>✓ Đã lấy tọa độ tự động</>}
          {geocodeStatus === "error" && <>⚠ Không tìm thấy tọa độ — vui lòng kiểm tra địa chỉ</>}
        </div>
      )}
    </div>
  );
}
