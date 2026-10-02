import api from "./api";

export interface Exercise {
    id: number;
    name: string;
    description: string;
    category: string;
    difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    duration_minutes: number | null;
    instructions: string;
    precautions: string;
    video_url: string;
    image_url: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ExerciseRecommendation {
    id: number;
    customer: number;
    customer_username: string;
    exercise: number;
    exercise_name: string;
    exercise_category: string;
    exercise_difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    exercise_description: string;
    exercise_instructions: string;
    exercise_precautions: string;
    exercise_video_url: string;
    exercise_image_url: string;
    recommended_by: number | null;
    recommended_by_username: string | null;
    sets: number | null;
    reps: number | null;
    duration_minutes: number | null;
    frequency: string;
    notes: string;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateExerciseData {
    name: string;
    description: string;
    category: string;
    difficulty: Exercise["difficulty"];
    duration_minutes?: number | null;
    instructions: string;
    precautions: string;
    video_url?: string;
    image_url?: string;
    is_active: boolean;
}

export interface CreateRecommendationData {
    customer: number;
    exercise: number;
    sets?: number | null;
    reps?: number | null;
    duration_minutes?: number | null;
    frequency: string;
    notes: string;
    status: "ACTIVE" | "COMPLETED" | "CANCELLED";
    starts_at?: string | null;
    ends_at?: string | null;
}

export const getMyExerciseRecommendations = async (): Promise<
    ExerciseRecommendation[]
> => {
    const response = await api.get<ExerciseRecommendation[]>(
        "exercises/my/",
    );

    return response.data;
};

export const getExerciseLibrary = async (): Promise<Exercise[]> => {
    const response = await api.get<Exercise[]>(
        "exercises/manage/library/",
    );

    return response.data;
};

export const createExercise = async (
    data: CreateExerciseData,
): Promise<Exercise> => {
    const response = await api.post<Exercise>(
        "exercises/manage/library/",
        data,
    );

    return response.data;
};

export const updateExercise = async (
    exerciseId: number,
    data: Partial<CreateExerciseData>,
): Promise<Exercise> => {
    const response = await api.patch<Exercise>(
        `exercises/manage/library/${exerciseId}/`,
        data,
    );

    return response.data;
};

export const deleteExercise = async (
    exerciseId: number,
): Promise<void> => {
    await api.delete(
        `exercises/manage/library/${exerciseId}/`,
    );
};

export const getExerciseRecommendations = async (
    customerId?: number,
): Promise<ExerciseRecommendation[]> => {
    const url = customerId
        ? `exercises/manage/recommendations/?customer=${customerId}`
        : "exercises/manage/recommendations/";

    const response = await api.get<ExerciseRecommendation[]>(
        url,
    );

    return response.data;
};

export const createExerciseRecommendation = async (
    data: CreateRecommendationData,
): Promise<ExerciseRecommendation> => {
    const response = await api.post<ExerciseRecommendation>(
        "exercises/manage/recommendations/",
        data,
    );

    return response.data;
};

export const updateExerciseRecommendation = async (
    recommendationId: number,
    data: Partial<CreateRecommendationData>,
): Promise<ExerciseRecommendation> => {
    const response = await api.patch<ExerciseRecommendation>(
        `exercises/manage/recommendations/${recommendationId}/`,
        data,
    );

    return response.data;
};

export const deleteExerciseRecommendation = async (
    recommendationId: number,
): Promise<void> => {
    await api.delete(
        `exercises/manage/recommendations/${recommendationId}/`,
    );
};