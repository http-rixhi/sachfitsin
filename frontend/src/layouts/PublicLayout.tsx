import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";

import { Brand } from "@/components/Brand";
import Footer from "@/components/Footer";
import { DashboardLink } from "@/components/DashboardLink";
import { Button, ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn, initialsOf } from "@/lib/utils";

const navLinks = [
    { label: "Home", to: "/" },
    { label: "Articles", to: "/content" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition",
        isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

export default function PublicLayout() {
    const { isAuthenticated, user, logout } = useAuth();

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const closeMenu = () => setIsMenuOpen(false);

    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-lg">
                <div className="app-container flex h-16 items-center justify-between gap-4 sm:h-18">
                    <Brand showTagline={false} />

                    {/* Desktop nav */}
                    <nav className="hidden items-center gap-1 md:flex">
                        {navLinks.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                end={link.to === "/"}
                                className={linkClass}
                            >
                                {link.label}
                            </NavLink>
                        ))}

                        <DashboardLink
                            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition"
                            activeClassName="hover:bg-secondary hover:text-foreground"
                            showLockIcon
                        />
                    </nav>

                    {/* Desktop actions */}
                    <div className="hidden items-center gap-3 md:flex">
                        {isAuthenticated ? (
                            <>
                                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-1.5">
                                    <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                                        {initialsOf(
                                            user?.first_name,
                                            user?.last_name ||
                                                user?.username,
                                        )}
                                    </span>

                                    <span className="max-w-32 truncate text-sm font-medium">
                                        {user?.first_name || user?.username}
                                    </span>
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={logout}
                                >
                                    <LogOut />
                                    Logout
                                </Button>
                            </>
                        ) : (
                            <>
                                <ButtonLink
                                    to="/login"
                                    variant="ghost"
                                    size="sm"
                                >
                                    Login
                                </ButtonLink>

                                <ButtonLink to="/register" size="sm">
                                    Get started
                                </ButtonLink>
                            </>
                        )}
                    </div>

                    {/* Mobile toggle */}
                    <button
                        type="button"
                        onClick={() => setIsMenuOpen((open) => !open)}
                        aria-label="Toggle menu"
                        aria-expanded={isMenuOpen}
                        className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-secondary md:hidden"
                    >
                        {isMenuOpen ? (
                            <X className="size-5" />
                        ) : (
                            <Menu className="size-5" />
                        )}
                    </button>
                </div>

                {/* Mobile menu */}
                {isMenuOpen && (
                    <div className="border-t border-border bg-background md:hidden">
                        <nav className="app-container flex flex-col gap-1 py-4">
                            {navLinks.map((link) => (
                                <NavLink
                                    key={link.to}
                                    to={link.to}
                                    end={link.to === "/"}
                                    onClick={closeMenu}
                                    className={({ isActive }) =>
                                        cn(
                                            "rounded-xl px-3 py-2.5 text-sm font-medium transition",
                                            isActive
                                                ? "bg-accent text-accent-foreground"
                                                : "text-muted-foreground hover:bg-secondary",
                                        )
                                    }
                                >
                                    {link.label}
                                </NavLink>
                            ))}

                            <DashboardLink
                                className="justify-start rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition"
                                activeClassName="hover:bg-secondary hover:text-foreground"
                                showLockIcon
                                onNavigate={closeMenu}
                            />

                            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
                                {isAuthenticated ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setIsMenuOpen(false);
                                            logout();
                                        }}
                                    >
                                        <LogOut />
                                        Logout
                                    </Button>
                                ) : (
                                    <>
                                        <ButtonLink
                                            to="/login"
                                            variant="outline"
                                            onClick={closeMenu}
                                        >
                                            Login
                                        </ButtonLink>

                                        <ButtonLink
                                            to="/register"
                                            onClick={closeMenu}
                                        >
                                            Create free account
                                        </ButtonLink>
                                    </>
                                )}
                            </div>
                        </nav>
                    </div>
                )}
            </header>

            <main className="flex-1">
                <Outlet />
            </main>

            <Footer />
        </div>
    );
}
