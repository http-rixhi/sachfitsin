import { useAuth } from "@/contexts/auth-context";

export const LOGIN_REQUIRED_MESSAGE =
    "Please login first to open your dashboard.";

export function useDashboardTarget() {
    const { isAuthenticated, user } = useAuth();

    return {
        isAuthenticated,
        path: user?.role === "DIETICIAN" ? "/admin" : "/dashboard",
    };
}
