"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-950 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-brand-500 text-white shadow hover:bg-brand-600 active:bg-brand-700",
        secondary:   "bg-surface-700 text-white hover:bg-surface-600 border border-surface-500",
        outline:     "border border-surface-500 bg-transparent text-slate-300 hover:bg-surface-700 hover:text-white",
        ghost:       "text-slate-400 hover:bg-surface-700 hover:text-white",
        destructive: "bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600 hover:text-white",
        success:     "bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600 hover:text-white",
        link:        "text-brand-500 underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded px-3 text-xs",
        lg:      "h-10 rounded-md px-6 text-base",
        icon:    "h-9 w-9",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
