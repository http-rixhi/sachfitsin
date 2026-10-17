import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Info, LogIn } from "lucide-react";

import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { Spinner } from "@/components/ui/states";
import { useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api-error";
import { useSeo } from "@/lib/seo";

interface LoginState {
    notice?: string;
}

export default function Login() {
    useSeo({
        title: "Log In",
        description: "Log in to your Sachfitsin account.",
        path: "/login",
        noIndex: true,
    });

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const notice = (location.state as LoginState | null)?.notice;

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        setError("");
        setIsSubmitting(true);

        try {
            const user = await login(username, password);

            navigate(user.role === "DIETICIAN" ? "/admin" : "/dashboard", {
                replace: true,
            });
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="app-container flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12">
            <div className="w-full max-w-md">
                <div className="mb-8 flex flex-col items-center text-center">
                    <BrandMark className="size-12 [&_svg]:size-7" />

                    <h1 className="mt-5 text-2xl sm:text-[1.75rem]">
                        Welcome back
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Sign in to open your dashboard.
                    </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-7">
                    {notice && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning/35 bg-warning/10 p-3.5">
                            <Info className="mt-0.5 size-4.5 shrink-0 text-warning" />

                            <p className="text-sm text-foreground">{notice}</p>
                        </div>
                    )}

                    <FormError message={error} className="mb-5" />

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Field label="Username" htmlFor="username" required>
                            <Input
                                id="username"
                                name="username"
                                autoComplete="username"
                                value={username}
                                onChange={(event) =>
                                    setUsername(event.target.value)
                                }
                                placeholder="your username"
                                required
                            />
                        </Field>

                        <Field label="Password" htmlFor="password" required>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(event) =>
                                        setPassword(event.target.value)
                                    }
                                    placeholder="••••••••"
                                    required
                                    className="pr-12"
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword((shown) => !shown)
                                    }
                                    aria-label={
                                        showPassword
                                            ? "Hide password"
                                            : "Show password"
                                    }
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                            </div>
                        </Field>

                        <Button
                            type="submit"
                            size="lg"
                            disabled={isSubmitting}
                            className="w-full"
                        >
                            {isSubmitting ? (
                                <>
                                    <Spinner className="size-4 text-primary-foreground" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn />
                                    Sign in
                                </>
                            )}
                        </Button>
                    </form>
                </div>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Link
                        to="/register"
                        className="font-medium text-primary hover:underline"
                    >
                        Create one for free
                    </Link>
                </p>
            </div>
        </div>
    );
}
