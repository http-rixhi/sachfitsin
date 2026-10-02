import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    BookOpen,
    Eye,
    EyeOff,
    ExternalLink,
    Pencil,
    Plus,
    Power,
    Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    EmptyState,
    LoadingBlock,
    Spinner,
} from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import {
    type AdminContent,
    type CreateContentData,
    createContent,
    getContentLibrary,
    updateContent,
} from "@/services/content";
import { cn, formatDate, titleCase } from "@/lib/utils";

const NO_CONTENT: AdminContent[] = [];

const emptyForm: CreateContentData = {
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    content_type: "ARTICLE",
    cover_image_url: "",
    is_public: true,
    is_active: true,
};

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);

type Filter = "ALL" | "LIVE" | "DRAFT" | "INACTIVE";

const filters: Array<{ id: Filter; label: string }> = [
    { id: "ALL", label: "All" },
    { id: "LIVE", label: "Live" },
    { id: "DRAFT", label: "Not public" },
    { id: "INACTIVE", label: "Inactive" },
];

export default function Content() {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContent, setEditingContent] =
        useState<AdminContent | null>(null);
    const [form, setForm] = useState<CreateContentData>(emptyForm);
    const [slugTouched, setSlugTouched] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("ALL");

    const contentQuery = useQuery({
        queryKey: ["admin", "content"],
        queryFn: getContentLibrary,
    });

    const content = contentQuery.data ?? NO_CONTENT;
    const { isLoading, isError } = contentQuery;

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "content"] });

    const createMutation = useMutation({
        mutationFn: createContent,
        onSuccess: () => {
            invalidate();
            queryClient.invalidateQueries({ queryKey: ["public-content"] });
            notify("Article saved.", "success");
            closeForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: number;
            data: Partial<CreateContentData>;
        }) => updateContent(id, data),
        onSuccess: () => {
            invalidate();
            queryClient.invalidateQueries({ queryKey: ["public-content"] });
            closeForm();
        },
    });

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingContent(null);
        setForm(emptyForm);
        setSlugTouched(false);
    };

    const openCreateForm = () => {
        setEditingContent(null);
        setForm(emptyForm);
        setSlugTouched(false);
        setIsFormOpen(true);
    };

    const openEditForm = (item: AdminContent) => {
        setEditingContent(item);

        setForm({
            title: item.title,
            slug: item.slug,
            excerpt: item.excerpt,
            body: item.body,
            content_type: item.content_type,
            cover_image_url: item.cover_image_url,
            is_public: item.is_public,
            is_active: item.is_active,
        });

        setSlugTouched(true);
        setIsFormOpen(true);
    };

    const handleChange = (
        field: keyof CreateContentData,
        value: string | boolean,
    ) => {
        setForm((previous) => ({ ...previous, [field]: value }));
    };

    const handleTitleChange = (value: string) => {
        setForm((previous) => ({
            ...previous,
            title: value,
            slug: slugTouched ? previous.slug : slugify(value),
        }));
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (editingContent) {
            updateMutation.mutate({ id: editingContent.id, data: form });
        } else {
            createMutation.mutate(form);
        }
    };

    const togglePublic = (item: AdminContent) => {
        updateMutation.mutate({
            id: item.id,
            data: { is_public: !item.is_public },
        });
    };

    const toggleActive = (item: AdminContent) => {
        updateMutation.mutate({
            id: item.id,
            data: { is_active: !item.is_active },
        });
    };

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return content.filter((item) => {
            const matchesFilter =
                filter === "ALL" ||
                (filter === "LIVE" && item.is_public && item.is_active) ||
                (filter === "DRAFT" && !item.is_public && item.is_active) ||
                (filter === "INACTIVE" && !item.is_active);

            const matchesQuery =
                !query ||
                item.title.toLowerCase().includes(query) ||
                item.slug.toLowerCase().includes(query) ||
                item.excerpt?.toLowerCase().includes(query);

            return matchesFilter && matchesQuery;
        });
    }, [content, filter, search]);

    const isSaving =
        createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Content"
                title="Articles & Resources"
                description="Everything here with 'Public' turned on shows on the homepage and the articles page."
                actions={
                    <Button onClick={openCreateForm}>
                        <Plus />
                        Write article
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
                        placeholder="Search articles..."
                        aria-label="Search articles"
                        className="pl-11"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {filters.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setFilter(item.id)}
                            className={cn(
                                "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                                filter === item.id
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading && <LoadingBlock label="Loading content..." />}

            {isError && (
                <ApiErrorState
                    error={contentQuery.error}
                    title="Unable to load content"
                    onRetry={() => contentQuery.refetch()}
                    isRetrying={contentQuery.isFetching}
                />
            )}

            {!isLoading && !isError && filtered.length === 0 && (
                <EmptyState
                    icon={<BookOpen />}
                    title={
                        content.length === 0
                            ? "No content yet"
                            : "No articles match your filters"
                    }
                    description={
                        content.length === 0
                            ? "Write your first educational article."
                            : "Try a different search word or filter."
                    }
                    action={
                        content.length === 0 ? (
                            <Button onClick={openCreateForm}>
                                <Plus />
                                Write your first article
                            </Button>
                        ) : (
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
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((item) => (
                        <Card
                            key={item.id}
                            className={cn(
                                "flex flex-col overflow-hidden transition hover:shadow-[var(--shadow-lift)]",
                                !item.is_active && "opacity-65",
                            )}
                        >
                            {item.cover_image_url ? (
                                <img
                                    src={item.cover_image_url}
                                    alt={item.title}
                                    loading="lazy"
                                    className="h-40 w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-40 w-full items-center justify-center bg-accent">
                                    <BookOpen className="size-9 text-accent-foreground/60" />
                                </div>
                            )}

                            <CardBody className="flex flex-1 flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone="primary">
                                        {titleCase(item.content_type)}
                                    </Badge>

                                    <Badge
                                        tone={
                                            item.is_public
                                                ? "success"
                                                : "neutral"
                                        }
                                    >
                                        {item.is_public ? "Public" : "Hidden"}
                                    </Badge>

                                    {!item.is_active && (
                                        <Badge tone="danger">Inactive</Badge>
                                    )}
                                </div>

                                <h3 className="text-base font-semibold leading-snug">
                                    {item.title}
                                </h3>

                                {item.excerpt && (
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {item.excerpt}
                                    </p>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    /{item.slug} ·{" "}
                                    {formatDate(
                                        item.published_at || item.created_at,
                                    )}
                                </p>

                                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEditForm(item)}
                                    >
                                        <Pencil />
                                        Edit
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => togglePublic(item)}
                                        title={
                                            item.is_public
                                                ? "Hide from the public site"
                                                : "Show on the public site"
                                        }
                                    >
                                        {item.is_public ? (
                                            <EyeOff />
                                        ) : (
                                            <Eye />
                                        )}
                                        {item.is_public ? "Hide" : "Publish"}
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleActive(item)}
                                    >
                                        <Power />
                                        {item.is_active
                                            ? "Disable"
                                            : "Enable"}
                                    </Button>

                                    {item.is_public && item.is_active && (
                                        <a
                                            href={`/content/${item.slug}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label="View on the public site"
                                            className="ml-auto rounded-lg border border-border p-2 text-muted-foreground transition hover:text-primary"
                                        >
                                            <ExternalLink className="size-4" />
                                        </a>
                                    )}
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={isFormOpen}
                onClose={closeForm}
                size="lg"
                title={editingContent ? "Edit article" : "Write an article"}
                description="Write in plain words. Line breaks are kept as they are."
                footer={
                    <>
                        <Button variant="outline" onClick={closeForm}>
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="content-form"
                            disabled={isSaving}
                        >
                            {isSaving && (
                                <Spinner className="size-4 text-primary-foreground" />
                            )}
                            {editingContent
                                ? "Save changes"
                                : "Create article"}
                        </Button>
                    </>
                }
            >
                <form
                    id="content-form"
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <Field label="Title" htmlFor="content-title" required>
                        <Input
                            id="content-title"
                            value={form.title}
                            onChange={(event) =>
                                handleTitleChange(event.target.value)
                            }
                            placeholder="e.g. 5 easy swaps for a lighter breakfast"
                            required
                        />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                            label="Slug"
                            htmlFor="content-slug"
                            hint="Used in the web address."
                            required
                        >
                            <Input
                                id="content-slug"
                                value={form.slug}
                                onChange={(event) => {
                                    setSlugTouched(true);
                                    handleChange("slug", event.target.value);
                                }}
                                placeholder="easy-breakfast-swaps"
                                required
                            />
                        </Field>

                        <Field label="Type" htmlFor="content-type">
                            <Select
                                id="content-type"
                                value={form.content_type}
                                onChange={(event) =>
                                    handleChange(
                                        "content_type",
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="ARTICLE">Article</option>
                                <option value="EDUCATIONAL">
                                    Educational
                                </option>
                                <option value="GENERAL">General</option>
                            </Select>
                        </Field>
                    </div>

                    <Field
                        label="Cover image URL"
                        htmlFor="content-cover"
                        hint="Optional. A wide image looks best."
                    >
                        <Input
                            id="content-cover"
                            type="url"
                            value={form.cover_image_url}
                            onChange={(event) =>
                                handleChange(
                                    "cover_image_url",
                                    event.target.value,
                                )
                            }
                            placeholder="https://..."
                        />
                    </Field>

                    <Field
                        label="Excerpt"
                        htmlFor="content-excerpt"
                        hint="One or two lines shown on the article card."
                    >
                        <Textarea
                            id="content-excerpt"
                            rows={3}
                            value={form.excerpt}
                            onChange={(event) =>
                                handleChange("excerpt", event.target.value)
                            }
                        />
                    </Field>

                    <Field label="Body" htmlFor="content-body" required>
                        <Textarea
                            id="content-body"
                            rows={12}
                            value={form.body}
                            onChange={(event) =>
                                handleChange("body", event.target.value)
                            }
                            placeholder="Write the full article here..."
                            required
                        />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Switch
                            id="content-public"
                            checked={form.is_public}
                            onChange={(checked) =>
                                handleChange("is_public", checked)
                            }
                            label="Public"
                            description="Show on the homepage and articles page"
                        />

                        <Switch
                            id="content-active"
                            checked={form.is_active}
                            onChange={(checked) =>
                                handleChange("is_active", checked)
                            }
                            label="Active"
                            description="Turn off to retire the article"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
}
