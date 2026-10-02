import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export function Label({
    className,
    ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return <label className={cn("field-label", className)} {...props} />;
}

interface FieldProps {
    label?: string;
    hint?: string;
    error?: string;
    required?: boolean;
    htmlFor?: string;
    className?: string;
    children: React.ReactNode;
}

export function Field({
    label,
    hint,
    error,
    required,
    htmlFor,
    className,
    children,
}: FieldProps) {
    return (
        <div className={cn("w-full", className)}>
            {label && (
                <Label htmlFor={htmlFor}>
                    {label}
                    {required && (
                        <span className="ml-0.5 text-destructive">*</span>
                    )}
                </Label>
            )}

            {children}

            {hint && !error && (
                <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
            )}

            {error && (
                <p className="mt-1.5 text-xs font-medium text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}

export const Input = forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
    return (
        <input ref={ref} className={cn("field-control", className)} {...props} />
    );
});

export const Textarea = forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, rows = 4, ...props }, ref) {
    return (
        <textarea
            ref={ref}
            rows={rows}
            className={cn("field-control-area resize-y", className)}
            {...props}
        />
    );
});

export const Select = forwardRef<
    HTMLSelectElement,
    React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
    return (
        <div className="relative">
            <select
                ref={ref}
                className={cn(
                    "field-control appearance-none pr-10",
                    className,
                )}
                {...props}
            >
                {children}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
    );
});

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
    id?: string;
}

export function Switch({
    checked,
    onChange,
    label,
    description,
    id,
}: SwitchProps) {
    return (
        <label
            htmlFor={id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition hover:border-primary/40"
        >
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={cn(
                    "mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
                    checked ? "bg-primary" : "bg-input",
                )}
            >
                <span
                    className={cn(
                        "size-5 rounded-full bg-white shadow transition-transform",
                        checked ? "translate-x-5.5" : "translate-x-0.5",
                    )}
                />
            </button>

            <span className="min-w-0">
                {label && (
                    <span className="block text-sm font-medium">{label}</span>
                )}

                {description && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}
