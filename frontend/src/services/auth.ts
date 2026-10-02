import api from "./api";

export interface User {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: "CUSTOMER" | "DIETICIAN";
}

export interface LoginResponse {
    access: string;
    refresh: string;
}

export interface RegisterData {
    username: string;
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
}

export const registerUser = async (data: RegisterData) => {
    const response = await api.post<User>("auth/register/", data);
    return response.data;
};

export const loginUser = async (
    username: string,
    password: string
): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("auth/login/", {
        username,
        password,
    });

    return response.data;
};

export const getCurrentUser = async (): Promise<User> => {
    const response = await api.get<User>("auth/me/");
    return response.data;
};