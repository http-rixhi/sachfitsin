import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    Activity,
    ArrowRight,
    ArrowUpRight,
    Clock3,
    Droplets,
    Dumbbell,
    ExternalLink,
    Flame,
    Repeat2,
    Ruler,
    Salad,
    Scale,
    Target,
    Video,
} from "lucide-react";

import { VideoCard } from "@/components/cards";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import { PERSONALIZED_VIDEOS_CODE } from "@/services/products";
import {
    CardSkeleton,
    EmptyState,
    LoadingBlock,
} from "@/components/ui/states";
import { useAuth } from "@/contexts/auth-context";
import { getCustomerProfile } from "@/services/customerProfile";
import { getMyExerciseRecommendations } from "@/services/exercises";
import { getMyPersonalizedVideos } from "@/services/videos";
import { titleCase } from "@/lib/utils";

const trackerCards = [
    {
        to: "/dashboard/calories",
        label: "Calorie Tracker",
        text: "Log meals and stay on target",
        icon: Flame,
        className:
            "from-warning/18 to-warning/5 text-warning-foreground ring-warning/25",
        iconClass: "bg-warning/20 text-warning-foreground",
    },
    {
        to: "/dashboard/water",
        label: "Water Tracker",
        text: "Track every glass you drink",
        icon: Droplets,
        className: "from-info/18 to-info/5 text-foreground ring-info/25",
        iconClass: "bg-info/20 text-info",
    },
];

export default function Dashboard() {
    const { user } = useAuth();

    const profileQuery = useQuery({
        queryKey: ["customer-profile"],
        queryFn: getCustomerProfile,
    });

    const videosQuery = useQuery({
        queryKey: ["my-personalized-videos"],
        queryFn: getMyPersonalizedVideos,
        retry: false,
    });

    const exercisesQuery = useQuery({
        queryKey: ["my-exercise-recommendations"],
        queryFn: getMyExerciseRecommendations,
        retry: false,
    });

    const profile = profileQuery.data;

    const profileFields = profile
        ? [
              profile.phone_number,
              profile.profession,
              profile.current_diet,
              profile.dietary_preference,
              profile.height_cm,
              profile.current_weight_kg,
              profile.target_weight_kg,
              profile.activity_level,
              profile.goals,
          ]
        : [];

    const completedFields = profileFields.filter(
        (field) => field !== null && field !== undefined && field !== "",
    ).length;

    const profileCompletion = profile
        ? Math.round((completedFields / profileFields.length) * 100)
        : 0;

    const videos = videosQuery.data ?? [];
    const exercises = exercisesQuery.data ?? [];

    const activeExercises = exercises.filter(
        (item) => item.status === "ACTIVE",
    );

    const weightGap =
        profile?.current_weight_kg && profile?.target_weight_kg
            ? Number(profile.current_weight_kg) -
              Number(profile.target_weight_kg)
            : null;

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Your dashboard"
                title={`Welcome, ${user?.first_name || user?.username}`}
                description="Your personalised videos, exercises and daily trackers — all in one place."
                actions={
                    <ButtonLink
                        to="/dashboard/profile"
                        variant={
                            profileCompletion === 100 ? "outline" : "primary"
                        }
                    >
                        {profileCompletion === 100
                            ? "Edit profile"
                            : "Complete profile"}
                        <ArrowRight />
                    </ButtonLink>
                }
            />

            {/* Profile completion */}
            {profileQuery.isLoading ? (
                <LoadingBlock
                    label="Loading your information..."
                    className="min-h-[120px]"
                />
            ) : (
                <Card className="overflow-hidden">
                    <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-muted-foreground">
                                Profile completion
                            </p>

                            <p className="mt-1 text-3xl font-semibold tabular-nums">
                                {profileCompletion}%
                            </p>

                            <p className="mt-1 text-sm text-muted-foreground">
                                {profileCompletion === 100
                                    ? "All set. Your dietician has everything needed."
                                    : "A complete profile helps your dietician plan better."}
                            </p>
                        </div>

                        <div className="w-full sm:max-w-xs">
                            <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{ width: `${profileCompletion}%` }}
                                />
                            </div>

                            <Link
                                to="/dashboard/profile"
                                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                            >
                                Update profile
                                <ArrowUpRight className="size-4" />
                            </Link>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    icon={<Scale />}
                    label="Current weight"
                    value={
                        profile?.current_weight_kg
                            ? `${profile.current_weight_kg} kg`
                            : "—"
                    }
                    sub={
                        weightGap !== null
                            ? `${Math.abs(weightGap).toFixed(1)} kg ${
                                  weightGap > 0 ? "to lose" : "to gain"
                              }`
                            : "Add it in your profile"
                    }
                />

                <StatCard
                    icon={<Target />}
                    label="Target weight"
                    tone="success"
                    value={
                        profile?.target_weight_kg
                            ? `${profile.target_weight_kg} kg`
                            : "—"
                    }
                    sub="Your goal"
                />

                <StatCard
                    icon={<Ruler />}
                    label="Height"
                    tone="info"
                    value={profile?.height_cm ? `${profile.height_cm} cm` : "—"}
                    sub="Used for BMI and targets"
                />

                <StatCard
                    icon={<Activity />}
                    label="Activity level"
                    tone="warning"
                    value={
                        <span className="text-xl">
                            {titleCase(profile?.activity_level) || "—"}
                        </span>
                    }
                    sub={
                        profile?.dietary_preference
                            ? titleCase(profile.dietary_preference)
                            : "Set your preference"
                    }
                />
            </div>

            {/* Personalized videos */}
            <section>
                <PageHeader
                    title="Personalised videos"
                    description="Videos your dietician selected just for you."
                    actions={
                        videos.length > 0 && (
                            <ButtonLink
                                to="/dashboard/videos"
                                variant="outline"
                                size="sm"
                            >
                                See all
                                <ArrowRight />
                            </ButtonLink>
                        )
                    }
                />

                <div className="mt-5">
                    {videosQuery.isLoading && <CardSkeleton count={3} />}

                    {videosQuery.isError && (
                        <ApiErrorState
                            error={videosQuery.error}
                            title="Unable to load your videos"
                            upgradeProductCode={PERSONALIZED_VIDEOS_CODE}
                            onRetry={() => videosQuery.refetch()}
                            isRetrying={videosQuery.isFetching}
                        />
                    )}

                    {!videosQuery.isLoading &&
                        !videosQuery.isError &&
                        videos.length === 0 && (
                            <EmptyState
                                icon={<Video />}
                                title="No personalised videos yet"
                                description="Your dietician has not assigned any videos so far. Meanwhile, watch the public videos on the homepage."
                                action={
                                    <ButtonLink to="/" variant="outline">
                                        Browse public videos
                                    </ButtonLink>
                                }
                            />
                        )}

                    {videos.length > 0 && (
                        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {videos.slice(0, 3).map((video) => (
                                <VideoCard
                                    key={video.id}
                                    title={video.video_title}
                                    videoUrl={video.video_url}
                                    note={video.notes}
                                    badge={
                                        <StatusBadge value={video.status} />
                                    }
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Exercises */}
            <section>
                <PageHeader
                    title="Your exercises"
                    description="Routines matched to your fitness level and goals."
                    actions={
                        exercises.length > 0 && (
                            <ButtonLink
                                to="/dashboard/exercises"
                                variant="outline"
                                size="sm"
                            >
                                See all
                                <ArrowRight />
                            </ButtonLink>
                        )
                    }
                />

                <div className="mt-5">
                    {exercisesQuery.isLoading && <CardSkeleton count={3} />}

                    {!exercisesQuery.isLoading && exercises.length === 0 && (
                        <EmptyState
                            icon={<Dumbbell />}
                            title="No exercises assigned yet"
                            description="Your dietician will add personalised exercises here."
                        />
                    )}

                    {activeExercises.length > 0 && (
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {activeExercises.slice(0, 3).map((item) => (
                                <Card key={item.id} className="flex flex-col">
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

                                        <StatusBadge
                                            value={item.exercise_difficulty}
                                        />
                                    </CardHeader>

                                    <CardBody className="flex flex-1 flex-col gap-4">
                                        {item.exercise_description && (
                                            <p className="line-clamp-3 text-sm text-muted-foreground">
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
                                                <Badge>
                                                    {item.sets} sets
                                                </Badge>
                                            )}

                                            {item.reps && (
                                                <Badge>
                                                    {item.reps} reps
                                                </Badge>
                                            )}
                                        </div>

                                        {item.exercise_video_url && (
                                            <a
                                                href={item.exercise_video_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary hover:underline"
                                            >
                                                Watch exercise
                                                <ExternalLink className="size-3.5" />
                                            </a>
                                        )}
                                    </CardBody>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Diet details */}
            {profile && (
                <section>
                    <PageHeader
                        title="Your details"
                        description="What your dietician uses to build your plan."
                    />

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Salad className="size-4.5 text-primary" />
                                    Diet profile
                                </CardTitle>
                            </CardHeader>

                            <CardBody className="grid gap-4 sm:grid-cols-2">
                                <DetailRow
                                    label="Dietary preference"
                                    value={titleCase(
                                        profile.dietary_preference,
                                    )}
                                />

                                <DetailRow
                                    label="Current diet"
                                    value={profile.current_diet}
                                />

                                <DetailRow
                                    label="Profession"
                                    value={profile.profession}
                                />

                                <DetailRow
                                    label="Phone"
                                    value={profile.phone_number}
                                />
                            </CardBody>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="size-4.5 text-primary" />
                                    Goals & restrictions
                                </CardTitle>
                            </CardHeader>

                            <CardBody className="grid gap-4">
                                <DetailRow
                                    label="Goals"
                                    value={profile.goals}
                                />

                                <DetailRow
                                    label="Allergies"
                                    value={profile.allergies}
                                />

                                <DetailRow
                                    label="Food dislikes"
                                    value={profile.food_dislikes}
                                />
                            </CardBody>
                        </Card>
                    </div>
                </section>
            )}

            {/* Trackers — bottom card buttons */}
            <section>
                <PageHeader
                    title="Daily trackers"
                    description="Keep your numbers honest. Tap a card to open the tracker."
                />

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    {trackerCards.map((tracker) => (
                        <Link
                            key={tracker.to}
                            to={tracker.to}
                            className={`group flex items-center gap-4 rounded-2xl bg-gradient-to-br p-5 ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:p-6 ${tracker.className}`}
                        >
                            <span
                                className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${tracker.iconClass}`}
                            >
                                <tracker.icon className="size-7" />
                            </span>

                            <span className="min-w-0 flex-1">
                                <span className="block text-base font-semibold">
                                    {tracker.label}
                                </span>

                                <span className="mt-0.5 block text-sm text-muted-foreground">
                                    {tracker.text}
                                </span>
                            </span>

                            <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
}

function DetailRow({
    label,
    value,
}: {
    label: string;
    value?: string | null;
}) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>

            <p className="mt-1 whitespace-pre-wrap text-sm">
                {value || "Not added"}
            </p>
        </div>
    );
}
