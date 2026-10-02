import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    AlertTriangle,
    Clock3,
    Dumbbell,
    ExternalLink,
    ListChecks,
    Repeat2,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    CardSkeleton,
    EmptyState,
} from "@/components/ui/states";
import {
    getMyExerciseRecommendations,
    type ExerciseRecommendation,
} from "@/services/exercises";
import { cn, titleCase } from "@/lib/utils";

const statusFilters = ["ACTIVE", "COMPLETED", "ALL"];

const NO_EXERCISES: ExerciseRecommendation[] = [];

export default function Exercises() {
    const [filter, setFilter] = useState("ACTIVE");

    const exercisesQuery = useQuery({
        queryKey: ["my-exercise-recommendations"],
        queryFn: getMyExerciseRecommendations,
    });

    const recommendations = exercisesQuery.data ?? NO_EXERCISES;
    const { isLoading, isError } = exercisesQuery;

    const filtered = useMemo(() => {
        if (filter === "ALL") {
            return recommendations;
        }

        return recommendations.filter((item) => item.status === filter);
    }, [recommendations, filter]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Move"
                    title="Your exercises"
                    description="Routines personalised for your wellness goals."
                />

                <CardSkeleton />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Move"
                    title="Your exercises"
                    description="Routines personalised for your wellness goals."
                />

                <ApiErrorState
                    error={exercisesQuery.error}
                    title="Unable to load your exercises"
                    onRetry={() => exercisesQuery.refetch()}
                    isRetrying={exercisesQuery.isFetching}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Move"
                title="Your exercises"
                description="Routines personalised for your wellness goals."
            />

            {recommendations.length === 0 ? (
                <EmptyState
                    icon={<Dumbbell />}
                    title="No exercises assigned yet"
                    description="Your dietician will add personalised exercises here."
                />
            ) : (
                <>
                    <div className="flex flex-wrap gap-2">
                        {statusFilters.map((status) => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setFilter(status)}
                                className={cn(
                                    "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                                    filter === status
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                )}
                            >
                                {status === "ALL" ? "All" : titleCase(status)}
                            </button>
                        ))}
                    </div>

                    {filtered.length === 0 ? (
                        <EmptyState
                            icon={<Dumbbell />}
                            title="Nothing in this list"
                            description="Switch the filter to see your other exercises."
                        />
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-2">
                            {filtered.map((item) => (
                                <Card
                                    key={item.id}
                                    className="overflow-hidden"
                                >
                                    {item.exercise_image_url && (
                                        <img
                                            src={item.exercise_image_url}
                                            alt={item.exercise_name}
                                            loading="lazy"
                                            className="h-48 w-full object-cover"
                                        />
                                    )}

                                    <CardHeader className="flex-row items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <CardTitle>
                                                {item.exercise_name}
                                            </CardTitle>

                                            <p className="mt-0.5 text-sm text-muted-foreground">
                                                {item.exercise_category ||
                                                    "General"}
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                                            <StatusBadge
                                                value={
                                                    item.exercise_difficulty
                                                }
                                            />

                                            <StatusBadge
                                                value={item.status}
                                            />
                                        </div>
                                    </CardHeader>

                                    <CardBody className="space-y-5">
                                        {item.exercise_description && (
                                            <p className="text-sm leading-relaxed text-muted-foreground">
                                                {item.exercise_description}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-2">
                                            {item.duration_minutes && (
                                                <Badge>
                                                    <Clock3 className="size-3.5" />
                                                    {item.duration_minutes} min
                                                </Badge>
                                            )}

                                            {item.frequency && (
                                                <Badge>
                                                    <Repeat2 className="size-3.5" />
                                                    {item.frequency}
                                                </Badge>
                                            )}

                                            {item.sets && (
                                                <Badge tone="primary">
                                                    {item.sets} sets
                                                </Badge>
                                            )}

                                            {item.reps && (
                                                <Badge tone="primary">
                                                    {item.reps} reps
                                                </Badge>
                                            )}
                                        </div>

                                        {item.exercise_instructions && (
                                            <Section
                                                icon={
                                                    <ListChecks className="size-4 text-primary" />
                                                }
                                                title="How to do it"
                                                text={
                                                    item.exercise_instructions
                                                }
                                            />
                                        )}

                                        {item.exercise_precautions && (
                                            <Section
                                                icon={
                                                    <AlertTriangle className="size-4 text-warning" />
                                                }
                                                title="Be careful"
                                                text={
                                                    item.exercise_precautions
                                                }
                                                tone="warning"
                                            />
                                        )}

                                        {item.notes && (
                                            <Section
                                                icon={
                                                    <Dumbbell className="size-4 text-primary" />
                                                }
                                                title="Dietician's note"
                                                text={item.notes}
                                                tone="accent"
                                            />
                                        )}

                                        {item.exercise_video_url && (
                                            <a
                                                href={item.exercise_video_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                                            >
                                                Watch exercise video
                                                <ExternalLink className="size-3.5" />
                                            </a>
                                        )}
                                    </CardBody>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function Section({
    icon,
    title,
    text,
    tone = "plain",
}: {
    icon: React.ReactNode;
    title: string;
    text: string;
    tone?: "plain" | "warning" | "accent";
}) {
    return (
        <div
            className={cn(
                "rounded-xl p-3.5",
                tone === "warning" && "bg-warning/10",
                tone === "accent" && "bg-accent",
                tone === "plain" && "bg-surface",
            )}
        >
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                {icon}
                {title}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {text}
            </p>
        </div>
    );
}
