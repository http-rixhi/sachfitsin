import api from "./api";

export interface CustomerProfile {
    id: number;
    phone_number: string;
    profession: string;
    current_diet: string;
    dietary_preference: string;
    allergies: string;
    food_dislikes: string;
    height_cm: number | null;
    current_weight_kg: number | null;
    target_weight_kg: number | null;
    activity_level: string;
    goals: string;
    created_at: string;
    updated_at: string;
}

export interface CustomerProfileInput {
    phone_number: string;
    profession: string;
    current_diet: string;
    dietary_preference: string;
    allergies: string;
    food_dislikes: string;
    height_cm: number | null;
    current_weight_kg: number | null;
    target_weight_kg: number | null;
    activity_level: string;
    goals: string;
}

export const getCustomerProfile = async (): Promise<CustomerProfile> => {
    const response = await api.get<CustomerProfile>("customers/me/");
    return response.data;
};

export const updateCustomerProfile = async (
    data: CustomerProfileInput
): Promise<CustomerProfile> => {
    const response = await api.patch<CustomerProfile>(
        "customers/me/",
        data
    );

    return response.data;
};