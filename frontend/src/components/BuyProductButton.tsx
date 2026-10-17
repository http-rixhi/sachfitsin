import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Loader2,
    Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    useRazorpayCheckout,
    type PaymentStage,
} from "@/hooks/useRazorpayCheckout";
import {
    cheapest,
    formatPrice,
    getProducts,
    type Feature,
    type Product,
} from "@/services/products";
import { cn } from "@/lib/utils";

const NO_PRODUCTS: Product[] = [];

const stageStyles: Partial<
    Record<PaymentStage, { className: string; icon: typeof Sparkles }>
> = {
    success: {
        className: "border-success/30 bg-success/10 text-success",
        icon: CheckCircle2,
    },
    pending: {
        className: "border-warning/35 bg-warning/10 text-foreground",
        icon: Clock3,
    },
    cancelled: {
        className: "border-border bg-surface text-muted-foreground",
        icon: AlertTriangle,
    },
    error: {
        className: "border-destructive/25 bg-destructive/8 text-destructive",
        icon: AlertTriangle,
    },
};

/**
 * Price plus a Buy button for one plan.
 *
 * Name either a plan `code`, or the `feature` the customer is trying to
 * reach. With a feature the cheapest plan that unlocks it is offered,
 * which is what a paywall wants: the customer cares about getting in, not
 * about which package it came from.
 *
 * Codes rather than ids so nothing here hardcodes a database id that
 * differs between environments.
 */
interface BuyProductButtonProps {
    code?: string;
    feature?: Feature;
    /**
     * Hide the price and description when the surrounding card already
     * shows them, so they are not printed twice.
     */
    compact?: boolean;
}

export function BuyProductButton({
    code,
    feature,
    compact = false,
}: BuyProductButtonProps) {
    const queryClient = useQueryClient();

    const { startPayment, stage, message, isBusy } =
        useRazorpayCheckout();

    const productsQuery = useQuery({
        queryKey: ["products", code ?? null, feature ?? null],
        queryFn: () => getProducts({ code, feature }),
    });

    const products = productsQuery.data ?? NO_PRODUCTS;

    // With a feature there may be several plans, so offer the cheapest
    // way in. With a code there is only ever one.
    const product = feature ? cheapest(products) : products[0];

    if (productsQuery.isLoading) {
        return (
            <span className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading the plan...
            </span>
        );
    }

    // No product set up for this code yet. Fall back to the old wording
    // rather than showing a Buy button that cannot work.
    if (!product) {
        return (
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <Sparkles className="size-4" />
                Ask your dietician to unlock it
            </span>
        );
    }

    const feedback = stageStyles[stage];

    // A plan priced at zero cannot be bought: the backend refuses to
    // create a Razorpay order for nothing, so a Buy button here would
    // always fail. billing_type is not enough: a ONE_TIME plan left at
    // zero behaves the same way.
    if (Number(product.price) <= 0) {
        return (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                <Sparkles className="size-4" />
                Ask your dietician to enable it
            </span>
        );
    }

    return (
        <div
            className={cn(
                "flex w-full flex-col items-center gap-3",
                !compact && "mt-6",
            )}
        >
            {!compact && (
                <>
                    <p className="text-2xl font-semibold tracking-tight">
                        {formatPrice(product)}
                    </p>

                    {product.description && (
                        <p className="max-w-sm text-sm text-accent-foreground/80">
                            {product.description}
                        </p>
                    )}
                </>
            )}

            {stage !== "success" && (
                <Button
                    size="lg"
                    disabled={isBusy}
                    onClick={() =>
                        startPayment(product.id, {
                            onVerified: () => {
                                // Re-check what this customer can now
                                // reach. The paywall disappears by itself.
                                queryClient.invalidateQueries({
                                    queryKey: ["my-personalized-videos"],
                                });

                                queryClient.invalidateQueries({
                                    queryKey: ["my-entitlements"],
                                });

                                queryClient.invalidateQueries({
                                    queryKey: ["my-payments"],
                                });
                            },
                        })
                    }
                >
                    {isBusy ? (
                        <>
                            <Loader2 className="animate-spin" />
                            {stage === "verifying"
                                ? "Confirming payment..."
                                : "Opening checkout..."}
                        </>
                    ) : (
                        <>
                            <Sparkles />
                            {stage === "cancelled" || stage === "error"
                                ? "Try again"
                                : `Unlock ${product.name}`}
                        </>
                    )}
                </Button>
            )}

            {message && feedback && (
                <div
                    role="status"
                    className={cn(
                        "mt-1 flex w-full max-w-sm items-start gap-2.5 rounded-xl border p-3.5 text-left",
                        feedback.className,
                    )}
                >
                    <feedback.icon className="mt-0.5 size-4 shrink-0" />

                    <div className="text-sm">
                        <p>{message}</p>

                        {(stage === "pending" || stage === "success") && (
                            <Link
                                to="/dashboard/payments"
                                className="mt-1.5 inline-block font-medium underline"
                            >
                                View payment history
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {stage === "idle" && (
                <p className="text-xs text-accent-foreground/70">
                    Secure payment through Razorpay.
                </p>
            )}
        </div>
    );
}
