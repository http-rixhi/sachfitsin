import {
    AlertTriangle,
    Lock,
    RefreshCw,
    ShieldX,
    Sparkles,
    WifiOff,
} from "lucide-react";

import { BuyProductButton } from "@/components/BuyProductButton";
import type { Feature } from "@/services/products";
import { Button, ButtonLink } from "@/components/ui/button";
import {
    errorMessage,
    isEntitlementError,
    isPermissionError,
    isRetryable,
    toApiError,
} from "@/lib/api-error";
import { cn } from "@/lib/utils";

interface ApiErrorStateProps {
    error: unknown;
    onRetry?: () => void;
    isRetrying?: boolean;
    /** Shown instead of the backend message, when a page has better words. */
    title?: string;
    /**
     * The feature the customer was trying to reach. When the error turns
     * out to be "not in your plan", the cheapest plan that unlocks it is
     * offered. Ignored for every other kind of error.
     */
    upgradeFeature?: Feature;
    className?: string;
}

/**
 * The single error block every page uses.
 *
 * It reads the normalised error and picks the right shape by itself, so a
 * page does not have to check for "is this a permission problem" or "should
 * I offer a retry".
 */
export function ApiErrorState({
    error,
    onRetry,
    isRetrying = false,
    title,
    upgradeFeature,
    className,
}: ApiErrorStateProps) {
    const { isNetwork } = toApiError(error);

    if (isEntitlementError(error)) {
        return (
            <UpgradeRequired
                message={errorMessage(error)}
                feature={upgradeFeature}
                className={className}
            />
        );
    }

    if (isPermissionError(error)) {
        return (
            <AccessDenied
                message={errorMessage(error)}
                className={className}
            />
        );
    }

    const canRetry = Boolean(onRetry) && isRetryable(error);

    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-12 text-center",
                className,
            )}
        >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                {isNetwork ? (
                    <WifiOff className="size-5" />
                ) : (
                    <AlertTriangle className="size-5" />
                )}
            </span>

            <h3 className="mt-4 text-base font-semibold sm:text-lg">
                {title ?? (isNetwork ? "You appear to be offline" : "Something went wrong")}
            </h3>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {errorMessage(error)}
            </p>

            {canRetry && (
                <Button
                    variant="outline"
                    onClick={onRetry}
                    disabled={isRetrying}
                    className="mt-6"
                >
                    <RefreshCw
                        className={cn(isRetrying && "animate-spin")}
                    />
                    {isRetrying ? "Retrying..." : "Try again"}
                </Button>
            )}
        </div>
    );
}

export function AccessDenied({
    message = "You do not have permission to view this page.",
    className,
}: {
    message?: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-14 text-center",
                className,
            )}
        >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                <ShieldX className="size-5" />
            </span>

            <h3 className="mt-4 text-base font-semibold sm:text-lg">
                Access denied
            </h3>

            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {message}
            </p>

            <ButtonLink to="/" variant="outline" className="mt-6">
                Back to home
            </ButtonLink>
        </div>
    );
}

export function UpgradeRequired({
    message = "This feature is not included in your plan.",
    feature,
    className,
}: {
    message?: string;
    /**
     * When given, shows the price and a Buy button for the cheapest plan
     * that unlocks this feature.
     */
    feature?: Feature;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center rounded-2xl border border-primary/25 bg-accent px-6 py-14 text-center",
                className,
            )}
        >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Lock className="size-5" />
            </span>

            <h3 className="mt-4 text-base font-semibold text-accent-foreground sm:text-lg">
                Not in your plan yet
            </h3>

            <p className="mt-2 max-w-md text-sm text-accent-foreground/80">
                {message}
            </p>

            {feature ? (
                <BuyProductButton feature={feature} />
            ) : (
                <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Sparkles className="size-4" />
                    Ask your dietician to unlock it
                </p>
            )}
        </div>
    );
}
