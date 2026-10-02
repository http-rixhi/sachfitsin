import { useQuery } from "@tanstack/react-query";
import { PlayCircle, Sparkles } from "lucide-react";

import { VideoCard } from "@/components/cards";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import { PERSONALIZED_VIDEOS_CODE } from "@/services/products";
import {
    CardSkeleton,
    EmptyState,
} from "@/components/ui/states";
import {
    getMyPersonalizedVideos,
    getPublicVideos,
} from "@/services/videos";

export default function Videos() {
    const publicVideos = useQuery({
        queryKey: ["public-videos"],
        queryFn: getPublicVideos,
    });

    const personalizedVideos = useQuery({
        queryKey: ["my-personalized-videos"],
        queryFn: getMyPersonalizedVideos,
        retry: false,
    });

    const personalized = personalizedVideos.data ?? [];

    return (
        <div className="space-y-10">
            <PageHeader
                eyebrow="Watch"
                title="Videos"
                description="Learn from your dietician and watch the videos picked for your plan."
            />

            {/* Personalised first — it is the reason to be here */}
            <section>
                <PageHeader
                    title="Personalised for you"
                    description="Chosen by your dietician for your diet and goals."
                />

                <div className="mt-5">
                    {personalizedVideos.isLoading && (
                        <CardSkeleton count={3} />
                    )}

                    {personalizedVideos.isError && (
                        <ApiErrorState
                            error={personalizedVideos.error}
                            title="Unable to load your videos"
                            upgradeProductCode={PERSONALIZED_VIDEOS_CODE}
                            onRetry={() => personalizedVideos.refetch()}
                            isRetrying={personalizedVideos.isFetching}
                        />
                    )}

                    {!personalizedVideos.isLoading &&
                        !personalizedVideos.isError &&
                        personalized.length === 0 && (
                            <EmptyState
                                icon={<Sparkles />}
                                title="Nothing assigned yet"
                                description="Your dietician has not assigned any personalised videos so far."
                            />
                        )}

                    {personalized.length > 0 && (
                        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {personalized.map((video) => (
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

            {/* Public library */}
            <section>
                <PageHeader
                    title="Educational videos"
                    description="Free nutrition and wellness content, open to everyone."
                    actions={
                        <ButtonLink to="/" variant="outline" size="sm">
                            See on the public site
                        </ButtonLink>
                    }
                />

                <div className="mt-5">
                    {publicVideos.isLoading && <CardSkeleton count={3} />}

                    {publicVideos.isError && (
                        <ApiErrorState
                            error={publicVideos.error}
                            title="Unable to load videos"
                            onRetry={() => publicVideos.refetch()}
                            isRetrying={publicVideos.isFetching}
                        />
                    )}

                    {!publicVideos.isLoading &&
                        !publicVideos.isError &&
                        publicVideos.data?.length === 0 && (
                            <EmptyState
                                icon={<PlayCircle />}
                                title="No educational videos yet"
                                description="New videos will appear here as they are published."
                            />
                        )}

                    {publicVideos.data && publicVideos.data.length > 0 && (
                        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {publicVideos.data.map((video) => (
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
            </section>
        </div>
    );
}
