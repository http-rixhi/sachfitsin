import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    ArrowUpRight,
    CalendarCheck,
    CalendarDays,
    CalendarX,
    CheckCircle2,
    Clock,
    ExternalLink,
    RefreshCw,
    Search,
    UserRound,
    Video,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ApiErrorState } from "@/components/ui/error-state";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/field";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import {
    cancelAppointment,
    getDieticianAppointments,
    updateAppointmentStatus,
    type Appointment,
} from "@/services/appointments";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const NO_APPOINTMENTS: Appointment[] = [];

type Filter = "ALL" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

const filters: Array<{ id: Filter; label: string }> = [
    { id: "ALL", label: "All" },
    { id: "PENDING", label: "Pending" },
    { id: "CONFIRMED", label: "Confirmed" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
];

function formatSlot(value: string | null) {
    if (!value) {
        return "Time not picked yet";
    }

    return new Date(value).toLocaleString(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function Appointments() {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("ALL");

    const [cancelling, setCancelling] = useState<Appointment | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelError, setCancelError] = useState("");

    const appointmentsQuery = useQuery({
        queryKey: ["admin", "appointments"],
        queryFn: getDieticianAppointments,
    });

    const appointments = appointmentsQuery.data ?? NO_APPOINTMENTS;

    const statusMutation = useMutation({
        mutationFn: ({
            id,
            status,
        }: {
            id: number;
            status: Appointment["status"];
        }) => updateAppointmentStatus(id, status),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["admin", "appointments"],
            });

            notify(
                `Appointment marked ${variables.status.toLowerCase()}.`,
                "success",
            );
        },
        onError: (error) => notify(errorMessage(error), "warning"),
    });

    const cancelMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) =>
            cancelAppointment(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["admin", "appointments"],
            });

            notify(
                "Cancelled here and in Calendly. The customer has been told.",
                "success",
            );

            setCancelling(null);
            setCancelReason("");
        },
        // Shown inside the dialog, not as a toast: if Calendly refused, the
        // session is still booked and that needs to be unmissable.
        onError: (error) => setCancelError(errorMessage(error)),
    });

    const counts = useMemo(() => {
        return {
            total: appointments.length,
            pending: appointments.filter((a) => a.status === "PENDING")
                .length,
            confirmed: appointments.filter((a) => a.status === "CONFIRMED")
                .length,
            completed: appointments.filter((a) => a.status === "COMPLETED")
                .length,
        };
    }, [appointments]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return appointments
            .filter((appointment) => {
                const matchesFilter =
                    filter === "ALL" || appointment.status === filter;

                const matchesQuery =
                    !query ||
                    appointment.customer_username
                        .toLowerCase()
                        .includes(query) ||
                    appointment.reason?.toLowerCase().includes(query) ||
                    appointment.booking_reference
                        .toLowerCase()
                        .includes(query);

                return matchesFilter && matchesQuery;
            })
            .sort((a, b) => {
                // Appointments with a time first, soonest at the top.
                if (a.scheduled_at && b.scheduled_at) {
                    return (
                        new Date(a.scheduled_at).getTime() -
                        new Date(b.scheduled_at).getTime()
                    );
                }

                if (a.scheduled_at) {
                    return -1;
                }

                if (b.scheduled_at) {
                    return 1;
                }

                return (
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
            });
    }, [appointments, filter, search]);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Admin"
                title="Appointments"
                description="Every consultation your customers have booked."
                actions={
                    <Button
                        variant="outline"
                        onClick={() => appointmentsQuery.refetch()}
                        disabled={appointmentsQuery.isFetching}
                    >
                        <RefreshCw
                            className={cn(
                                appointmentsQuery.isFetching &&
                                    "animate-spin",
                            )}
                        />
                        Refresh
                    </Button>
                }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={<CalendarDays />}
                    label="Total"
                    value={counts.total}
                />

                <StatCard
                    icon={<Clock />}
                    tone="warning"
                    label="Awaiting a slot"
                    value={counts.pending}
                    sub="Customer has not picked a time"
                />

                <StatCard
                    icon={<CalendarCheck />}
                    tone="success"
                    label="Confirmed"
                    value={counts.confirmed}
                />

                <StatCard
                    icon={<CheckCircle2 />}
                    tone="info"
                    label="Completed"
                    value={counts.completed}
                />
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by customer, reason or reference..."
                        aria-label="Search appointments"
                        className="pl-11"
                    />
                </div>

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
            </div>

            {appointmentsQuery.isLoading && (
                <LoadingBlock label="Loading appointments..." />
            )}

            {appointmentsQuery.isError && (
                <ApiErrorState
                    error={appointmentsQuery.error}
                    title="Unable to load appointments"
                    onRetry={() => appointmentsQuery.refetch()}
                    isRetrying={appointmentsQuery.isFetching}
                />
            )}

            {!appointmentsQuery.isLoading &&
                !appointmentsQuery.isError &&
                filtered.length === 0 && (
                    <EmptyState
                        icon={<CalendarX />}
                        title={
                            appointments.length === 0
                                ? "No appointments yet"
                                : "Nothing matches your filters"
                        }
                        description={
                            appointments.length === 0
                                ? "Bookings made by your customers will appear here."
                                : "Try a different search word or status."
                        }
                        action={
                            appointments.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch("");
                                        setFilter("ALL");
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )
                        }
                    />
                )}

            {filtered.length > 0 && (
                <div className="grid gap-4 xl:grid-cols-2">
                    {filtered.map((appointment) => (
                        <Card key={appointment.id}>
                            <CardBody className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium">
                                            {appointment.reason ||
                                                "Consultation"}
                                        </p>

                                        <Link
                                            to={`/admin/customers/${appointment.customer}`}
                                            className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-primary"
                                        >
                                            <UserRound className="size-3.5" />
                                            @{appointment.customer_username}
                                            <ArrowUpRight className="size-3" />
                                        </Link>
                                    </div>

                                    <StatusBadge value={appointment.status} />
                                </div>

                                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1.5",
                                            appointment.scheduled_at
                                                ? "font-medium text-foreground"
                                                : "text-muted-foreground",
                                        )}
                                    >
                                        <CalendarDays className="size-4" />
                                        {formatSlot(appointment.scheduled_at)}
                                    </span>

                                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                        <Clock className="size-4" />
                                        {appointment.duration_minutes} min
                                    </span>
                                </div>

                                {appointment.notes && (
                                    <p className="rounded-xl bg-surface p-3.5 text-sm text-muted-foreground">
                                        {appointment.notes}
                                    </p>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    Ref {appointment.booking_reference}
                                </p>

                                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                                    {appointment.meeting_url && (
                                        <a
                                            href={appointment.meeting_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[0.8125rem] font-medium transition hover:border-primary/40 hover:text-primary"
                                        >
                                            <Video className="size-4" />
                                            Join
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    )}

                                    {appointment.status === "CONFIRMED" && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                                statusMutation.isPending
                                            }
                                            onClick={() =>
                                                statusMutation.mutate({
                                                    id: appointment.id,
                                                    status: "COMPLETED",
                                                })
                                            }
                                        >
                                            <CheckCircle2 />
                                            Mark completed
                                        </Button>
                                    )}

                                    {appointment.status !== "CANCELLED" &&
                                        appointment.status !==
                                            "COMPLETED" && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => {
                                                    setCancelError("");
                                                    setCancelReason("");
                                                    setCancelling(
                                                        appointment,
                                                    );
                                                }}
                                                className="text-destructive hover:bg-destructive/10"
                                            >
                                                <CalendarX />
                                                Cancel
                                            </Button>
                                        )}
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={Boolean(cancelling)}
                onClose={() => setCancelling(null)}
                size="sm"
                title="Cancel this appointment?"
                description="This also cancels it in Calendly and frees the slot."
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setCancelling(null)}
                        >
                            Keep it
                        </Button>

                        <Button
                            variant="destructive"
                            disabled={cancelMutation.isPending}
                            onClick={() =>
                                cancelling &&
                                cancelMutation.mutate({
                                    id: cancelling.id,
                                    reason: cancelReason.trim(),
                                })
                            }
                        >
                            {cancelMutation.isPending
                                ? "Cancelling..."
                                : "Cancel appointment"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5">
                    <FormError message={cancelError} />

                    <p className="text-sm text-muted-foreground">
                        {cancelling?.customer_username && (
                            <>
                                @{cancelling.customer_username} will be told,
                                and the slot will be released in Calendly.
                            </>
                        )}
                    </p>

                    <Field
                        label="Reason"
                        htmlFor="cancel-reason"
                        hint="Shown to the customer by Calendly. Optional."
                    >
                        <Textarea
                            id="cancel-reason"
                            rows={3}
                            value={cancelReason}
                            onChange={(event) =>
                                setCancelReason(event.target.value)
                            }
                            placeholder="Something came up and I need to reschedule."
                        />
                    </Field>
                </div>
            </Modal>
        </div>
    );
}
