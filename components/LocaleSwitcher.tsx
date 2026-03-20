"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export default function LocaleSwitcher({ currentLocale }: { currentLocale: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function switchLocale(locale: string) {
    document.cookie = `locale=${locale}; path=/; max-age=31536000`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1">
      {[
        { value: "vi", label: "🇻🇳" },
        { value: "en", label: "🇬🇧" },
      ].map((l) => (
        <button
          key={l.value}
          onClick={() => switchLocale(l.value)}
          disabled={isPending}
          title={l.value === "vi" ? "Tiếng Việt" : "English"}
          className={`w-8 h-8 rounded-lg text-sm transition-colors ${
            currentLocale === l.value
              ? "bg-emerald-500 text-white"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}