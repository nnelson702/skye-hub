import toast from "react-hot-toast";

/**
 * Toast utilities with consistent styling and correlation ID support
 */

export interface ToastOptions {
  correlationId?: string;
  duration?: number;
}

export function showSuccess(message: string, options?: ToastOptions) {
  const fullMessage = options?.correlationId
    ? `${message} (ID: ${options.correlationId.slice(0, 8)})`
    : message;

  toast.success(fullMessage, {
    duration: options?.duration ?? 4000,
    position: "top-right",
  });
}

export function showError(message: string, options?: ToastOptions) {
  const fullMessage = options?.correlationId
    ? `${message} (ID: ${options.correlationId.slice(0, 8)})`
    : message;

  toast.error(fullMessage, {
    duration: options?.duration ?? 6000,
    position: "top-right",
  });
}

export function showInfo(message: string, options?: ToastOptions) {
  toast(message, {
    duration: options?.duration ?? 3000,
    position: "top-right",
    icon: "ℹ️",
  });
}

/**
 * Generate a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}
