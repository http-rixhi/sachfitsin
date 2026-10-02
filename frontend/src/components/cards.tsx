import { useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowUpRight,
    BookOpen,
    Clock3,
    ExternalLink,
    Play,
    X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatDate, readingTime, titleCase } from "@/lib/utils";
import { embedUrl, posterUrl } from "@/lib/video";
import type { Content } from "@/services/content";

interface ArticleCardProps {
    article: Content;
    featured?: boolean;
    className?: string;
}

export function ArticleCard({
    article,
    featured = false,
    className,
}: ArticleCardProps) {
    return (
        <article
            className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
                featured && "md:flex-row",
                className,
            )}
        >
            <Link
                to={`/content/${article.slug}`}
                className={cn(
                    "relative block shrink-0 overflow-hidden bg-accent",
                    featured ? "md:w-[46%]" : "",
                )}
            >
                {article.cover_image_url ? (
                    <img
                        src={article.cover_image_url}
                        alt={article.title}
                        loading="lazy"
                        className={cn(
                            "w-full object-cover transition duration-500 group-hover:scale-[1.03]",
                            featured ? "h-56 md:h-full" : "h-48",
                        )}
                    />
                ) : (
                    <div
                        className={cn(
                            "flex w-full items-center justify-center bg-accent",
                            featured ? "h-56 md:h-full" : "h-48",
                        )}
                    >
                        <BookOpen className="size-10 text-accent-foreground/60" />
                    </div>
                )}
            </Link>

            <div
                className={cn(
                    "flex flex-1 flex-col p-5 sm:p-6",
                    featured && "md:justify-center md:p-8",
                )}
            >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="primary">
                        {titleCase(article.content_type)}
                    </Badge>

                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="size-3.5" />
                        {readingTime(article.body || article.excerpt)} min read
                    </span>
                </div>

                <h3
                    className={cn(
                        "font-semibold leading-snug",
                        featured ? "text-xl sm:text-2xl" : "text-lg",
                    )}
                >
                    <Link
                        to={`/content/${article.slug}`}
                        className="outline-none transition hover:text-primary focus-visible:text-primary"
                    >
                        {article.title}
                    </Link>
                </h3>

                {article.excerpt && (
                    <p
                        className={cn(
                            "mt-3 text-sm leading-relaxed text-muted-foreground",
                            featured ? "line-clamp-4" : "line-clamp-3",
                        )}
                    >
                        {article.excerpt}
                    </p>
                )}

                <div className="mt-5 flex items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-muted-foreground">
                        {formatDate(
                            article.published_at || article.created_at,
                        )}
                    </span>

                    <Link
                        to={`/content/${article.slug}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
                    >
                        Read article
                        <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                </div>
            </div>
        </article>
    );
}

interface VideoCardProps {
    title: string;
    description?: string;
    category?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    note?: string;
    badge?: React.ReactNode;
    className?: string;
}

export function VideoCard({
    title,
    description,
    category,
    videoUrl,
    thumbnailUrl,
    note,
    badge,
    className,
}: VideoCardProps) {
    const [isPlaying, setIsPlaying] = useState(false);

    const embed = embedUrl(videoUrl);
    const poster = posterUrl(videoUrl, thumbnailUrl);

    return (
        <article
            className={cn(
                "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
                className,
            )}
        >
            <div className="relative aspect-video w-full overflow-hidden bg-foreground/90">
                {isPlaying && embed ? (
                    <>
                        <iframe
                            src={embed}
                            title={title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="absolute inset-0 size-full"
                        />

                        <button
                            type="button"
                            onClick={() => setIsPlaying(false)}
                            aria-label="Close player"
                            className="absolute right-2 top-2 rounded-lg bg-foreground/60 p-1.5 text-background transition hover:bg-foreground/80"
                        >
                            <X className="size-4" />
                        </button>
                    </>
                ) : (
                    <>
                        {poster ? (
                            <img
                                src={poster}
                                alt={title}
                                loading="lazy"
                                className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                            />
                        ) : (
                            <div className="size-full bg-gradient-to-br from-primary/85 to-primary/55" />
                        )}

                        <div className="absolute inset-0 bg-foreground/20 transition group-hover:bg-foreground/30" />

                        {embed ? (
                            <button
                                type="button"
                                onClick={() => setIsPlaying(true)}
                                aria-label={`Play ${title}`}
                                className="absolute inset-0 flex items-center justify-center outline-none"
                            >
                                <span className="flex size-14 items-center justify-center rounded-full bg-background/95 text-primary shadow-[var(--shadow-lift)] transition group-hover:scale-110">
                                    <Play className="size-6 translate-x-0.5 fill-current" />
                                </span>
                            </button>
                        ) : (
                            <a
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Watch ${title}`}
                                className="absolute inset-0 flex items-center justify-center"
                            >
                                <span className="flex size-14 items-center justify-center rounded-full bg-background/95 text-primary shadow-[var(--shadow-lift)] transition group-hover:scale-110">
                                    <Play className="size-6 translate-x-0.5 fill-current" />
                                </span>
                            </a>
                        )}

                        {badge && (
                            <div className="absolute left-3 top-3">{badge}</div>
                        )}
                    </>
                )}
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5">
                {category && (
                    <Badge tone="primary" className="w-fit">
                        {titleCase(category)}
                    </Badge>
                )}

                <h3 className="text-base font-semibold leading-snug">
                    {title}
                </h3>

                {description && (
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {description}
                    </p>
                )}

                {note && (
                    <div className="rounded-xl border border-border bg-surface p-3 text-sm">
                        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                            Dietician's note
                        </p>

                        <p className="text-muted-foreground">{note}</p>
                    </div>
                )}

                <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-primary hover:underline"
                >
                    Open original
                    <ExternalLink className="size-3.5" />
                </a>
            </div>
        </article>
    );
}
