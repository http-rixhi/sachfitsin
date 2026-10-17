import type { ReactNode } from "react";

interface LegalPageProps {
    title: string;
    updated: string;
    intro: string;
    children: ReactNode;
}

/** Shared frame for the Privacy Policy and Terms pages. */
export function LegalPage({
    title,
    updated,
    intro,
    children,
}: LegalPageProps) {
    return (
        <div className="app-container py-12 sm:py-16">
            <div className="mx-auto max-w-3xl">
                <header className="border-b border-border pb-8">
                    <h1 className="text-3xl sm:text-4xl">{title}</h1>

                    <p className="mt-3 text-sm text-muted-foreground">
                        Last updated: {updated}
                    </p>

                    <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                        {intro}
                    </p>
                </header>

                <div className="mt-10 space-y-10">{children}</div>
            </div>
        </div>
    );
}

export function Section({
    heading,
    children,
}: {
    heading: string;
    children: ReactNode;
}) {
    return (
        <section>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {heading}
            </h2>

            <div className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
                {children}
            </div>
        </section>
    );
}

export function List({ items }: { items: ReactNode[] }) {
    return (
        <ul className="ml-5 list-disc space-y-2">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    );
}

/**
 * Something the owner still has to fill in, shown clearly rather than
 * hidden. A blank in a legal page is worse than a visible marker.
 */
export function Fill({ children }: { children: ReactNode }) {
    return (
        <mark className="rounded bg-warning/20 px-1.5 py-0.5 font-medium text-foreground">
            {children}
        </mark>
    );
}
