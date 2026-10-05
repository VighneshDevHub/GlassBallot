"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "checked"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  defaultChecked?: boolean;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      className,
      checked,
      onCheckedChange,
      defaultChecked = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const [internal, setInternal] = React.useState<boolean>(
      checked ?? defaultChecked ?? false
    );

    React.useEffect(() => {
      if (checked !== undefined) setInternal(checked);
    }, [checked]);

    const isOn = checked !== undefined ? checked : internal;

    const handleClick = () => {
      if (disabled) return;
      const next = !isOn;
      if (checked === undefined) setInternal(next);
      onCheckedChange?.(next);
    };

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={isOn}
        type="button"
        disabled={disabled}
        onClick={handleClick}
        data-state={isOn ? "checked" : "unchecked"}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DAF39F] focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isOn
            ? "bg-[#202124]"
            : "bg-[#CDD2D8] data-[state=unchecked]:bg-[#CDD2D8] hover:bg-[#BFC6CE]",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-card ring-0 transition-transform",
            isOn ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
