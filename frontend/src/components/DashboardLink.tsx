import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";

import { useToast } from "@/components/ui/toast-context";
import {
    LOGIN_REQUIRED_MESSAGE,
    useDashboardTarget,
} from "@/lib/dashboard";
import { cn } from "@/lib/utils";

interface DashboardLinkProps {
    className?: string;
    activeClassName?: string;
    children?: React.ReactNode;
    showLockIcon?: boolean;
    onNavigate?: () => void;
}

/**
 * Dashboard entry point. Logged out users see it as inactive: clicking
 * tells them to login first, then sends them to the login page.
 */
export function DashboardLink({
    className,
    activeClassName,
    children = "Dashboard",
    showLockIcon = false,
    onNavigate,
}: DashboardLinkProps) {
    const navigate = useNavigate();
    const { notify } = useToast();
    const { isAuthenticated, path } = useDashboardTarget();

    const handleClick = () => {
        onNavigate?.();

        if (!isAuthenticated) {
            notify(LOGIN_REQUIRED_MESSAGE, "warning");

            navigate("/login", {
                state: {
                    notice: LOGIN_REQUIRED_MESSAGE,
                    from: path,
                },
            });

            return;
        }

        navigate(path);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-disabled={!isAuthenticated}
            title={isAuthenticated ? undefined : LOGIN_REQUIRED_MESSAGE}
            className={cn(
                "inline-flex items-center gap-1.5 outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
                className,
                isAuthenticated
                    ? activeClassName
                    : "cursor-not-allowed opacity-60",
            )}
        >
            {children}

            {showLockIcon && !isAuthenticated && (
                <Lock className="size-3.5" aria-hidden />
            )}
        </button>
    );
}
