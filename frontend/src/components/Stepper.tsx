"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface Step {
  id: number;
  label: string;
}

export interface StepperProps {
  steps: Step[];
  current: number;
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol
      className={cn(
        "flex items-start justify-between gap-2 mb-8 overflow-x-auto pb-2",
        className
      )}
    >
      {steps.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <li
            key={step.id}
            className={cn(
              "flex items-start gap-2 min-w-0 flex-shrink-0",
              i < steps.length - 1 ? "flex-1" : ""
            )}
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors",
                  done
                    ? "bg-verified-green border-verified-green text-white"
                    : active
                    ? "bg-teal-main border-teal-main text-white"
                    : "bg-white border-slate-200 text-slate-muted"
                )}
              >
                {done ? <Check className="w-4 h-4" /> : step.id + 1}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "text-sm font-medium whitespace-nowrap",
                  active ? "text-teal-main" : done ? "text-deep-navy" : "text-slate-muted"
                )}
              >
                {step.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="hidden sm:block pt-4 flex-shrink-0 w-8">
                <div
                  className={cn(
                    "h-0.5 w-8 rounded",
                    done ? "bg-verified-green" : "bg-slate-200"
                  )}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
