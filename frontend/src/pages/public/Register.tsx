import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus } from "lucide-react";

import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import { errorMessage, fieldErrors } from "@/lib/api-error";
import { registerUser } from "@/services/auth";
import { useSeo } from "@/lib/seo";

export default function Register() {
    useSeo({
        title: "Create an Account",
        description:
            "Create a free Sachfitsin account to unlock personalised diet plans, exercises and daily tracking.",
        path: "/register",
    });

    const navigate = useNavigate();
    const { notify } = useToast();

    const [form, setForm] = useState({
        username: "",
        email: "",
        password: "",
        first_name: "",
        last_name: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [fields, setFields] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        setForm({
            ...form,
            [event.target.name]: event.target.value,
        });
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        setError("");
        setFields({});
        setIsSubmitting(true);

        try {
            const started = await registerUser(form);

            notify("We sent a code to your email.", "success");

            // No account exists yet. The code proves the inbox, and the
            // verify step is what actually creates it.
            navigate("/verify-email", {
                replace: true,
                state: { email: started.email },
            });
        } catch (submitError) {
            // The backend flags each bad field by name, so they can be
            // shown under the right input instead of all in one banner.
            setError(errorMessage(submitError));
            setFields(fieldErrors(submitError));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="app-container flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12">
            <div className="w-full max-w-lg">
                <div className="mb-8 flex flex-col items-center text-center">
                    <BrandMark className="size-12 [&_svg]:size-7" />

                    <h1 className="mt-5 text-2xl sm:text-[1.75rem]">
                        Create your account
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        Free to join. Unlock your dashboard, plans and trackers.
                    </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-7">
                    <FormError message={error} className="mb-5" />

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field label="First name" htmlFor="first_name" error={fields.first_name}>
                                <Input
                                    id="first_name"
                                    name="first_name"
                                    autoComplete="given-name"
                                    value={form.first_name}
                                    onChange={handleChange}
                                    placeholder="Rishi"
                                />
                            </Field>

                            <Field label="Last name" htmlFor="last_name" error={fields.last_name}>
                                <Input
                                    id="last_name"
                                    name="last_name"
                                    autoComplete="family-name"
                                    value={form.last_name}
                                    onChange={handleChange}
                                    placeholder="Raj"
                                />
                            </Field>
                        </div>

                        <Field label="Username" htmlFor="username" error={fields.username} required>
                            <Input
                                id="username"
                                name="username"
                                autoComplete="username"
                                value={form.username}
                                onChange={handleChange}
                                placeholder="Pick a unique username"
                                required
                            />
                        </Field>

                        <Field label="Email" htmlFor="email" error={fields.email} required>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="you@example.com"
                                required
                            />
                        </Field>

                        <Field
                            label="Password"
                            htmlFor="password"
                            hint="Use at least 8 characters."
                            error={fields.password}
                            required
                        >
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    value={form.password}
                                    onChange={handleChange}
                                    minLength={8}
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
                                    Creating account...
                                </>
                            ) : (
                                <>
                                    <UserPlus />
                                    Create account
                                </>
                            )}
                        </Button>
                    </form>
                </div>

                <p className="mt-6 text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                        to="/login"
                        className="font-medium text-primary hover:underline"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
