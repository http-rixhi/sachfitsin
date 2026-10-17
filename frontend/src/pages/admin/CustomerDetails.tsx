import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
    Activity,
    ArrowLeft,
    CalendarDays,
    Dumbbell,
    ExternalLink,
    Mail,
    Pencil,
    Phone,
    Plus,
    Ruler,
    Scale,
    Target,
    UserRound,
    Video,
} from "lucide-react";

import { AssignExerciseModal } from "@/components/admin/AssignExerciseModal";
import { AssignVideoModal } from "@/components/admin/AssignVideoModal";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    EmptyState,
    LoadingBlock,
} from "@/components/ui/states";
import { getCustomer } from "@/services/customerManagement";
import {
    getExerciseRecommendations,
    type ExerciseRecommendation,
} from "@/services/exercises";
import {
    getPersonalizedVideos,
    type PersonalizedVideo,
} from "@/services/videos";
import { cn, formatDate, initialsOf, titleCase } from "@/lib/utils";

type Tab = "profile" | "videos" | "exercises";

const tabs: Array<{ id: Tab; label: string; icon: typeof UserRound }> = [
    { id: "profile", label: "Profile", icon: UserRound },
    { id: "videos", label: "Videos", icon: Video },
    { id: "exercises", label: "Exercises", icon: Dumbbell },
];

export default function CustomerDetails() {
    const { id } = useParams();
    const customerId = Number(id);

    const [tab, setTab] = useState<Tab>("profile");

    const [videoModal, setVideoModal] = useState<{
        open: boolean;
        editing: PersonalizedVideo | null;
    }>({ open: false, editing: null });

    const [exerciseModal, setExerciseModal] = useState<{
        open: boolean;
        editing: ExerciseRecommendation | null;
    }>({ open: false, editing: null });

    const customerQuery = useQuery({
        queryKey: ["admin", "customer", customerId],
        queryFn: () => getCustomer(customerId),
        enabled: Number.isInteger(customerId),
    });

    const videosQuery = useQuery({
        queryKey: ["admin", "customer-videos", customerId],
        queryFn: () => getPersonalizedVideos(customerId),
        enabled: Number.isInteger(customerId),
    });

    const exercisesQuery = useQuery({
        queryKey: ["admin", "customer-exercises", customerId],
        queryFn: () => getExerciseRecommendations(customerId),
        enabled: Number.isInteger(customerId),
    });

    const customer = customerQuery.data;
    const profile = customer?.profile;

    const videos = videosQuery.data ?? [];
    const exercises = exercisesQuery.data ?? [];

    if (customerQuery.isLoading) {
        return <LoadingBlock label="Loading customer..." />;
    }

    if (customerQuery.isError || !customer) {
        return (
            <div className="space-y-5">
                <BackLink />

                <ApiErrorState
                    error={customerQuery.error}
                    title="Customer could not be found"
                    onRetry={() => customerQuery.refetch()}
                    isRetrying={customerQuery.isFetching}
                />
            </div>
        );
    }

    const fullName =
        `${customer.first_name} ${customer.last_name}`.trim() ||
        customer.username;

    const counts: Record<Tab, number | null> = {
        profile: null,
        videos: videos.length,
        exercises: exercises.length,
    };

    return (
        <div className="space-y-6">
            <BackLink />

            {/* Header */}
            <Card>
                <CardBody className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-foreground">
                            {initialsOf(
                                customer.first_name,
                                customer.last_name || customer.username,
                            )}
                        </span>

                        <div className="min-w-0">
                            <h1 className="truncate text-xl font-semibold sm:text-2xl">
                                {fullName}
                            </h1>

                            <p className="text-sm text-muted-foreground">
                                @{customer.username}
                            </p>

                            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <Mail className="size-4" />
                                    {customer.email}
                                </span>

                                <span className="inline-flex items-center gap-1.5">
                                    <Phone className="size-4" />
                                    {profile?.phone_number || "No phone"}
                                </span>

                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="size-4" />
                                    Joined {formatDate(customer.created_at)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Assign directly from the customer view */}
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={() =>
                                setVideoModal({ open: true, editing: null })
                            }
                        >
                            <Plus />
                            Add video
                        </Button>

                        <Button
                            variant="outline"
                            onClick={() =>
                                setExerciseModal({ open: true, editing: null })
                            }
                        >
                            <Plus />
                            Add exercise
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 hide-scrollbar">
                {tabs.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className={cn(
                            "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition",
                            tab === item.id
                                ? "bg-accent text-accent-foreground"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )}
                    >
                        <item.icon className="size-4" />
                        {item.label}

                        {counts[item.id] !== null && (
                            <span className="rounded-full bg-background/70 px-1.5 text-xs tabular-nums">
                                {counts[item.id]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Profile tab */}
            {tab === "profile" && (
                <div className="space-y-5">
                    {!profile ? (
                        <EmptyState
                            icon={<UserRound />}
                            title="Profile not completed"
                            description="This customer has not filled in their health and diet profile yet."
                        />
                    ) : (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <StatCard
                                    icon={<Scale />}
                                    label="Current weight"
                                    value={
                                        profile.current_weight_kg
                                            ? `${profile.current_weight_kg} kg`
                                            : "-"
                                    }
                                />

                                <StatCard
                                    icon={<Target />}
                                    tone="success"
                                    label="Target weight"
                                    value={
                                        profile.target_weight_kg
                                            ? `${profile.target_weight_kg} kg`
                                            : "-"
                                    }
                                />

                                <StatCard
                                    icon={<Ruler />}
                                    tone="info"
                                    label="Height"
                                    value={
                                        profile.height_cm
                                            ? `${profile.height_cm} cm`
                                            : "-"
                                    }
                                />

                                <StatCard
                                    icon={<Activity />}
                                    tone="warning"
                                    label="Activity"
                                    value={
                                        <span className="text-xl">
                                            {titleCase(
                                                profile.activity_level,
                                            ) || "-"}
                                        </span>
                                    }
                                />
                            </div>

                            <div className="grid gap-5 lg:grid-cols-2">
                                <InfoCard
                                    title="Personal information"
                                    items={[
                                        ["Profession", profile.profession],
                                        [
                                            "Dietary preference",
                                            titleCase(
                                                profile.dietary_preference,
                                            ),
                                        ],
                                        ["Current diet", profile.current_diet],
                                    ]}
                                />

                                <InfoCard
                                    title="Dietary considerations"
                                    items={[
                                        ["Allergies", profile.allergies],
                                        [
                                            "Food dislikes",
                                            profile.food_dislikes,
                                        ],
                                        ["Goals", profile.goals],
                                    ]}
                                />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Videos tab */}
            {tab === "videos" && (
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Personalised videos</CardTitle>

                            <p className="mt-0.5 text-sm text-muted-foreground">
                                Videos assigned to {fullName}.
                            </p>
                        </div>

                        <Button
                            size="sm"
                            onClick={() =>
                                setVideoModal({ open: true, editing: null })
                            }
                        >
                            <Plus />
                            Assign
                        </Button>
                    </CardHeader>

                    <CardBody className="p-0 sm:p-0">
                        {videosQuery.isLoading ? (
                            <LoadingBlock
                                label="Loading videos..."
                                className="border-0 bg-transparent"
                            />
                        ) : videos.length === 0 ? (
                            <EmptyState
                                icon={<Video />}
                                title="No videos assigned"
                                description="Assign a video from the library to get started."
                                className="border-0 bg-transparent"
                                action={
                                    <Button
                                        onClick={() =>
                                            setVideoModal({
                                                open: true,
                                                editing: null,
                                            })
                                        }
                                    >
                                        <Plus />
                                        Assign a video
                                    </Button>
                                }
                            />
                        ) : (
                            <ul className="divide-y divide-border">
                                {videos.map((video) => (
                                    <li
                                        key={video.id}
                                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                                    >
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                            <Video className="size-[1.125rem]" />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {video.video_title}
                                            </p>

                                            {video.notes && (
                                                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                    {video.notes}
                                                </p>
                                            )}

                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {video.starts_at
                                                    ? formatDate(
                                                          video.starts_at,
                                                      )
                                                    : "Available now"}
                                                {" → "}
                                                {video.ends_at
                                                    ? formatDate(video.ends_at)
                                                    : "No expiry"}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <StatusBadge value={video.status} />

                                            {video.video_url && (
                                                <a
                                                    href={video.video_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    aria-label="Open video"
                                                    className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-primary"
                                                >
                                                    <ExternalLink className="size-4" />
                                                </a>
                                            )}

                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                aria-label="Edit assignment"
                                                onClick={() =>
                                                    setVideoModal({
                                                        open: true,
                                                        editing: video,
                                                    })
                                                }
                                            >
                                                <Pencil />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            )}

            {/* Exercises tab */}
            {tab === "exercises" && (
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Exercise plan</CardTitle>

                            <p className="mt-0.5 text-sm text-muted-foreground">
                                Exercises recommended to {fullName}.
                            </p>
                        </div>

                        <Button
                            size="sm"
                            onClick={() =>
                                setExerciseModal({ open: true, editing: null })
                            }
                        >
                            <Plus />
                            Assign
                        </Button>
                    </CardHeader>

                    <CardBody className="p-0 sm:p-0">
                        {exercisesQuery.isLoading ? (
                            <LoadingBlock
                                label="Loading exercises..."
                                className="border-0 bg-transparent"
                            />
                        ) : exercises.length === 0 ? (
                            <EmptyState
                                icon={<Dumbbell />}
                                title="No exercises assigned"
                                description="Pick an exercise from the library and set the sets, reps and frequency."
                                className="border-0 bg-transparent"
                                action={
                                    <Button
                                        onClick={() =>
                                            setExerciseModal({
                                                open: true,
                                                editing: null,
                                            })
                                        }
                                    >
                                        <Plus />
                                        Assign an exercise
                                    </Button>
                                }
                            />
                        ) : (
                            <ul className="divide-y divide-border">
                                {exercises.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6"
                                    >
                                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                            <Dumbbell className="size-[1.125rem]" />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {item.exercise_name}
                                            </p>

                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {item.sets && (
                                                    <Badge>
                                                        {item.sets} sets
                                                    </Badge>
                                                )}

                                                {item.reps && (
                                                    <Badge>
                                                        {item.reps} reps
                                                    </Badge>
                                                )}

                                                {item.duration_minutes && (
                                                    <Badge>
                                                        {item.duration_minutes}{" "}
                                                        min
                                                    </Badge>
                                                )}

                                                {item.frequency && (
                                                    <Badge>
                                                        {item.frequency}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <StatusBadge value={item.status} />

                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                aria-label="Edit exercise"
                                                onClick={() =>
                                                    setExerciseModal({
                                                        open: true,
                                                        editing: item,
                                                    })
                                                }
                                            >
                                                <Pencil />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            )}

            <AssignVideoModal
                open={videoModal.open}
                onClose={() =>
                    setVideoModal({ open: false, editing: null })
                }
                customerId={customerId}
                customerName={fullName}
                editing={videoModal.editing}
            />

            <AssignExerciseModal
                open={exerciseModal.open}
                onClose={() =>
                    setExerciseModal({ open: false, editing: null })
                }
                customerId={customerId}
                customerName={fullName}
                editing={exerciseModal.editing}
            />
        </div>
    );
}

function BackLink() {
    return (
        <Link
            to="/admin/customers"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
        >
            <ArrowLeft className="size-4" />
            Back to customers
        </Link>
    );
}

function InfoCard({
    title,
    items,
}: {
    title: string;
    items: Array<[string, string]>;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>

            <CardBody className="space-y-4">
                {items.map(([label, value]) => (
                    <div key={label}>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {label}
                        </p>

                        <p className="mt-1 whitespace-pre-wrap text-sm">
                            {value || "Not provided"}
                        </p>
                    </div>
                ))}
            </CardBody>
        </Card>
    );
}
