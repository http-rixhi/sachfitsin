import { cn } from "@/lib/utils";

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
                className,
            )}
        >
            <div className="min-w-0">
                {eyebrow && (
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                        {eyebrow}
                    </p>
                )}

                <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                    {title}
                </h1>

                {description && (
                    <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-[0.9375rem]">
                        {description}
                    </p>
                )}
            </div>

            {actions && (
                <div className="flex flex-wrap items-center gap-3">
                    {actions}
                </div>
            )}
        </div>
    );
}

interface StatCardProps {
    icon?: React.ReactNode;
    label: string;
    value: React.ReactNode;
    sub?: React.ReactNode;
    tone?: "primary" | "info" | "warning" | "success" | "neutral";
    className?: string;
}

const toneStyles = {
    primary: "bg-accent text-accent-foreground",
    info: "bg-info/12 text-info",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/12 text-success",
    neutral: "bg-secondary text-secondary-foreground",
};

export function StatCard({
    icon,
    label,
    value,
    sub,
    tone = "primary",
    className,
}: StatCardProps) {
    return (
        <div
            className={cn(
                "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-lift)]",
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                    {label}
                </p>

                {icon && (
                    <span
                        className={cn(
                            "flex size-9 items-center justify-center rounded-xl [&_svg]:size-[1.125rem]",
                            toneStyles[tone],
                        )}
                    >
                        {icon}
                    </span>
                )}
            </div>

            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {value}
            </p>

            {sub && (
                <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
            )}
        </div>
    );
}
