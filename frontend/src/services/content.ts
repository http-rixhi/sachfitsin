import api from "./api";

export type ContentType =
    | "ARTICLE"
    | "EDUCATIONAL"
    | "GENERAL";

export interface Content {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    content_type: ContentType;
    cover_image_url: string;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

export const getPublicContent = async (): Promise<Content[]> => {
    const response = await api.get("/content/public/");
    return response.data.results ?? response.data;
};

export const getPublicContentDetail = async (
    slug: string
): Promise<Content> => {
    const response = await api.get(
        `/content/public/${slug}/`
    );

    return response.data;
};

export interface CreateContentData {
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    content_type: ContentType;
    cover_image_url: string;
    is_public: boolean;
    is_active: boolean;
}

export interface AdminContent extends Content {
    is_public: boolean;
    is_active: boolean;
    created_by: number | null;
    created_by_username: string | null;
}

export const getContentLibrary = async (): Promise<AdminContent[]> => {
    const response = await api.get("/content/manage/");
    return response.data.results ?? response.data;
};

export const createContent = async (
    data: CreateContentData
): Promise<AdminContent> => {
    const response = await api.post("/content/manage/", data);
    return response.data;
};

export const updateContent = async (
    id: number,
    data: Partial<CreateContentData>
): Promise<AdminContent> => {
    const response = await api.patch(
        `/content/manage/${id}/`,
        data
    );

    return response.data;
};