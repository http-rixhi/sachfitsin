import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    CalendarDays,
    Dumbbell,
    Plus,
    UserRound,
    Users,
    Utensils,
    Video,
} from "lucide-react";

import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { useAuth } from "@/contexts/auth-context";
import { getDieticianAppointments } from "@/services/appointments";
import { getContentLibrary } from "@/services/content";
import { getCustomers } from "@/services/customerManagement";
import { getDietPlans } from "@/services/dietPlans";
import { getExerciseLibrary } from "@/services/exercises";
import {
    getPersonalizedVideos,
    getVideoLibrary,
} from "@/services/videos";
import { formatDate } from "@/lib/utils";

const quickActions = [
    {
        to: "/admin/videos",
        label: "Add a video",
        text: "Grow the video library",
        icon: Video,
    },
    {
        to: "/admin/exercises",
        label: "Add an exercise",
        text: "Build the exercise library",
        icon: Dumbbell,
    },
    {
        to: "/admin/videos/personalized",
        label: "Assign a video",
        text: "Send a video to a customer",
        icon: UserRound,
    },
    {
        to: "/admin/content",
        label: "Write an article",
        text: "Publish to the public site",
        icon: BookOpen,
    },
];

/**
 * Every list endpoint returns a plain array, so the dashboard counts are
 * derived from the same data the detail pages already use.
 */
export default function Dashboard() {
    const { user } = useAuth();

    const results = useQueries({
        queries: [
            {
                queryKey: ["admin", "customers"],
                queryFn: getCustomers,
            },
            {
                queryKey: ["admin", "appointments"],
                queryFn: getDieticianAppointments,
            },
            {
                queryKey: ["admin", "diet-plans"],
                queryFn: getDietPlans,
            },
            {
                queryKey: ["admin", "videos"],
                queryFn: getVideoLibrary,
            },
            {
                queryKey: ["admin", "personalized-videos"],
                queryFn: () => getPersonalizedVideos(),
            },
            {
                queryKey: ["exercise-library"],
                queryFn: getExerciseLibrary,
            },
            {
                queryKey: ["admin", "content"],
                queryFn: getContentLibrary,
            },
        ],
    });

    const [
        customersQuery,
        appointmentsQuery,
        plansQuery,
        videosQuery,
        personalizedQuery,
        exercisesQuery,
        contentQuery,
    ] = results;

    const customers = customersQuery.data ?? [];
    const appointments = appointmentsQuery.data ?? [];
    const plans = plansQuery.data ?? [];
    const videos = videosQuery.data ?? [];
    const personalized = personalizedQuery.data ?? [];
    const exercises = exercisesQuery.data ?? [];
    const content = contentQuery.data ?? [];

    const upcomingAppointments = appointments.filter(
        (item) =>
            item.status === "PENDING" || item.status === "CONFIRMED",
    );

    const activePlans = plans.filter((plan) => plan.status === "ACTIVE");

    const publishedContent = content.filter(
        (item) => item.is_public && item.is_active,
    );

    const recentCustomers = [...customers]
        .sort(
            (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime(),
        )
        .slice(0, 5);

    const recentAssignments = personalized.slice(0, 5);

    const stats = [
        {
            label: "Customers",
            value: customers.length,
            sub: `${recentCustomers.length} newest shown below`,
            icon: <Users />,
            tone: "primary" as const,
            query: customersQuery,
            to: "/admin/customers",
        },
        {
            label: "Appointments",
            value: appointments.length,
            sub: `${upcomingAppointments.length} pending or confirmed`,
            icon: <CalendarDays />,
            tone: "info" as const,
            query: appointmentsQuery,
        },
        {
            label: "Active plans",
            value: activePlans.length,
            sub: `${plans.length} plan${plans.length === 1 ? "" : "s"} in total`,
            icon: <Utensils />,
            tone: "success" as const,
            query: plansQuery,
        },
        {
            label: "Videos",
            value: videos.length,
            sub: `${personalized.length} personalised assignment${
                personalized.length === 1 ? "" : "s"
            }`,
            icon: <Video />,
            tone: "warning" as const,
            query: videosQuery,
            to: "/admin/videos",
        },
    ];

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Admin"
                title={`Welcome, ${user?.first_name || user?.username}`}
                description="Manage your customers, library and published content."
                actions={
                    <ButtonLink to="/admin/customers">
                        <Users />
                        View customers
                    </ButtonLink>
                }
            />

            {/* Counts */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => {
                    const card = stat.query.isLoading ? (
                        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="mt-4 h-8 w-16" />
                            <Skeleton className="mt-3 h-3 w-32" />
                        </div>
                    ) : (
                        <StatCard
                            icon={stat.icon}
                            label={stat.label}
                            tone={stat.tone}
                            value={
                                stat.query.isError ? (
                                    <span className="text-lg text-muted-foreground">
                                        Unavailable
                                    </span>
                                ) : (
                                    stat.value
                                )
                            }
                            sub={
                                stat.query.isError
                                    ? "Could not load this number"
                                    : stat.sub
                            }
                        />
                    );

                    return stat.to && !stat.query.isLoading ? (
                        <Link
                            key={stat.label}
                            to={stat.to}
                            className="rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-primary/25"
                        >
                            {card}
                        </Link>
                    ) : (
                        <div key={stat.label}>{card}</div>
                    );
                })}
            </div>

            {/* Secondary counts */}
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    icon={<Dumbbell />}
                    tone="neutral"
                    label="Exercises in library"
                    value={exercisesQuery.isLoading ? "—" : exercises.length}
                    sub={`${
                        exercises.filter((item) => item.is_active).length
                    } active`}
                />

                <StatCard
                    icon={<BookOpen />}
                    tone="neutral"
                    label="Articles"
                    value={contentQuery.isLoading ? "—" : content.length}
                    sub={`${publishedContent.length} live on the public site`}
                />

                <StatCard
                    icon={<UserRound />}
                    tone="neutral"
                    label="Personalised videos"
                    value={
                        personalizedQuery.isLoading ? "—" : personalized.length
                    }
                    sub={`${
                        personalized.filter((item) => item.status === "ACTIVE")
                            .length
                    } active`}
                />
            </div>

            {/* Quick actions */}
            <section>
                <PageHeader
                    title="Quick actions"
                    description="Jump straight to what you do most."
                />

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {quickActions.map((action) => (
                        <Link
                            key={action.to}
                            to={action.to}
                            className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-lift)]"
                        >
                            <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                <action.icon className="size-5" />
                            </span>

                            <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold">
                                {action.label}
                                <Plus className="size-3.5 text-primary" />
                            </span>

                            <span className="mt-1 text-xs text-muted-foreground">
                                {action.text}
                            </span>
                        </Link>
                    ))}
                </div>
            </section>

            {/* Recent activity */}
            <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Newest customers</CardTitle>

                        <Link
                            to="/admin/customers"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                            View all
                            <ArrowRight className="size-4" />
                        </Link>
                    </CardHeader>

                    <CardBody className="p-0 sm:p-0">
                        {customersQuery.isLoading ? (
                            <div className="space-y-3 p-5">
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                            </div>
                        ) : recentCustomers.length === 0 ? (
                            <EmptyState
                                icon={<Users />}
                                title="No customers yet"
                                description="New sign-ups will appear here."
                                className="border-0 bg-transparent"
                            />
                        ) : (
                            <ul className="divide-y divide-border">
                                {recentCustomers.map((customer) => (
                                    <li key={customer.id}>
                                        <Link
                                            to={`/admin/customers/${customer.id}`}
                                            className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-secondary/60"
                                        >
                                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                                <UserRound className="size-4" />
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">
                                                    {`${customer.first_name} ${customer.last_name}`.trim() ||
                                                        customer.username}
                                                </span>

                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {customer.email}
                                                </span>
                                            </span>

                                            <span className="hidden text-xs text-muted-foreground sm:block">
                                                {formatDate(
                                                    customer.created_at,
                                                )}
                                            </span>

                                            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Recent video assignments</CardTitle>

                        <Link
                            to="/admin/videos/personalized"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                            View all
                            <ArrowRight className="size-4" />
                        </Link>
                    </CardHeader>

                    <CardBody className="p-0 sm:p-0">
                        {personalizedQuery.isLoading ? (
                            <div className="space-y-3 p-5">
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                                <Skeleton className="h-12" />
                            </div>
                        ) : recentAssignments.length === 0 ? (
                            <EmptyState
                                icon={<Video />}
                                title="No assignments yet"
                                description="Assign a video to a customer to see it here."
                                className="border-0 bg-transparent"
                            />
                        ) : (
                            <ul className="divide-y divide-border">
                                {recentAssignments.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex items-center gap-3 px-5 py-3.5"
                                    >
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                            <Video className="size-4" />
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {item.video_title}
                                            </span>

                                            <span className="block truncate text-xs text-muted-foreground">
                                                @{item.customer_username}
                                            </span>
                                        </span>

                                        <StatusBadge value={item.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardBody>
                </Card>
            </div>

            {appointmentsQuery.isError && (
                <Badge tone="warning">
                    Appointment count could not be loaded — check the
                    appointments API.
                </Badge>
            )}
        </div>
    );
}
