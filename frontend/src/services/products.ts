import api from "./api";

export type BillingType = "FREE" | "ONE_TIME" | "MONTHLY";

export interface Product {
    id: number;
    code: string;
    name: string;
    description: string;
    billing_type: BillingType;
    /** Decimal string from Django, e.g. "499.00". */
    price: string;
    duration_days: number | null;
}

export async function getProducts(code?: string): Promise<Product[]> {
    const response = await api.get<Product[]>("products/", {
        params: code ? { code } : undefined,
    });

    return response.data;
}

/** The product that unlocks personalised videos. */
export const PERSONALIZED_VIDEOS_CODE = "PERSONALIZED_VIDEOS";

export function formatPrice(product: Product): string {
    const amount = Number(product.price);

    const formatted = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);

    return product.billing_type === "MONTHLY"
        ? `${formatted}/month`
        : formatted;
}

// --- Dietician plan management -------------------------------------------

export interface AdminProduct extends Product {
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
