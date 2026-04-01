"use client";
import { useEffect, useRef, useState, useCallback } from "react";

type Mode = "register" | "verify";

interface Props {
  mode: Mode;
  /** verify mode: descriptor đã lưu trong DB (JSON string) */
  savedDescriptor?: string | null;
  onSuccess: (descriptor?: number[]) => void;
  onCancel: () => void;
}

const MODEL_URL = "/models";
const MATCH_THRESHOLD = 0.45; // khoảng cách Euclidean — nhỏ hơn = giống hơn

// Lazy load face-api để không ảnh hưởng bundle chính
async function loadFaceApi() {
  const faceapi = await import("face-api.js");
  return faceapi;
}

export default function FaceCapture({ mode, savedDescriptor, onSuccess, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "scanning" | "done" | "error">("loading");
  const [message, setMessage] = useState("Đang tải model nhận diện...");
  const [faceApiRef, setFaceApiRef] = useState<Awaited<ReturnType<typeof loadFaceApi>> | null>(null);

  // Load models + camera
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setMessage("Đang tải model nhận diện khuôn mặt...");
        const faceapi = await loadFaceApi();

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        if (cancelled) return;
        setFaceApiRef(faceapi);

        setMessage("Đang mở camera...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
        });

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus("ready");
        setMessage(
          mode === "register"
            ? "Nhìn thẳng vào camera rồi bấm Chụp"
            : "Nhìn thẳng vào camera để xác nhận"
        );

        if (mode === "verify") startVerifyLoop(faceapi);
      } catch (e: any) {
        if (!cancelled) {
          setStatus("error");
          if (e.name === "NotAllowedError") setMessage("Bạn chưa cấp quyền camera.");
          else if (e.message?.includes("model")) setMessage("Không tải được model. Kiểm tra thư mục /public/models/.");
          else setMessage("Lỗi khởi tạo: " + e.message);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  // ── REGISTER: chụp 1 ảnh ─────────────────────────────────────────────────
  async function handleCapture() {
    if (!faceApiRef || !videoRef.current) return;
    setStatus("scanning");
    setMessage("Đang nhận diện...");

    try {
      const detection = await faceApiRef
        .detectSingleFace(videoRef.current, new faceApiRef.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      if (!detection) {
        setStatus("ready");
        setMessage("Không tìm thấy khuôn mặt. Hãy thử lại.");
        return;
      }

      const descriptor = Array.from(detection.descriptor) as number[];
      setStatus("done");
      setMessage("Đăng ký thành công!");
      cleanup();
      onSuccess(descriptor);
    } catch {
      setStatus("ready");
      setMessage("Có lỗi khi xử lý. Thử lại.");
    }
  }

  // ── VERIFY: liên tục quét mỗi 800ms ──────────────────────────────────────
  const startVerifyLoop = useCallback((faceapi: Awaited<ReturnType<typeof loadFaceApi>>) => {
    if (!savedDescriptor) {
      setStatus("error");
      setMessage("Chưa đăng ký khuôn mặt. Liên hệ quản lý để đăng ký.");
      return;
    }

    const saved = new Float32Array(JSON.parse(savedDescriptor) as number[]);
    let noFaceCount = 0;

    setStatus("scanning");
    setMessage("Nhìn thẳng vào camera...");

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) return;
      const video = videoRef.current;

      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks(true)
        .withFaceDescriptor();

      // Re-check sau await
      if (!videoRef.current) return;

      if (!detection) {
        noFaceCount++;
        if (noFaceCount >= 4) {
          setMessage("Không phát hiện khuôn mặt — hãy nhìn thẳng vào camera...");
        }
        return;
      }

      noFaceCount = 0;
      const distance = faceapi.euclideanDistance(detection.descriptor, saved);

      if (distance < MATCH_THRESHOLD) {
        clearInterval(intervalRef.current!);
        setStatus("done");
        setMessage("Nhận diện thành công! Đang xác nhận...");
        streamRef.current?.getTracks().forEach(t => t.stop());
        // Chờ 1.2s để user thấy trạng thái thành công rồi mới đóng
        setTimeout(() => onSuccess(), 1200);
      } else {
        setMessage("Khuôn mặt không khớp — hãy điều chỉnh góc nhìn và thử lại...");
      }
    }, 800);
  }, [savedDescriptor, onSuccess]);

  // Vẽ overlay nhận diện
  useEffect(() => {
    if (status !== "scanning" || !faceApiRef) return;
    const drawInterval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      const detections = await faceApiRef.detectAllFaces(
        video,
        new faceApiRef.TinyFaceDetectorOptions()
      ).withFaceLandmarks(true);

      // Re-check sau await — component có thể đã unmount
      if (!videoRef.current || !canvasRef.current) return;

      const dims = { width: video.videoWidth, height: video.videoHeight };
      faceApiRef.matchDimensions(canvas, dims);
      const resized = faceApiRef.resizeResults(detections, dims);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, dims.width, dims.height);
        faceApiRef.draw.drawDetections(canvas, resized);
        faceApiRef.draw.drawFaceLandmarks(canvas, resized);
      }
    }, 200);
    return () => clearInterval(drawInterval);
  }, [status, faceApiRef]);

  const statusColor = {
    loading: "text-gray-500",
    ready: "text-emerald-600",
    scanning: "text-blue-600",
    done: "text-emerald-700 font-semibold",
    error: "text-red-600",
  }[status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-black text-center mb-3">
          {mode === "register" ? "Đăng ký khuôn mặt" : "Xác nhận khuôn mặt"}
        </h3>

        {/* Camera */}
        <div className="relative rounded-xl overflow-hidden bg-black mb-3" style={{ aspectRatio: "4/3" }}>
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: "scaleX(-1)" }} />
          {status === "done" && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80">
              <span className="text-white text-5xl">✓</span>
            </div>
          )}
        </div>

        {/* Trạng thái */}
        <p className={`text-sm text-center mb-4 min-h-[40px] ${statusColor}`}>{message}</p>

        {/* Nút */}
        <div className="flex gap-2">
          {mode === "register" && status === "ready" && (
            <button onClick={handleCapture}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-2.5 rounded-xl text-sm font-semibold">
              Chụp khuôn mặt
            </button>
          )}
          {mode === "register" && status === "scanning" && (
            <button disabled className="flex-1 bg-emerald-300 text-white py-2.5 rounded-xl text-sm font-semibold">
              Đang xử lý...
            </button>
          )}
          <button onClick={() => { cleanup(); onCancel(); }}
            className="flex-1 bg-white border border-gray-300 text-gray-600 hover:border-red-300 py-2.5 rounded-xl text-sm">
            {status === "done" ? "Đóng" : "Hủy"}
          </button>
        </div>
      </div>
    </div>
  );
}
