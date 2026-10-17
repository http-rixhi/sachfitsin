import { useState, type FormEvent } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { FormError } from "@/components/ui/form-error";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import { errorMessage } from "@/lib/api-error";
import {
    createPersonalizedVideo,
    getVideoLibrary,
    updatePersonalizedVideo,
    type CreatePersonalizedVideoData,
    type PersonalizedVideo,
} from "@/services/videos";

interface AssignVideoModalProps {
    open: boolean;
    onClose: () => void;
    customerId: number;
    customerName: string;
    editing?: PersonalizedVideo | null;
}

const emptyForm: CreatePersonalizedVideoData = {
    customer: 0,
    video: 0,
    notes: "",
    starts_at: null,
    ends_at: null,
    status: "ACTIVE",
};

/** Mounts fresh on every open, so the form always starts from the right values. */
export function AssignVideoModal(props: AssignVideoModalProps) {
    if (!props.open) {
        return null;
    }

    return (
        <AssignVideoForm
            key={props.editing?.id ?? `new-${props.customerId}`}
            {...props}
        />
    );
}

function AssignVideoForm({
    open,
    onClose,
    customerId,
    customerName,
    editing,
}: AssignVideoModalProps) {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [form, setForm] = useState<CreatePersonalizedVideoData>(() =>
        editing
            ? {
                  customer: editing.customer,
                  video: editing.video,
                  notes: editing.notes,
                  starts_at: editing.starts_at
                      ? editing.starts_at.slice(0, 16)
                      : null,
                  ends_at: editing.ends_at
                      ? editing.ends_at.slice(0, 16)
                      : null,
                  status: editing.status,
              }
            : { ...emptyForm, customer: customerId },
    );

    const [error, setError] = useState("");

    const videosQuery = useQuery({
        queryKey: ["admin", "videos"],
        queryFn: getVideoLibrary,
    });

    const activeVideos = (videosQuery.data ?? []).filter(
        (video) => video.is_active,
    );

    const invalidate = () => {
        queryClient.invalidateQueries({
            queryKey: ["admin", "personalized-videos"],
        });

        queryClient.invalidateQueries({
            queryKey: ["admin", "customer-videos", customerId],
        });
    };

    const createMutation = useMutation({
        mutationFn: createPersonalizedVideo,
        onSuccess: () => {
            invalidate();
            notify(`Video assigned to ${customerName}.`, "success");
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
            data: Partial<CreatePersonalizedVideoData>;
        }) => updatePersonalizedVideo(id, data),
        onSuccess: () => {
            invalidate();
            notify("Assignment updated.", "success");
            onClose();
        },
        onError: (mutationError) => setError(errorMessage(mutationError)),
    });

    const isSaving =
        createMutation.isPending || updateMutation.isPending;

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!form.video) {
            setError("Please select a video.");
            return;
        }

        setError("");

        if (editing) {
            updateMutation.mutate({ id: editing.id, data: form });
        } else {
            createMutation.mutate({ ...form, customer: customerId });
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={editing ? "Edit video assignment" : "Assign a video"}
            description={`For ${customerName}`}
            footer={
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>

                    <Button
                        type="submit"
                        form="assign-video-form"
                        disabled={isSaving}
                    >
                        {isSaving && (
                            <Spinner className="size-4 text-primary-foreground" />
                        )}
                        {editing ? "Save changes" : "Assign video"}
                    </Button>
                </>
            }
        >
            <form
                id="assign-video-form"
                onSubmit={handleSubmit}
                className="space-y-5"
            >
                <FormError message={error} />

                <Field label="Video" htmlFor="video" required>
                    {videosQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">
                            Loading video library...
                        </p>
                    ) : activeVideos.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No active videos in the library yet. Add one under
                            Videos first.
                        </p>
                    ) : (
                        <Select
                            id="video"
                            required
                            value={form.video || ""}
                            disabled={Boolean(editing)}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    video: Number(event.target.value),
                                })
                            }
                        >
                            <option value="">Select a video</option>

                            {activeVideos.map((video) => (
                                <option key={video.id} value={video.id}>
                                    {video.title}
                                    {video.category
                                        ? ` - ${video.category}`
                                        : ""}
                                </option>
                            ))}
                        </Select>
                    )}
                </Field>

                <Field
                    label="Notes for the customer"
                    htmlFor="video-notes"
                    hint="Shown with the video on their dashboard."
                >
                    <Textarea
                        id="video-notes"
                        value={form.notes}
                        onChange={(event) =>
                            setForm({ ...form, notes: event.target.value })
                        }
                        placeholder="Watch this before your next session..."
                    />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Starts at" htmlFor="video-start">
                        <Input
                            id="video-start"
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

                    <Field label="Ends at" htmlFor="video-end">
                        <Input
                            id="video-end"
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

                <Field label="Status" htmlFor="video-status">
                    <Select
                        id="video-status"
                        value={form.status}
                        onChange={(event) =>
                            setForm({
                                ...form,
                                status: event.target
                                    .value as CreatePersonalizedVideoData["status"],
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
