import api from "./api";

export interface CreatePaymentOrderResponse {
    success: boolean;
    message: string;
    data: {
        payment_id: number;
        razorpay_order_id: string;
        razorpay_key_id: string;
        amount: number;
        currency: string;
        product_id: number;
        product_name: string;
    };
}

export interface VerifyPaymentData {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

export async function createPaymentOrder(
    productId: number
): Promise<CreatePaymentOrderResponse> {
    const response = await api.post<CreatePaymentOrderResponse>(
        "/payments/create-order/",
        {
            product_id: productId,
        }
    );

    return response.data;
}
export interface VerifyPaymentResponse {
    success: boolean;
    message: string;
    data: {
        payment_id: number;
        razorpay_payment_id?: string;
        status: string;
        product_id?: number;
        product_name?: string;
        amount?: string;
        currency?: string;
    };
}

/**
 * Ask Django to confirm the payment.
 *
 * Razorpay's success callback happens in the browser, so it proves
 * nothing on its own. Only this call does: the server recomputes the
 * signature with the secret key before marking anything paid.
 */
export async function verifyPayment(
    data: VerifyPaymentData
): Promise<VerifyPaymentResponse> {
    const response = await api.post<VerifyPaymentResponse>(
        "/payments/verify/",
        data
    );

    return response.data;
}

export type PaymentStatus =
    | "CREATED"
    | "PENDING"
    | "SUCCESS"
    | "FAILED"
    | "REFUNDED";

export interface Payment {
    id: number;
    product: number;
    product_name: string;
    /** Decimal string from Django, e.g. "499.00". */
    amount: string;
    currency: string;
    status: PaymentStatus;
    razorpay_order_id: string;
    razorpay_payment_id?: string | null;
    failure_reason: string;
    created_at: string;
    updated_at: string;
}

export interface MyPaymentsResponse {
    success: boolean;
    data: Payment[];
}

export async function getMyPayments(
    status?: PaymentStatus
): Promise<MyPaymentsResponse> {
    const response = await api.get<MyPaymentsResponse>(
        "/payments/my/",
        { params: status ? { status } : undefined }
    );

    return response.data;
}
