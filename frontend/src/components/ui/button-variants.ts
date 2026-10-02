import { cn } from "@/lib/utils";

export type ButtonVariant =
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "subtle"
    | "destructive"
    | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all outline-none select-none " +
    "focus-visible:ring-4 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-55 " +
    "[&_svg]:pointer-events-none [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
    primary:
        "bg-primary text-primary-foreground shadow-[var(--shadow-card)] hover:brightness-110 active:brightness-95",
    secondary:
        "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
    outline:
        "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent/40",
    ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
    subtle: "bg-accent text-accent-foreground hover:brightness-97",
    destructive:
        "bg-destructive text-destructive-foreground hover:brightness-110",
    link: "text-primary underline-offset-4 hover:underline px-0",
};

const sizes: Record<ButtonSize, string> = {
    sm: "h-9 px-3 text-[0.8125rem] [&_svg]:size-4",
    md: "h-11 px-4.5 [&_svg]:size-4",
    lg: "h-12 px-6 text-[0.9375rem] [&_svg]:size-[1.125rem]",
    icon: "size-11 [&_svg]:size-[1.125rem]",
    "icon-sm": "size-9 [&_svg]:size-4",
};

export function buttonClass(
    variant: ButtonVariant = "primary",
    size: ButtonSize = "md",
    className?: string,
) {
    return cn(base, variants[variant], sizes[size], className);
}
