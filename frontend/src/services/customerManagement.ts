import api from "./api";

export interface CustomerListItem {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    created_at: string;
}

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

export interface CustomerDetail extends CustomerListItem {
    profile: CustomerProfile | null;
}

export const getCustomers = async (): Promise<CustomerListItem[]> => {
    const response = await api.get<CustomerListItem[]>("customers/manage/");
    return response.data;
};

export const getCustomer = async (
    customerId: number,
): Promise<CustomerDetail> => {
    const response = await api.get<CustomerDetail>(
        `customers/manage/${customerId}/`,
    );

    return response.data;
};