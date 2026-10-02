import { useEffect, useState, type ReactNode } from "react";

import {
    getCurrentUser,
    loginUser,
    type User,
} from "@/services/auth";

import {
    clearTokens,
    getAccessToken,
    setTokens,
} from "@/lib/auth";

import { AuthContext } from "@/contexts/auth-context";
import { SESSION_EXPIRED_EVENT } from "@/lib/session";

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initializeAuth = async () => {
            const token = getAccessToken();

            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            } catch {
                clearTokens();
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, []);

    // When Axios gives up on refreshing the token, drop the user here too
    // so the route guards send them to the login screen.
    useEffect(() => {
        const onSessionExpired = () => setUser(null);

        window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);

        return () =>
            window.removeEventListener(
                SESSION_EXPIRED_EVENT,
                onSessionExpired,
            );
    }, []);

    const login = async (username: string, password: string) => {
        const tokens = await loginUser(username, password);

        setTokens(tokens.access, tokens.refresh);

        const currentUser = await getCurrentUser();

        setUser(currentUser);

        return currentUser;
    };

    const logout = () => {
        clearTokens();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
