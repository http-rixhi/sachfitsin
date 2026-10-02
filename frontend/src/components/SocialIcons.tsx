type IconProps = React.SVGProps<SVGSVGElement>;

export function InstagramIcon(props: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            {...props}
        >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="3.6" />
            <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function FacebookIcon(props: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            {...props}
        >
            <path d="M15.5 3h-2.2A4 4 0 0 0 9.3 7v2.6H7v3.2h2.3V21h3.3v-8.2h2.6l.5-3.2h-3.1V7.4c0-.8.4-1.2 1.3-1.2h1.6V3Z" />
        </svg>
    );
}

export function YoutubeIcon(props: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            {...props}
        >
            <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
            <path d="M10.3 9.6v4.8l4.3-2.4-4.3-2.4Z" fill="currentColor" />
        </svg>
    );
}

export function WhatsappIcon(props: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            {...props}
        >
            <path d="M3.2 20.8 4.6 16A8.2 8.2 0 1 1 8 19.4l-4.8 1.4Z" />
            <path d="M9.1 9c.3 1 .8 1.9 1.5 2.6.7.7 1.6 1.2 2.6 1.5l.9-1.1 2 .9-.3 1.4c-1.7.4-3.6-.4-5.1-1.9-1.5-1.5-2.3-3.4-1.9-5.1l1.4-.3.9 2L9.1 9Z" />
        </svg>
    );
}
