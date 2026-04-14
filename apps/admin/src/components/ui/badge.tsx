import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "border-slate-700 bg-slate-700/50 text-slate-300",
        pending:     "border-yellow-600/40 bg-yellow-500/10 text-yellow-400",
        confirmed:   "border-blue-600/40 bg-blue-500/10 text-blue-400",
        preparing:   "border-orange-600/40 bg-orange-500/10 text-orange-400",
        ready:       "border-purple-600/40 bg-purple-500/10 text-purple-400",
        delivering:  "border-sky-600/40 bg-sky-500/10 text-sky-400",
        delivered:   "border-green-600/40 bg-green-500/10 text-green-400",
        cancelled:   "border-red-600/40 bg-red-500/10 text-red-400",
        success:     "border-green-600/40 bg-green-500/10 text-green-400",
        destructive: "border-red-600/40 bg-red-500/10 text-red-400",
        warning:     "border-yellow-600/40 bg-yellow-500/10 text-yellow-400",
        info:        "border-blue-600/40 bg-blue-500/10 text-blue-400",
        brand:       "border-brand-600/40 bg-brand-500/10 text-brand-400",
        outline:     "border-surface-500 bg-transparent text-slate-400",
        collect:     "border-teal-600/40 bg-teal-500/10 text-teal-400",
        delivery:    "border-indigo-600/40 bg-indigo-500/10 text-indigo-400",
        online:      "border-cyan-600/40 bg-cyan-500/10 text-cyan-400",
        inperson:    "border-violet-600/40 bg-violet-500/10 text-violet-400",
        settled:     "border-green-600/40 bg-green-500/10 text-green-400",
        unsettled:   "border-amber-600/40 bg-amber-500/10 text-amber-400",
        approved:    "border-green-600/40 bg-green-500/10 text-green-400",
        rejected:    "border-red-600/40 bg-red-500/10 text-red-400",
        suspended:   "border-gray-600/40 bg-gray-500/10 text-gray-400",
        active:      "border-green-600/40 bg-green-500/10 text-green-400",
        inactive:    "border-gray-600/40 bg-gray-500/10 text-gray-400",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
