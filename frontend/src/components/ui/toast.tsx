import {
    useCallback,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import {
    ToastContext,
    type ToastTone,
} from "@/components/ui/toast-context";
import { cn } from "@/lib/utils";

interface ToastItem {
    id: number;
    message: string;
    tone: ToastTone;
}

const icons = {
    info: Info,
    success: CheckCircle2,
    warning: TriangleAlert,
};

const tones: Record<ToastTone, string> = {
    info: "border-info/25 bg-card text-foreground [&_svg]:text-info",
    success: "border-success/25 bg-card text-foreground [&_svg]:text-success",
    warning:
        "border-warning/35 bg-card text-foreground [&_svg]:text-warning",
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((current) => current.filter((item) => item.id !== id));
    }, []);

    const notify = useCallback(
        (message: string, tone: ToastTone = "info") => {
            const id = Date.now() + Math.random();

            setToasts((current) => [...current, { id, message, tone }]);

            window.setTimeout(() => dismiss(id), 4000);
        },
        [dismiss],
    );

    const value = useMemo(() => ({ notify }), [notify]);

    return (
        <ToastContext.Provider value={value}>
            {children}

            {createPortal(
                <div className="pointer-events-none fixed inset-x-0 top-4 z-200 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:items-end">
                    {toasts.map((toast) => {
                        const Icon = icons[toast.tone];

                        return (
                            <div
                                key={toast.id}
                                role="status"
                                className={cn(
                                    "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-[var(--shadow-lift)] animate-in slide-in-from-top-2 fade-in",
                                    tones[toast.tone],
                                )}
                            >
                                <Icon className="mt-0.5 size-5 shrink-0" />

                                <p className="flex-1 text-sm font-medium">
                                    {toast.message}
                                </p>

                                <button
                                    type="button"
                                    onClick={() => dismiss(toast.id)}
                                    aria-label="Dismiss"
                                    className="rounded-md p-0.5 text-muted-foreground transition hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>,
                document.body,
            )}
        </ToastContext.Provider>
    );
}
