import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    Bell,
    BellOff,
    CalendarDays,
    CheckCheck,
    Dumbbell,
    RefreshCw,
    Sparkles,
    Trash2,
    UserRound,
    Utensils,
    Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/states";
import { errorMessage } from "@/lib/api-error";
import { useNow } from "@/lib/use-now";
import {
    deleteNotification,
    getNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    type AppNotification,
    type NotificationCategory,
} from "@/services/notifications";
import { cn } from "@/lib/utils";

const icons: Record<NotificationCategory, typeof Bell> = {
    ACCOUNT: UserRound,
    APPOINTMENT: CalendarDays,
    DIET_PLAN: Utensils,
    VIDEO: Video,
    EXERCISE: Dumbbell,
    CONTENT: Bell,
    SUBSCRIPTION: Sparkles,
    GENERAL: Bell,
};

/** "3 min ago", "2 days ago" — good enough without a date library. */
function timeAgo(value: string, now: number) {
    const seconds = Math.round((now - new Date(value).getTime()) / 1000);

    if (seconds < 60) {
        return "just now";
    }

    const steps: Array<[number, string]> = [
        [60, "min"],
        [3600, "hr"],
        [86400, "day"],
        [604800, "week"],
    ];

    for (let index = steps.length - 1; index >= 0; index -= 1) {
        const [unitSeconds, label] = steps[index];

        if (seconds >= unitSeconds) {
            const count = Math.floor(seconds / unitSeconds);

            return `${count} ${label}${count === 1 ? "" : "s"} ago`;
        }
    }

    return "just now";
}

export function NotificationBell() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [isOpen, setIsOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    const now = useNow();

    // Close on outside click and on Escape.
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [isOpen]);

    const notificationsQuery = useQuery({
        queryKey: ["notifications"],
        queryFn: () => getNotifications({ limit: 20 }),
        // Polling keeps the badge fresh without websockets.
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });

    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ["notifications"] });

    const markReadMutation = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: invalidate,
    });

    const markAllMutation = useMutation({
        mutationFn: markAllNotificationsRead,
        onSuccess: invalidate,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteNotification,
        onSuccess: invalidate,
    });

    const notifications = notificationsQuery.data?.results ?? [];
    const unreadCount = notificationsQuery.data?.unread_count ?? 0;

    const open = (notification: AppNotification) => {
        if (!notification.is_read) {
            markReadMutation.mutate(notification.id);
        }

        if (notification.link) {
            setIsOpen(false);
            navigate(notification.link);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((value) => !value)}
                aria-label={
                    unreadCount > 0
                        ? `Notifications, ${unreadCount} unread`
                        : "Notifications"
                }
                aria-expanded={isOpen}
                className={cn(
                    "relative flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition outline-none",
                    "hover:border-primary/40 hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/25",
                    isOpen && "border-primary/40 text-foreground",
                )}
            >
                <Bell className="size-[1.125rem]" />

                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground tabular-nums">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Notifications"
                    className={cn(
                        "absolute right-0 top-12 z-100 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-pop)]",
                        "animate-in fade-in slide-in-from-top-1",
                    )}
                >
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold">
                                Notifications
                            </p>

                            <p className="text-xs text-muted-foreground">
                                {unreadCount > 0
                                    ? `${unreadCount} unread`
                                    : "You are all caught up"}
                            </p>
                        </div>

                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAllMutation.mutate()}
                                disabled={markAllMutation.isPending}
                            >
                                <CheckCheck />
                                Mark all
                            </Button>
                        )}
                    </div>

                    <div className="max-h-[min(26rem,60dvh)] overflow-y-auto">
                        {notificationsQuery.isLoading && (
                            <div className="flex items-center justify-center gap-2.5 py-10">
                                <Spinner />

                                <p className="text-sm text-muted-foreground">
                                    Loading...
                                </p>
                            </div>
                        )}

                        {notificationsQuery.isError && (
                            <div className="px-4 py-8 text-center">
                                <p className="text-sm text-muted-foreground">
                                    {errorMessage(notificationsQuery.error)}
                                </p>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        notificationsQuery.refetch()
                                    }
                                    disabled={notificationsQuery.isFetching}
                                    className="mt-4"
                                >
                                    <RefreshCw
                                        className={cn(
                                            notificationsQuery.isFetching &&
                                                "animate-spin",
                                        )}
                                    />
                                    Try again
                                </Button>
                            </div>
                        )}

                        {!notificationsQuery.isLoading &&
                            !notificationsQuery.isError &&
                            notifications.length === 0 && (
                                <div className="flex flex-col items-center px-4 py-10 text-center">
                                    <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                                        <BellOff className="size-5" />
                                    </span>

                                    <p className="mt-3 text-sm font-medium">
                                        Nothing yet
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Updates about your plan, videos and
                                        appointments will show up here.
                                    </p>
                                </div>
                            )}

                        {notifications.length > 0 && (
                            <ul className="divide-y divide-border">
                                {notifications.map((notification) => {
                                    const Icon =
                                        icons[notification.category] ?? Bell;

                                    return (
                                        <li
                                            key={notification.id}
                                            className={cn(
                                                "group relative transition",
                                                notification.is_read
                                                    ? "bg-card"
                                                    : "bg-accent/35",
                                            )}
                                        >
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    open(notification)
                                                }
                                                className="flex w-full items-start gap-3 px-4 py-3.5 text-left outline-none transition hover:bg-secondary/60 focus-visible:bg-secondary/60"
                                            >
                                                <span
                                                    className={cn(
                                                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                                                        notification.is_read
                                                            ? "bg-secondary text-muted-foreground"
                                                            : "bg-accent text-accent-foreground",
                                                    )}
                                                >
                                                    <Icon className="size-4" />
                                                </span>

                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-start gap-2">
                                                        <span
                                                            className={cn(
                                                                "block flex-1 text-sm leading-snug",
                                                                notification.is_read
                                                                    ? "font-medium text-foreground"
                                                                    : "font-semibold text-foreground",
                                                            )}
                                                        >
                                                            {notification.title}
                                                        </span>

                                                        {!notification.is_read && (
                                                            <span
                                                                aria-hidden
                                                                className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                                                            />
                                                        )}
                                                    </span>

                                                    {notification.body && (
                                                        <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                                            {notification.body}
                                                        </span>
                                                    )}

                                                    <span className="mt-1.5 block text-[0.6875rem] text-muted-foreground">
                                                        {timeAgo(
                                                            notification.created_at,
                                                            now,
                                                        )}
                                                    </span>
                                                </span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    deleteMutation.mutate(
                                                        notification.id,
                                                    )
                                                }
                                                aria-label="Remove notification"
                                                className="absolute right-2 top-3 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                                            >
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
