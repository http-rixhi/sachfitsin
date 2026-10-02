import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The inline red box above a form.
 *
 * Renders nothing when there is no message, so a page can drop it in
 * without wrapping it in a conditional.
 */
export function FormError({
    message,
    className,
}: {
    message?: string | null;
    className?: string;
}) {
    if (!message) {
        return null;
    }

    return (
        <div
            role="alert"
            className={cn(
                "flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/8 p-3.5",
                className,
            )}
        >
            <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-destructive" />

            <p className="text-sm text-destructive">{message}</p>
        </div>
    );
}
