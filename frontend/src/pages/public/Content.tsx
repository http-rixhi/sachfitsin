import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";

import { ArticleCard } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    CardSkeleton,
    EmptyState,
} from "@/components/ui/states";
import {
    getPublicContent,
    type Content as ContentItem,
} from "@/services/content";
import { cn, titleCase } from "@/lib/utils";

const NO_CONTENT: ContentItem[] = [];

export default function Content() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");

    const contentQuery = useQuery({
        queryKey: ["public-content"],
        queryFn: getPublicContent,
    });

    const content = contentQuery.data ?? NO_CONTENT;
    const { isLoading, isError } = contentQuery;

    const types = useMemo(() => {
        return ["ALL", ...new Set(content.map((item) => item.content_type))];
    }, [content]);

    const query = search.trim().toLowerCase();

    const filtered = useMemo(() => {
        return content.filter((item) => {
            const matchesType =
                filter === "ALL" || item.content_type === filter;

            const matchesQuery =
                !query ||
                item.title.toLowerCase().includes(query) ||
                item.excerpt?.toLowerCase().includes(query);

            return matchesType && matchesQuery;
        });
    }, [content, filter, query]);

    return (
        <div>
            <div className="border-b border-border bg-surface">
                <div className="app-container py-12 sm:py-16">
                    <PageHeader
                        eyebrow="Health & Nutrition"
                        title="Articles & Resources"
                        description="Practical nutrition, fitness and healthy lifestyle guides from our dietician."
                    />

                    <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full max-w-md">
                            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                            <Input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search articles..."
                                aria-label="Search articles"
                                className="pl-11"
                            />
                        </div>

                        {types.length > 2 && (
                            <div className="flex flex-wrap gap-2">
                                {types.map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFilter(type)}
                                        className={cn(
                                            "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                                            filter === type
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                        )}
                                    >
                                        {type === "ALL"
                                            ? "All"
                                            : titleCase(type)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="app-container py-12 sm:py-14">
                {isLoading && <CardSkeleton count={6} />}

                {isError && (
                    <ApiErrorState
                        error={contentQuery.error}
                        title="Unable to load articles"
                        onRetry={() => contentQuery.refetch()}
                        isRetrying={contentQuery.isFetching}
                    />
                )}

                {!isLoading && !isError && filtered.length === 0 && (
                    <EmptyState
                        icon={<BookOpen />}
                        title={
                            query || filter !== "ALL"
                                ? "No articles match your search"
                                : "No articles available"
                        }
                        description={
                            query || filter !== "ALL"
                                ? "Try a different word or clear the filters."
                                : "New educational content will appear here soon."
                        }
                        action={
                            (query || filter !== "ALL") && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch("");
                                        setFilter("ALL");
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )
                        }
                    />
                )}

                {filtered.length > 0 && (
                    <>
                        <p className="mb-6 text-sm text-muted-foreground">
                            Showing {filtered.length} of {content.length}{" "}
                            article{content.length === 1 ? "" : "s"}
                        </p>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {filtered.map((article) => (
                                <ArticleCard
                                    key={article.id}
                                    article={article}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
