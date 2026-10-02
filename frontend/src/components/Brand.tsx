import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export const BRAND_NAME = "Sachfitsin";
export const BRAND_TAGLINE = "Nutrition & Wellness";

export function BrandMark({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                "flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-card)]",
                className,
            )}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
                className="size-5"
            >
                <path
                    d="M20 4c0 8.5-4.2 13-9.2 13H8.4"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                />
                <path
                    d="M20 4C11 4 6.5 7.3 6.5 12.2c0 2.9 2 4.8 4.3 4.8"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M6 20c1.1-2 2.6-3.6 4.4-4.8"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                />
            </svg>
        </span>
    );
}

interface BrandProps {
    to?: string;
    className?: string;
    showTagline?: boolean;
}

export function Brand({
    to = "/",
    className,
    showTagline = true,
}: BrandProps) {
    return (
        <Link
            to={to}
            className={cn(
                "group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
                className,
            )}
        >
            <BrandMark />

            <span className="flex flex-col leading-none">
                <span className="text-[1.0625rem] font-semibold tracking-tight">
                    {BRAND_NAME}
                </span>

                {showTagline && (
                    <span className="mt-1 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {BRAND_TAGLINE}
                    </span>
                )}
            </span>
        </Link>
    );
}
