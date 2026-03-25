"use client";
import { useState, useEffect } from "react";

interface MatchPost {
  id: number;
  title: string;
  description?: string | null;
  matchDate: string;
  startTime: string;
  endTime: string;
  level: string;
  status: string;
  requiredPlayers: number;
  joinedPlayers: number;
  remaining: number;
  facility: { id: number; name: string; address: string };
  sport: { id: number; name: string; iconUrl: string | null };
  creator: { id: number; fullName: string };
  createdAt: string;
}

interface TeammateModalProps {
  onClose: () => void;
  currentUserId?: number;
}

const levelLabel: Record<string, string> = {
  BEGINNER: "Người mới",
  INTERMEDIATE: "Trung bình",
  PRO: "Chuyên nghiệp",
};

const levelColor: Record<string, string> = {
  BEGINNER: "bg-green-100 text-green-700",
  INTERMEDIATE: "bg-yellow-100 text-yellow-700",
  PRO: "bg-red-100 text-red-700",
};

export default function TeammateModal({ onClose, currentUserId }: TeammateModalProps) {
  const [posts, setPosts] = useState<MatchPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"list" | "create">("list");
  const [joining, setJoining] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacilitySports, setSelectedFacilitySports] = useState<any[]>([]);
  const [form, setForm] = useState({
    facilityId: "",
    categoryId: "",
    matchDate: "",
    startTime: "",
    endTime: "",
    level: "BEGINNER",
    requiredPlayers: "4",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];

  useEffect(() => {
    loadPosts();
    fetch("/api/facilities")
      .then((r) => r.json())
      .then((data) => setFacilities(Array.isArray(data) ? data : []));
  }, []);

  function loadPosts() {
    setLoading(true);
    fetch("/api/match-posts?status=OPEN")
      .then((r) => r.json())
      .then((data) => {
        setPosts(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function handleFacilityChange(facilityId: string) {
    setForm((f) => ({ ...f, facilityId, categoryId: "" }));
    const facility = facilities.find((f: any) => String(f.id) === facilityId);
    setSelectedFacilitySports(facility?.sports || []);
  }

  async function handleJoin(postId: number) {
    if (!currentUserId) {
      showToast("Vui lòng đăng nhập để tham gia!");
      return;
    }
    setJoining(postId);
    const res = await fetch(`/api/match-posts/${postId}/join`, { method: "POST" });
    const data = await res.json();
    setJoining(null);
    if (res.ok) {
      showToast("Đã tham gia thành công!");
      loadPosts();
    } else {
      showToast(data.error || "Có lỗi xảy ra!");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId) {
      showToast("Vui lòng đăng nhập để đăng bài!");
      return;
    }
    if (!form.facilityId || !form.categoryId || !form.matchDate || !form.startTime || !form.endTime) {
      showToast("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/match-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        facilityId: Number(form.facilityId),
        categoryId: Number(form.categoryId),
        requiredPlayers: Number(form.requiredPlayers),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      showToast("Đã đăng bài tìm đồng đội!");
      setTab("list");
      loadPosts();
      setForm({
        facilityId: "",
        categoryId: "",
        matchDate: "",
        startTime: "",
        endTime: "",
        level: "BEGINNER",
        requiredPlayers: "4",
        description: "",
      });
      setSelectedFacilitySports([]);
    } else {
      showToast(data.error || "Có lỗi xảy ra!");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between" style={{ background: "#E0EEE0" }}>
          <div className="flex items-center gap-3">
            <img src="/group.png" className="w-9 h-9" alt="group" />
            <div>
              <h2 className="font-bold text-black text-lg">Tìm đồng đội</h2>
              <p className="text-gray-500 text-xs">Kết nối người chơi · Ghép nhóm · Đặt sân cùng nhau</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors font-semibold"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setTab("list")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "list"
                ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-1.5"><img src="/list.png" className="w-4 h-4" alt="" /> Bài đăng ({posts.length})</span>
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "create"
                ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            + Đăng tìm đồng đội
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "list" ? (
            loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <img src="/group.png" className="w-16 h-16 mx-auto opacity-30 mb-3" alt="" />
                <p className="text-sm font-medium">Chưa có bài đăng nào</p>
                <p className="text-xs text-gray-400 mt-1">Hãy là người đầu tiên tìm đồng đội!</p>
                <button
                  onClick={() => setTab("create")}
                  className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2 rounded-xl transition-colors font-medium"
                >
                  + Đăng ngay
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-colors"
                    style={{ background: "#f8fffe" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <img
                          src={post.sport.iconUrl || "/group.png"}
                          className="w-10 h-10 rounded-lg border border-gray-200 bg-white p-1 flex-shrink-0"
                          alt={post.sport.name}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-black text-sm">{post.title}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${levelColor[post.level]}`}>
                              {levelLabel[post.level]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <img src="/placeholder.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                            {post.facility.name} · {post.facility.address}
                          </p>
                          <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <img src="/calendar.png" className="w-3.5 h-3.5 flex-shrink-0" alt="" />
                            {new Date(post.matchDate).toLocaleDateString("vi-VN", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                            })}{" "}
                            · {post.startTime} – {post.endTime}
                          </p>
                          {post.description && (
                            <p className="text-xs text-gray-600 mb-2 italic">"{post.description}"</p>
                          )}
                          {/* Thanh tiến trình thành viên */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, (post.joinedPlayers / post.requiredPlayers) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 font-medium whitespace-nowrap">
                              {post.joinedPlayers}/{post.requiredPlayers} người · còn thiếu{" "}
                              <span className="text-red-500 font-semibold">{post.remaining}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {currentUserId && currentUserId === post.creator.id ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-medium">
                            Của bạn
                          </span>
                        ) : (
                          <button
                            onClick={() => handleJoin(post.id)}
                            disabled={joining === post.id}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            {joining === post.id ? "..." : "Tham gia"}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Đăng bởi {post.creator.fullName} ·{" "}
                      {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Cơ sở sân *</label>
                <select
                  value={form.facilityId}
                  onChange={(e) => handleFacilityChange(e.target.value)}
                  required
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                >
                  <option value="">-- Chọn cơ sở --</option>
                  {facilities.map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {f.name} · {f.address}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Môn thể thao *</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                    required
                    disabled={!form.facilityId}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 disabled:opacity-50"
                  >
                    <option value="">-- Chọn môn --</option>
                    {selectedFacilitySports.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Trình độ *</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  >
                    <option value="BEGINNER">Người mới</option>
                    <option value="INTERMEDIATE">Trung bình</option>
                    <option value="PRO">Chuyên nghiệp</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Ngày chơi *</label>
                <input
                  type="date"
                  value={form.matchDate}
                  onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))}
                  min={nowVN}
                  required
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Giờ bắt đầu *</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    required
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-medium mb-1 block">Giờ kết thúc *</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                    required
                    className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">
                  Cần bao nhiêu người? *
                </label>
                <input
                  type="number"
                  value={form.requiredPlayers}
                  onChange={(e) => setForm((f) => ({ ...f, requiredPlayers: e.target.value }))}
                  min="2"
                  max="30"
                  required
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400"
                />
                <p className="text-xs text-gray-400 mt-1">Tổng số người cần (bao gồm bạn)</p>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-medium mb-1 block">Mô tả (không bắt buộc)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="VD: Tìm 3 người chơi pickleball trình độ beginner, vui vẻ..."
                  rows={3}
                  className="w-full bg-white border border-gray-300 text-black rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                {submitting ? "Đang đăng..." : "Đăng tìm đồng đội"}
              </button>
            </form>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mx-4 mb-4 px-4 py-3 rounded-xl text-sm font-medium text-white ${
              toast.includes("thành công") || toast.includes("Đã")
                ? "bg-emerald-500"
                : "bg-red-500"
            }`}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
