import { useCallback, useState } from "react";

import { useToast } from "@/components/ui/toast-context";
import { useAuth } from "@/contexts/auth-context";
import { errorMessage } from "@/lib/api-error";
import {
    createPaymentOrder,
    verifyPayment,
} from "@/services/payments";

/**
 * Where the purchase has got to.
 *
 * "pending" is the one that matters: Razorpay took the money but our
 * confirmation call did not get through. It is NOT a failure, and the
 * webhook will almost certainly settle it a moment later.
 */
export type PaymentStage =
    | "idle"
    | "starting"
    | "verifying"
    | "success"
    | "pending"
    | "cancelled"
    | "error";

interface StartPaymentOptions {
    /** Runs only after the SERVER has confirmed the payment. */
    onVerified?: () => void;
}

/**
 * Opens Razorpay Checkout for a product.
 *
 *   ask Django for an order  ->  open Razorpay  ->  customer pays
 *
 * IMPORTANT. Razorpay's success callback is not proof of anything.
 *
 * It runs in the browser, and a browser is under the customer's control.
 * Anyone can open the console and call it by hand. So the callback does
 * not unlock anything; it only forwards the three values to Django, which
 * recomputes the signature with the secret key.
 *
 *   handler fires  ->  POST /payments/verify/  ->  Django checks the
 *   signature  ->  only then is the payment SUCCESS
 */
export function useRazorpayCheckout() {
    const { notify } = useToast();
    const { user } = useAuth();

    const [stage, setStage] = useState<PaymentStage>("idle");
    const [message, setMessage] = useState("");

    const reset = useCallback(() => {
        setStage("idle");
        setMessage("");
    }, []);

    const startPayment = useCallback(
        async (productId: number, options: StartPaymentOptions = {}) => {
            // The checkout script is loaded from Razorpay's servers in
            // index.html. An ad blocker or a dropped connection can stop
            // it, and `new window.Razorpay(...)` would then throw.
            if (typeof window.Razorpay !== "function") {
                setStage("error");
                setMessage(
                    "The payment window could not be loaded. Please " +
                        "disable any ad blocker and refresh the page.",
                );

                return;
            }

            setStage("starting");
            setMessage("");

            try {
                const { data } = await createPaymentOrder(productId);

                const razorpay = new window.Razorpay({
                    key: data.razorpay_key_id,
                    amount: data.amount,
                    currency: data.currency,
                    name: "Sachfitsin",
                    description: data.product_name,
                    order_id: data.razorpay_order_id,

                    prefill: {
                        name: user
                            ? `${user.first_name} ${user.last_name}`.trim()
                            : "",
                        email: user?.email ?? "",
                    },

                    theme: {
                        // Matches the site's primary green.
                        color: "#2f7d5d",
                    },

                    handler: async (paymentResponse) => {
                        setStage("verifying");
                        setMessage("Confirming your payment...");

                        try {
                            const result = await verifyPayment({
                                razorpay_order_id:
                                    paymentResponse.razorpay_order_id,
                                razorpay_payment_id:
                                    paymentResponse.razorpay_payment_id,
                                razorpay_signature:
                                    paymentResponse.razorpay_signature,
                            });

                            if (!result.success) {
                                throw new Error(result.message);
                            }

                            setStage("success");
                            setMessage(
                                "Payment successful. Your access is now " +
                                    "active.",
                            );

                            notify("Payment confirmed. Thank you!", "success");

                            options.onVerified?.();
                        } catch {
                            // Never say "payment failed" here. Razorpay may
                            // well have taken the money and only our
                            // confirmation call failed. The webhook will
                            // settle it server to server. Telling them it
                            // failed invites them to pay a second time.
                            setStage("pending");
                            setMessage(
                                "We have received your payment but are " +
                                    "still confirming it. This usually " +
                                    "takes a moment. Check your payment " +
                                    "history shortly.",
                            );
                        }
                    },

                    modal: {
                        ondismiss: () => {
                            setStage("cancelled");
                            setMessage(
                                "Payment cancelled. You have not been " +
                                    "charged.",
                            );
                        },
                    },
                });

                razorpay.open();
            } catch (error) {
                setStage("error");
                setMessage(errorMessage(error));
            }
        },
        [notify, user],
    );

    return {
        startPayment,
        reset,
        stage,
        message,
        /** True while anything is in flight; use it to disable the button. */
        isBusy: stage === "starting" || stage === "verifying",
    };
}
