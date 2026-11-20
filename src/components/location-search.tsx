"use client";

import { LoaderCircle, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useWeather } from "@/context/weather-provider";
import { cn } from "@/lib/cn";
import { searchPlaces } from "@/lib/weather-service";
import type { Place } from "@/lib/types";

export function LocationSearch({ className }: { className?: string }) {
  const { selectPlace, requestLocation, snapshot } = useWeather();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const searchId = useRef(0);

  useEffect(() => {
    const id = ++searchId.current;
    const handle = window.setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([]);
        setBusy(false);
        setSearchError(null);
        return;
      }
      setBusy(true);
      void searchPlaces(query)
        .then((places) => {
          if (searchId.current !== id) return;
          setResults(places);
          setSearchError(places.length ? null : "No matching cities");
          setActive(0);
        })
        .catch(() => {
          if (searchId.current !== id) return;
          setResults([]);
          setSearchError("Location search is unavailable");
        })
        .finally(() => { if (searchId.current === id) setBusy(false); });
    }, 280);
    return () => { window.clearTimeout(handle); searchId.current += 1; };
  }, [query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  function choose(place: Place) {
    selectPlace(place);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={boxRef} className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ws-muted" />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((value) => Math.min(value + 1, Math.max(0, results.length - 1)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((value) => Math.max(value - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (results[active]) {
              choose(results[active]);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={snapshot ? snapshot.place.name : "Search a city"}
        aria-label="Search city"
        aria-expanded={open}
        aria-busy={busy}
        aria-controls={listId}
        aria-autocomplete="list"
        role="combobox"
        className="h-10 w-full rounded-full border border-[var(--ws-line)] bg-black/10 pr-10 pl-9 text-sm text-ws-text outline-none placeholder:text-ws-muted focus:border-[#38D9FF]"
      />
      {busy ? (
        <LoaderCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-ws-muted" />
      ) : null}
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-12 z-50 max-h-80 w-full min-w-[240px] overflow-auto rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-popup)] p-1.5 shadow-2xl"
        >
          {results.map((place, index) => (
            <li key={`${place.id}-${place.latitude}`}>
              <button
                type="button"
                role="option"
                aria-selected={active === index}
                className={cn(
                  "flex w-full flex-col rounded-xl px-3 py-2 text-left",
                  active === index ? "bg-[#38D9FF]/12" : "hover:bg-white/5",
                )}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(place)}
              >
                <span className="text-sm text-ws-text">{place.name}</span>
                <span className="text-xs text-ws-muted">{[place.admin1, place.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
          {searchError ? <li className="px-3 py-2 text-xs text-ws-muted">{searchError}</li> : null}
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ws-text hover:bg-white/5"
              onClick={() => {
                requestLocation();
                setOpen(false);
              }}
            >
              <MapPin className="h-4 w-4 text-[#38D9FF]" />
              Use my location
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
