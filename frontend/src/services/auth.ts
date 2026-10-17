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

/** What step one returns. No account exists yet at this point. */
export interface SignupStartedResponse {
    detail: string;
    email: string;
    /** Seconds until the emailed code stops working. */
    expires_in: number;
}

export interface VerifyEmailResponse {
    detail: string;
    user: User;
}

/**
 * Step one of sign-up: emails a six digit code.
 *
 * This does NOT create the account. `verifyEmail` with the code does.
 */
export const registerUser = async (data: RegisterData) => {
    const response = await api.post<SignupStartedResponse>(
        "auth/register/",
        data,
    );

    return response.data;
};

/** Step two: the code proves the inbox, and the account is created. */
export const verifyEmail = async (email: string, code: string) => {
    const response = await api.post<VerifyEmailResponse>(
        "auth/verify-email/",
        { email, code },
    );

    return response.data;
};

export const resendCode = async (email: string) => {
    const response = await api.post<{ detail: string; expires_in: number }>(
        "auth/resend-code/",
        { email },
    );

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