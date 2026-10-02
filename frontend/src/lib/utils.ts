export type ClassValue =
    | string
    | number
    | null
    | undefined
    | false
    | ClassValue[]
    | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
    const classes: string[] = [];

    const walk = (value: ClassValue) => {
        if (!value) {
            return;
        }

        if (typeof value === "string" || typeof value === "number") {
            classes.push(String(value));
            return;
        }

        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }

        Object.entries(value).forEach(([key, enabled]) => {
            if (enabled) {
                classes.push(key);
            }
        });
    };

    inputs.forEach(walk);

    return classes.join(" ");
}

export function initialsOf(...parts: Array<string | undefined | null>) {
    const letters = parts
        .map((part) => part?.trim()?.charAt(0) ?? "")
        .filter(Boolean)
        .join("");

    return (letters || "U").slice(0, 2).toUpperCase();
}

export function formatDate(value?: string | null) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function readingTime(body?: string | null) {
    const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;

    return Math.max(1, Math.round(words / 200));
}

export function titleCase(value?: string | null) {
    if (!value) {
        return "";
    }

    return value
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
