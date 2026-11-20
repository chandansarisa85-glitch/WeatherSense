"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Bot, Check, CloudRain, Droplets, Eye, Gauge, MapPin, Navigation, RefreshCw, Send,
  ShieldAlert, Sparkles, Sun, Sunrise, Sunset, Wind,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { SectionHeading } from "@/components/section-heading";
import { WeatherIcon } from "@/components/weather-icon";
import { useWeather } from "@/context/weather-provider";
import { answerQuestion, SUGGESTED_QUESTIONS } from "@/lib/assistant";
import { buildAlerts } from "@/lib/alerts";
import { compass, currentHour, findDay, formatClock, formatFullDate, formatMonthDay, formatNumber, formatTemp, formatUpdated, formatWeekday, upcomingHours, uvLabel } from "@/lib/format";
import { describeWeather } from "@/lib/weather-codes";
import type { DailyPoint, HourlyPoint, MapLayer, WeatherKind } from "@/lib/types";

const Weather3D = dynamic(() => import("@/components/weather-3d").then((module) => module.Weather3D), { ssr: false, loading: () => <div className="scene-3d-fallback"/> });

const WeatherMap = dynamic(() => import("@/components/weather-map").then((module) => module.WeatherMap), {
  ssr: false,
  loading: () => <div className="map-surface grid h-[360px] place-items-center rounded-[24px]"><span className="text-sm text-ws-muted">Preparing local weather map…</span></div>,
});

const ANALYTICS_RANGE = ["24 hours", "5 days"] as const;

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const c1x = start.x + (end.x - previous.x) / 6;
    const c1y = start.y + (end.y - previous.y) / 6;
    const c2x = end.x - (next.x - start.x) / 6;
    const c2y = end.y - (next.y - start.y) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  }
  return path;
}

function WeatherScene({ kind, day, reducedMotion }: { kind: WeatherKind; day: boolean; reducedMotion: boolean }) {
  return (
    <div className={`weather-scene scene-${kind}`} aria-label={`${kind} weather illustration`} role="img">
      <div className="scene-3d"><Weather3D kind={kind} isDay={day} reducedMotion={reducedMotion}/></div>
      <div className="scene-caption">Atmospheric view <span>·</span> Current conditions</div>
    </div>
  );
}

function StatCard({ title, value, unit, subtitle, icon: Icon, color }: { title: string; value: string; unit: string; subtitle: string; icon: typeof Wind; color: string }) {
  return (
    <article className="metric-cell">
      <div className="metric-title"><Icon size={15} style={{ color }} /><span>{title}</span></div>
      <p className="metric-reading"><span>{value}</span><small>{unit}</small></p>
      <p className="metric-note">{subtitle}</p>
    </article>
  );
}

function Hourly({ hours, currentTime }: { hours: HourlyPoint[]; currentTime: string }) {
  return <div className="hourly-scroll" aria-label="Hourly forecast">
    {hours.map((hour) => {
      const weather = describeWeather(hour.weatherCode);
      const active = hour.time.slice(0, 13) === currentTime.slice(0, 13);
      return <article key={hour.time} className={`hour-card ${active ? "hour-card-active" : ""}`}>
        <p className="text-xs text-ws-muted">{active ? "Now" : formatClock(hour.time)}</p>
        <WeatherIcon kind={weather.kind} className="my-4 h-6 w-6" />
        <p className="font-display text-lg font-medium text-ws-text">{formatTemp(hour.temperature)}</p>
        <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-[#67C9FF]"><Droplets size={12} />{formatNumber(hour.precipitationProbability)}%</p>
      </article>;
    })}
  </div>;
}

function Weekly({ days }: { days: DailyPoint[] }) {
  const temps = days.flatMap((day) => [day.tempMin, day.tempMax]).filter((value): value is number => value != null);
  const min = Math.min(...temps, 0); const max = Math.max(...temps, 1);
  return <div className="divide-y divide-white/[0.055]">
    {days.slice(0, 7).map((day, index) => {
      const weather = describeWeather(day.weatherCode);
      const left = day.tempMin == null ? 0 : ((day.tempMin - min) / (max - min || 1)) * 100;
      const width = day.tempMin == null || day.tempMax == null ? 0 : Math.max(8, ((day.tempMax - day.tempMin) / (max - min || 1)) * 100);
      return <div key={day.date} className="weekly-row">
        <div className="w-[86px] shrink-0"><p className="text-sm font-medium text-ws-text">{index === 0 ? "Today" : formatWeekday(day.date)}</p><p className="mt-1 text-[11px] text-ws-muted">{formatMonthDay(day.date)}</p></div>
        <WeatherIcon kind={weather.kind} className="h-5 w-5 shrink-0" />
        <span className="hidden w-36 text-xs text-ws-muted sm:block">{weather.label}</span>
        <span className="w-9 text-right text-xs text-ws-muted">{formatTemp(day.tempMin)}</span>
        <div className="temperature-track"><span style={{ left: `${left}%`, width: `${width}%` }} /></div>
        <span className="w-9 text-xs font-medium text-ws-text">{formatTemp(day.tempMax)}</span>
        <span className="flex w-12 items-center justify-end gap-1 text-[11px] text-[#67C9FF]"><Droplets size={12} />{formatNumber(day.precipitationProbability)}%</span>
      </div>;
    })}
  </div>;
}

function Analytics({ hours, days, intervalHours }: { hours: HourlyPoint[]; days: DailyPoint[]; intervalHours: number }) {
  const [range, setRange] = useState<(typeof ANALYTICS_RANGE)[number]>("24 hours");
  const points = useMemo(() => range === "24 hours" ? hours.slice(0, Math.ceil(24 / intervalHours)).map((hour, i) => ({ label: i % Math.max(1, Math.ceil(12 / intervalHours)) === 0 ? formatClock(hour.time) : "", pointLabel: formatClock(hour.time), temperature: hour.temperature, rain: hour.precipitationProbability, wind: hour.windSpeed, humidity: hour.humidity })) : days.slice(0, 5).map((day) => {
    return { label: formatWeekday(day.date), pointLabel: formatFullDate(day.date), temperature: day.tempMax, rain: day.precipitationProbability, wind: day.windSpeedMax, humidity: day.humidity };
  }), [hours, days, intervalHours, range]);
  const series = [{ key: "temperature" as const, label: "Temperature", unit: "°C", color: "#FFCB70" }, { key: "rain" as const, label: "Rain chance", unit: "%", color: "#49B8FF" }, { key: "wind" as const, label: "Wind speed", unit: "km/h", color: "#9B87FF" }, { key: "humidity" as const, label: "Humidity", unit: "%", color: "#38D9FF" }];
  return <>
    <div className="chart-range-toggle flex w-fit rounded-full border border-[var(--ws-line)] bg-white/[0.025] p-1" role="group" aria-label="Analytics range">{ANALYTICS_RANGE.map((item) => <button type="button" key={item} aria-pressed={range === item} onClick={() => setRange(item)} className={`rounded-full px-3 py-1.5 text-xs transition ${range === item ? "bg-[#38D9FF]/15 text-ws-text" : "text-ws-muted hover:text-ws-text"}`}>{item}</button>)}</div>
    <div className="mt-5 grid gap-4 xl:grid-cols-2">{series.map((item) => {
      const values = points.map((point) => point[item.key]).filter((v): v is number => v != null);
      const lo = Math.min(...values, 0), hi = Math.max(...values, 1);
      const coords = points.map((point, i) => ({ x: points.length <= 1 ? 50 : (i / (points.length - 1)) * 100, y: point[item.key] == null ? null : 86 - ((point[item.key]! - lo) / (hi - lo || 1)) * 68, value: point[item.key], label: point.pointLabel })).filter((point): point is { x: number; y: number; value: number; label: string } => point.y != null && point.value != null);
      const path = smoothPath(coords);
      const area = coords.length ? `${path} L ${coords[coords.length - 1].x} 100 L ${coords[0].x} 100 Z` : "";
      return <div key={item.key} className="chart-card"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-ws-text">{item.label}</p><p className="mt-1 text-xs text-ws-muted">{range === "24 hours" ? "Next 24 hours" : "5-day outlook"}</p></div><span className="chart-legend" style={{ color: item.color }}><i style={{ background: item.color }} />{item.unit}</span></div>
        {values.length === 0 ? <p className="grid h-[156px] place-items-center text-sm text-ws-muted">No {item.label.toLowerCase()} data in this forecast.</p> : <>
        <div className="chart-wrap mt-4"><div className="chart-y-labels"><span>{formatNumber(hi)}{item.key === "temperature" ? "°" : ""}</span><span>{formatNumber((hi + lo) / 2)}</span><span>{formatNumber(lo)}{item.key === "temperature" ? "°" : ""}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" role="group" aria-label={`${item.label} chart from the OpenWeather forecast`}><defs><linearGradient id={`fill-${item.key}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity=".18"/><stop offset="100%" stopColor={item.color} stopOpacity="0"/></linearGradient></defs>{[20, 53, 86].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="chart-grid"/>)}{path && <><path d={area} fill={`url(#fill-${item.key})`}/><path d={path} fill="none" stroke={item.color} strokeWidth="1.7" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>{coords.map((point) => <circle key={point.label} cx={point.x} cy={point.y} r="1.35" className="chart-point" style={{ fill: item.color }} tabIndex={0} aria-label={`${point.label}: ${formatNumber(point.value)} ${item.unit}`}><title>{point.label}: {formatNumber(point.value)} {item.unit}</title></circle>)}</>}</svg></div><div className="chart-x-labels">{points.map((point, index) => <span key={`${point.label}-${index}`}>{point.label}</span>)}</div>
        </>}
      </div>;
    })}</div>
  </>;
}

function AssistantPanel() {
  const { snapshot } = useWeather();
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState<Array<{ q: string; a: string }>>([]);
  if (!snapshot) return null;
  function ask(prompt: string) { if (!snapshot || !prompt.trim()) return; setConversation((items) => [...items, { q: prompt, a: answerQuestion(prompt, snapshot) }]); setQuestion(""); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); ask(question); }
  return <div className="assistant-panel">
    <div className="flex items-center gap-3"><div className="assistant-avatar"><Bot size={19}/></div><div><p className="text-sm font-medium text-ws-text">Forecast assistant</p><p className="mt-1 flex items-center gap-1.5 text-[11px] text-ws-muted"><span className="status-dot"/> Answers use loaded forecast values</p></div><Sparkles className="ml-auto h-4 w-4 text-[#9B87FF]"/></div>
    <div className="assistant-log mt-5">
      <div className="chat-bubble chat-ai">I’m using the current OpenWeather forecast for {snapshot.place.name}. Ask me about rain, UV, wind, or your plans.</div>
      {conversation.map((entry, index) => <div key={`${index}-${entry.q}`} className="space-y-2"><div className="chat-bubble chat-user">{entry.q}</div><div className="chat-bubble chat-ai">{entry.a}</div></div>)}
    </div>
    {conversation.length === 0 && <div className="mt-3 flex flex-wrap gap-2">{SUGGESTED_QUESTIONS.map((suggestion) => <button type="button" key={suggestion} className="suggestion-chip" onClick={() => ask(suggestion)}>{suggestion}</button>)}</div>}
    <form onSubmit={submit} className="assistant-input mt-4"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about your forecast…" aria-label="Ask a forecast question"/><button type="submit" aria-label="Send question" disabled={!question.trim()}><Send size={15}/></button></form>
    <p className="mt-2 text-[10px] text-ws-muted">Answers use loaded forecast values and are not official guidance.</p>
  </div>;
}

function AlertsPanel() {
  const { snapshot } = useWeather();
  if (!snapshot) return null;
  const alerts = buildAlerts(snapshot);
  const tone: Record<string, string> = { info: "#53C995", moderate: "#F4CF69", high: "#F09A4A", severe: "#F06F79" };
  return <div className="glass-card p-5 md:p-6"><div className="flex items-center gap-2"><ShieldAlert size={17} className="text-[#FFCB70]"/><p className="text-sm font-medium text-ws-text">Weather notices</p></div><p className="mt-1 text-xs leading-5 text-ws-muted">Configured WeatherSense thresholds based on this forecast.</p>{alerts.length ? <div className="mt-4 space-y-3">{alerts.map((alert) => <div key={alert.id} className="alert-row"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: tone[alert.severity] }}/><div><p className="text-sm font-medium text-ws-text">{alert.title}<span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: tone[alert.severity] }}>{alert.severity}</span></p><p className="mt-1 text-xs leading-5 text-ws-muted">{alert.detail}</p></div></div>)}</div> : <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#53C995]/[0.07] p-3 text-xs text-ws-muted"><Check size={15} className="text-[#53C995]"/>No configured thresholds are currently met.</div>}<p className="mt-4 text-[10px] text-ws-muted">These notices are calculated from forecast data and are not official alerts.</p></div>;
}

function DashboardBody() {
  const { snapshot, status, error, locationNotice, refresh, reducedMotion } = useWeather();
  const [layer, setLayer] = useState<MapLayer>("temperature");
  if (!snapshot && status === "loading") return <><Navbar/><main aria-busy="true" aria-live="polite" className="mx-auto min-h-screen w-full max-w-[1440px] px-4 pt-28 md:px-8"><p className="sr-only">Loading live weather conditions</p><LoadingSkeleton className="h-[620px] w-full rounded-[30px]"/></main></>;
  if (!snapshot) return <><Navbar/><main className="mx-auto grid min-h-screen w-full max-w-2xl place-items-center px-4 pt-24"><div className="glass-card w-full p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F06F79]/10 text-[#F06F79]"><CloudRain/></div><h1 className="mt-5 font-display text-2xl text-ws-text">Weather data unavailable</h1><p className="mt-2 text-sm leading-6 text-ws-muted">{error ?? "The weather service did not return conditions."}</p><button onClick={refresh} className="primary-button mt-5"><RefreshCw size={15}/>Try again</button></div></main></>;
  const { place, current, daily, fetchedAt } = snapshot;
  const weather = describeWeather(current.weatherCode);
  const today = findDay(snapshot);
  const hour = currentHour(snapshot);
  const localDate = current.time.slice(0, 10);
  const hours = upcomingHours(snapshot, 24);
  const stats = [
    { title: "Humidity", value: formatNumber(current.humidity), unit: "%", subtitle: "Relative humidity", icon: Droplets, color: "#68bfe0" },
    { title: "Wind speed", value: formatNumber(current.windSpeed), unit: "km/h", subtitle: `From ${compass(current.windDirection)}`, icon: Wind, color: "#a89be9" },
    { title: "Pressure", value: formatNumber(current.pressure), unit: "hPa", subtitle: "Mean sea level", icon: Gauge, color: "#73c9df" },
    { title: "Visibility", value: current.visibility == null ? "—" : formatNumber(current.visibility / 1000, 1), unit: "km", subtitle: "Horizontal visibility", icon: Eye, color: "#a6b8cc" },
    { title: "UV index", value: formatNumber(hour?.uvIndex, 1), unit: "", subtitle: hour?.uvIndex == null ? "Not provided by OpenWeather" : uvLabel(hour.uvIndex), icon: Sun, color: "#e5bd72" },
    { title: "Precipitation", value: formatNumber(current.precipitation, 1), unit: "mm", subtitle: `Today · ${formatNumber(today?.precipitationProbability)}% chance`, icon: CloudRain, color: "#68bfe0" },
  ];
  const sectionMotion = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.5 } };
  return <><Navbar/><main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-[92px] md:px-8 md:pt-[112px]">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs text-ws-muted"><span className="status-dot"/> {status === "loading" ? "Updating conditions" : error ? "Last loaded conditions" : "Current conditions"} <span className="opacity-40">/</span> Updated {formatUpdated(fetchedAt)}</div><button type="button" onClick={refresh} className="refresh-button" disabled={status === "loading"}><RefreshCw size={13} className={status === "loading" ? "animate-spin" : ""}/> {status === "loading" ? "Refreshing" : "Refresh"}</button></div>
    {error && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F09A4A]/25 bg-[#F09A4A]/[0.06] px-4 py-3 text-xs text-ws-muted"><span>Couldn’t refresh live weather. Showing the last loaded conditions from {formatUpdated(fetchedAt)}. {error}</span><button type="button" onClick={refresh} className="refresh-button" disabled={status === "loading"}><RefreshCw size={13}/> Try again</button></div>}
    {locationNotice && <div className="mb-4 rounded-xl border border-[#FFCB70]/20 bg-[#FFCB70]/[0.05] px-4 py-2.5 text-xs text-ws-muted">{locationNotice}</div>}
    <motion.section {...sectionMotion} className="command-stage">
      <aside className="stage-story">
        <p className="stage-brand"><span className="stage-brand-mark">W</span> WEATHER SENSE <i/> OBSERVATORY</p>
        <p className="stage-kicker">WEATHER INTELLIGENCE</p>
        <h1 className="stage-title">Atmosphere,<br/> <em>in focus.</em></h1>
        <p className="stage-intro">Local conditions and verified weather layers, centered on your selected place.</p>
        <div className="stage-place"><MapPin size={15}/><div><strong>{place.name}</strong><span>{[place.admin1, place.country].filter(Boolean).join(", ")}</span></div></div>
        <div className="stage-coordinate"><Navigation size={12}/>{place.latitude.toFixed(2)}° N <span>/</span> {Math.abs(place.longitude).toFixed(2)}° {place.longitude < 0 ? "W" : "E"}</div>
        <div className="stage-source"><span className="status-dot"/> OpenWeather <span>·</span> Updated {formatUpdated(fetchedAt)}</div>
      </aside>

      <aside className="stage-current">
        <div className="stage-current-head"><div><p className="stage-panel-label">CURRENT CONDITIONS</p><p className="stage-current-time">{formatClock(current.time)} local <span>·</span> {formatFullDate(localDate)}</p></div><span className="stage-live-mark" aria-label="Weather data loaded"><i/></span></div>
        <div className="stage-condition-line"><WeatherIcon kind={weather.kind} className="h-5 w-5"/><span>{weather.label}</span><span className="stage-condition-day">{current.isDay ? "Day" : "Night"}</span></div>
        <div className="stage-weather-visual"><WeatherScene kind={weather.kind} day={current.isDay} reducedMotion={reducedMotion}/></div>
        <div className="stage-temperature-row"><div className="stage-temperature">{current.temperature == null ? "—" : Math.round(current.temperature)}<sup>°</sup></div></div>
        <div className="stage-feels">Feels like <strong>{formatTemp(current.apparentTemperature, true)}</strong><span>H {formatTemp(today?.tempMax)} <i>/</i> L {formatTemp(today?.tempMin)}</span></div>
        <div className="stage-sun-times"><div><Sunrise size={14}/><span>Sunrise</span><strong>{today?.sunrise ? formatClock(today.sunrise) : "—"}</strong></div><div><Sunset size={14}/><span>Sunset</span><strong>{today?.sunset ? formatClock(today.sunset) : "—"}</strong></div></div>
        <p className="stage-outlook-label">NEXT HOURS</p>
        <div className="stage-hour-strip">{hours.slice(0, 4).map((item) => <div className="stage-hour" key={item.time}><span>{formatClock(item.time)}</span><WeatherIcon kind={describeWeather(item.weatherCode).kind} className="h-4 w-4"/><strong>{formatTemp(item.temperature)}</strong></div>)}</div>
      </aside>

      <div className="weather-stats-grid stage-metrics">{stats.map((stat) => <StatCard key={stat.title} {...stat}/>)}</div>
    </motion.section>

    <motion.section {...sectionMotion} className="mt-12" id="forecast"><SectionHeading eyebrow="THE NEXT 24 HOURS" title="Forecast timeline" description="Conditions and precipitation probability at each OpenWeather forecast interval."/><div className="glass-card p-3 md:p-4"><Hourly hours={hours} currentTime={current.time}/></div></motion.section>

    <motion.section {...sectionMotion} className="mt-12"><SectionHeading eyebrow="PLAN AHEAD" title="5-day outlook" description="Daily ranges aggregated from OpenWeather’s five-day forecast in three-hour steps."/><div className="glass-card px-4 py-2 md:px-6"><Weekly days={daily.filter((day) => day.date >= localDate)}/></div></motion.section>

    <motion.section {...sectionMotion} className="mt-12" id="maps"><SectionHeading eyebrow="WEATHER MAP" title={`Explore ${place.name}`} description="Live atmospheric layers centered on your selected location. Pan and zoom to inspect nearby conditions."/><div className="map-feature-shell"><div className="map-feature-head"><div><p className="stage-map-label">LOCAL WEATHER LAYERS <span>/ {place.name.toUpperCase()}</span></p><p className="stage-map-subtitle">OpenWeather map data · Updated with your location</p></div><div className="stage-map-layers" role="group" aria-label="Weather map layer">{(["temperature", "precipitation", "wind", "clouds"] as MapLayer[]).map((item) => <button type="button" key={item} aria-pressed={layer === item} onClick={() => setLayer(item)}>{item === "temperature" ? "Temp" : item === "precipitation" ? "Rain" : item === "wind" ? "Wind" : "Cloud"}</button>)}</div></div><div className="map-feature-canvas"><WeatherMap place={place} layer={layer}/></div><div className="map-feature-foot"><span>OpenWeather {layer === "clouds" ? "cloud cover" : layer} overlay</span><span>Drag to explore <i>·</i> Use + / − to zoom</span></div></div></motion.section>

    <motion.section {...sectionMotion} className="mt-12" id="analytics"><SectionHeading eyebrow="WEATHER INTELLIGENCE" title="Forecast analytics" description="Trends calculated from the same OpenWeather forecast data."/><div className="glass-card p-4 md:p-6"><Analytics hours={hours} days={daily.filter((day) => day.date >= localDate)} intervalHours={snapshot.hourlyIntervalHours}/></div></motion.section>

    <div className="dashboard-bottom-grid mt-12 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]"><motion.section {...sectionMotion} className="min-w-0" id="assistant"><SectionHeading eyebrow="ASK WEATHER SENSE" title="Your forecast, explained" description="A useful answer grounded in conditions loaded for this location."/><div className="glass-card p-5 md:p-6"><AssistantPanel/></div></motion.section><motion.section {...sectionMotion} className="min-w-0" id="alerts"><SectionHeading eyebrow="LOCAL CONDITIONS" title="Weather notices" description="Threshold based context for the forecast ahead."/><AlertsPanel/></motion.section></div>
    <p className="mt-10 text-center text-[11px] text-ws-muted">Forecast source: OpenWeather <span className="mx-1.5 opacity-40">·</span> Local timezone: {place.timezone ?? "automatic"} <span className="mx-1.5 opacity-40">·</span> Data requested when this location loads</p>
  </main><Footer/></>;
}

export function Dashboard() {
  return <DashboardBody/>;
}
