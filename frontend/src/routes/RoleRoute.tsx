import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LOGIN_REQUIRED_MESSAGE } from "@/lib/dashboard";
import { FullPageLoader } from "@/components/FullPageLoader";
import { useAuth } from "@/contexts/auth-context";

interface RoleRouteProps {
    allowedRoles: Array<"CUSTOMER" | "DIETICIAN">;
}

export default function RoleRoute({ allowedRoles }: RoleRouteProps) {
    const location = useLocation();
    const { user, isLoading, isAuthenticated } = useAuth();

    if (isLoading) {
        return <FullPageLoader label="Checking your access..." />;
    }

    if (!isAuthenticated || !user) {
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

    if (!allowedRoles.includes(user.role)) {
        return (
            <Navigate
                to={user.role === "DIETICIAN" ? "/admin" : "/dashboard"}
                replace
            />
        );
    }

    return <Outlet />;
}
