import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    ExternalLink,
    Globe,
    Lock,
    Pencil,
    Play,
    Plus,
    Power,
    Search,
    Video as VideoIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
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
    createVideo,
    getVideoLibrary,
    updateVideo,
    type CreateVideoData,
    type Video,
} from "@/services/videos";
import { posterUrl } from "@/lib/video";
import { cn, titleCase } from "@/lib/utils";

const NO_VIDEOS: Video[] = [];

const emptyForm: CreateVideoData = {
    title: "",
    description: "",
    category: "",
    video_url: "",
    thumbnail_url: "",
    is_public: true,
    is_active: true,
};

type Filter = "ALL" | "PUBLIC" | "PRIVATE" | "INACTIVE";

const filters: Array<{ id: Filter; label: string }> = [
    { id: "ALL", label: "All" },
    { id: "PUBLIC", label: "Public" },
    { id: "PRIVATE", label: "Private" },
    { id: "INACTIVE", label: "Inactive" },
];

export default function Videos() {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [isOpen, setIsOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);
    const [form, setForm] = useState<CreateVideoData>(emptyForm);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("ALL");

    const videosQuery = useQuery({
        queryKey: ["admin", "videos"],
        queryFn: getVideoLibrary,
    });

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "videos"] });

    const createMutation = useMutation({
        mutationFn: createVideo,
        onSuccess: () => {
            invalidate();
            notify("Video added to the library.", "success");
            closeModal();
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: number;
            data: Partial<CreateVideoData>;
        }) => updateVideo(id, data),
        onSuccess: () => {
            invalidate();
            closeModal();
        },
    });

    function closeModal() {
        setIsOpen(false);
        setEditingVideo(null);
        setForm(emptyForm);
    }

    function openCreate() {
        setEditingVideo(null);
        setForm(emptyForm);
        setIsOpen(true);
    }

    function openEdit(video: Video) {
        setEditingVideo(video);

        setForm({
            title: video.title,
            description: video.description,
            category: video.category,
            video_url: video.video_url,
            thumbnail_url: video.thumbnail_url,
            is_public: video.is_public,
            is_active: video.is_active,
        });

        setIsOpen(true);
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (editingVideo) {
            updateMutation.mutate({ id: editingVideo.id, data: form });
        } else {
            createMutation.mutate(form);
        }
    }

    function toggleStatus(video: Video) {
        updateMutation.mutate({
            id: video.id,
            data: { is_active: !video.is_active },
        });
    }

    const videos = videosQuery.data ?? NO_VIDEOS;

    const categories = useMemo(() => {
        return Array.from(
            new Set(videos.map((video) => video.category).filter(Boolean)),
        );
    }, [videos]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return videos.filter((video) => {
            const matchesFilter =
                filter === "ALL" ||
                (filter === "PUBLIC" && video.is_public && video.is_active) ||
                (filter === "PRIVATE" &&
                    !video.is_public &&
                    video.is_active) ||
                (filter === "INACTIVE" && !video.is_active);

            const matchesQuery =
                !query ||
                video.title.toLowerCase().includes(query) ||
                video.description?.toLowerCase().includes(query) ||
                video.category?.toLowerCase().includes(query);

            return matchesFilter && matchesQuery;
        });
    }, [videos, filter, search]);

    const isSaving =
        createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Library"
                title="Video Library"
                description="Public videos appear on the homepage. Private ones can be assigned to individual customers."
                actions={
                    <Button onClick={openCreate}>
                        <Plus />
                        Add video
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
                        placeholder="Search videos..."
                        aria-label="Search videos"
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

            {videosQuery.isLoading && <CardSkeleton />}

            {videosQuery.isError && (
                <ApiErrorState
                    error={videosQuery.error}
                    title="Unable to load the video library"
                    onRetry={() => videosQuery.refetch()}
                    isRetrying={videosQuery.isFetching}
                />
            )}

            {!videosQuery.isLoading &&
                !videosQuery.isError &&
                filtered.length === 0 && (
                    <EmptyState
                        icon={<VideoIcon />}
                        title={
                            videos.length === 0
                                ? "No videos yet"
                                : "No videos match your filters"
                        }
                        description={
                            videos.length === 0
                                ? "Add your first video to the library."
                                : "Try a different search word or filter."
                        }
                        action={
                            videos.length === 0 ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    Add your first video
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
                    {filtered.map((video) => {
                        const poster = posterUrl(
                            video.video_url,
                            video.thumbnail_url,
                        );

                        return (
                            <Card
                                key={video.id}
                                className={cn(
                                    "flex flex-col overflow-hidden transition hover:shadow-[var(--shadow-lift)]",
                                    !video.is_active && "opacity-65",
                                )}
                            >
                                <div className="relative aspect-video bg-foreground/90">
                                    {poster ? (
                                        <img
                                            src={poster}
                                            alt={video.title}
                                            loading="lazy"
                                            className="size-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/80 to-primary/50">
                                            <Play className="size-8 fill-current text-primary-foreground" />
                                        </div>
                                    )}

                                    <div className="absolute left-3 top-3 flex gap-2">
                                        <Badge
                                            tone={
                                                video.is_public
                                                    ? "success"
                                                    : "neutral"
                                            }
                                        >
                                            {video.is_public ? (
                                                <Globe className="size-3" />
                                            ) : (
                                                <Lock className="size-3" />
                                            )}
                                            {video.is_public
                                                ? "Public"
                                                : "Private"}
                                        </Badge>

                                        {!video.is_active && (
                                            <Badge tone="danger">
                                                Inactive
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-1 flex-col gap-3 p-5">
                                    {video.category && (
                                        <Badge tone="primary" className="w-fit">
                                            {titleCase(video.category)}
                                        </Badge>
                                    )}

                                    <h3 className="text-base font-semibold leading-snug">
                                        {video.title}
                                    </h3>

                                    {video.description && (
                                        <p className="line-clamp-2 text-sm text-muted-foreground">
                                            {video.description}
                                        </p>
                                    )}

                                    <div className="mt-auto flex items-center gap-2 pt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEdit(video)}
                                        >
                                            <Pencil />
                                            Edit
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleStatus(video)}
                                            title={
                                                video.is_active
                                                    ? "Deactivate"
                                                    : "Activate"
                                            }
                                        >
                                            <Power />
                                            {video.is_active
                                                ? "Disable"
                                                : "Enable"}
                                        </Button>

                                        {video.video_url && (
                                            <a
                                                href={video.video_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                aria-label="Open video"
                                                className="ml-auto rounded-lg border border-border p-2 text-muted-foreground transition hover:text-primary"
                                            >
                                                <ExternalLink className="size-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <Modal
                open={isOpen}
                onClose={closeModal}
                title={editingVideo ? "Edit video" : "Add a video"}
                description="Videos marked public are visible to everyone on the homepage."
                footer={
                    <>
                        <Button variant="outline" onClick={closeModal}>
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="video-form"
                            disabled={isSaving}
                        >
                            {isSaving && (
                                <Spinner className="size-4 text-primary-foreground" />
                            )}
                            {editingVideo ? "Save changes" : "Add video"}
                        </Button>
                    </>
                }
            >
                <form
                    id="video-form"
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <Field label="Title" htmlFor="video-title" required>
                        <Input
                            id="video-title"
                            value={form.title}
                            onChange={(event) =>
                                setForm({ ...form, title: event.target.value })
                            }
                            placeholder="e.g. How to read a food label"
                            required
                        />
                    </Field>

                    <Field
                        label="Video URL"
                        htmlFor="video-url"
                        hint="YouTube and Vimeo links play inline on the site."
                        required
                    >
                        <Input
                            id="video-url"
                            type="url"
                            value={form.video_url}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    video_url: event.target.value,
                                })
                            }
                            placeholder="https://youtube.com/watch?v=..."
                            required
                        />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Category" htmlFor="video-category">
                            <Input
                                id="video-category"
                                list="video-categories"
                                value={form.category}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        category: event.target.value,
                                    })
                                }
                                placeholder="Nutrition"
                            />

                            <datalist id="video-categories">
                                {categories.map((category) => (
                                    <option key={category} value={category} />
                                ))}
                            </datalist>
                        </Field>

                        <Field
                            label="Thumbnail URL"
                            htmlFor="video-thumb"
                            hint="Optional — YouTube thumbnails are automatic."
                        >
                            <Input
                                id="video-thumb"
                                type="url"
                                value={form.thumbnail_url}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        thumbnail_url: event.target.value,
                                    })
                                }
                                placeholder="https://..."
                            />
                        </Field>
                    </div>

                    <Field label="Description" htmlFor="video-description">
                        <Textarea
                            id="video-description"
                            value={form.description}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    description: event.target.value,
                                })
                            }
                            placeholder="What will the viewer learn?"
                        />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Switch
                            id="video-public"
                            checked={form.is_public}
                            onChange={(checked) =>
                                setForm({ ...form, is_public: checked })
                            }
                            label="Public"
                            description="Show on the homepage to everyone"
                        />

                        <Switch
                            id="video-active"
                            checked={form.is_active}
                            onChange={(checked) =>
                                setForm({ ...form, is_active: checked })
                            }
                            label="Active"
                            description="Available for assigning and viewing"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
}
