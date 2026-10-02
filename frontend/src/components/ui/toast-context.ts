import { createContext, useContext } from "react";

export type ToastTone = "info" | "success" | "warning";

export interface ToastContextValue {
    notify: (message: string, tone?: ToastTone) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(
    undefined,
);

const noop: ToastContextValue = { notify: () => undefined };

export function useToast() {
    return useContext(ToastContext) ?? noop;
}
