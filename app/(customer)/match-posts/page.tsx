"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { generateCourtSlots, getSlotPrice, getSlotPriceLabel, isHoliday, isWeekend, CourtSlot } from "@/lib/court-slots";

function toMinutes(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

interface MatchPost {
  id: number;
  title: string;
  description: string | null;
  matchDate: string;
  startTime: string;
  endTime: string;
  level: string;
  status: string;
  requiredPlayers: number;
  joinedPlayers: number;
  remaining: number;
  facility: { id: number; name: string; address: string };
  sport: { id: number; name: string; iconUrl: string };
  creator: { id: number; fullName: string };
  courtName: string | null;
  pricePerPerson: number | null;
  totalPrice: number | null;
  qrCodeUrl: string | null;
  isLocked: boolean;
  createdAt: string;
}

interface JoinRequest {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  paymentProofUrl: string | null;
  createdAt: string;
  user: { id: number; fullName: string; email: string; phone: string | null; avatar: string | null } | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
}

const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Người mới", INTERMEDIATE: "Trung bình", PRO: "Chuyên nghiệp" };
const LEVEL_COLOR: Record<string, string> = {
  BEGINNER: "bg-green-100 text-green-700",
  INTERMEDIATE: "bg-yellow-100 text-yellow-700",
  PRO: "bg-red-100 text-red-700",
};
const STATUS_JOIN: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "Chờ duyệt",     color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "Đã được duyệt", color: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Bị từ chối",    color: "bg-red-100 text-red-700" },
};

export default function MatchPostsPage() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ? Number((session?.user as any).id) : null;

  const [pageTab, setPageTab]     = useState<"posts" | "history">("posts");

  const [posts, setPosts]         = useState<MatchPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterSport, setFilter]  = useState("");
  const [sports, setSports]       = useState<{ id: number; name: string; iconUrl: string }[]>([]);
  const [toast, setToast]         = useState({ msg: "", ok: false });
  const [myRequests, setMyReqs]   = useState<Record<number, string>>({});

  /* ── history tab ── */
  const [histTab, setHistTab]               = useState<"created" | "joined">("created");
  const [myPosts, setMyPosts]               = useState<any[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [myJoinReqs, setMyJoinReqs]         = useState<any[]>([]);
  const [myJoinLoading, setMyJoinLoading]   = useState(false);

  /* ── join flow ── */
  const [joinPost, setJoinPost]   = useState<MatchPost | null>(null);
  const [joinStep, setJoinStep]   = useState<1 | 2>(1);
  const [proofUrl, setProofUrl]   = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmit]   = useState(false);
  const [guestName, setGName]     = useState("");
  const [guestEmail, setGEmail]   = useState("");
  const [guestPhone, setGPhone]   = useState("");
  const proofRef = useRef<HTMLInputElement>(null);

  /* ── creator: edit modal ── */
  const [editPost, setEditPost]        = useState<MatchPost | null>(null);
  const [editForm, setEditForm]        = useState({ title: "", description: "", level: "BEGINNER", requiredPlayers: 2 });
  const [editQrUrl, setEditQrUrl]      = useState<string | null>(null);
  const [editQrUploading, setEditQrUp] = useState(false);
  const [editSaving, setEditSaving]    = useState(false);
  const qrRef = useRef<HTMLInputElement>(null);

  /* ── create post modal ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [facilities, setFacilities] = useState<{ id: number; name: string; address: string }[]>([]);
  const [createForm, setCreateForm] = useState({
    title: "", description: "", matchDate: "",
    level: "BEGINNER", requiredPlayers: 2,
    facilityId: "", categoryId: "",
    courtId: "", courtName: "",
    startTime: "", endTime: "", totalPrice: "",
  });
  const [facilityCourts, setFacilityCourts]         = useState<any[]>([]);
  const [createSelectedSlots, setCreateSelectedSlots] = useState<string[]>([]);
  const [createBookedSlots, setCreateBookedSlots]     = useState<string[]>([]);
  const [createLoadingSlots, setCreateLoadingSlots]   = useState(false);
  const [creating, setCreating] = useState(false);

  /* ── requests modal ── */
  const [reqPost, setReqPost]     = useState<MatchPost | null>(null);
  const [requests, setRequests]   = useState<JoinRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectId, setRejectId]   = useState<number | null>(null);
  const [viewProof, setViewProof] = useState<string | null>(null);

  function toast_(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: false }), 4000);
  }

  function loadPosts() {
    setLoading(true);
    fetch("/api/match-posts?status=OPEN")
      .then(r => r.json())
      .then(d => { setPosts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetch("/api/sports").then(r => r.json()).then(setSports); }, []);
  useEffect(() => { fetch("/api/facilities").then(r => r.json()).then(d => setFacilities(Array.isArray(d) ? d : [])); }, []);
  useEffect(() => { loadPosts(); }, []);
  useEffect(() => {
    if (!session) return;
    fetch("/api/match-join-requests/my").then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        const m: Record<number, string> = {};
        d.forEach((r: any) => { m[r.matchPost.id] = r.status; });
        setMyReqs(m);
      }
    });
  }, [session]);

  useEffect(() => {
    if (pageTab !== "history" || !session) return;
    setMyPostsLoading(true);
    fetch("/api/match-posts/my").then(r => r.json()).then(d => { setMyPosts(Array.isArray(d) ? d : []); setMyPostsLoading(false); }).catch(() => setMyPostsLoading(false));
    setMyJoinLoading(true);
    fetch("/api/match-join-requests/my").then(r => r.json()).then(d => { setMyJoinReqs(Array.isArray(d) ? d : []); setMyJoinLoading(false); }).catch(() => setMyJoinLoading(false));
  }, [pageTab, session]);

  /* ────── Join flow ────── */
  function openJoin(post: MatchPost) {
    setJoinPost(post); setJoinStep(1); setProofUrl(null);
    setGName(""); setGEmail(""); setGPhone("");
  }

  async function uploadProof(file: File) {
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/upload/match-proof", { method: "POST", body: fd });
    const d = await r.json();
    setUploading(false);
    if (r.ok) setProofUrl(d.url);
    else toast_(d.error || "Tải ảnh thất bại", false);
  }

  async function submitJoin() {
    if (!joinPost) return;
    setSubmit(true);
    const body: Record<string, unknown> = { paymentProofUrl: proofUrl };
    if (!session) { body.guestName = guestName; body.guestEmail = guestEmail; body.guestPhone = guestPhone; }
    const res = await fetch(`/api/match-posts/${joinPost.id}/join-requests`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json();
    setSubmit(false);
    if (res.ok) {
      toast_("Gửi yêu cầu thành công! Chờ chủ bài duyệt.", true);
      if (session) setMyReqs(p => ({ ...p, [joinPost!.id]: "PENDING" }));
      setJoinPost(null);
    } else toast_(d.error || "Gửi yêu cầu thất bại", false);
  }

  /* ────── Create post handlers ────── */
  async function handleCreateFacilityChange(facilityId: string) {
    setCreateForm(f => ({ ...f, facilityId, categoryId: "", courtId: "", courtName: "", startTime: "", endTime: "", totalPrice: "", matchDate: "" }));
    setFacilityCourts([]); setCreateSelectedSlots([]); setCreateBookedSlots([]);
    if (!facilityId) return;
    const data = await fetch(`/api/facilities/${facilityId}`).then(r => r.json());
    setFacilityCourts(data.courts || []);
  }

  function handleCreateSportChange(categoryId: string) {
    setCreateForm(f => ({ ...f, categoryId, courtId: "", courtName: "", startTime: "", endTime: "", totalPrice: "" }));
    setCreateSelectedSlots([]); setCreateBookedSlots([]);
  }

  async function handleCreateCourtChange(courtId: string, courtName: string) {
    setCreateForm(f => ({ ...f, courtId, courtName, startTime: "", endTime: "", totalPrice: "" }));
    setCreateSelectedSlots([]);
    if (courtId && createForm.matchDate) {
      setCreateLoadingSlots(true);
      const d = await fetch(`/api/courts/${courtId}/booked-slots?date=${createForm.matchDate}`).then(r => r.json());
      setCreateBookedSlots(d.bookedSlots || []); setCreateLoadingSlots(false);
    }
  }

  async function handleCreateDateChange(matchDate: string) {
    setCreateForm(f => ({ ...f, matchDate, startTime: "", endTime: "", totalPrice: "" }));
    setCreateSelectedSlots([]);
    if (createForm.courtId && matchDate) {
      setCreateLoadingSlots(true);
      const d = await fetch(`/api/courts/${createForm.courtId}/booked-slots?date=${matchDate}`).then(r => r.json());
      setCreateBookedSlots(d.bookedSlots || []); setCreateLoadingSlots(false);
    }
  }

  function toggleCreateSlot(slotTime: string, allSlots: CourtSlot[]) {
    if (createBookedSlots.includes(slotTime)) return;
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const todayVN = nowVN.toISOString().split("T")[0];
    const nowMin = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
    if (createForm.matchDate === todayVN && toMinutes(slotTime) < nowMin) return;
    const newSlots = createSelectedSlots.includes(slotTime)
      ? createSelectedSlots.filter(s => s !== slotTime)
      : [...createSelectedSlots, slotTime];
    setCreateSelectedSlots(newSlots);
    if (newSlots.length === 0) {
      setCreateForm(f => ({ ...f, startTime: "", endTime: "", totalPrice: "" }));
    } else {
      const sorted = [...newSlots].sort((a, b) => toMinutes(a) - toMinutes(b));
      const lastSlot = allSlots.find(s => s.time === sorted[sorted.length - 1]);
      const total = newSlots.reduce((sum, t) => {
        const slot = allSlots.find(s => s.time === t);
        return sum + (slot ? getSlotPrice(slot, createForm.matchDate) : 0);
      }, 0);
      setCreateForm(f => ({ ...f, startTime: sorted[0], endTime: lastSlot?.end || "", totalPrice: String(total) }));
    }
  }

  /* ────── Create post ────── */
  async function submitCreate() {
    const { title, description, matchDate, startTime, endTime, level, requiredPlayers, facilityId, categoryId, courtId, courtName, totalPrice } = createForm;
    if (!facilityId || !categoryId || !matchDate || !startTime || !endTime) {
      toast_("Vui lòng chọn cơ sở, môn, ngày và khung giờ", false); return;
    }
    setCreating(true);
    const res = await fetch("/api/match-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        matchDate, startTime, endTime, level,
        requiredPlayers: Number(requiredPlayers),
        facilityId: Number(facilityId),
        categoryId: Number(categoryId),
        ...(courtId ? { courtId: Number(courtId), courtName } : {}),
        ...(totalPrice ? { totalPrice: Number(totalPrice) } : {}),
      }),
    });
    const d = await res.json();
    setCreating(false);
    if (res.ok) {
      toast_("Đã đăng bài tìm đồng đội!", true);
      setCreateOpen(false);
      setCreateForm({ title: "", description: "", matchDate: "", level: "BEGINNER", requiredPlayers: 2, facilityId: "", categoryId: "", courtId: "", courtName: "", startTime: "", endTime: "", totalPrice: "" });
      setFacilityCourts([]); setCreateSelectedSlots([]); setCreateBookedSlots([]);
      loadPosts();
    } else toast_(d.error || "Đăng bài thất bại", false);
  }

  /* ────── Creator: Edit modal ────── */
  function openEdit(post: MatchPost) {
    setEditPost(post);
    setEditForm({ title: post.title, description: post.description || "", level: post.level, requiredPlayers: post.requiredPlayers });
    setEditQrUrl(post.qrCodeUrl);
  }

  async function uploadQr(file: File) {
    setEditQrUp(true);
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/upload/match-proof", { method: "POST", body: fd });
    const d = await r.json();
    setEditQrUp(false);
    if (r.ok) setEditQrUrl(d.url);
    else toast_(d.error || "Tải ảnh thất bại", false);
  }

  async function saveEdit() {
    if (!editPost) return;
    setEditSaving(true);
    const res = await fetch(`/api/match-posts/${editPost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editForm.title, description: editForm.description, level: editForm.level, requiredPlayers: editForm.requiredPlayers, qrCodeUrl: editQrUrl }),
    });
    setEditSaving(false);
    if (res.ok) { toast_("Đã lưu chỉnh sửa", true); setEditPost(null); loadPosts(); }
    else toast_("Lưu thất bại", false);
  }

  async function toggleLock(post: MatchPost) {
    const res = await fetch(`/api/match-posts/${post.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !post.isLocked }),
    });
    if (res.ok) { toast_(post.isLocked ? "Đã mở khóa bài" : "Đã khóa bài đăng", true); loadPosts(); }
    else toast_("Thao tác thất bại", false);
  }

  /* ────── Requests modal ────── */
  async function openRequests(post: MatchPost) {
    setReqPost(post); setReqLoading(true);
    const r = await fetch(`/api/match-posts/${post.id}/join-requests`);
    const d = await r.json();
    setReqLoading(false);
    setRequests(Array.isArray(d) ? d : []);
  }

  async function approve(reqId: number) {
    if (!reqPost) return;
    const r = await fetch(`/api/match-posts/${reqPost.id}/join-requests/${reqId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }),
    });
    const d = await r.json();
    if (r.ok) { toast_("Đã duyệt thành viên", true); openRequests(reqPost); loadPosts(); }
    else toast_(d.error || "Thất bại", false);
  }

  async function reject(reqId: number) {
    if (!reqPost) return;
    const r = await fetch(`/api/match-posts/${reqPost.id}/join-requests/${reqId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", note: rejectNote }),
    });
    if (r.ok) { toast_("Đã từ chối", true); setRejectId(null); setRejectNote(""); openRequests(reqPost); }
    else toast_("Thất bại", false);
  }

  const filtered = filterSport ? posts.filter(p => p.sport.name === filterSport) : posts;

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="min-h-screen text-black" style={{ fontFamily: "Arial, sans-serif", background: "linear-gradient(to right, #DDEFBB, #FFEEEE)" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-black flex items-center gap-2">
              <img src="/group.png" className="w-7 h-7" alt="" /> Cáp kèo - Tìm đồng đội
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Tham gia nhóm đang tìm người chơi cùng.{" "}
              {!session && <Link href="/login" className="text-emerald-600 hover:underline font-medium">Đăng nhập</Link>}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {session && (
              <button
                onClick={() => setCreateOpen(true)}
                className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl font-medium transition-colors"
              >
                + Đăng bài
              </button>
            )}
            <Link href="/" className="text-xs text-gray-500 border border-gray-300 bg-white px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors">
              Trang chủ
            </Link>
          </div>
        </div>

        {/* Page tabs */}
        {session && (
          <div className="flex gap-1 bg-white/60 border border-gray-300 rounded-2xl p-1 mb-5">
            <button
              onClick={() => setPageTab("posts")}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${pageTab === "posts" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
            >
              Danh sách bài đăng
            </button>
            <button
              onClick={() => setPageTab("history")}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 ${pageTab === "history" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
            >
              Lịch sử của tôi
              {myPosts.some((p: any) => p.pendingCount > 0) && pageTab !== "history" && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none">!</span>
              )}
            </button>
          </div>
        )}

        {/* Toast */}
        {toast.msg && (
          <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium text-white ${toast.ok ? "bg-emerald-500" : "bg-red-500"}`}>
            {toast.msg}
          </div>
        )}

        {/* TAB: Danh sách bài đăng */}
        {(!session || pageTab === "posts") && <>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          <button onClick={() => setFilter("")}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${filterSport === "" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
            Tất cả
          </button>
          {sports.map(s => (
            <button key={s.id} onClick={() => setFilter(filterSport === s.name ? "" : s.name)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${filterSport === s.name ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400"}`}>
              <img src={s.iconUrl} className="w-4 h-4" alt="" /> {s.name}
            </button>
          ))}
        </div>

        {/* Post list */}
        {loading ? (
          <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="rounded-2xl h-32 animate-pulse bg-[#E0EEE0]" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <img src="/group.png" className="w-12 h-12 opacity-30 mx-auto mb-4" alt="" />
            <p>Chưa có bài đăng tìm đồng đội nào.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(post => {
              const isCreator = userId === post.creator.id;
              const myStatus  = myRequests[post.id];
              const canJoin   = !isCreator && post.remaining > 0 && !post.isLocked && !myStatus;

              return (
                <div key={post.id} className="border border-gray-300 rounded-2xl p-5 bg-[#E0EEE0]">
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={post.sport.iconUrl} className="w-6 h-6 shrink-0" alt="" />
                      <div className="min-w-0">
                        <p className="font-semibold text-black text-sm leading-tight flex items-center gap-2 flex-wrap">
                          {post.title}
                          {post.isLocked && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Đã khóa</span>}
                          {post.qrCodeUrl && !isCreator && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Có QR</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{post.facility.name} · {post.facility.address}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${LEVEL_COLOR[post.level]}`}>
                      {LEVEL_LABEL[post.level]}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                    <div>Ngày: {new Date(post.matchDate).toLocaleDateString("vi-VN")}</div>
                    <div>Giờ: {post.startTime} – {post.endTime}</div>
                    <div>
                      Người: {post.joinedPlayers}/{post.requiredPlayers} ·{" "}
                      <span className={post.remaining > 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                        còn {post.remaining} chỗ
                      </span>
                    </div>
                    {post.pricePerPerson != null && post.pricePerPerson > 0 && (
                      <div>Phí: {post.pricePerPerson.toLocaleString("vi-VN")}đ/người</div>
                    )}
                  </div>

                  {post.description && <p className="text-xs text-gray-500 mb-3 italic">"{post.description}"</p>}

                  {/* Action row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-gray-200/60">
                    <p className="text-xs text-gray-400">Đăng bởi {post.creator.fullName}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* CREATOR controls */}
                      {isCreator && (
                        <>
                          <button
                            onClick={() => openEdit(post)}
                            className="text-xs border border-emerald-400 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors font-medium"
                          >
                            Chỉnh sửa
                          </button>
                          <button
                            onClick={() => openRequests(post)}
                            className="text-xs border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            Yêu cầu
                          </button>
                          <button
                            onClick={() => toggleLock(post)}
                            className={`text-xs px-3 py-1.5 rounded-xl transition-colors border ${post.isLocked ? "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100" : "border-gray-300 text-gray-600 bg-white hover:bg-gray-100"}`}
                          >
                            {post.isLocked ? "Mở khóa" : "Khóa bài"}
                          </button>
                        </>
                      )}

                      {/* JOINER status / action */}
                      {!isCreator && myStatus && (
                        <span className={`text-xs px-3 py-1.5 rounded-xl font-medium ${STATUS_JOIN[myStatus]?.color}`}>
                          {STATUS_JOIN[myStatus]?.label}
                        </span>
                      )}
                      {canJoin && (
                        <button onClick={() => openJoin(post)}
                          className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm px-5 py-2 rounded-xl font-medium transition-colors flex items-center gap-1.5">
                          <img src="/group.png" className="w-4 h-4" alt="" /> Tham gia
                        </button>
                      )}
                      {!isCreator && post.isLocked && !myStatus && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">Đã khóa</span>
                      )}
                      {!isCreator && post.remaining === 0 && !myStatus && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-xl">Đã đủ người</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* kết thúc tab posts */}
        </>}

        {/* TAB: Lịch sử của tôi */}
        {session && pageTab === "history" && (() => {
          const HIST_LEVEL: Record<string, string> = { BEGINNER: "Mới", INTERMEDIATE: "TB", PRO: "Pro" };
          const HIST_LEVEL_COLOR: Record<string, string> = { BEGINNER: "bg-green-100 text-green-700", INTERMEDIATE: "bg-yellow-100 text-yellow-700", PRO: "bg-red-100 text-red-700" };
          const JOIN_STATUS_HIST: Record<string, { label: string; color: string }> = {
            PENDING:  { label: "Chờ duyệt",    color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
            APPROVED: { label: "Đã duyệt",      color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
            REJECTED: { label: "Bị từ chối",    color: "bg-red-100 text-red-600 border-red-200" },
          };
          function postBadge(p: any) {
            if (p.isLocked)            return { label: "Đã khóa",  color: "bg-gray-200 text-gray-600" };
            if (p.status === "CLOSED") return { label: "Đủ người", color: "bg-emerald-100 text-emerald-700" };
            if (p.status === "EXPIRED")return { label: "Hết hạn",  color: "bg-gray-100 text-gray-500" };
            return { label: "Đang mở", color: "bg-blue-100 text-blue-700" };
          }
          const totalPending = myPosts.reduce((s: number, p: any) => s + (p.pendingCount || 0), 0);
          const pendingJoins = myJoinReqs.filter((r: any) => r.status === "PENDING").length;

          return (
            <div className="bg-white/60 border border-gray-300 rounded-2xl overflow-hidden">
              {/* sub-tabs */}
              <div className="flex border-b border-gray-200">
                <button onClick={() => setHistTab("created")}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${histTab === "created" ? "text-emerald-700 border-b-2 border-emerald-500 bg-white/60" : "text-gray-500 hover:text-gray-700"}`}>
                  Bài đăng của tôi
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${histTab === "created" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{myPosts.length}</span>
                  {totalPending > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{totalPending} chờ</span>}
                </button>
                <button onClick={() => setHistTab("joined")}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${histTab === "joined" ? "text-emerald-700 border-b-2 border-emerald-500 bg-white/60" : "text-gray-500 hover:text-gray-700"}`}>
                  Yêu cầu của tôi
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${histTab === "joined" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{myJoinReqs.length}</span>
                  {pendingJoins > 0 && <span className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">{pendingJoins}</span>}
                </button>
              </div>

              <div className="p-5">
                {/* Bài đăng của tôi */}
                {histTab === "created" && (
                  myPostsLoading ? (
                    <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}</div>
                  ) : myPosts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <img src="/group.png" className="w-12 h-12 opacity-25 mx-auto mb-3" alt="" />
                      <p className="text-sm">Bạn chưa đăng bài nào.</p>
                      <button onClick={() => { setPageTab("posts"); setCreateOpen(true); }}
                        className="text-emerald-600 hover:underline text-sm mt-2 inline-block">+ Đăng bài ngay</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myPosts.map((p: any) => {
                        const badge = postBadge(p);
                        return (
                          <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <p className="font-semibold text-sm text-black truncate">{p.title}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${HIST_LEVEL_COLOR[p.level]}`}>{HIST_LEVEL[p.level]}</span>
                                </div>
                                <p className="text-xs text-gray-400">{p.facility.name} · {p.facility.address}</p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 whitespace-nowrap ${badge.color}`}>{badge.label}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-3">
                              <span>Ngày: {new Date(p.matchDate).toLocaleDateString("vi-VN")}</span>
                              <span>Giờ: {p.startTime}–{p.endTime}</span>
                              <span>Người: {p.joinedPlayers}/{p.requiredPlayers}</span>
                              {p.pricePerPerson && <span>Phí: {p.pricePerPerson.toLocaleString("vi-VN")}đ/người</span>}
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, (p.joinedPlayers / p.requiredPlayers) * 100)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 whitespace-nowrap">Còn {p.remaining} chỗ</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mb-3">
                              {p.pendingCount > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-full font-medium">{p.pendingCount} chờ duyệt</span>}
                              {p.approvedCount > 0 && <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">{p.approvedCount} đã duyệt</span>}
                              {p.pendingCount === 0 && p.approvedCount === 0 && <span className="text-xs text-gray-400">Chưa có yêu cầu</span>}
                            </div>
                            <button onClick={() => setPageTab("posts")}
                              className="inline-flex items-center gap-1 text-xs text-emerald-700 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-medium transition-colors">
                              {p.pendingCount > 0 ? "Xem & duyệt yêu cầu" : "Quản lý bài đăng"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}

                {/* Yêu cầu của tôi */}
                {histTab === "joined" && (
                  myJoinLoading ? (
                    <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}</div>
                  ) : myJoinReqs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <img src="/group.png" className="w-12 h-12 opacity-25 mx-auto mb-3" alt="" />
                      <p className="text-sm">Bạn chưa gửi yêu cầu ghép trận nào.</p>
                      <button onClick={() => setPageTab("posts")} className="text-emerald-600 hover:underline text-sm mt-2 inline-block">Tìm trận để tham gia</button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(["PENDING","APPROVED","REJECTED"] as const).map(sk => {
                        const group = myJoinReqs.filter((r: any) => r.status === sk);
                        if (!group.length) return null;
                        const s = JOIN_STATUS_HIST[sk];
                        return (
                          <div key={sk}>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-2 border text-xs font-semibold ${s.color}`}>
                              <span>{s.label}</span>
                              <span className="ml-auto font-bold">{group.length} yêu cầu</span>
                            </div>
                            <div className="space-y-2 mb-4">
                              {group.map((r: any) => (
                                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                                  <div className="flex items-start justify-between gap-3 mb-1.5">
                                    <div className="min-w-0">
                                      <p className="font-semibold text-sm text-black truncate">{r.matchPost.title}</p>
                                      <p className="text-xs text-gray-400">{r.matchPost.facility.name}</p>
                                    </div>
                                    {r.matchPost.sport?.iconUrl && <img src={r.matchPost.sport.iconUrl} className="w-6 h-6 shrink-0 rounded" alt="" />}
                                  </div>
                                  <div className="text-xs text-gray-500 space-y-0.5 mb-2">
                                    <p>Ngày: {new Date(r.matchPost.matchDate).toLocaleDateString("vi-VN")} · {r.matchPost.startTime}–{r.matchPost.endTime}</p>
                                    <p>Địa chỉ: {r.matchPost.facility.address}</p>
                                    {r.matchPost.pricePerPerson && <p>Phí: {r.matchPost.pricePerPerson.toLocaleString("vi-VN")}đ/người</p>}
                                    <p className="text-gray-400">Gửi lúc: {new Date(r.createdAt).toLocaleString("vi-VN",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</p>
                                  </div>
                                  {sk === "PENDING" && <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700">Chờ chủ bài xem bill và duyệt yêu cầu.</div>}
                                  {sk === "APPROVED" && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">Yêu cầu được chấp nhận! Hẹn gặp tại sân.</div>}
                                  {sk === "REJECTED" && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                                      Yêu cầu bị từ chối.{r.note && <span className="block mt-0.5 italic">Lý do: {r.note}</span>}
                                    </div>
                                  )}
                                  {r.paymentProofUrl && (
                                    <button onClick={() => setViewProof(r.paymentProofUrl)}
                                      className="mt-2 text-xs text-blue-600 hover:underline block">Xem bill đã tải lên</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })()}

      </div>{/* end max-w-4xl */}

      {/* MODAL: Đăng bài mới */}
      {createOpen && (() => {
        const filteredCourts = facilityCourts.filter(c => !createForm.categoryId || String(c.category?.id) === createForm.categoryId);
        const selectedCourt  = filteredCourts.find(c => String(c.id) === createForm.courtId);
        const sportName      = selectedCourt?.category?.name || "";
        const allSlots: CourtSlot[] = (createForm.courtId && createForm.matchDate && sportName)
          ? generateCourtSlots(sportName, createForm.matchDate) : [];
        const nowVN   = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
        const todayVN = nowVN.toISOString().split("T")[0];
        const nowMin  = nowVN.getUTCHours() * 60 + nowVN.getUTCMinutes();
        const holiday = createForm.matchDate ? isHoliday(createForm.matchDate) : false;
        const weekend = createForm.matchDate ? isWeekend(createForm.matchDate) : false;
        const totalCreatePrice = createSelectedSlots.reduce((sum, t) => {
          const slot = allSlots.find(s => s.time === t);
          return sum + (slot ? getSlotPrice(slot, createForm.matchDate) : 0);
        }, 0);
        const pricePerPerson = totalCreatePrice > 0 && createForm.requiredPlayers > 1
          ? Math.ceil(totalCreatePrice / Number(createForm.requiredPlayers)) : 0;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 px-4 py-6 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl my-auto w-full max-w-lg">
              <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
                <h3 className="font-bold text-black text-lg flex items-center gap-2">
                  <img src="/group.png" className="w-5 h-5" alt="" /> Đăng bài tìm đồng đội
                </h3>
                <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Tiêu đề */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tiêu đề <span className="text-gray-400 font-normal">(để trống sẽ tự tạo)</span></label>
                  <input type="text" placeholder="VD: Cần 3 người cùng chơi cầu lông sáng thứ 7"
                    value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                </div>

                {/* Cơ sở + Môn */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Cơ sở thể thao <span className="text-red-400">*</span></label>
                    <select value={createForm.facilityId} onChange={e => handleCreateFacilityChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 bg-white">
                      <option value="">-- Chọn cơ sở --</option>
                      {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Môn thể thao <span className="text-red-400">*</span></label>
                    <select value={createForm.categoryId} onChange={e => handleCreateSportChange(e.target.value)}
                      disabled={!createForm.facilityId}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 bg-white disabled:opacity-50">
                      <option value="">-- Chọn môn --</option>
                      {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Danh sách sân */}
                {createForm.facilityId && createForm.categoryId && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Chọn sân <span className="text-red-400">*</span></label>
                    {filteredCourts.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Không có sân phù hợp với môn này.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredCourts.map(court => (
                          <button key={court.id} type="button"
                            onClick={() => handleCreateCourtChange(String(court.id), court.name)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                              createForm.courtId === String(court.id)
                                ? "bg-emerald-500 text-white border-emerald-500"
                                : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400"
                            }`}>
                            {court.category?.iconUrl && <img src={court.category.iconUrl} className="w-5 h-5 shrink-0" alt="" />}
                            <span className="font-medium truncate">{court.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Ngày thi đấu — hiện sau khi chọn sân */}
                {createForm.courtId && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Ngày thi đấu <span className="text-red-400">*</span></label>
                    <input type="date" value={createForm.matchDate}
                      min={new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0]}
                      onChange={e => handleCreateDateChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  </div>
                )}

                {/* Slot picker — hiện sau khi chọn sân + ngày */}
                {createForm.courtId && createForm.matchDate && (
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">Chọn khung giờ <span className="text-red-400">*</span></label>

                    {/* Chú thích màu */}
                    <div className="flex gap-3 flex-wrap text-[10px] mb-3">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded inline-block" style={{ background: "#96CDCD", border: "1px solid #D1EEEE" }} />
                        Trống
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded inline-block" style={{ background: "#EED5D2" }} />
                        Đã đặt
                      </span>
                      {(weekend || holiday) && (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ background: "#FFD580" }} />
                          Giờ cao điểm sáng
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded inline-block" style={{ background: "#9BCD9B" }} />
                        Giờ cao điểm chiều
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded inline-block" style={{ background: "#B0C4DE" }} />
                        Đã chọn
                      </span>
                    </div>

                    {createLoadingSlots ? (
                      <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {allSlots.map(slot => {
                          const isBooked   = createBookedSlots.includes(slot.time);
                          const isPast     = createForm.matchDate === todayVN && toMinutes(slot.time) < nowMin;
                          const isSelected = createSelectedSlots.includes(slot.time);
                          let bgStyle: React.CSSProperties = {};
                          let cls = "border rounded-lg text-xs font-medium transition-all text-left ";
                          const pad = slot.isPeak ? "px-4 py-2.5" : "px-2.5 py-2";
                          if (isPast) {
                            bgStyle = { background: "#D1D5DB", borderColor: "#9CA3AF", color: "#6B7280" };
                            cls += "cursor-not-allowed opacity-60";
                          } else if (isBooked) {
                            bgStyle = { background: "#EED5D2", borderColor: "#FFB5C5", color: "#000" };
                            cls += "cursor-not-allowed";
                          } else if (isSelected) {
                            bgStyle = { background: "#B0C4DE", borderColor: "#7a9cbf", color: "#000" };
                            cls += "cursor-pointer ring-2 ring-blue-400";
                          } else if (slot.isMorningPeak) {
                            bgStyle = { background: "#FFD580", borderColor: "#FFC107", color: "#000" };
                            cls += "cursor-pointer hover:opacity-80";
                          } else if (slot.isPeak) {
                            bgStyle = { background: "#9BCD9B", borderColor: "#a8e050", color: "#000" };
                            cls += "cursor-pointer hover:opacity-80";
                          } else {
                            bgStyle = { background: "#96CDCD", borderColor: "#D1EEEE", color: "#000" };
                            cls += "cursor-pointer hover:opacity-80";
                          }
                          return (
                            <button key={slot.time} type="button"
                              onClick={() => toggleCreateSlot(slot.time, allSlots)}
                              disabled={isBooked || isPast}
                              className={`${cls} ${pad}`} style={bgStyle}>
                              <div className="font-semibold text-[11px]">{slot.label}</div>
                              <div className="text-[10px] opacity-70 mt-0.5">{getSlotPriceLabel(slot, createForm.matchDate)}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {createSelectedSlots.length > 0 && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">{createSelectedSlots.length} khung · {createForm.startTime}–{createForm.endTime}</p>
                          <p className="font-bold text-emerald-600">{totalCreatePrice.toLocaleString("vi-VN")}đ</p>
                        </div>
                        <button type="button"
                          onClick={() => { setCreateSelectedSlots([]); setCreateForm(f => ({ ...f, startTime: "", endTime: "", totalPrice: "" })); }}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors">Xóa chọn</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Trình độ + Số người */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Trình độ</label>
                    <select value={createForm.level} onChange={e => setCreateForm(f => ({ ...f, level: e.target.value }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 bg-white">
                      <option value="BEGINNER">Người mới</option>
                      <option value="INTERMEDIATE">Trung bình</option>
                      <option value="PRO">Chuyên nghiệp</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Tổng số người cần</label>
                    <input type="number" min={2} max={20} value={createForm.requiredPlayers}
                      onChange={e => setCreateForm(f => ({ ...f, requiredPlayers: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                    <p className="text-xs text-gray-400 mt-0.5">Bao gồm cả bạn</p>
                  </div>
                </div>

                {/* Tóm tắt giá */}
                {pricePerPerson > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    <p className="font-semibold mb-0.5">Tổng tiền sân: {totalCreatePrice.toLocaleString("vi-VN")}đ</p>
                    <p>Mỗi người đóng góp: {pricePerPerson.toLocaleString("vi-VN")}đ</p>
                    <p className="mt-0.5 text-amber-500">Tiền sân sẽ được trừ từ ví của bạn khi đăng bài.</p>
                  </div>
                )}

                {/* Mô tả */}
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Mô tả thêm</label>
                  <textarea placeholder="Ghi chú thêm về kèo, yêu cầu, liên hệ..."
                    value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => setCreateOpen(false)}
                    className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Hủy</button>
                  <button onClick={submitCreate}
                    disabled={creating || !createForm.facilityId || !createForm.categoryId || !createForm.matchDate || !createForm.startTime}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                    {creating ? "Đang đăng..." : "Đăng bài"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: Tham gia (2 bước) */}
      {joinPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl my-auto w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <img src="/group.png" className="w-5 h-5" alt="" />
                <h3 className="font-bold text-black">Tham gia ghép trận</h3>
              </div>
              <div className="flex gap-1">
                {[1,2].map(s => (
                  <div key={s} className={`w-6 h-1.5 rounded-full ${joinStep >= s ? "bg-emerald-500" : "bg-gray-200"}`} />
                ))}
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Thông tin bài */}
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm mb-4 space-y-1">
                <p className="font-semibold text-black">{joinPost.title}</p>
                <p className="text-gray-500 text-xs">{joinPost.facility.name} · {joinPost.facility.address}</p>
                <p className="text-gray-500 text-xs">{new Date(joinPost.matchDate).toLocaleDateString("vi-VN")} · {joinPost.startTime}–{joinPost.endTime}</p>
                {joinPost.pricePerPerson != null && joinPost.pricePerPerson > 0 && (
                  <p className="text-amber-700 font-semibold">Phí: {joinPost.pricePerPerson.toLocaleString("vi-VN")}đ/người</p>
                )}
              </div>

              {/* BƯỚC 1: Xem QR + điền info khách */}
              {joinStep === 1 && (
                <>
                  {joinPost.qrCodeUrl ? (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                        <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                        Quét mã QR để chuyển khoản cho người đăng bài:
                      </p>
                      <div className="flex justify-center bg-white border-2 border-emerald-200 rounded-2xl p-3 mb-2">
                        <img src={joinPost.qrCodeUrl} alt="QR thanh toán" className="max-h-52 object-contain" />
                      </div>
                      {joinPost.pricePerPerson != null && joinPost.pricePerPerson > 0 ? (
                        <p className="text-xs text-center text-amber-700 font-medium">
                          Chuyển khoản: <span className="font-bold">{joinPost.pricePerPerson.toLocaleString("vi-VN")}đ</span>
                        </p>
                      ) : (
                        <p className="text-xs text-center text-gray-400">Thoả thuận trực tiếp với người đăng bài về phí tham gia</p>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                      <p className="font-medium mb-1">Chưa có mã QR thanh toán</p>
                      <p className="text-xs text-amber-600">Người đăng bài chưa tải lên mã QR. Bạn vẫn có thể gửi yêu cầu — chủ bài sẽ liên hệ hướng dẫn thanh toán sau khi duyệt.</p>
                    </div>
                  )}

                  {!session && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                        <span className="w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-[10px] font-bold">{joinPost.qrCodeUrl ? "2" : "1"}</span>
                        Thông tin của bạn:
                      </p>
                      <input type="text" placeholder="Họ và tên *" value={guestName} onChange={e => setGName(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                      <input type="tel" placeholder="Số điện thoại *" value={guestPhone} onChange={e => setGPhone(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                      <input type="email" placeholder="Email (để nhận thông báo kết quả)" value={guestEmail} onChange={e => setGEmail(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => setJoinPost(null)}
                      className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Hủy</button>
                    <button
                      onClick={() => setJoinStep(2)}
                      disabled={!session && (!guestName || !guestPhone)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {joinPost.qrCodeUrl ? "Tiếp theo" : "Gửi yêu cầu"}
                    </button>
                  </div>
                </>
              )}

              {/* BƯỚC 2: Upload bill */}
              {joinStep === 2 && (
                <>
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <span className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                      Tải lên ảnh bill chuyển khoản để xác nhận:
                    </p>
                    <input ref={proofRef} type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files?.[0] && uploadProof(e.target.files[0])} />

                    {proofUrl ? (
                      <div className="relative">
                        <img src={proofUrl} alt="Bill" className="w-full max-h-44 object-contain border border-gray-200 rounded-xl" />
                        <button onClick={() => setProofUrl(null)}
                          className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center shadow">✕</button>
                        <p className="text-xs text-emerald-600 text-center mt-1.5 font-medium">Đã tải lên ảnh bill</p>
                      </div>
                    ) : (
                      <button onClick={() => proofRef.current?.click()} disabled={uploading}
                        className="w-full border-2 border-dashed border-gray-300 hover:border-emerald-400 text-gray-500 hover:text-emerald-600 rounded-xl py-6 text-sm transition-colors flex flex-col items-center gap-1">
                        {uploading ? (
                          <span>Đang tải lên...</span>
                        ) : (
                          <><span className="font-medium">Nhấn để chọn ảnh bill</span><span className="text-xs text-gray-400">JPG, PNG, WebP · tối đa 5MB</span></>
                        )}
                      </button>
                    )}

                    {!joinPost.qrCodeUrl && (
                      <p className="text-xs text-gray-400 mt-2 text-center">Không bắt buộc nếu chưa chuyển khoản</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setJoinStep(1)}
                      className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Quay lại</button>
                    <button
                      onClick={submitJoin}
                      disabled={submitting || uploading}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-2">Chủ bài sẽ xem bill và duyệt yêu cầu của bạn</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Chỉnh sửa bài (Creator) */}
      {editPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl my-auto w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-black text-lg">Chỉnh sửa bài đăng</h3>
              <button onClick={() => setEditPost(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tiêu đề</label>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Mô tả</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Trình độ</label>
                  <select value={editForm.level} onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 bg-white">
                    <option value="BEGINNER">Người mới</option>
                    <option value="INTERMEDIATE">Trung bình</option>
                    <option value="PRO">Chuyên nghiệp</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tổng số người</label>
                  <input type="number" min={editPost.joinedPlayers} max={20}
                    value={editForm.requiredPlayers}
                    onChange={e => setEditForm(f => ({ ...f, requiredPlayers: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
                  <p className="text-xs text-gray-400 mt-0.5">Đã có: {editPost.joinedPlayers} người</p>
                </div>
              </div>

              {/* QR code section */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Mã QR thanh toán ngân hàng
                  {!editQrUrl && <span className="text-amber-500 font-medium ml-1">(khuyến nghị để người tham gia chuyển khoản)</span>}
                </label>
                <input ref={qrRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadQr(e.target.files[0])} />

                {editQrUrl ? (
                  <div className="relative">
                    <div className="flex justify-center bg-gray-50 border-2 border-emerald-200 rounded-2xl p-3">
                      <img src={editQrUrl} alt="QR" className="max-h-48 object-contain" />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => qrRef.current?.click()} disabled={editQrUploading}
                        className="flex-1 text-xs border border-blue-300 text-blue-600 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                        {editQrUploading ? "Đang tải..." : "Đổi ảnh QR"}
                      </button>
                      <button onClick={() => setEditQrUrl(null)}
                        className="flex-1 text-xs border border-red-300 text-red-500 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                        Xóa QR
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => qrRef.current?.click()} disabled={editQrUploading}
                    className="w-full border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl py-5 text-sm transition-colors flex flex-col items-center gap-1">
                    {editQrUploading ? (
                      <span>Đang tải lên...</span>
                    ) : (
                      <><span className="font-medium">Tải lên mã QR ngân hàng</span><span className="text-xs opacity-70">Để người tham gia quét và chuyển tiền cho bạn</span></>
                    )}
                  </button>
                )}
              </div>

              {/* Lock toggle */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-black">{editPost.isLocked ? "Bài đang bị khóa" : "Bài đang mở"}</p>
                  <p className="text-xs text-gray-500">{editPost.isLocked ? "Không ai có thể gửi yêu cầu mới" : "Mọi người có thể gửi yêu cầu tham gia"}</p>
                </div>
                <button
                  onClick={async () => { await toggleLock(editPost); setEditPost(p => p ? { ...p, isLocked: !p.isLocked } : p); }}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors border ${editPost.isLocked ? "border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" : "border-gray-300 text-gray-600 bg-white hover:bg-gray-100"}`}
                >
                  {editPost.isLocked ? "Mở khóa" : "Khóa bài"}
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditPost(null)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Hủy</button>
                <button onClick={saveEdit} disabled={editSaving || !editForm.title}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {editSaving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Danh sách yêu cầu (Creator) */}
      {reqPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl my-auto w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-black text-lg">Yêu cầu tham gia</h3>
                <p className="text-xs text-gray-500 mt-0.5">{reqPost.title}</p>
              </div>
              <button onClick={() => setReqPost(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-4">
              {reqLoading ? (
                <div className="py-10 text-center text-gray-400">Đang tải...</div>
              ) : requests.length === 0 ? (
                <div className="py-10 text-center text-gray-400">
                  <p className="text-sm">Chưa có yêu cầu nào.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {requests.map(req => {
                    const name    = req.user?.fullName || req.guestName || "Khách";
                    const contact = req.user?.phone || req.guestPhone || req.user?.email || req.guestEmail || "";
                    return (
                      <div key={req.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="font-semibold text-sm text-black">{name}</p>
                            {contact && <p className="text-xs text-gray-500">{contact}</p>}
                            {!req.user && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Khách vãng lai</span>}
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_JOIN[req.status]?.color}`}>
                            {STATUS_JOIN[req.status]?.label}
                          </span>
                        </div>

                        {req.paymentProofUrl ? (
                          <button onClick={() => setViewProof(req.paymentProofUrl)}
                            className="text-xs text-blue-600 hover:underline mb-2 block font-medium">
                            Xem ảnh bill chuyển khoản
                          </button>
                        ) : (
                          <p className="text-xs text-gray-400 mb-2 italic">Chưa tải bill lên</p>
                        )}

                        {req.status === "PENDING" && (
                          rejectId === req.id ? (
                            <div className="space-y-2">
                              <input type="text" placeholder="Lý do từ chối (tuỳ chọn)" value={rejectNote}
                                onChange={e => setRejectNote(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-red-400" />
                              <div className="flex gap-2">
                                <button onClick={() => { setRejectId(null); setRejectNote(""); }}
                                  className="flex-1 border border-gray-300 text-gray-600 py-1.5 rounded-lg text-xs hover:bg-gray-50">Hủy</button>
                                <button onClick={() => reject(req.id)}
                                  className="flex-1 bg-red-500 hover:bg-red-400 text-white py-1.5 rounded-lg text-xs font-medium">Xác nhận từ chối</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => approve(req.id)}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-1.5 rounded-lg text-xs font-medium transition-colors">
                                Duyệt tham gia
                              </button>
                              <button onClick={() => { setRejectId(req.id); setRejectNote(""); }}
                                className="flex-1 border border-red-300 text-red-500 hover:bg-red-50 py-1.5 rounded-lg text-xs transition-colors">
                                Từ chối
                              </button>
                            </div>
                          )
                        )}

                        {req.note && req.status === "REJECTED" && (
                          <p className="text-xs text-red-400 mt-1 italic">Lý do: {req.note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Xem bill fullscreen */}
      {viewProof && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-60 px-4"
          onClick={() => setViewProof(null)}>
          <div className="relative max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewProof(null)}
              className="absolute -top-3 -right-3 bg-white text-gray-700 w-8 h-8 rounded-full flex items-center justify-center shadow-lg text-sm font-bold">✕</button>
            <img src={viewProof} alt="Bill" className="w-full rounded-2xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
