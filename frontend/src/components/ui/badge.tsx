import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-deep-navy text-warm-white",
        success:
          "border-transparent bg-verified-green/15 text-verified-green",
        destructive:
          "border-transparent bg-failure-red/15 text-failure-red",
        warning:
          "border-transparent bg-yellow-500/15 text-yellow-700",
        info:
          "border-transparent bg-blue-accent/15 text-blue-accent",
        secondary:
          "border-transparent bg-slate-100 text-deep-navy",
        outline:
          "text-slate-muted border-slate-200",
        teal:
          "border-transparent bg-teal-main/15 text-teal-main",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
