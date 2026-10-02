import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    CalendarClock,
    CheckCircle2,
    Infinity as InfinityIcon,
    PackageOpen,
} from "lucide-react";

import { BuyProductButton } from "@/components/BuyProductButton";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ApiErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, EmptyState } from "@/components/ui/states";
import { getProducts, type Product } from "@/services/products";
import {
    getMyEntitlements,
    type Entitlement,
} from "@/services/subscriptions";
import { useNow } from "@/lib/use-now";
import { cn, formatDate } from "@/lib/utils";

const NO_PRODUCTS: Product[] = [];
const NO_ENTITLEMENTS: Entitlement[] = [];

function priceLabel(product: Product) {
    const amount = Number(product.price);

    if (product.billing_type === "FREE" || amount === 0) {
        return "Free";
    }

    const formatted = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);

    return product.billing_type === "MONTHLY"
        ? `${formatted}/month`
        : formatted;
}

export default function Plans() {
    // Date.now() during render is impure; useNow reads a clock through
    // useSyncExternalStore so the value is stable within each tick.
    const now = useNow();

    const [productsQuery, entitlementsQuery] = useQueries({
        queries: [
            {
                queryKey: ["products"],
                queryFn: () => getProducts(),
            },
            {
                queryKey: ["my-entitlements"],
                queryFn: getMyEntitlements,
            },
        ],
    });

    const products = productsQuery.data ?? NO_PRODUCTS;
    const entitlements = entitlementsQuery.data ?? NO_ENTITLEMENTS;

    /** Product code -> the active entitlement for it, if any. */
    const owned = useMemo(() => {
        const map = new Map<string, Entitlement>();

        entitlements.forEach((entitlement) => {
            const isLive =
                entitlement.status === "ACTIVE" &&
                (!entitlement.expires_at ||
                    new Date(entitlement.expires_at).getTime() > now);

            if (isLive) {
                map.set(entitlement.product_code, entitlement);
            }
        });

        return map;
    }, [entitlements, now]);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Plans"
                title="Plans & Pricing"
                description="Everything your dietician offers. Buy what you need, when you need it."
            />

            {productsQuery.isLoading && <CardSkeleton count={3} />}

            {productsQuery.isError && (
                <ApiErrorState
                    error={productsQuery.error}
                    title="Unable to load the plans"
                    onRetry={() => productsQuery.refetch()}
                    isRetrying={productsQuery.isFetching}
                />
            )}

            {!productsQuery.isLoading &&
                !productsQuery.isError &&
                products.length === 0 && (
                    <EmptyState
                        icon={<PackageOpen />}
                        title="No plans available yet"
                        description="Your dietician has not published any plans. Please check back soon."
                    />
                )}

            {products.length > 0 && (
                <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                    {products.map((product) => {
                        const entitlement = owned.get(product.code);

                        // A free plan is open to every customer, so there
                        // is no entitlement row for it. See
                        // subscriptions.services.has_entitlement.
                        const isFree = product.billing_type === "FREE";

                        const isOwned = Boolean(entitlement) || isFree;

                        return (
                            <Card
                                key={product.id}
                                className={cn(
                                    "flex flex-col transition",
                                    isOwned
                                        ? "border-success/35 bg-success/5"
                                        : "hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
                                )}
                            >
                                <CardBody className="flex flex-1 flex-col">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="text-lg font-semibold leading-snug">
                                            {product.name}
                                        </h3>

                                        {isOwned ? (
                                            <Badge tone="success">
                                                <CheckCircle2 className="size-3.5" />
                                                {isFree && !entitlement
                                                    ? "Free"
                                                    : "Active"}
                                            </Badge>
                                        ) : (
                                            <Badge
                                                tone={
                                                    product.billing_type ===
                                                    "MONTHLY"
                                                        ? "primary"
                                                        : "neutral"
                                                }
                                            >
                                                {product.billing_type ===
                                                "MONTHLY"
                                                    ? "Monthly"
                                                    : product.billing_type ===
                                                        "FREE"
                                                      ? "Free"
                                                      : "One time"}
                                            </Badge>
                                        )}
                                    </div>

                                    <p className="mt-3 text-3xl font-semibold tracking-tight">
                                        {priceLabel(product)}
                                    </p>

                                    {product.description && (
                                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                                            {product.description}
                                        </p>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {product.duration_days ? (
                                            <Badge>
                                                <CalendarClock className="size-3.5" />
                                                {product.duration_days} days
                                                of access
                                            </Badge>
                                        ) : (
                                            <Badge>
                                                <InfinityIcon className="size-3.5" />
                                                No expiry
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="mt-auto pt-5">
                                        {isOwned ? (
                                            <div className="rounded-xl border border-success/25 bg-success/10 p-3.5 text-sm">
                                                <p className="font-medium text-success">
                                                    {isFree && !entitlement
                                                        ? "Included with your account."
                                                        : "You already have this."}
                                                </p>

                                                <p className="mt-1 text-muted-foreground">
                                                    {isFree && !entitlement
                                                        ? "Free for every customer."
                                                        : entitlement?.expires_at
                                                          ? `Active until ${formatDate(
                                                                entitlement.expires_at,
                                                            )}.`
                                                          : "Active, with no expiry."}
                                                </p>
                                            </div>
                                        ) : (
                                            <BuyProductButton
                                                code={product.code}
                                                compact
                                            />
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}

            <p className="text-sm text-muted-foreground">
                Every payment is handled by Razorpay. Your card details
                never reach Sachfitsin.{" "}
                <Link
                    to="/dashboard/payments"
                    className="font-medium text-primary hover:underline"
                >
                    See your payment history
                </Link>
                .
            </p>
        </div>
    );
}
