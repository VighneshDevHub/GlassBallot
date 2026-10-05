import * as React from "react";
import { cn } from "@/lib/utils";

type ToastKind = "default" | "success" | "error" | "info" | "warning";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  kind?: ToastKind;
  title?: string;
  description?: string;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, kind = "default", title, description, children, ...props }, ref) => {
    const colors: Record<ToastKind, string> = {
      default: "bg-white border-slate-200",
      success: "bg-verified-green text-white border-verified-green",
      error: "bg-failure-red text-white border-failure-red",
      info: "bg-blue-accent text-white border-blue-accent",
      warning: "bg-yellow-500 text-white border-yellow-500",
    };
    return (
      <div
        ref={ref}
        className={cn(
          "pointer-events-auto relative flex w-full items-start space-x-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all",
          colors[kind],
          className
        )}
        {...props}
      >
        <div className="flex-1">
          {title && <div className="text-sm font-semibold">{title}</div>}
          {description && <div className="text-sm opacity-90 mt-0.5">{description}</div>}
          {children}
        </div>
      </div>
    );
  }
);
Toast.displayName = "Toast";

export { Toast };
