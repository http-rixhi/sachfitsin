import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LOGIN_REQUIRED_MESSAGE } from "@/lib/dashboard";
import { FullPageLoader } from "@/components/FullPageLoader";
import { useAuth } from "@/contexts/auth-context";

export default function ProtectedRoute() {
    const location = useLocation();
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return <FullPageLoader label="Checking your session..." />;
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
                state={{
                    notice: LOGIN_REQUIRED_MESSAGE,
                    from: location.pathname,
                }}
            />
        );
    }

    return <Outlet />;
}
