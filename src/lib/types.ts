export type WeatherKind = "sunny" | "cloudy" | "rainy" | "stormy" | "snowy";

export type Place = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export type CurrentWeather = {
  time: string;
  temperature: number;
  apparentTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  pressure: number | null;
  visibility: number | null;
  precipitation: number | null;
  cloudCover: number | null;
  weatherCode: number;
  isDay: boolean;
};

export type HourlyPoint = {
  time: string;
  temperature: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
  windSpeed: number | null;
  humidity: number | null;
  uvIndex: number | null;
  precipitation: number | null;
};

export type DailyPoint = {
  date: string;
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  sunrise: string | null;
  sunset: string | null;
  precipitationProbability: number | null;
  uvIndexMax: number | null;
  humidity: number | null;
  precipitationSum: number | null;
  windSpeedMax: number | null;
};

export type WeatherSnapshot = {
  place: Place;
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  fetchedAt: string;
  hourlyIntervalHours: number;
  source: "openweathermap";
};

export type AlertSeverity = "info" | "moderate" | "high" | "severe";

export type WeatherAlert = {
  id: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
  source: "weathersense-threshold";
};

export type MapLayer = "temperature" | "precipitation" | "wind" | "clouds";

export type ThemeMode = "dark" | "light";
export type MotionPreference = "system" | "full" | "reduce";
