import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-surface-500 border-t-brand-500",
        size === "sm" && "h-4 w-4",
        size === "md" && "h-6 w-6",
        size === "lg" && "h-8 w-8",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
