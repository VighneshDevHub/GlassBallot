"use client";

import { toast as sonnerToast } from "sonner";

type ToastKind = "success" | "error" | "info" | "warning";

export function useToast() {
  const toast = (kind: ToastKind, message: string, description?: string) => {
    switch (kind) {
      case "success":
        sonnerToast.success(message, { description });
        break;
      case "error":
        sonnerToast.error(message, { description });
        break;
      case "warning":
        sonnerToast.warning(message, { description });
        break;
      default:
        sonnerToast.info(message, { description });
    }
  };

  return {
    success: (msg: string, desc?: string) => toast("success", msg, desc),
    error: (msg: string, desc?: string) => toast("error", msg, desc),
    info: (msg: string, desc?: string) => toast("info", msg, desc),
    warning: (msg: string, desc?: string) => toast("warning", msg, desc),
    dismiss: () => sonnerToast.dismiss(),
  };
}
