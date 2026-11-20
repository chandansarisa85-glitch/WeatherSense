import { Cloud, CloudFog, CloudLightning, CloudRain, Moon, Snowflake, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WeatherKind } from "@/lib/types";

const tones: Record<WeatherKind, string> = {
  sunny: "text-[#FFCB70]",
  cloudy: "text-[#A6B8CC]",
  rainy: "text-[#49B8FF]",
  stormy: "text-[#B49AFF]",
  snowy: "text-[#D8F0FF]",
};

export function WeatherIcon({
  kind,
  isDay = true,
  className,
}: {
  kind: WeatherKind;
  isDay?: boolean;
  className?: string;
}) {
  const classes = cn("h-6 w-6", tones[kind], className);
  if (kind === "sunny") return isDay ? <Sun className={classes} /> : <Moon className={cn(classes, "text-[#D8F0FF]")} />;
  if (kind === "rainy") return <CloudRain className={classes} />;
  if (kind === "stormy") return <CloudLightning className={classes} />;
  if (kind === "snowy") return <Snowflake className={classes} />;
  if (!isDay && kind === "cloudy") return <CloudFog className={classes} />;
  return <Cloud className={classes} />;
}
