import api from "./api";

export type BillingType = "FREE" | "ONE_TIME" | "MONTHLY";

/**
 * Something the app lets a customer do, as opposed to something they
 * bought. Several plans can unlock the same feature, so pages ask for the
 * feature and let the backend say which plans provide it.
 */
export type Feature = "PERSONALIZED_VIDEOS" | "EXERCISE_ROUTINES";

export const FEATURE_PERSONALIZED_VIDEOS: Feature = "PERSONALIZED_VIDEOS";
export const FEATURE_EXERCISE_ROUTINES: Feature = "EXERCISE_ROUTINES";

export interface Product {
    id: number;
    code: string;
    name: string;
    description: string;
    billing_type: BillingType;
    /** Decimal string from Django, e.g. "499.00". */
    price: string;
    duration_days: number | null;
    /** What this plan unlocks. Sent by the backend, never guessed here. */
    features: Feature[];
}

interface ProductQuery {
    code?: string;
    /** Only plans that unlock this feature. */
    feature?: Feature;
}

export async function getProducts(
    query: ProductQuery = {},
): Promise<Product[]> {
    const params: Record<string, string> = {};

    if (query.code) {
        params.code = query.code;
    }

    if (query.feature) {
        params.feature = query.feature;
    }

    const response = await api.get<Product[]>("products/", {
        params: Object.keys(params).length ? params : undefined,
    });

    return response.data;
}

/** The cheapest of a set of plans, which is what a paywall should offer. */
export function cheapest(products: Product[]): Product | undefined {
    return [...products].sort(
        (a, b) => Number(a.price) - Number(b.price),
    )[0];
}

/**
 * How long a plan lasts, in words.
 *
 * A 90 day plan is stored as MONTHLY because that is what drives the
 * expiry date, but calling it "per month" on a price tag would be wrong:
 * the customer pays 3,999 once for three months, not every month.
 */
export function periodLabel(product: Product): string {
    if (product.billing_type !== "MONTHLY") {
        return "";
    }

    const days = product.duration_days;

    if (!days || days === 30) {
        return "per month";
    }

    if (days % 30 === 0) {
        return `for ${days / 30} months`;
    }

    return `for ${days} days`;
}

export function formatPrice(product: Product): string {
    const amount = Number(product.price);

    if (product.billing_type === "FREE" || amount === 0) {
        return "Free";
    }

    const formatted = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);

    const period = periodLabel(product);

    return period ? `${formatted} ${period}` : formatted;
}

// --- Dietician plan management -------------------------------------------

export interface AdminProduct extends Omit<Product, "features"> {
    status: "ACTIVE" | "INACTIVE";
    /** How many customers currently have access to this plan. */
    customer_count: number;
    created_at: string;
    updated_at: string;
}

export interface ProductInput {
    code?: string;
    name: string;
    description: string;
    billing_type: BillingType;
    price: string;
    duration_days: number | null;
    status: "ACTIVE" | "INACTIVE";
}

export async function getManagedProducts(): Promise<AdminProduct[]> {
    const response = await api.get<AdminProduct[]>("products/manage/");

    return response.data;
}

export async function createProduct(
    data: ProductInput
): Promise<AdminProduct> {
    const response = await api.post<AdminProduct>(
        "products/manage/",
        data
    );

    return response.data;
}

export async function updateProduct(
    id: number,
    data: Partial<ProductInput>
): Promise<AdminProduct> {
    const response = await api.patch<AdminProduct>(
        `products/manage/${id}/`,
        data
    );

    return response.data;
}
