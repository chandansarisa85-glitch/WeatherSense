"use client";

import { MotionConfig } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { fetchWeather, reversePlace, searchPlaces } from "@/lib/weather-service";
import type { MotionPreference, Place, ThemeMode, WeatherSnapshot } from "@/lib/types";

const PLACE_KEY = "weathersense.place";
const THEME_KEY = "weathersense.theme";
const MOTION_KEY = "weathersense.motion";

function readPreference(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writePreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Storage can be disabled by the browser. */ }
}

type Status = "idle" | "loading" | "ready" | "error";

type WeatherContextValue = {
  snapshot: WeatherSnapshot | null;
  status: Status;
  error: string | null;
  locationNotice: string | null;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  motion: MotionPreference;
  setMotion: (motion: MotionPreference) => void;
  reducedMotion: boolean;
  selectPlace: (place: Place) => void;
  requestLocation: () => void;
  refresh: () => void;
};

const WeatherContext = createContext<WeatherContextValue | null>(null);

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [motion, setMotionState] = useState<MotionPreference>("system");
  const systemReduced = useSystemReducedMotion();
  const requestId = useRef(0);
  const snapshotRef = useRef<WeatherSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const reducedMotion = motion === "reduce" || (motion === "system" && systemReduced);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedTheme = readPreference(THEME_KEY);
      if (storedTheme === "light" || storedTheme === "dark") setThemeState(storedTheme);
      const storedMotion = readPreference(MOTION_KEY);
      if (storedMotion === "system" || storedMotion === "full" || storedMotion === "reduce") {
        setMotionState(storedMotion);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.motion = reducedMotion ? "reduce" : "full";
    writePreference(THEME_KEY, theme);
  }, [theme, reducedMotion]);

  const load = useCallback(async (next: Place) => {
    const id = ++requestId.current;
    setPlace(next);
    setStatus("loading");
    setError(null);
    setSnapshot((current) => {
      if (!current) return null;
      const same =
        current.place.latitude.toFixed(2) === next.latitude.toFixed(2) &&
        current.place.longitude.toFixed(2) === next.longitude.toFixed(2);
      return same ? current : null;
    });
    try {
      const data = await fetchWeather(next);
      if (requestId.current !== id) return;
      setSnapshot(data);
      setStatus("ready");
      writePreference(PLACE_KEY, JSON.stringify(next));
    } catch (loadError) {
      if (requestId.current !== id) return;
      setStatus("error");
      setError(loadError instanceof Error ? loadError.message : "Unable to load weather");
    }
  }, []);

  useEffect(() => {
    const initialRequest = ++requestId.current;
    const saved = readPreference(PLACE_KEY);
    if (saved) {
      try {
        const stored = JSON.parse(saved) as Place;
        if (stored?.name && typeof stored.latitude === "number") {
          window.setTimeout(() => { if (requestId.current === initialRequest) void load(stored); }, 0);
          return;
        }
      } catch {
        try { localStorage.removeItem(PLACE_KEY); } catch { /* Ignore unavailable storage. */ }
      }
    }

    if (!navigator.geolocation) {
      void loadLondon("Location access is unavailable, so WeatherSense is showing London.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId.current !== initialRequest) return;
        void reversePlace(position.coords.latitude, position.coords.longitude)
          .then((next) => { if (requestId.current === initialRequest) void load(next); })
          .catch(() => { if (requestId.current === initialRequest) loadLondon("Your coordinates could not be resolved, so WeatherSense is showing London."); });
      },
      () => { if (requestId.current === initialRequest) loadLondon("Location access was not granted, so WeatherSense is showing London."); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );

    function loadLondon(notice: string) {
      if (requestId.current !== initialRequest) return;
      setLocationNotice(notice);
      void searchPlaces("London")
        .then((results) => {
          if (requestId.current !== initialRequest) return;
          const london =
            results.find((item) => item.name === "London" && item.country === "United Kingdom") ?? results[0];
          if (!london) throw new Error("No starting location was returned");
          return load(london);
        })
        .catch((loadError: unknown) => {
          if (requestId.current !== initialRequest) return;
          setStatus("error");
          setError(loadError instanceof Error ? loadError.message : "Unable to load a starting location");
        });
    }
  }, [load]);

  const selectPlace = useCallback(
    (next: Place) => {
      setLocationNotice(null);
      void load(next);
    },
    [load],
  );

  const requestLocation = useCallback(() => {
    const locationRequest = ++requestId.current;
    if (!navigator.geolocation) {
      setStatus(snapshotRef.current ? "ready" : "error");
      setError("This browser does not provide location access.");
      return;
    }
    setStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId.current !== locationRequest) return;
        void reversePlace(position.coords.latitude, position.coords.longitude)
          .then((next) => {
            if (requestId.current !== locationRequest) return;
            setLocationNotice(null);
            void load(next);
          })
          .catch((loadError: unknown) => {
            if (requestId.current !== locationRequest) return;
            setStatus(snapshotRef.current ? "ready" : "error");
            setError(loadError instanceof Error ? loadError.message : "Unable to resolve your location");
          });
      },
      () => {
        if (requestId.current !== locationRequest) return;
        setStatus(snapshotRef.current ? "ready" : "error");
        setError("Location permission was denied.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [load]);

  const refresh = useCallback(() => {
    if (place) {
      void load(place);
      return;
    }
    const retryId = ++requestId.current;
    setStatus("loading");
    setError(null);
    void searchPlaces("London")
      .then((results) => {
        if (requestId.current !== retryId) return;
        const london = results.find((item) => item.name === "London" && item.country === "United Kingdom") ?? results[0];
        if (!london) throw new Error("No starting location was returned");
        void load(london);
      })
      .catch((loadError: unknown) => {
        if (requestId.current !== retryId) return;
        setStatus("error");
        setError(loadError instanceof Error ? loadError.message : "Unable to load a starting location");
      });
  }, [load, place]);

  const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);
  const setMotion = useCallback((next: MotionPreference) => {
    setMotionState(next);
    writePreference(MOTION_KEY, next);
  }, []);

  const value = useMemo<WeatherContextValue>(
    () => ({
      snapshot,
      status,
      error,
      locationNotice,
      theme,
      setTheme,
      motion,
      setMotion,
      reducedMotion,
      selectPlace,
      requestLocation,
      refresh,
    }),
    [
      snapshot,
      status,
      error,
      locationNotice,
      theme,
      setTheme,
      motion,
      setMotion,
      reducedMotion,
      selectPlace,
      requestLocation,
      refresh,
    ],
  );

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
      <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>
    </MotionConfig>
  );
}

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error("useWeather must be used within WeatherProvider");
  return context;
}
