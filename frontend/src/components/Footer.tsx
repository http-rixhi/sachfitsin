import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";

import { BRAND_NAME, BrandMark } from "@/components/Brand";
import {
    InstagramIcon,
    WhatsappIcon,
    YoutubeIcon,
} from "@/components/SocialIcons";
import { DashboardLink } from "@/components/DashboardLink";

const exploreLinks = [
    { label: "Home", to: "/" },
    { label: "Articles", to: "/content" },
    { label: "Videos", to: "/#videos" },
];

const accountLinks = [
    { label: "Login", to: "/login" },
    { label: "Create account", to: "/register" },
];

const legalLinks = [
    { label: "Privacy Policy", to: "/privacy" },
    { label: "Terms and Conditions", to: "/terms" },
];

const socials = [
    { label: "Instagram", href: "https://instagram.com/sachfitsin", Icon: InstagramIcon },
    { label: "YouTube", href: "https://youtube.com/@sachfitsin", Icon: YoutubeIcon },
    { label: "WhatsApp", href: "https://wa.me/919509006393", Icon: WhatsappIcon },
];

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="mt-20 border-t border-border bg-surface">
            <div className="app-container py-12 sm:py-16">
                <div className="grid gap-10 md:grid-cols-12">
                    {/* Brand */}
                    <div className="md:col-span-5 lg:col-span-4">
                        <div className="flex items-center gap-2.5">
                            <BrandMark />

                            <span className="text-lg font-semibold tracking-tight">
                                {BRAND_NAME}
                            </span>
                        </div>

                        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                            Practical nutrition guidance, personalised diet
                            plans and simple daily tracking, built to help you
                            reach your health goals and stay there.
                        </p>

                        <div className="mt-6 flex items-center gap-2.5">
                            {socials.map(({ label, href, Icon }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                                >
                                    <Icon className="size-[1.125rem]" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Explore */}
                    <div className="md:col-span-3 lg:col-span-2">
                        <h3 className="text-sm font-semibold">Explore</h3>

                        <ul className="mt-4 space-y-3">
                            {exploreLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        to={link.to}
                                        className="text-sm text-muted-foreground transition hover:text-primary"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}

                            <li>
                                <DashboardLink className="text-sm text-muted-foreground transition hover:text-primary">
                                    Dashboard
                                </DashboardLink>
                            </li>
                        </ul>
                    </div>

                    {/* Account */}
                    <div className="md:col-span-4 lg:col-span-2">
                        <h3 className="text-sm font-semibold">Account</h3>

                        <ul className="mt-4 space-y-3">
                            {accountLinks.map((link) => (
                                <li key={link.label}>
                                    <Link
                                        to={link.to}
                                        className="text-sm text-muted-foreground transition hover:text-primary"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact */}
                    <div className="md:col-span-12 lg:col-span-4">
                        <h3 className="text-sm font-semibold">Get in touch</h3>

                        <ul className="mt-4 space-y-3.5">
                            <li className="flex items-start gap-3">
                                <Mail className="mt-0.5 size-4 shrink-0 text-primary" />

                                <a
                                    href="mailto:hello@sachfitsin.com"
                                    className="text-sm text-muted-foreground transition hover:text-primary"
                                >
                                    hello@sachfitsin.com
                                </a>
                            </li>

                            <li className="flex items-start gap-3">
                                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />

                                <a
                                    href="tel:+919509006393"
                                    className="text-sm text-muted-foreground transition hover:text-primary"
                                >
                                    +91 9509006393
                                </a>
                            </li>

                            <li className="flex items-start gap-3">
                                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />

                                <span className="text-sm text-muted-foreground">
                                    Online consultations, available everywhere
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
                    <p className="text-xs text-muted-foreground">
                        © {year} {BRAND_NAME}. All rights reserved.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                        {legalLinks.map((link) => (
                            <Link
                                key={link.label}
                                to={link.to}
                                className="text-xs text-muted-foreground transition hover:text-primary"
                            >
                                {link.label}
                            </Link>
                        ))}

                        <p className="text-xs text-muted-foreground">
                            Guidance here is educational and does not replace
                            medical advice.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
