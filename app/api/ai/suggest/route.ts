import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "có key" : "KHÔNG CÓ KEY");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    console.log("Gemini response:", JSON.stringify(data).slice(0, 300));
    
    const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể gợi ý lúc này.";
    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error("AI error:", error);
    return NextResponse.json({ suggestion: "Lỗi khi gọi AI." }, { status: 500 });
  }
}