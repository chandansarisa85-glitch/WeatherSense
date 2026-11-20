"use client";

import { Moon, Sun } from "lucide-react";
import { useWeather } from "@/context/weather-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useWeather();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--ws-line)] bg-white/5 px-3 text-sm text-ws-text transition hover:border-[#38D9FF]/50"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4 text-[#FFCB70]" /> : <Moon className="h-4 w-4 text-[#4B9EFF]" />}
      {compact ? null : <span>{theme === "dark" ? "Light" : "Dark"}</span>}
    </button>
  );
}
