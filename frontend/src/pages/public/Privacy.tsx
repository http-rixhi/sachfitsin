import { Link } from "react-router-dom";

import { LegalPage, List, Section } from "@/components/LegalPage";
import { useSeo } from "@/lib/seo";

export default function Privacy() {
    useSeo({
        title: "Privacy Policy",
        description:
            "What personal and health information Sachfitsin collects, why it is collected, who it is shared with, and how to have it deleted.",
        path: "/privacy",
    });

    return (
        <LegalPage
            title="Privacy Policy"
            updated="16 October 2026"
            intro="This page explains what information Sachfitsin collects about you, why it is collected, who else can see it, and how you can have it removed."
        >
            <Section heading="Who runs this website">
                <p>
                    Sachfitsin is operated by{" "}
                    <strong className="text-foreground">SFI Aesthetics</strong>,
                    with a registered address at{" "}
                    <span>40, Jagannathpuri-3, Triveni Nagar, Gopalpura Bypass, Jaipur, Rajasthan 302018, India</span>.
                </p>

                <p>
                    For any question about this policy or your information,
                    write to{" "}
                    <a
                        href="mailto:hello@sachfitsin.com"
                        className="font-medium text-primary hover:underline"
                    >
                        hello@sachfitsin.com
                    </a>
                    .
                </p>
            </Section>

            <Section heading="Information you give us">
                <p>
                    You can read the free articles and videos without an
                    account. Everything below applies once you create one.
                </p>

                <List
                    items={[
                        <>
                            <strong className="text-foreground">
                                Account details.
                            </strong>{" "}
                            Your username, email address, and your first and
                            last name if you choose to give them. Your
                            password is stored only as a secure hash, so
                            nobody at Sachfitsin can read it.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Health profile.
                            </strong>{" "}
                            Your phone number, profession, height, current
                            weight, target weight, activity level, dietary
                            preference, allergies, foods you dislike, your
                            current diet and your goals. You enter these
                            yourself, and you can change or clear them at any
                            time from your dashboard.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Daily tracking.
                            </strong>{" "}
                            The meals and calories you log, and the water you
                            record.
                        </>,
                    ]}
                />

                <p>
                    Your health profile and tracking are health information.
                    They are visible only to you and to your dietician. They
                    are never sold, never used for advertising, and never
                    shared with anyone outside the services listed below.
                </p>
            </Section>

            <Section heading="Information created when you use the site">
                <List
                    items={[
                        <>
                            <strong className="text-foreground">
                                Payments.
                            </strong>{" "}
                            The plan you bought, the amount, the currency,
                            whether the payment succeeded, and the reference
                            numbers Razorpay gives us.{" "}
                            <strong className="text-foreground">
                                Your card, UPI and bank details never reach
                                Sachfitsin.
                            </strong>{" "}
                            They are entered on Razorpay's own checkout and
                            stay with Razorpay.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Appointments.
                            </strong>{" "}
                            The date, time and status of sessions you book,
                            and the reference Calendly gives us.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Email records.
                            </strong>{" "}
                            Which emails we sent you, when, and whether they
                            were delivered. We keep this so we can tell
                            whether a receipt or a reminder actually reached
                            you.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Technical records.
                            </strong>{" "}
                            Standard server logs kept by our hosting
                            provider, including IP addresses, used to keep the
                            service running and to block abuse.
                        </>,
                    ]}
                />
            </Section>

            <Section heading="Why we use it">
                <List
                    items={[
                        "To create and run your account.",
                        "To let your dietician build a plan that suits your body, goals and restrictions.",
                        "To show you your own tracking history.",
                        "To take payment and give you access to what you bought.",
                        "To send you account emails such as a verification code, a receipt, or an appointment confirmation.",
                        "To keep the service secure, including rate limiting and fraud checks.",
                    ]}
                />

                <p>
                    We do not use your information for advertising, and we do
                    not sell it to anybody.
                </p>
            </Section>

            <Section heading="Services we rely on">
                <p>
                    Running the site means some information passes through
                    other companies. Each is used for one job only.
                </p>

                <List
                    items={[
                        <>
                            <strong className="text-foreground">
                                Razorpay
                            </strong>{" "}
                            handles payments. They receive your payment
                            details directly; we receive only the result.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Calendly
                            </strong>{" "}
                            handles appointment booking and receives your name
                            and email so the session can be scheduled.
                        </>,
                        <>
                            <strong className="text-foreground">Resend</strong>{" "}
                            sends our emails and therefore receives your email
                            address and the content of those emails.
                        </>,
                        <>
                            <strong className="text-foreground">
                                Neon and Render
                            </strong>{" "}
                            host our database and our servers.
                        </>,
                        <>
                            <strong className="text-foreground">YouTube</strong>{" "}
                            hosts the videos shown on this site. Watching an
                            embedded video means YouTube can set its own
                            cookies, under Google's privacy policy rather than
                            ours.
                        </>,
                    ]}
                />
            </Section>

            <Section heading="Where your information is kept">
                <p>
                    Our database and servers are located in Singapore. Some of
                    the services above may process information in other
                    countries. We use them because they are established
                    providers with their own published privacy terms.
                </p>
            </Section>

            <Section heading="How long we keep it">
                <List
                    items={[
                        "Account, profile and tracking information: until you ask us to delete your account.",
                        "Payment records: kept after account deletion where tax or accounting law requires it.",
                        "A sign-up that is never verified: deleted automatically, usually within minutes.",
                        "Email delivery records: kept so we can investigate a missing receipt.",
                    ]}
                />
            </Section>

            <Section heading="Your choices">
                <p>You can ask us to:</p>

                <List
                    items={[
                        "Give you a copy of the information we hold about you.",
                        "Correct anything that is wrong.",
                        "Delete your account and the information attached to it.",
                        "Stop sending you non-essential email.",
                    ]}
                />

                <p>
                    Email{" "}
                    <a
                        href="mailto:hello@sachfitsin.com"
                        className="font-medium text-primary hover:underline"
                    >
                        hello@sachfitsin.com
                    </a>{" "}
                    from the address on your account and we will act within{" "}
                    14 days. Account emails such as
                    payment receipts and verification codes cannot be turned
                    off while your account is open, because they are part of
                    the service itself.
                </p>
            </Section>

            <Section heading="Cookies and browser storage">
                <p>
                    We do not use advertising or tracking cookies. Your login
                    session is kept in your browser's own storage so you stay
                    signed in. Clearing your browser data signs you out.
                    Razorpay and YouTube may set their own cookies when you
                    pay or watch a video.
                </p>
            </Section>

            <Section heading="Children">
                <p>
                    This service is not intended for anyone under 18. If you
                    believe a child has created an account, contact us and we
                    will remove it.
                </p>
            </Section>

            <Section heading="Medical disclaimer">
                <p>
                    Information on this site, including plans written for you,
                    is nutritional guidance. It is not a medical diagnosis and
                    does not replace advice from a doctor. Speak to a
                    qualified medical professional before making changes if
                    you have a medical condition, are pregnant, or are taking
                    medication.
                </p>
            </Section>

            <Section heading="Changes to this policy">
                <p>
                    If this policy changes, the date at the top of this page
                    changes with it. If the change materially affects how we
                    use your information, we will email you.
                </p>

                <p>
                    See also our{" "}
                    <Link
                        to="/terms"
                        className="font-medium text-primary hover:underline"
                    >
                        Terms and Conditions
                    </Link>
                    .
                </p>
            </Section>
        </LegalPage>
    );
}
