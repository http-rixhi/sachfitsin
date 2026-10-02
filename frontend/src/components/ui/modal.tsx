import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    size?: "sm" | "md" | "lg";
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const sizes = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
};

export function Modal({
    open,
    onClose,
    title,
    description,
    size = "md",
    children,
    footer,
}: ModalProps) {
    useEffect(() => {
        if (!open) {
            return;
        }

        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        const previousOverflow = document.body.style.overflow;

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center">
            <div
                aria-hidden
                onClick={onClose}
                className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px] animate-in fade-in"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={cn(
                    "relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-border bg-card shadow-[var(--shadow-pop)]",
                    "rounded-t-3xl sm:rounded-3xl",
                    "animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:slide-in-from-bottom-0",
                    sizes[size],
                    "sm:mx-4",
                )}
            >
                <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6 sm:py-5">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold">{title}</h2>

                        {description && (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-1 rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                        <X className="size-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {children}
                </div>

                {footer && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-surface px-5 py-4 sm:px-6">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
