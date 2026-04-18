import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:     "border-slate-200 bg-slate-100 text-slate-600",
        pending:     "border-yellow-200 bg-yellow-50 text-yellow-700",
        confirmed:   "border-blue-200 bg-blue-50 text-blue-700",
        preparing:   "border-orange-200 bg-orange-50 text-orange-700",
        ready:       "border-purple-200 bg-purple-50 text-purple-700",
        delivering:  "border-sky-200 bg-sky-50 text-sky-700",
        delivered:   "border-green-200 bg-green-50 text-green-700",
        cancelled:   "border-red-200 bg-red-50 text-red-700",
        success:     "border-green-200 bg-green-50 text-green-700",
        destructive: "border-red-200 bg-red-50 text-red-700",
        warning:     "border-yellow-200 bg-yellow-50 text-yellow-700",
        info:        "border-blue-200 bg-blue-50 text-blue-700",
        brand:       "border-brand-200 bg-brand-50 text-brand-700",
        outline:     "border-slate-200 bg-transparent text-slate-600",
        collect:     "border-teal-200 bg-teal-50 text-teal-700",
        delivery:    "border-indigo-200 bg-indigo-50 text-indigo-700",
        online:      "border-cyan-200 bg-cyan-50 text-cyan-700",
        inperson:    "border-violet-200 bg-violet-50 text-violet-700",
        settled:     "border-green-200 bg-green-50 text-green-700",
        unsettled:   "border-amber-200 bg-amber-50 text-amber-700",
        approved:    "border-green-200 bg-green-50 text-green-700",
        rejected:    "border-red-200 bg-red-50 text-red-700",
        suspended:   "border-gray-200 bg-gray-50 text-gray-600",
        active:      "border-green-200 bg-green-50 text-green-700",
        inactive:    "border-gray-200 bg-gray-50 text-gray-600",
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
