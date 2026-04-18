"use client";
import { useEffect } from "react";
import { X, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const icons: Record<ToastVariant, React.ReactNode> = {
  success:     <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />,
  destructive: <XCircle className="h-5 w-5 text-red-400 shrink-0" />,
  warning:     <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />,
  info:        <Info className="h-5 w-5 text-blue-400 shrink-0" />,
  default:     <Info className="h-5 w-5 text-slate-400 shrink-0" />,
};

const borders: Record<ToastVariant, string> = {
  success:     "border-green-500/30 bg-green-500/10",
  destructive: "border-red-500/30 bg-red-500/10",
  warning:     "border-yellow-500/30 bg-yellow-500/10",
  info:        "border-blue-500/30 bg-blue-500/10",
  default:     "border-slate-200 bg-white",
};

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => {
        const variant = t.variant ?? "default";
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl",
              "animate-fade-in",
              borders[variant]
            )}
          >
            {icons[variant]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-slate-400">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
