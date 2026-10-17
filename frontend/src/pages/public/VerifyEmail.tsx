import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MailCheck, RotateCcw, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import { errorMessage } from "@/lib/api-error";
import { resendCode, verifyEmail } from "@/services/auth";
import { useSeo } from "@/lib/seo";

/** Passed through router state by the Register page. */
interface VerifyEmailState {
    email?: string;
}

const CODE_LENGTH = 6;

export default function VerifyEmail() {
    useSeo({
        title: "Verify Your Email",
        noIndex: true,
    });

    const navigate = useNavigate();
    const location = useLocation();
    const { notify } = useToast();

    const state = (location.state ?? {}) as VerifyEmailState;
    const email = state.email ?? "";

    const [code, setCode] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(60);

    const inputRef = useRef<HTMLInputElement>(null);

    // Landing here directly (a refresh, or a pasted link) means there is
    // no sign-up in progress to verify.
    useEffect(() => {
        if (!email) {
            navigate("/register", { replace: true });
        }
    }, [email, navigate]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (cooldown <= 0) {
            return;
        }

        const timer = window.setTimeout(
            () => setCooldown((seconds) => seconds - 1),
            1000,
        );

        return () => window.clearTimeout(timer);
    }, [cooldown]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        setError("");
        setIsSubmitting(true);

        try {
            await verifyEmail(email, code);

            notify("Email verified. Please sign in.", "success");

            navigate("/login", { replace: true });
        } catch (submitError) {
            setError(errorMessage(submitError));
            setCode("");
            inputRef.current?.focus();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        setError("");
        setIsResending(true);

        try {
            await resendCode(email);

            notify("We sent a new code.", "success");

            setCode("");
            setCooldown(60);
            inputRef.current?.focus();
        } catch (resendError) {
            setError(errorMessage(resendError));
        } finally {
            setIsResending(false);
        }
    };

    if (!email) {
        return null;
    }

    return (
        <div className="app-container flex min-h-[calc(100dvh-4rem)] items-center justify-center py-12">
            <div className="w-full max-w-md">
                <div className="mb-8 flex flex-col items-center text-center">
                    <BrandMark className="size-12 [&_svg]:size-7" />

                    <h1 className="mt-5 text-2xl sm:text-[1.75rem]">
                        Check your email
                    </h1>

                    <p className="mt-2 text-sm text-muted-foreground">
                        We sent a {CODE_LENGTH} digit code to{" "}
                        <span className="font-medium text-foreground">
                            {email}
                        </span>
                        .
                    </p>
                </div>

                <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lift)] sm:p-7">
                    <FormError message={error} className="mb-5" />

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Field
                            label="Verification code"
                            htmlFor="code"
                            required
                            hint="The code expires in 10 minutes."
                        >
                            <Input
                                ref={inputRef}
                                id="code"
                                name="code"
                                value={code}
                                onChange={(event) =>
                                    setCode(
                                        event.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, CODE_LENGTH),
                                    )
                                }
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="000000"
                                className="text-center text-2xl font-semibold tracking-[0.5em]"
                                required
                            />
                        </Field>

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={
                                isSubmitting || code.length !== CODE_LENGTH
                            }
                        >
                            {isSubmitting ? (
                                <>
                                    <Spinner />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck />
                                    Verify and create account
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 border-t border-border pt-5 text-center">
                        <p className="text-sm text-muted-foreground">
                            No email yet? Check your spam folder.
                        </p>

                        <Button
                            type="button"
                            variant="ghost"
                            className="mt-2"
                            onClick={handleResend}
                            disabled={isResending || cooldown > 0}
                        >
                            {isResending ? (
                                <>
                                    <Spinner />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <RotateCcw />
                                    {cooldown > 0
                                        ? `Resend in ${cooldown}s`
                                        : "Send a new code"}
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
                    <MailCheck className="size-4" />
                    Wrong address?{" "}
                    <Link
                        to="/register"
                        className="font-medium text-primary hover:underline"
                    >
                        Start again
                    </Link>
                </p>
            </div>
        </div>
    );
}
