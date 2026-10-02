import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    BookOpen,
    Droplets,
    Flame,
    HeartPulse,
    PlayCircle,
    Search,
    Sparkles,
    Utensils,
} from "lucide-react";

import { ArticleCard, VideoCard } from "@/components/cards";
import { DashboardLink } from "@/components/DashboardLink";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    CardSkeleton,
    EmptyState,
} from "@/components/ui/states";
import { useAuth } from "@/contexts/auth-context";
import { getPublicContent } from "@/services/content";
import type { Content } from "@/services/content";
import { getPublicVideos, type Video } from "@/services/videos";
import { cn, titleCase } from "@/lib/utils";

const NO_ARTICLES: Content[] = [];
const NO_VIDEOS: Video[] = [];

const highlights = [
    {
        icon: Utensils,
        title: "Personalised diet plans",
        text: "Plans built around your body, routine and food preferences.",
    },
    {
        icon: Flame,
        title: "Calorie tracking",
        text: "Log meals and see how each day adds up against your target.",
    },
    {
        icon: Droplets,
        title: "Water tracking",
        text: "A simple daily habit that makes the biggest difference.",
    },
    {
        icon: HeartPulse,
        title: "Guided exercises",
        text: "Safe routines matched to your fitness level and goals.",
    },
];

export default function Home() {
    const { isAuthenticated, user } = useAuth();

    const [search, setSearch] = useState("");
    const [articleFilter, setArticleFilter] = useState("ALL");

    const articlesQuery = useQuery({
        queryKey: ["public-content"],
        queryFn: getPublicContent,
    });

    const videosQuery = useQuery({
        queryKey: ["public-videos"],
        queryFn: getPublicVideos,
    });

    const articles = articlesQuery.data ?? NO_ARTICLES;
    const videos = videosQuery.data ?? NO_VIDEOS;

    const articleTypes = useMemo(() => {
        const types = new Set(articles.map((item) => item.content_type));

        return ["ALL", ...Array.from(types)];
    }, [articles]);

    const query = search.trim().toLowerCase();

    const filteredArticles = useMemo(() => {
        return articles.filter((item) => {
            const matchesType =
                articleFilter === "ALL" ||
                item.content_type === articleFilter;

            const matchesQuery =
                !query ||
                item.title.toLowerCase().includes(query) ||
                item.excerpt?.toLowerCase().includes(query);

            return matchesType && matchesQuery;
        });
    }, [articles, articleFilter, query]);

    const filteredVideos = useMemo(() => {
        return videos.filter((video) => {
            return (
                !query ||
                video.title.toLowerCase().includes(query) ||
                video.description?.toLowerCase().includes(query) ||
                video.category?.toLowerCase().includes(query)
            );
        });
    }, [videos, query]);

    const [featured, ...restArticles] = filteredArticles;

    return (
        <div>
            {/* Hero */}
            <section className="relative overflow-hidden border-b border-border bg-surface">
                <div
                    aria-hidden
                    className="pointer-events-none absolute -right-24 -top-32 size-[28rem] rounded-full bg-primary/10 blur-3xl"
                />

                <div
                    aria-hidden
                    className="pointer-events-none absolute -bottom-40 -left-32 size-[24rem] rounded-full bg-info/10 blur-3xl"
                />

                <div className="app-container relative py-14 sm:py-20 lg:py-24">
                    <div className="grid items-center gap-12 lg:grid-cols-12">
                        <div className="lg:col-span-7">
                            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground">
                                <Sparkles className="size-3.5" />
                                Nutrition made simple
                            </span>

                            <h1 className="mt-5 text-3xl leading-[1.12] sm:text-4xl lg:text-[3.25rem]">
                                {isAuthenticated ? (
                                    <>
                                        Welcome back,{" "}
                                        <span className="text-primary">
                                            {user?.first_name || user?.username}
                                        </span>
                                        . Here is today's reading.
                                    </>
                                ) : (
                                    <>
                                        Eat better, move better,{" "}
                                        <span className="text-primary">
                                            feel better
                                        </span>
                                        .
                                    </>
                                )}
                            </h1>

                            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                                Free articles and videos from our dietician, plus
                                personalised plans, exercises and daily trackers
                                once you sign in.
                            </p>

                            <div className="mt-8 flex flex-wrap items-center gap-3">
                                {isAuthenticated ? (
                                    <DashboardLink
                                        className="h-12 rounded-xl bg-primary px-6 text-[0.9375rem] font-medium text-primary-foreground shadow-[var(--shadow-card)] transition hover:brightness-110"
                                        activeClassName=""
                                    >
                                        Go to dashboard
                                        <ArrowRight className="size-4" />
                                    </DashboardLink>
                                ) : (
                                    <>
                                        <ButtonLink to="/register" size="lg">
                                            Create free account
                                            <ArrowRight />
                                        </ButtonLink>

                                        <ButtonLink
                                            to="/login"
                                            size="lg"
                                            variant="outline"
                                        >
                                            I already have an account
                                        </ButtonLink>
                                    </>
                                )}
                            </div>

                            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
                                <div>
                                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Articles
                                    </dt>

                                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                                        {articles.length}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Videos
                                    </dt>

                                    <dd className="mt-1 text-2xl font-semibold tabular-nums">
                                        {videos.length}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Cost
                                    </dt>

                                    <dd className="mt-1 text-2xl font-semibold">
                                        Free
                                    </dd>
                                </div>
                            </dl>
                        </div>

                        <div className="lg:col-span-5">
                            <div className="grid gap-4 sm:grid-cols-2">
                                {highlights.map(({ icon: Icon, title, text }) => (
                                    <div
                                        key={title}
                                        className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                                    >
                                        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                            <Icon className="size-5" />
                                        </span>

                                        <h3 className="mt-4 text-sm font-semibold">
                                            {title}
                                        </h3>

                                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                                            {text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Search */}
            <div className="border-b border-border bg-background">
                <div className="app-container py-5">
                    <div className="relative mx-auto max-w-2xl">
                        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search articles and videos..."
                            aria-label="Search articles and videos"
                            className="pl-11"
                        />
                    </div>
                </div>
            </div>

            {/* Articles */}
            <section id="articles" className="app-container py-12 sm:py-16">
                <PageHeader
                    eyebrow="Read"
                    title="Latest articles"
                    description="Nutrition, fitness and healthy-habit guides written by our dietician."
                    actions={
                        articles.length > 0 && (
                            <ButtonLink
                                to="/content"
                                variant="outline"
                                size="sm"
                            >
                                View all
                                <ArrowRight />
                            </ButtonLink>
                        )
                    }
                />

                {articleTypes.length > 2 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                        {articleTypes.map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setArticleFilter(type)}
                                className={cn(
                                    "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                                    articleFilter === type
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                )}
                            >
                                {type === "ALL" ? "All" : titleCase(type)}
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-8">
                    {articlesQuery.isLoading && <CardSkeleton />}

                    {articlesQuery.isError && (
                        <ApiErrorState
                            error={articlesQuery.error}
                            title="Unable to load articles"
                            onRetry={() => articlesQuery.refetch()}
                            isRetrying={articlesQuery.isFetching}
                        />
                    )}

                    {!articlesQuery.isLoading &&
                        !articlesQuery.isError &&
                        filteredArticles.length === 0 && (
                            <EmptyState
                                icon={<BookOpen />}
                                title={
                                    query || articleFilter !== "ALL"
                                        ? "No articles match your search"
                                        : "No articles published yet"
                                }
                                description={
                                    query || articleFilter !== "ALL"
                                        ? "Try a different word or clear the filters."
                                        : "New nutrition guides will appear here soon."
                                }
                                action={
                                    (query || articleFilter !== "ALL") && (
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setSearch("");
                                                setArticleFilter("ALL");
                                            }}
                                        >
                                            Clear filters
                                        </Button>
                                    )
                                }
                            />
                        )}

                    {filteredArticles.length > 0 && (
                        <div className="space-y-6">
                            {featured && (
                                <ArticleCard article={featured} featured />
                            )}

                            {restArticles.length > 0 && (
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {restArticles.map((article) => (
                                        <ArticleCard
                                            key={article.id}
                                            article={article}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* Videos */}
            <section
                id="videos"
                className="scroll-mt-20 border-t border-border bg-surface py-12 sm:py-16"
            >
                <div className="app-container">
                    <PageHeader
                        eyebrow="Watch"
                        title="Public videos"
                        description="Short, practical videos you can watch without an account."
                    />

                    <div className="mt-8">
                        {videosQuery.isLoading && <CardSkeleton />}

                        {videosQuery.isError && (
                            <ApiErrorState
                                error={videosQuery.error}
                                title="Unable to load videos"
                                onRetry={() => videosQuery.refetch()}
                                isRetrying={videosQuery.isFetching}
                            />
                        )}

                        {!videosQuery.isLoading &&
                            !videosQuery.isError &&
                            filteredVideos.length === 0 && (
                                <EmptyState
                                    icon={<PlayCircle />}
                                    title={
                                        query
                                            ? "No videos match your search"
                                            : "No public videos yet"
                                    }
                                    description={
                                        query
                                            ? "Try a different word."
                                            : "Educational videos will be published here soon."
                                    }
                                />
                            )}

                        {filteredVideos.length > 0 && (
                            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {filteredVideos.map((video) => (
                                    <VideoCard
                                        key={video.id}
                                        title={video.title}
                                        description={video.description}
                                        category={video.category}
                                        videoUrl={video.video_url}
                                        thumbnailUrl={video.thumbnail_url}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* CTA */}
            {!isAuthenticated && (
                <section className="app-container py-12 sm:py-16">
                    <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-accent px-6 py-12 text-center sm:px-12">
                        <div
                            aria-hidden
                            className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/15 blur-2xl"
                        />

                        <div className="relative">
                            <h2 className="text-2xl sm:text-3xl">
                                Ready for a plan made for you?
                            </h2>

                            <p className="mx-auto mt-3 max-w-xl text-sm text-accent-foreground/80 sm:text-base">
                                Create a free account to unlock your dashboard —
                                personalised videos, exercises, calorie and water
                                tracking, all in one place.
                            </p>

                            <div className="mt-7 flex flex-wrap justify-center gap-3">
                                <ButtonLink to="/register" size="lg">
                                    Create free account
                                    <ArrowRight />
                                </ButtonLink>

                                <ButtonLink
                                    to="/login"
                                    size="lg"
                                    variant="outline"
                                >
                                    Login
                                </ButtonLink>
                            </div>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
