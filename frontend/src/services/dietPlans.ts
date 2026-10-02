import api from "./api";

export interface DietPlan {
    id: number;
    customer: number;
    customer_username: string;
    created_by: number | null;
    created_by_username: string | null;
    title: string;
    description: string;
    start_date: string | null;
    end_date: string | null;
    status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
    created_at: string;
    updated_at: string;
}

export const getDietPlans = async (): Promise<DietPlan[]> => {
    const response = await api.get("diet-plans/manage/");
    return response.data.results ?? response.data;
};

export const getMyDietPlans = async (): Promise<DietPlan[]> => {
    const response = await api.get("diet-plans/my-plans/");
    return response.data.results ?? response.data;
};
