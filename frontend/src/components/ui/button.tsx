import { forwardRef } from "react";
import { Link } from "react-router-dom";

import {
    buttonClass,
    type ButtonSize,
    type ButtonVariant,
} from "@/components/ui/button-variants";

interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    function Button(
        {
            className,
            variant = "primary",
            size = "md",
            type = "button",
            ...props
        },
        ref,
    ) {
        return (
            <button
                ref={ref}
                type={type}
                className={buttonClass(variant, size, className)}
                {...props}
            />
        );
    },
);

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

export function ButtonLink({
    className,
    variant = "primary",
    size = "md",
    ...props
}: ButtonLinkProps) {
    return (
        <Link
            className={buttonClass(variant, size, className)}
            {...props}
        />
    );
}

interface ButtonAnchorProps
    extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

export function ButtonAnchor({
    className,
    variant = "primary",
    size = "md",
    ...props
}: ButtonAnchorProps) {
    return (
        <a className={buttonClass(variant, size, className)} {...props} />
    );
}
