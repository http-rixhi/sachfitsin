import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    CheckCircle2,
    Clock3,
    CreditCard,
    ReceiptText,
    RefreshCw,
    XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ApiErrorState } from "@/components/ui/error-state";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import {
    getMyPayments,
    type Payment,
    type PaymentStatus,
} from "@/services/payments";
import { cn, formatDate } from "@/lib/utils";

const NO_PAYMENTS: Payment[] = [];

type Filter = "ALL" | PaymentStatus;

const filters: Array<{ id: Filter; label: string }> = [
    { id: "ALL", label: "All" },
    { id: "SUCCESS", label: "Successful" },
    { id: "FAILED", label: "Failed" },
    { id: "CREATED", label: "Not completed" },
];

/** Plain words. "CREATED" means nothing to a customer. */
const statusLabel: Record<PaymentStatus, string> = {
    CREATED: "Not completed",
    PENDING: "Being confirmed",
    SUCCESS: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded",
};

const statusTone: Record<
    PaymentStatus,
    "success" | "warning" | "danger" | "neutral" | "info"
> = {
    CREATED: "neutral",
    PENDING: "warning",
    SUCCESS: "success",
    FAILED: "danger",
    REFUNDED: "info",
};

const statusIcon = {
    CREATED: Clock3,
    PENDING: Clock3,
    SUCCESS: CheckCircle2,
    FAILED: XCircle,
    REFUNDED: ReceiptText,
};

function formatAmount(payment: Payment) {
    const amount = Number(payment.amount);

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: payment.currency || "INR",
            maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
        }).format(amount);
    } catch {
        return `${payment.currency} ${payment.amount}`;
    }
}

export default function Payments() {
    const [filter, setFilter] = useState<Filter>("ALL");

    const paymentsQuery = useQuery({
        queryKey: ["my-payments"],
        queryFn: () => getMyPayments(),
    });

    const payments = paymentsQuery.data?.data ?? NO_PAYMENTS;

    const totalPaid = useMemo(() => {
        return payments
            .filter((payment) => payment.status === "SUCCESS")
            .reduce((sum, payment) => sum + Number(payment.amount), 0);
    }, [payments]);

    const successCount = payments.filter(
        (payment) => payment.status === "SUCCESS",
    ).length;

    const filtered = useMemo(() => {
        if (filter === "ALL") {
            return payments;
        }

        return payments.filter((payment) => payment.status === filter);
    }, [payments, filter]);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Billing"
                title="Payment History"
                description="Everything you have paid for, and what happened to each payment."
                actions={
                    <Button
                        variant="outline"
                        onClick={() => paymentsQuery.refetch()}
                        disabled={paymentsQuery.isFetching}
                    >
                        <RefreshCw
                            className={cn(
                                paymentsQuery.isFetching && "animate-spin",
                            )}
                        />
                        Refresh
                    </Button>
                }
            />

            {payments.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <StatCard
                        icon={<CheckCircle2 />}
                        tone="success"
                        label="Successful payments"
                        value={successCount}
                    />

                    <StatCard
                        icon={<CreditCard />}
                        label="Total paid"
                        value={new Intl.NumberFormat("en-IN", {
                            style: "currency",
                            currency: "INR",
                            maximumFractionDigits:
                                totalPaid % 1 === 0 ? 0 : 2,
                        }).format(totalPaid)}
                    />
                </div>
            )}

            {payments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {filters.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setFilter(item.id)}
                            className={cn(
                                "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                                filter === item.id
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            {paymentsQuery.isLoading && (
                <LoadingBlock label="Loading your payments..." />
            )}

            {paymentsQuery.isError && (
                <ApiErrorState
                    error={paymentsQuery.error}
                    title="Unable to load your payment history"
                    onRetry={() => paymentsQuery.refetch()}
                    isRetrying={paymentsQuery.isFetching}
                />
            )}

            {!paymentsQuery.isLoading &&
                !paymentsQuery.isError &&
                filtered.length === 0 && (
                    <EmptyState
                        icon={<ReceiptText />}
                        title={
                            payments.length === 0
                                ? "No payments yet"
                                : "Nothing in this list"
                        }
                        description={
                            payments.length === 0
                                ? "Anything you buy will show up here with its receipt details."
                                : "Switch the filter to see your other payments."
                        }
                        action={
                            payments.length === 0 && (
                                <ButtonLink
                                    to="/dashboard/videos"
                                    variant="outline"
                                >
                                    See what is available
                                </ButtonLink>
                            )
                        }
                    />
                )}

            {filtered.length > 0 && (
                <div className="space-y-4">
                    {filtered.map((payment) => {
                        const Icon = statusIcon[payment.status];

                        return (
                            <Card key={payment.id}>
                                <CardBody className="space-y-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={cn(
                                                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                                                    payment.status ===
                                                        "SUCCESS"
                                                        ? "bg-success/12 text-success"
                                                        : payment.status ===
                                                            "FAILED"
                                                          ? "bg-destructive/10 text-destructive"
                                                          : "bg-secondary text-muted-foreground",
                                                )}
                                            >
                                                <Icon className="size-[1.125rem]" />
                                            </span>

                                            <div>
                                                <p className="font-medium">
                                                    {payment.product_name}
                                                </p>

                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(
                                                        payment.created_at,
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-semibold tabular-nums">
                                                {formatAmount(payment)}
                                            </span>

                                            <Badge
                                                tone={
                                                    statusTone[
                                                        payment.status
                                                    ]
                                                }
                                            >
                                                {statusLabel[payment.status]}
                                            </Badge>
                                        </div>
                                    </div>

                                    {payment.status === "FAILED" &&
                                        payment.failure_reason && (
                                            <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 text-sm text-destructive">
                                                {payment.failure_reason}
                                            </p>
                                        )}

                                    {payment.status === "CREATED" && (
                                        <p className="rounded-xl bg-surface p-3.5 text-sm text-muted-foreground">
                                            This payment was started but
                                            never completed. You have not
                                            been charged.
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                                        <span>
                                            Order {payment.razorpay_order_id}
                                        </span>

                                        {payment.razorpay_payment_id && (
                                            <span>
                                                Payment{" "}
                                                {payment.razorpay_payment_id}
                                            </span>
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
