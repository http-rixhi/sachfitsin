import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CalendarDays, Clock3 } from "lucide-react";

import { ArticleCard } from "@/components/cards";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import {
    getPublicContent,
    getPublicContentDetail,
} from "@/services/content";
import { formatDate, readingTime, titleCase } from "@/lib/utils";
import { useSeo } from "@/lib/seo";

export default function ContentDetail() {
    const { slug } = useParams<{ slug: string }>();

    const {
        data: article,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ["public-content", slug],
        queryFn: () => getPublicContentDetail(slug!),
        enabled: Boolean(slug),
    });

    const { data: allArticles = [] } = useQuery({
        queryKey: ["public-content"],
        queryFn: getPublicContent,
    });

    const related = allArticles
        .filter((item) => item.slug !== slug)
        .slice(0, 3);

    // Runs on every render, including while the article is still loading,
    // because hooks cannot sit behind the early returns below.
    useSeo({
        title: article?.title ?? "Article",
        description:
            article?.excerpt ??
            "An article on nutrition and healthy eating from Sachfitsin.",
        path: `/content/${slug ?? ""}`,
    });

    if (isLoading) {
        return (
            <div className="app-container max-w-3xl py-12">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-8 h-10 w-3/4" />
                <Skeleton className="mt-4 h-5 w-1/2" />
                <Skeleton className="mt-8 h-72 rounded-2xl" />

                <div className="mt-8 space-y-3">
                    <Skeleton className="h-4" />
                    <Skeleton className="h-4" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            </div>
        );
    }

    if (isError || !article) {
        return (
            <div className="app-container flex min-h-[60dvh] flex-col items-center justify-center py-16 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                    <BookOpen className="size-6" />
                </span>

                <h1 className="mt-5 text-2xl">Article not found</h1>

                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    This article may have been unpublished or the link is
                    incorrect.
                </p>

                <ButtonLink to="/content" variant="outline" className="mt-6">
                    <ArrowLeft />
                    Back to articles
                </ButtonLink>
            </div>
        );
    }

    return (
        <div>
            <div className="border-b border-border bg-surface">
                <div className="app-container max-w-3xl py-10 sm:py-14">
                    <Link
                        to="/content"
                        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-primary"
                    >
                        <ArrowLeft className="size-4" />
                        Back to articles
                    </Link>

                    <Badge tone="primary" className="mt-6">
                        {titleCase(article.content_type)}
                    </Badge>

                    <h1 className="mt-4 text-3xl leading-tight sm:text-4xl">
                        {article.title}
                    </h1>

                    {article.excerpt && (
                        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                            {article.excerpt}
                        </p>
                    )}

                    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="size-4" />
                            {formatDate(
                                article.published_at || article.created_at,
                            )}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="size-4" />
                            {readingTime(article.body)} min read
                        </span>
                    </div>
                </div>
            </div>

            <article className="app-container max-w-3xl py-10 sm:py-14">
                {article.cover_image_url && (
                    <img
                        src={article.cover_image_url}
                        alt={article.title}
                        className="mb-10 max-h-[460px] w-full rounded-2xl border border-border object-cover shadow-[var(--shadow-card)]"
                    />
                )}

                <div className="prose-body whitespace-pre-wrap text-[1.0625rem] leading-[1.85] text-foreground/90">
                    {article.body}
                </div>
            </article>

            {related.length > 0 && (
                <section className="border-t border-border bg-surface py-12 sm:py-16">
                    <div className="app-container">
                        <h2 className="text-xl sm:text-2xl">
                            More to read
                        </h2>

                        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {related.map((item) => (
                                <ArticleCard key={item.id} article={item} />
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
