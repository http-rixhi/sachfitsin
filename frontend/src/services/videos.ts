import api from "./api";

export interface Video {
    id: number;
    title: string;
    description: string;
    category: string;
    video_url: string;
    thumbnail_url: string;
    is_public: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PersonalizedVideo {
    id: number;
    customer: number;
    customer_username: string;
    video: number;
    video_title: string;
    video_url: string;
    notes: string;
    starts_at: string | null;
    ends_at: string | null;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    created_at: string;
    updated_at: string;
}

export async function getPublicVideos(): Promise<Video[]> {
    const response = await api.get<Video[]>("/videos/public/");
    return response.data;
}

export async function getMyPersonalizedVideos(): Promise<
    PersonalizedVideo[]
> {
    const response = await api.get<PersonalizedVideo[]>(
        "/videos/my/"
    );

    return response.data;
}

export interface CreateVideoData {
    title: string;
    description: string;
    category: string;
    video_url: string;
    thumbnail_url: string;
    is_public: boolean;
    is_active: boolean;
}

export async function getVideoLibrary(): Promise<Video[]> {
    const response = await api.get<Video[]>(
        "/videos/manage/library/"
    );

    return response.data;
}

export async function createVideo(
    data: CreateVideoData
): Promise<Video> {
    const response = await api.post<Video>(
        "/videos/manage/library/",
        data
    );

    return response.data;
}

export async function updateVideo(
    id: number,
    data: Partial<CreateVideoData>
): Promise<Video> {
    const response = await api.patch<Video>(
        `/videos/manage/library/${id}/`,
        data
    );

    return response.data;
}

export interface CreatePersonalizedVideoData {
    customer: number;
    video: number;
    notes: string;
    starts_at: string | null;
    ends_at: string | null;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
}

export async function getPersonalizedVideos(
    customerId?: number
): Promise<PersonalizedVideo[]> {
    const params = customerId
        ? { customer: customerId }
        : undefined;

    const response = await api.get<PersonalizedVideo[]>(
        "/videos/manage/personalized/",
        { params }
    );

    return response.data;
}

export async function createPersonalizedVideo(
    data: CreatePersonalizedVideoData
): Promise<PersonalizedVideo> {
    const response = await api.post<PersonalizedVideo>(
        "/videos/manage/personalized/",
        data
    );

    return response.data;
}

export async function updatePersonalizedVideo(
    id: number,
    data: Partial<CreatePersonalizedVideoData>
): Promise<PersonalizedVideo> {
    const response = await api.patch<PersonalizedVideo>(
        `/videos/manage/personalized/${id}/`,
        data
    );

    return response.data;
}