"use client";

import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion as fm } from "framer-motion";
import { LocationSearch } from "@/components/location-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWeather } from "@/context/weather-provider";
import { buildAlerts } from "@/lib/alerts";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/#forecast", label: "Forecast" },
  { href: "/#maps", label: "Weather Maps" },
  { href: "/#analytics", label: "Analytics" },
  { href: "/#assistant", label: "Forecast assistant" },
];

function Logo() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="WeatherSense home">
      <span className="grid h-9 w-9 place-items-center rounded-2xl border border-[#38D9FF]/30 bg-[#38D9FF]/10">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden>
          <circle cx="12" cy="13" r="4.5" fill="#FFCB70" />
          <path d="M8 22h16a5 5 0 0 0 0-10 6.5 6.5 0 0 0-12.4-1.6A4.5 4.5 0 0 0 8 22z" fill="#F4F8FF" />
        </svg>
      </span>
      <span className="font-display text-base font-semibold tracking-tight text-ws-text">WeatherSense</span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { snapshot, motion, setMotion } = useWeather();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("/");
  const alerts = snapshot ? buildAlerts(snapshot) : [];

  useEffect(() => {
    const syncLocation = () => setActiveHref(`${window.location.pathname}${window.location.hash}`);
    syncLocation();
    window.addEventListener("hashchange", syncLocation);
    window.addEventListener("popstate", syncLocation);
    return () => {
      window.removeEventListener("hashchange", syncLocation);
      window.removeEventListener("popstate", syncLocation);
    };
  }, []);

  const closeMenus = () => {
    setMobileOpen(false);
    setAlertsOpen(false);
    setProfileOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 md:px-6">
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-nav)] px-3 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl md:gap-3">
        <Logo />
        <nav className="ml-2 hidden items-center gap-1 xl:flex" aria-label="Primary">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" && activeHref === "/" : activeHref === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={() => { closeMenus(); setActiveHref(link.href); }}
                className={cn(
                  "relative rounded-full px-3 py-2 text-sm text-ws-muted transition hover:text-ws-text",
                  active && "text-ws-text",
                )}
              >
                {active ? (
                  <fm.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full border border-[#38D9FF]/40 bg-[#38D9FF]/10"
                  />
                ) : null}
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden w-56 md:block xl:w-64">
          <LocationSearch />
        </div>
        <button
          type="button"
          className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--ws-line)] text-ws-text hover:border-[#38D9FF]/50"
          aria-label={`Notifications, ${alerts.length} threshold alerts`}
          aria-expanded={alertsOpen}
          onClick={() => {
            setAlertsOpen((open) => !open);
            setProfileOpen(false);
          }}
        >
          <Bell className="h-4 w-4" />
          {alerts.length ? (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#F09A4A]" />
          ) : null}
        </button>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-[var(--ws-line)] bg-gradient-to-br from-[#17324d] to-[#0d1b2d] text-ws-text"
          aria-label="Preferences"
          aria-expanded={profileOpen}
          onClick={() => {
            setProfileOpen((open) => !open);
            setAlertsOpen(false);
          }}
        >
          <span className="text-xs font-semibold">WS</span>
        </button>
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-[var(--ws-line)] text-ws-text xl:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {alertsOpen ? (
        <div className="mx-auto mt-2 max-w-md rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-popup)] p-4 shadow-2xl">
          <p className="text-sm font-medium text-ws-text">Threshold notices</p>
          <p className="mt-1 text-xs leading-5 text-ws-muted">
            Generated from WeatherSense thresholds and the loaded forecast. Not official warnings.
          </p>
          <div className="mt-3 space-y-2">
            {alerts.length ? (
              alerts.map((alert) => (
                <Link key={alert.id} href="/#alerts" className="block rounded-xl bg-white/5 px-3 py-2" onClick={() => setAlertsOpen(false)}>
                  <span className="text-sm text-ws-text">{alert.title}</span>
                  <span className="mt-1 block text-xs text-ws-muted">{alert.detail}</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-ws-muted">No configured threshold is currently met.</p>
            )}
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="mx-auto mt-2 max-w-sm rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-popup)] p-4 shadow-2xl">
          <p className="text-sm font-medium text-ws-text">Local preferences</p>
          <p className="mt-1 text-xs leading-5 text-ws-muted">Stored in this browser. No account is connected.</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-ws-text">Theme</span>
            <ThemeToggle />
          </div>
          <label className="mt-3 block text-sm text-ws-text">
            Motion
            <select
              value={motion}
              onChange={(event) => setMotion(event.target.value as typeof motion)}
              className="mt-1 h-10 w-full rounded-xl border border-[var(--ws-line)] bg-transparent px-3 text-sm"
            >
              <option value="system">Match device</option>
              <option value="full">Full motion</option>
              <option value="reduce">Reduced motion</option>
            </select>
          </label>
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="mx-auto mt-2 rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-popup)] p-3 shadow-2xl xl:hidden">
          <LocationSearch />
          <nav className="mt-2 grid gap-1" aria-label="Mobile">
            {LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" && activeHref === "/" : activeHref === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => { closeMenus(); setActiveHref(link.href); }}
                  className={cn("rounded-xl px-3 py-3 text-sm", active ? "bg-[#38D9FF]/10 text-ws-text" : "text-ws-muted")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
