import { AlertTriangle, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
    return (
        <Loader2 className={cn("size-5 animate-spin text-primary", className)} />
    );
}

export function LoadingBlock({
    label = "Loading...",
    className,
}: {
    label?: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 p-8",
                className,
            )}
        >
            <Spinner />

            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-lg bg-secondary",
                className,
            )}
        />
    );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
    return (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                    <Skeleton className="h-44 rounded-none" />

                    <div className="space-y-3 p-5">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center",
                className,
            )}
        >
            {icon && (
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground [&_svg]:size-6">
                    {icon}
                </div>
            )}

            <h3 className="text-base font-semibold sm:text-lg">{title}</h3>

            {description && (
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {description}
                </p>
            )}

            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}

export function ErrorState({
    title = "Something went wrong",
    description = "Please refresh the page and try again.",
    className,
}: {
    title?: string;
    description?: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex items-start gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-5",
                className,
            )}
        >
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />

            <div>
                <h3 className="text-sm font-semibold text-destructive">
                    {title}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}
