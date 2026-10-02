import api from "./api";

export type NotificationCategory =
    | "ACCOUNT"
    | "APPOINTMENT"
    | "DIET_PLAN"
    | "VIDEO"
    | "EXERCISE"
    | "CONTENT"
    | "SUBSCRIPTION"
    | "GENERAL";

export interface AppNotification {
    id: number;
    category: NotificationCategory;
    title: string;
    body: string;
    link: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
}

export interface NotificationListResponse {
    results: AppNotification[];
    unread_count: number;
    total: number;
}

export async function getNotifications(params?: {
    unread?: boolean;
    limit?: number;
}): Promise<NotificationListResponse> {
    const response = await api.get<NotificationListResponse>(
        "notifications/",
        {
            params: {
                ...(params?.unread ? { unread: 1 } : {}),
                ...(params?.limit ? { limit: params.limit } : {}),
            },
        },
    );

    return response.data;
}

export async function getUnreadCount(): Promise<number> {
    const response = await api.get<{ unread_count: number }>(
        "notifications/unread-count/",
    );

    return response.data.unread_count;
}

export async function markNotificationRead(
    id: number,
): Promise<{ notification: AppNotification; unread_count: number }> {
    const response = await api.post(`notifications/${id}/read/`);

    return response.data;
}

export async function markAllNotificationsRead(): Promise<{
    updated: number;
    unread_count: number;
}> {
    const response = await api.post("notifications/read-all/");

    return response.data;
}

export async function deleteNotification(id: number): Promise<void> {
    await api.delete(`notifications/${id}/`);
}
