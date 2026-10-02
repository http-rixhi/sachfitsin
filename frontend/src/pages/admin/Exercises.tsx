import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    Clock3,
    Dumbbell,
    ExternalLink,
    Pencil,
    Plus,
    Power,
    Search,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    CardSkeleton,
    EmptyState,
    Spinner,
} from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import {
    createExercise,
    getExerciseLibrary,
    updateExercise,
    type CreateExerciseData,
    type Exercise,
} from "@/services/exercises";
import { cn, titleCase } from "@/lib/utils";

const NO_EXERCISES: Exercise[] = [];

const emptyForm: CreateExerciseData = {
    name: "",
    description: "",
    category: "",
    difficulty: "BEGINNER",
    duration_minutes: null,
    instructions: "",
    precautions: "",
    video_url: "",
    image_url: "",
    is_active: true,
};

const difficulties = ["ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED"];

export default function Exercises() {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingExercise, setEditingExercise] =
        useState<Exercise | null>(null);
    const [form, setForm] = useState<CreateExerciseData>(emptyForm);
    const [search, setSearch] = useState("");
    const [difficulty, setDifficulty] = useState("ALL");

    const exercisesQuery = useQuery({
        queryKey: ["exercise-library"],
        queryFn: getExerciseLibrary,
    });

    const exercises = exercisesQuery.data ?? NO_EXERCISES;
    const { isLoading, isError } = exercisesQuery;

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["exercise-library"] });

    const createMutation = useMutation({
        mutationFn: createExercise,
        onSuccess: () => {
            invalidate();
            notify("Exercise added to the library.", "success");
            closeForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: number;
            data: Partial<CreateExerciseData>;
        }) => updateExercise(id, data),
        onSuccess: () => {
            invalidate();
            closeForm();
        },
    });

    function openCreate() {
        setEditingExercise(null);
        setForm(emptyForm);
        setIsFormOpen(true);
    }

    function openEdit(exercise: Exercise) {
        setEditingExercise(exercise);

        setForm({
            name: exercise.name,
            description: exercise.description,
            category: exercise.category,
            difficulty: exercise.difficulty,
            duration_minutes: exercise.duration_minutes,
            instructions: exercise.instructions,
            precautions: exercise.precautions,
            video_url: exercise.video_url,
            image_url: exercise.image_url,
            is_active: exercise.is_active,
        });

        setIsFormOpen(true);
    }

    function closeForm() {
        setIsFormOpen(false);
        setEditingExercise(null);
        setForm(emptyForm);
    }

    function handleChange(
        field: keyof CreateExerciseData,
        value: string | number | boolean | null,
    ) {
        setForm((current) => ({ ...current, [field]: value }));
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (!form.name.trim()) {
            return;
        }

        if (editingExercise) {
            updateMutation.mutate({
                id: editingExercise.id,
                data: form,
            });
        } else {
            createMutation.mutate(form);
        }
    }

    function toggleExercise(exercise: Exercise) {
        updateMutation.mutate({
            id: exercise.id,
            data: { is_active: !exercise.is_active },
        });
    }

    const categories = useMemo(
        () =>
            Array.from(
                new Set(
                    exercises.map((item) => item.category).filter(Boolean),
                ),
            ),
        [exercises],
    );

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return exercises.filter((exercise) => {
            const matchesDifficulty =
                difficulty === "ALL" || exercise.difficulty === difficulty;

            const matchesQuery =
                !query ||
                exercise.name.toLowerCase().includes(query) ||
                exercise.category?.toLowerCase().includes(query) ||
                exercise.description?.toLowerCase().includes(query);

            return matchesDifficulty && matchesQuery;
        });
    }, [exercises, difficulty, search]);

    const isSaving =
        createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Library"
                title="Exercise Library"
                description="Exercises here can be recommended to any customer from their profile."
                actions={
                    <Button onClick={openCreate}>
                        <Plus />
                        Add exercise
                    </Button>
                }
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search exercises..."
                        aria-label="Search exercises"
                        className="pl-11"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {difficulties.map((level) => (
                        <button
                            key={level}
                            type="button"
                            onClick={() => setDifficulty(level)}
                            className={cn(
                                "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                                difficulty === level
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            )}
                        >
                            {level === "ALL" ? "All" : titleCase(level)}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && <CardSkeleton />}

            {isError && (
                <ApiErrorState
                    error={exercisesQuery.error}
                    title="Unable to load exercises"
                    onRetry={() => exercisesQuery.refetch()}
                    isRetrying={exercisesQuery.isFetching}
                />
            )}

            {!isLoading && !isError && filtered.length === 0 && (
                <EmptyState
                    icon={<Dumbbell />}
                    title={
                        exercises.length === 0
                            ? "No exercises yet"
                            : "No exercises match your filters"
                    }
                    description={
                        exercises.length === 0
                            ? "Add your first exercise to the library."
                            : "Try a different search word or difficulty."
                    }
                    action={
                        exercises.length === 0 ? (
                            <Button onClick={openCreate}>
                                <Plus />
                                Add your first exercise
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearch("");
                                    setDifficulty("ALL");
                                }}
                            >
                                Clear filters
                            </Button>
                        )
                    }
                />
            )}

            {filtered.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((exercise) => (
                        <Card
                            key={exercise.id}
                            className={cn(
                                "flex flex-col overflow-hidden transition hover:shadow-[var(--shadow-lift)]",
                                !exercise.is_active && "opacity-65",
                            )}
                        >
                            {exercise.image_url ? (
                                <img
                                    src={exercise.image_url}
                                    alt={exercise.name}
                                    loading="lazy"
                                    className="h-40 w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-40 w-full items-center justify-center bg-accent">
                                    <Dumbbell className="size-9 text-accent-foreground/60" />
                                </div>
                            )}

                            <div className="flex flex-1 flex-col gap-3 p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-base font-semibold leading-snug">
                                        {exercise.name}
                                    </h3>

                                    <StatusBadge
                                        value={exercise.difficulty}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {exercise.category && (
                                        <Badge tone="primary">
                                            {titleCase(exercise.category)}
                                        </Badge>
                                    )}

                                    {exercise.duration_minutes && (
                                        <Badge>
                                            <Clock3 className="size-3.5" />
                                            {exercise.duration_minutes} min
                                        </Badge>
                                    )}

                                    {!exercise.is_active && (
                                        <Badge tone="danger">Inactive</Badge>
                                    )}
                                </div>

                                {exercise.description && (
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {exercise.description}
                                    </p>
                                )}

                                <div className="mt-auto flex items-center gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEdit(exercise)}
                                    >
                                        <Pencil />
                                        Edit
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            toggleExercise(exercise)
                                        }
                                    >
                                        <Power />
                                        {exercise.is_active
                                            ? "Disable"
                                            : "Enable"}
                                    </Button>

                                    {exercise.video_url && (
                                        <a
                                            href={exercise.video_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label="Open exercise video"
                                            className="ml-auto rounded-lg border border-border p-2 text-muted-foreground transition hover:text-primary"
                                        >
                                            <ExternalLink className="size-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={isFormOpen}
                onClose={closeForm}
                size="lg"
                title={editingExercise ? "Edit exercise" : "Add exercise"}
                description="These details are shown to the customer with their plan."
                footer={
                    <>
                        <Button variant="outline" onClick={closeForm}>
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="exercise-form"
                            disabled={isSaving}
                        >
                            {isSaving && (
                                <Spinner className="size-4 text-primary-foreground" />
                            )}
                            {editingExercise
                                ? "Save changes"
                                : "Create exercise"}
                        </Button>
                    </>
                }
            >
                <form
                    id="exercise-form"
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <Field label="Name" htmlFor="exercise-name" required>
                        <Input
                            id="exercise-name"
                            value={form.name}
                            onChange={(event) =>
                                handleChange("name", event.target.value)
                            }
                            placeholder="e.g. Brisk walking"
                            required
                        />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-3">
                        <Field label="Category" htmlFor="exercise-category">
                            <Input
                                id="exercise-category"
                                list="exercise-categories"
                                value={form.category}
                                onChange={(event) =>
                                    handleChange(
                                        "category",
                                        event.target.value,
                                    )
                                }
                                placeholder="Cardio"
                            />

                            <datalist id="exercise-categories">
                                {categories.map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                        </Field>

                        <Field
                            label="Difficulty"
                            htmlFor="exercise-difficulty"
                        >
                            <Select
                                id="exercise-difficulty"
                                value={form.difficulty}
                                onChange={(event) =>
                                    handleChange(
                                        "difficulty",
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="BEGINNER">Beginner</option>
                                <option value="INTERMEDIATE">
                                    Intermediate
                                </option>
                                <option value="ADVANCED">Advanced</option>
                            </Select>
                        </Field>

                        <Field
                            label="Duration (minutes)"
                            htmlFor="exercise-minutes"
                        >
                            <Input
                                id="exercise-minutes"
                                type="number"
                                min={0}
                                value={form.duration_minutes ?? ""}
                                onChange={(event) =>
                                    handleChange(
                                        "duration_minutes",
                                        event.target.value
                                            ? Number(event.target.value)
                                            : null,
                                    )
                                }
                            />
                        </Field>
                    </div>

                    <Field
                        label="Description"
                        htmlFor="exercise-description"
                    >
                        <Textarea
                            id="exercise-description"
                            rows={3}
                            value={form.description}
                            onChange={(event) =>
                                handleChange(
                                    "description",
                                    event.target.value,
                                )
                            }
                            placeholder="What is this exercise and who is it for?"
                        />
                    </Field>

                    <Field
                        label="Instructions"
                        htmlFor="exercise-instructions"
                    >
                        <Textarea
                            id="exercise-instructions"
                            value={form.instructions}
                            onChange={(event) =>
                                handleChange(
                                    "instructions",
                                    event.target.value,
                                )
                            }
                            placeholder="Step by step, in simple words."
                        />
                    </Field>

                    <Field
                        label="Precautions"
                        htmlFor="exercise-precautions"
                        hint="Anything the customer must be careful about."
                    >
                        <Textarea
                            id="exercise-precautions"
                            rows={3}
                            value={form.precautions}
                            onChange={(event) =>
                                handleChange(
                                    "precautions",
                                    event.target.value,
                                )
                            }
                        />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Video URL" htmlFor="exercise-video">
                            <Input
                                id="exercise-video"
                                type="url"
                                value={form.video_url}
                                onChange={(event) =>
                                    handleChange(
                                        "video_url",
                                        event.target.value,
                                    )
                                }
                                placeholder="https://..."
                            />
                        </Field>

                        <Field label="Image URL" htmlFor="exercise-image">
                            <Input
                                id="exercise-image"
                                type="url"
                                value={form.image_url}
                                onChange={(event) =>
                                    handleChange(
                                        "image_url",
                                        event.target.value,
                                    )
                                }
                                placeholder="https://..."
                            />
                        </Field>
                    </div>

                    <Switch
                        id="exercise-active"
                        checked={form.is_active}
                        onChange={(checked) =>
                            handleChange("is_active", checked)
                        }
                        label="Active"
                        description="Only active exercises can be assigned to customers"
                    />
                </form>
            </Modal>
        </div>
    );
}
