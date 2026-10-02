import { Compass } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="app-container flex min-h-[70dvh] flex-col items-center justify-center py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Compass className="size-7" />
            </span>

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-primary">
                Error 404
            </p>

            <h1 className="mt-2 text-3xl sm:text-4xl">
                This page does not exist
            </h1>

            <p className="mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
                The link may be old, or the page may have been moved.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ButtonLink to="/" size="lg">
                    Back to home
                </ButtonLink>

                <ButtonLink to="/content" size="lg" variant="outline">
                    Browse articles
                </ButtonLink>
            </div>
        </div>
    );
}
