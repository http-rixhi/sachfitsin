import { useState, type FormEvent } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { FormError } from "@/components/ui/form-error";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import { errorMessage } from "@/lib/api-error";
import {
    createExerciseRecommendation,
    getExerciseLibrary,
    updateExerciseRecommendation,
    type CreateRecommendationData,
    type ExerciseRecommendation,
} from "@/services/exercises";

interface AssignExerciseModalProps {
    open: boolean;
    onClose: () => void;
    customerId: number;
    customerName: string;
    editing?: ExerciseRecommendation | null;
}

const emptyForm: CreateRecommendationData = {
    customer: 0,
    exercise: 0,
    sets: null,
    reps: null,
    duration_minutes: null,
    frequency: "",
    notes: "",
    status: "ACTIVE",
    starts_at: null,
    ends_at: null,
};

/** Mounts fresh on every open, so the form always starts from the right values. */
export function AssignExerciseModal(props: AssignExerciseModalProps) {
    if (!props.open) {
        return null;
    }

    return (
        <AssignExerciseForm
            key={props.editing?.id ?? `new-${props.customerId}`}
            {...props}
        />
    );
}

function AssignExerciseForm({
    open,
    onClose,
    customerId,
    customerName,
    editing,
}: AssignExerciseModalProps) {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [form, setForm] = useState<CreateRecommendationData>(() =>
        editing
            ? {
                  customer: editing.customer,
                  exercise: editing.exercise,
                  sets: editing.sets,
                  reps: editing.reps,
                  duration_minutes: editing.duration_minutes,
                  frequency: editing.frequency,
                  notes: editing.notes,
                  status: editing.status,
                  starts_at: editing.starts_at
                      ? editing.starts_at.slice(0, 16)
                      : null,
                  ends_at: editing.ends_at
                      ? editing.ends_at.slice(0, 16)
                      : null,
              }
            : { ...emptyForm, customer: customerId },
    );

    const [error, setError] = useState("");

    const libraryQuery = useQuery({
        queryKey: ["exercise-library"],
        queryFn: getExerciseLibrary,
    });

    const activeExercises = (libraryQuery.data ?? []).filter(
        (exercise) => exercise.is_active,
    );

    const invalidate = () => {
        queryClient.invalidateQueries({
            queryKey: ["admin", "exercise-recommendations"],
        });

        queryClient.invalidateQueries({
            queryKey: ["admin", "customer-exercises", customerId],
        });
    };

    const createMutation = useMutation({
        mutationFn: createExerciseRecommendation,
        onSuccess: () => {
            invalidate();
            notify(`Exercise assigned to ${customerName}.`, "success");
            onClose();
        },
        onError: (mutationError) => setError(errorMessage(mutationError)),
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: number;
            data: Partial<CreateRecommendationData>;
        }) => updateExerciseRecommendation(id, data),
        onSuccess: () => {
            invalidate();
            notify("Exercise updated.", "success");
            onClose();
        },
        onError: (mutationError) => setError(errorMessage(mutationError)),
    });

    const isSaving =
        createMutation.isPending || updateMutation.isPending;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!form.exercise) {
            setError("Please select an exercise.");
            return;
        }

        setError("");

        if (editing) {
            updateMutation.mutate({ id: editing.id, data: form });
        } else {
            createMutation.mutate({ ...form, customer: customerId });
        }
    };

    const numberValue = (value: number | null | undefined) =>
        value === null || value === undefined ? "" : value;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Edit exercise" : "Assign an exercise"}
            description={`For ${customerName}`}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        form="assign-exercise-form"
                        disabled={isSaving}
                    >
                        {isSaving && (
                            <Spinner className="size-4 text-primary-foreground" />
                        )}
                        {editing ? "Save changes" : "Assign exercise"}
                    </Button>
                </>
            }
        >
            <form
                id="assign-exercise-form"
                onSubmit={handleSubmit}
                className="space-y-5"
            >
                <FormError message={error} />

                <Field label="Exercise" htmlFor="exercise" required>
                    {libraryQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">
                            Loading exercise library...
                        </p>
                    ) : activeExercises.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No active exercises in the library yet. Add one
                            under Exercises first.
                        </p>
                    ) : (
                        <Select
                            id="exercise"
                            required
                            value={form.exercise || ""}
                            disabled={Boolean(editing)}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    exercise: Number(event.target.value),
                                })
                            }
                        >
                            <option value="">Select an exercise</option>

                            {activeExercises.map((exercise) => (
                                <option key={exercise.id} value={exercise.id}>
                                    {exercise.name}
                                    {exercise.category
                                        ? ` - ${exercise.category}`
                                        : ""}
                                </option>
                            ))}
                        </Select>
                    )}
                </Field>

                <div className="grid gap-5 sm:grid-cols-3">
                    <Field label="Sets" htmlFor="sets">
                        <Input
                            id="sets"
                            type="number"
                            min={0}
                            value={numberValue(form.sets)}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    sets: event.target.value
                                        ? Number(event.target.value)
                                        : null,
                                })
                            }
                        />
                    </Field>

                    <Field label="Reps" htmlFor="reps">
                        <Input
                            id="reps"
                            type="number"
                            min={0}
                            value={numberValue(form.reps)}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    reps: event.target.value
                                        ? Number(event.target.value)
                                        : null,
                                })
                            }
                        />
                    </Field>

                    <Field label="Minutes" htmlFor="exercise-duration">
                        <Input
                            id="exercise-duration"
                            type="number"
                            min={0}
                            value={numberValue(form.duration_minutes)}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    duration_minutes: event.target.value
                                        ? Number(event.target.value)
                                        : null,
                                })
                            }
                        />
                    </Field>
                </div>

                <Field
                    label="Frequency"
                    htmlFor="frequency"
                    hint="For example: 3 times a week"
                >
                    <Input
                        id="frequency"
                        value={form.frequency}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                frequency: event.target.value,
                            })
                        }
                        placeholder="3 times a week"
                    />
                </Field>

                <Field label="Notes for the customer" htmlFor="exercise-notes">
                    <Textarea
                        id="exercise-notes"
                        value={form.notes}
                        onChange={(event) =>
                            setForm({ ...form, notes: event.target.value })
                        }
                        placeholder="Start slow and stop if you feel pain..."
                    />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Starts at" htmlFor="exercise-start">
                        <Input
                            id="exercise-start"
                            type="datetime-local"
                            value={form.starts_at ?? ""}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    starts_at: event.target.value || null,
                                })
                            }
                        />
                    </Field>

                    <Field label="Ends at" htmlFor="exercise-end">
                        <Input
                            id="exercise-end"
                            type="datetime-local"
                            value={form.ends_at ?? ""}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    ends_at: event.target.value || null,
                                })
                            }
                        />
                    </Field>
                </div>

                <Field label="Status" htmlFor="exercise-status">
                    <Select
                        id="exercise-status"
                        value={form.status}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                status: event.target
                                    .value as CreateRecommendationData["status"],
                            })
                        }
                    >
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </Select>
                </Field>
            </form>
        </Modal>
    );
}
