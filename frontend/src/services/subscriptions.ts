import api from "./api";

export interface Entitlement {
    id: number;
    product_code: string;
    product_name: string;
    status: "ACTIVE" | "EXPIRED" | "REVOKED";
    starts_at: string;
    expires_at: string | null;
    source: string;
    created_at: string;
    updated_at: string;
}

export async function getMyEntitlements(): Promise<Entitlement[]> {
    const response = await api.get<Entitlement[]>(
        "subscriptions/my/entitlements/",
    );

    return response.data;
}
