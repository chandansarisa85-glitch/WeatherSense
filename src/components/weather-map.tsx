"use client";

import { CircleMarker, MapContainer, Pane, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, MapPin } from "lucide-react";
import type { MapLayer, Place } from "@/lib/types";
import { useWeather } from "@/context/weather-provider";

const OPENWEATHER_LAYERS: Record<MapLayer, string> = {
  temperature: "temp_new",
  precipitation: "precipitation_new",
  wind: "wind_new",
  clouds: "clouds_new",
};
const WEATHER_MAP_ZOOM = 6;

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, WEATHER_MAP_ZOOM, { duration: 0.8 }); }, [center, map]);
  return null;
}

export function WeatherMap({ place, layer }: { place: Place; layer: MapLayer }) {
  const { theme } = useWeather();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const center = useMemo<[number, number]>(() => [place.latitude, place.longitude], [place.latitude, place.longitude]);

  return <div className="weather-map-frame relative overflow-hidden rounded-[20px]">
    <MapContainer center={center} zoom={WEATHER_MAP_ZOOM} scrollWheelZoom={false} zoomControl className="weather-leaflet" aria-label={`Weather map centered on ${place.name}`}>
      <Recenter center={center}/>
      <Pane name="weather-base-pane" style={{ zIndex: 200, filter: theme === "dark" ? "invert(1) hue-rotate(180deg) brightness(.58) contrast(1.06) saturate(.48) grayscale(.32)" : "none" }}>
        <TileLayer pane="weather-base-pane" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"/>
      </Pane>
      <Pane name="weather-overlay-pane" style={{ zIndex: 250 }}>
        <TileLayer
          key={layer}
          pane="weather-overlay-pane"
          attribution='&copy; <a href="https://openweathermap.org/">OpenWeather</a>'
          url={`/api/weather/map/${OPENWEATHER_LAYERS[layer]}/{z}/{x}/{y}`}
          opacity={layer === "clouds" ? 0.42 : 0.68}
          eventHandlers={{
            loading: () => { setBusy(true); setError(false); },
            load: () => setBusy(false),
            tileerror: () => { setBusy(false); setError(true); },
          }}
        />
      </Pane>
      <CircleMarker center={center} radius={7} pathOptions={{ color: "#fff", fillColor: "#38D9FF", fillOpacity: 1, weight: 3 }}>
        <Tooltip permanent direction="top" offset={[0, -8]}>{place.name}</Tooltip>
      </CircleMarker>
    </MapContainer>
    <div className="map-legend"><div className="flex items-center gap-2 text-xs font-medium text-ws-text"><MapPin size={13} className="text-[#38D9FF]"/>OpenWeather {layer === "clouds" ? "cloud cover" : layer} overlay</div></div>
    {busy && <div className="absolute top-3 right-3 z-[500] flex items-center gap-2 rounded-full border border-white/10 bg-[#07111F]/85 px-3 py-2 text-[11px] text-ws-muted backdrop-blur"><LoaderCircle size={13} className="animate-spin"/>Loading weather layer</div>}
    {error && <div role="status" className="absolute right-3 bottom-3 left-3 z-[500] rounded-xl border border-[#F09A4A]/25 bg-[#07111F]/90 px-3 py-2 text-xs text-ws-muted">OpenWeather layer unavailable. Check API access; the base map remains available.</div>}
  </div>;
}
