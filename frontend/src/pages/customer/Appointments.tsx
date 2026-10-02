import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    CalendarDays,
    Clock,
    ExternalLink,
    Plus,
    Video,
} from "lucide-react";
import {
    InlineWidget,
    useCalendlyEventListener,
} from "react-calendly";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import { FormError } from "@/components/ui/form-error";
import {
    EmptyState,
    LoadingBlock,
    Spinner,
} from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import { useAuth } from "@/contexts/auth-context";
import {
    confirmAppointment,
    createAppointment,
    getMyAppointments,
    type Appointment,
} from "@/services/appointments";
import { errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const CALENDLY_URL = "https://calendly.com/sachinsharmabm/30min";

const NO_APPOINTMENTS: Appointment[] = [];

export default function Appointments() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { notify } = useToast();

    const [showForm, setShowForm] = useState(false);
    const [showCalendly, setShowCalendly] = useState(false);
    const [selectedAppointment, setSelectedAppointment] =
        useState<Appointment | null>(null);
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");

    const appointmentsQuery = useQuery({
        queryKey: ["customer", "appointments"],
        queryFn: getMyAppointments,
    });

    const appointments = appointmentsQuery.data ?? NO_APPOINTMENTS;
    const { isLoading, isError } = appointmentsQuery;

    const createMutation = useMutation({
        mutationFn: createAppointment,
        onSuccess: (appointment) => {
            queryClient.invalidateQueries({
                queryKey: ["customer", "appointments"],
            });

            setSelectedAppointment(appointment);
            setReason("");
            setNotes("");
            setShowForm(false);
            setShowCalendly(true);
        },
        onError: (mutationError) => setError(errorMessage(mutationError)),
    });

    const confirmMutation = useMutation({
        mutationFn: ({
            id,
            eventUri,
            inviteeUri,
        }: {
            id: number;
            eventUri: string;
            inviteeUri?: string;
        }) =>
            confirmAppointment(id, {
                event_uri: eventUri,
                invitee_uri: inviteeUri,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["customer", "appointments"],
            });

            queryClient.invalidateQueries({ queryKey: ["notifications"] });

            notify("Your appointment is confirmed.", "success");

            setShowCalendly(false);
        },
    });

    // Calendly tells the page the moment a slot is picked, which is what
    // turns "Time not picked yet" into the real date without waiting for
    // the webhook.
    useCalendlyEventListener({
        onEventScheduled: (calendlyEvent) => {
            if (!selectedAppointment) {
                return;
            }

            const { event, invitee } = calendlyEvent.data.payload;

            confirmMutation.mutate({
                id: selectedAppointment.id,
                eventUri: event?.uri,
                inviteeUri: invitee?.uri,
            });
        },
    });

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (!reason.trim()) {
            setError("Please tell your dietician what this is about.");
            return;
        }

        setError("");

        createMutation.mutate({
            reason: reason.trim(),
            notes: notes.trim(),
        });
    };

    const { upcoming, past } = useMemo(() => {
        const upcomingList: Appointment[] = [];
        const pastList: Appointment[] = [];

        appointments.forEach((appointment) => {
            const isClosed =
                appointment.status === "COMPLETED" ||
                appointment.status === "CANCELLED";

            if (isClosed) {
                pastList.push(appointment);
            } else {
                upcomingList.push(appointment);
            }
        });

        return { upcoming: upcomingList, past: pastList };
    }, [appointments]);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Consultations"
                title="Appointments"
                description="Book a session with your dietician and see your history."
                actions={
                    <Button onClick={() => setShowForm(true)}>
                        <Plus />
                        Book appointment
                    </Button>
                }
            />

            {isLoading && <LoadingBlock label="Loading appointments..." />}

            {isError && (
                <ApiErrorState
                    error={appointmentsQuery.error}
                    title="Unable to load your appointments"
                    onRetry={() => appointmentsQuery.refetch()}
                    isRetrying={appointmentsQuery.isFetching}
                />
            )}

            {!isLoading && !isError && appointments.length === 0 && (
                <EmptyState
                    icon={<CalendarDays />}
                    title="No appointments yet"
                    description="Book your first consultation and pick a slot that suits you."
                    action={
                        <Button onClick={() => setShowForm(true)}>
                            <Plus />
                            Book appointment
                        </Button>
                    }
                />
            )}

            {upcoming.length > 0 && (
                <section>
                    <h2 className="mb-4 text-lg font-semibold">
                        Upcoming
                    </h2>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {upcoming.map((appointment) => (
                            <AppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                            />
                        ))}
                    </div>
                </section>
            )}

            {past.length > 0 && (
                <section>
                    <h2 className="mb-4 text-lg font-semibold">
                        Past & closed
                    </h2>

                    <div className="grid gap-4 lg:grid-cols-2">
                        {past.map((appointment) => (
                            <AppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                                muted
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Booking form */}
            <Modal
                open={showForm}
                onClose={() => setShowForm(false)}
                title="Book an appointment"
                description="Tell your dietician what you want to discuss, then pick a time."
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowForm(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="appointment-form"
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending && (
                                <Spinner className="size-4 text-primary-foreground" />
                            )}
                            Continue to time slots
                        </Button>
                    </>
                }
            >
                <form
                    id="appointment-form"
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <FormError message={error} />

                    <Field
                        label="What is this about?"
                        htmlFor="reason"
                        required
                    >
                        <Input
                            id="reason"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="e.g. Review my diet plan"
                            required
                        />
                    </Field>

                    <Field
                        label="Anything else your dietician should know?"
                        htmlFor="appointment-notes"
                    >
                        <Textarea
                            id="appointment-notes"
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Recent changes, symptoms, questions..."
                        />
                    </Field>
                </form>
            </Modal>

            {/* Calendly slot picker */}
            <Modal
                open={showCalendly}
                onClose={() => setShowCalendly(false)}
                size="lg"
                title="Pick your time slot"
                description="Choose a 30-minute consultation slot."
                footer={
                    <>
                        {confirmMutation.isPending && (
                            <span className="mr-auto inline-flex items-center gap-2 text-sm text-muted-foreground">
                                <Spinner className="size-4" />
                                Saving your slot...
                            </span>
                        )}

                        <Button
                            variant="outline"
                            onClick={() => setShowCalendly(false)}
                        >
                            Done
                        </Button>
                    </>
                }
            >
                <div className="overflow-hidden rounded-xl border border-border">
                    <InlineWidget
                        url={CALENDLY_URL}
                        styles={{ height: "640px" }}
                        prefill={{
                            name: user
                                ? `${user.first_name} ${user.last_name}`.trim()
                                : "",
                            email: user?.email ?? "",
                        }}
                        utm={{
                            utmSource: "sachfitsin",
                            utmMedium: "appointment",
                            utmCampaign: "dietician_booking",
                            utmContent:
                                selectedAppointment?.booking_reference || "",
                        }}
                    />
                </div>
            </Modal>
        </div>
    );
}

function AppointmentCard({
    appointment,
    muted = false,
}: {
    appointment: Appointment;
    muted?: boolean;
}) {
    const scheduled = appointment.scheduled_at
        ? new Date(appointment.scheduled_at)
        : null;

    return (
        <Card className={cn(muted && "opacity-75")}>
            <CardBody className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-medium">
                            {appointment.reason || "Consultation"}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                            Ref {appointment.booking_reference}
                        </p>
                    </div>

                    <StatusBadge value={appointment.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-4" />
                        {scheduled
                            ? scheduled.toLocaleString(undefined, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                              })
                            : "Time not picked yet"}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-4" />
                        {appointment.duration_minutes} min
                    </span>
                </div>

                {appointment.notes && (
                    <p className="rounded-xl bg-surface p-3.5 text-sm text-muted-foreground">
                        {appointment.notes}
                    </p>
                )}

                {appointment.meeting_url && (
                    <a
                        href={appointment.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                        <Video className="size-4" />
                        Join the meeting
                        <ExternalLink className="size-3.5" />
                    </a>
                )}
            </CardBody>
        </Card>
    );
}
