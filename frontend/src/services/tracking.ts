import api from "./api";


export interface CalorieProfile {
    id: number;
    daily_calorie_target: number | null;
    protein_target_g: number | null;
    carbs_target_g: number | null;
    fat_target_g: number | null;
    created_at: string;
    updated_at: string;
}

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export interface CalorieEntry {
    id: number;
    date: string;
    meal_type: MealType;
    food_name: string;
    quantity: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    created_at: string;
    updated_at: string;
}

export interface CalorieSummary {
    date: string;
    calorie_target: number | null;
    calories_consumed: number;
    remaining_calories: number | null;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
}

export interface UpdateCalorieProfileData {
    daily_calorie_target?: number | null;
    protein_target_g?: number | null;
    carbs_target_g?: number | null;
    fat_target_g?: number | null;
}

export interface CreateCalorieEntryData {
    date: string;
    meal_type: MealType;
    food_name: string;
    quantity: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
}

export async function getCalorieProfile(): Promise<CalorieProfile> {
    const response = await api.get("/tracking/calories/profile/");
    return response.data;
}

export async function updateCalorieProfile(
    data: UpdateCalorieProfileData,
): Promise<CalorieProfile> {
    const response = await api.patch(
        "/tracking/calories/profile/",
        data,
    );
    return response.data;
}

export async function getCalorieEntries(
    date?: string,
): Promise<CalorieEntry[]> {
    const response = await api.get(
        "/tracking/calories/entries/",
        {
            params: date ? { date } : undefined,
        },
    );

    return response.data;
}

export async function createCalorieEntry(
    data: CreateCalorieEntryData,
): Promise<CalorieEntry> {
    const response = await api.post(
        "/tracking/calories/entries/",
        data,
    );

    return response.data;
}

export async function updateCalorieEntry(
    id: number,
    data: Partial<CreateCalorieEntryData>,
): Promise<CalorieEntry> {
    const response = await api.patch(
        `/tracking/calories/entries/${id}/`,
        data,
    );

    return response.data;
}

export async function deleteCalorieEntry(
    id: number,
): Promise<void> {
    await api.delete(
        `/tracking/calories/entries/${id}/`,
    );
}

export async function getCalorieSummary(
    date?: string,
): Promise<CalorieSummary> {
    const response = await api.get(
        "/tracking/calories/summary/",
        {
            params: date ? { date } : undefined,
        },
    );

    return response.data;
}

export interface WaterProfile {
    id: number;
    daily_water_target_ml: number | null;
    created_at: string;
    updated_at: string;
}

export interface WaterEntry {
    id: number;
    date: string;
    amount_ml: number;
    created_at: string;
    updated_at: string;
}

export interface WaterSummary {
    date: string;
    daily_target_ml: number | null;
    total_water_ml: number;
    remaining_water_ml: number | null;
    progress_percentage: number | null;
}

export async function getWaterProfile(): Promise<WaterProfile> {
    const response = await api.get(
        "/tracking/water/profile/",
    );

    return response.data;
}

export async function updateWaterProfile(
    daily_water_target_ml: number | null,
): Promise<WaterProfile> {
    const response = await api.patch(
        "/tracking/water/profile/",
        {
            daily_water_target_ml,
        },
    );

    return response.data;
}

export async function getWaterEntries(
    date?: string,
): Promise<WaterEntry[]> {
    const response = await api.get(
        "/tracking/water/entries/",
        {
            params: date ? { date } : undefined,
        },
    );

    return response.data;
}

export async function createWaterEntry(
    data: {
        date: string;
        amount_ml: number;
    },
): Promise<WaterEntry> {
    const response = await api.post(
        "/tracking/water/entries/",
        data,
    );

    return response.data;
}

export async function updateWaterEntry(
    id: number,
    data: {
        date?: string;
        amount_ml?: number;
    },
): Promise<WaterEntry> {
    const response = await api.patch(
        `/tracking/water/entries/${id}/`,
        data,
    );

    return response.data;
}

export async function deleteWaterEntry(
    id: number,
): Promise<void> {
    await api.delete(
        `/tracking/water/entries/${id}/`,
    );
}

export async function getWaterSummary(
    date?: string,
): Promise<WaterSummary> {
    const response = await api.get(
        "/tracking/water/summary/",
        {
            params: date ? { date } : undefined,
        },
    );

    return response.data;
}