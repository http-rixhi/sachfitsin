import { cn } from "@/lib/utils";

type Tone =
    | "neutral"
    | "primary"
    | "success"
    | "warning"
    | "info"
    | "danger";

const tones: Record<Tone, string> = {
    neutral: "bg-secondary text-secondary-foreground ring-border",
    primary: "bg-accent text-accent-foreground ring-primary/20",
    success: "bg-success/12 text-success ring-success/25",
    warning: "bg-warning/15 text-warning-foreground ring-warning/35",
    info: "bg-info/12 text-info ring-info/25",
    danger: "bg-destructive/10 text-destructive ring-destructive/20",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    tone?: Tone;
}

export function Badge({
    className,
    tone = "neutral",
    ...props
}: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                tones[tone],
                className,
            )}
            {...props}
        />
    );
}

const statusTone: Record<string, Tone> = {
    ACTIVE: "success",
    CONFIRMED: "success",
    COMPLETED: "info",
    PENDING: "warning",
    CANCELLED: "danger",
    INACTIVE: "neutral",
    BEGINNER: "success",
    INTERMEDIATE: "warning",
    ADVANCED: "danger",
};

export function StatusBadge({
    value,
    className,
}: {
    value: string;
    className?: string;
}) {
    const tone = statusTone[value?.toUpperCase()] ?? "neutral";

    return (
        <Badge tone={tone} className={className}>
            <span className="size-1.5 rounded-full bg-current" />
            {value?.charAt(0) + value?.slice(1).toLowerCase()}
        </Badge>
    );
}
