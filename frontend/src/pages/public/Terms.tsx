import { Link } from "react-router-dom";

import { LegalPage, List, Section } from "@/components/LegalPage";
import { useSeo } from "@/lib/seo";

export default function Terms() {
    useSeo({
        title: "Terms and Conditions",
        description:
            "The rules for using Sachfitsin, including plans and pricing, payments, the refund and cancellation policy, and account closure.",
        path: "/terms",
    });

    return (
        <LegalPage
            title="Terms and Conditions"
            updated="16 October 2026"
            intro="These are the rules for using Sachfitsin. By creating an account or buying a plan, you agree to them."
        >
            <Section heading="Who you are dealing with">
                <p>
                    Sachfitsin is operated by{" "}
                    <strong className="text-foreground">SFI Aesthetics</strong>,
                    registered at{" "}
                    <span>40, Jagannathpuri-3, Triveni Nagar, Gopalpura Bypass, Jaipur, Rajasthan 302018, India</span>. In
                    these terms, "we" and "us" mean that business, and "you"
                    means the person using the site.
                </p>
            </Section>

            <Section heading="Your account">
                <List
                    items={[
                        "You must be 18 or older to create an account.",
                        "The details you give must be true, and your email address must be one you control. We send a code to it before the account is created.",
                        "You are responsible for keeping your password private and for anything done through your account.",
                        "One person, one account. Do not share your login.",
                        "Tell us straight away if you think someone else has access to your account.",
                    ]}
                />
            </Section>

            <Section heading="What the service gives you">
                <List
                    items={[
                        "Free articles and videos, which anyone can read without an account.",
                        "Paid plans, which unlock features such as personalised diet plans, assigned exercises and personalised videos.",
                        "Daily calorie and water tracking.",
                        "Appointment booking with the dietician, where your plan includes it.",
                    ]}
                />

                <p>
                    We may add, change or withdraw features. If a change
                    removes something you have already paid for, we will
                    contact you about it first.
                </p>
            </Section>

            <Section heading="Plans and payment">
                <List
                    items={[
                        "Prices are shown on the Plans page in Indian Rupees and include any taxes stated there.",
                        "Payments are handled by Razorpay. Your card, UPI and bank details go to Razorpay, not to us.",
                        "A one time plan gives you access that does not expire.",
                        "A monthly plan gives access for the number of days shown on the plan, starting from the day the payment succeeds.",
                        "Access is unlocked once Razorpay confirms the payment. If your browser closes mid payment, access is still granted when the confirmation reaches us.",
                    ]}
                />
            </Section>

            <Section heading="Cancellations and refunds">
                <p className="rounded-xl border border-border bg-surface p-4 text-foreground">
                    Payments are non refundable once access has been given.
                </p>

                <p>
                    Everything sold here is digital and is delivered the
                    moment the payment succeeds. A diet plan, an exercise
                    routine or a video cannot be returned once it has been
                    unlocked and read.
                </p>

                <List
                    items={[
                        <>
                            <strong className="text-foreground">
                                One time plans.
                            </strong>{" "}
                            No refund once the plan is active on your account.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Monthly plans.
                            </strong>{" "}
                            You can stop a monthly plan at any time so it does
                            not continue. You keep access until the end of the
                            period you have already paid for. The current
                            period is not refunded.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Appointments.
                            </strong>{" "}
                            You can cancel or reschedule a booked session
                            through the link in your confirmation email, at
                            least 24 hours before it
                            starts.
                        </>,
                    ]}
                />

                <p>
                    Two things are always refunded: a payment taken twice for
                    the same plan, and a payment where the plan was never
                    unlocked on your account. Email{" "}
                    <a
                        href="mailto:hello@sachfitsin.com"
                        className="font-medium text-primary hover:underline"
                    >
                        hello@sachfitsin.com
                    </a>{" "}
                    with the payment reference from your payment history page.
                    Approved refunds go back to the original payment method
                    through Razorpay, usually within{" "}
                    5–7 working days.
                </p>
            </Section>

            <Section heading="Health and medical limits">
                <p>
                    Sachfitsin provides nutritional guidance. It is not
                    medical treatment and does not replace a doctor.
                </p>

                <List
                    items={[
                        "Tell your dietician about any medical condition, allergy, pregnancy or medication before following a plan.",
                        "Speak to a doctor before starting a new diet or exercise routine if you have a health condition.",
                        "Stop and seek medical help if you feel unwell while following any plan.",
                        "Results depend on your own body, consistency and circumstances. We do not promise any particular outcome, including weight loss or weight gain.",
                    ]}
                />
            </Section>

            <Section heading="What you may not do">
                <List
                    items={[
                        "Copy, republish or resell the articles, videos, plans or exercises on this site.",
                        "Share your account or a paid plan with anyone else.",
                        "Try to reach another customer's information, or any part of the site you have not paid for.",
                        "Attempt to break, overload or probe the service, or use automated tools against it.",
                        "Upload anything unlawful, or impersonate another person.",
                    ]}
                />
            </Section>

            <Section heading="Ownership">
                <p>
                    The articles, videos, exercise routines, plan templates,
                    branding and the site itself belong to us. Buying a plan
                    gives you permission to use it for yourself. It does not
                    transfer ownership.
                </p>

                <p>
                    What you write into your own profile and trackers stays
                    yours. You allow us to use it only to run the service and
                    to let your dietician help you.
                </p>
            </Section>

            <Section heading="Ending your account">
                <List
                    items={[
                        "You can ask us to close your account at any time by emailing us.",
                        "We may suspend or close an account that breaks these terms, or where payment is reversed or disputed without cause.",
                        "If we close your account for breaking these terms, unused access is not refunded.",
                    ]}
                />
            </Section>

            <Section heading="Availability">
                <p>
                    We work to keep the site running, but we cannot promise it
                    will never be unavailable. Maintenance, a hosting problem
                    or a failure at Razorpay, Calendly or our email provider
                    can interrupt it. We are not responsible for losses caused
                    by an interruption outside our control.
                </p>
            </Section>

            <Section heading="Limit of responsibility">
                <p>
                    So far as the law allows, our total responsibility to you
                    for any claim is limited to the amount you paid us in the{" "}
                    6 months before the claim.
                    Nothing here limits responsibility for death, personal
                    injury caused by our negligence, or fraud.
                </p>
            </Section>

            <Section heading="Governing law">
                <p>
                    These terms are governed by the laws of India. Any dispute
                    will be handled by the courts of{" "}
                    Jaipur,{" "}
                    Rajasthan.
                </p>
            </Section>

            <Section heading="Changes to these terms">
                <p>
                    If these terms change, the date at the top of this page
                    changes with it. Continuing to use the site after a change
                    means you accept the new terms.
                </p>

                <p>
                    See also our{" "}
                    <Link
                        to="/privacy"
                        className="font-medium text-primary hover:underline"
                    >
                        Privacy Policy
                    </Link>
                    .
                </p>
            </Section>

            <Section heading="Contact">
                <p>
                    <strong className="text-foreground">SFI Aesthetics</strong>
                    <br />
                    <span>40, Jagannathpuri-3, Triveni Nagar, Gopalpura Bypass, Jaipur, Rajasthan 302018, India</span>
                    <br />
                    Email:{" "}
                    <a
                        href="mailto:hello@sachfitsin.com"
                        className="font-medium text-primary hover:underline"
                    >
                        hello@sachfitsin.com
                    </a>
                    <br />
                    Phone: +91 9509006393
                </p>
            </Section>
        </LegalPage>
    );
}
