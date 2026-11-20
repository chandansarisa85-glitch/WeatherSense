import { cn } from "@/lib/cn";

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

