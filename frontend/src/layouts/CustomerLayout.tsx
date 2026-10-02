import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
    CalendarDays,
    Droplets,
    Dumbbell,
    Home,
    LayoutDashboard,
    LogOut,
    Menu,
    ReceiptText,
    Sparkles,
    Flame,
    UserRound,
    Utensils,
    Video,
    X,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { NotificationBell } from "@/components/NotificationBell";
import { Button, ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn, initialsOf } from "@/lib/utils";

const navItems = [
    { label: "Overview", to: "/dashboard", icon: LayoutDashboard, end: true },
    { label: "My Profile", to: "/dashboard/profile", icon: UserRound },
    { label: "Videos", to: "/dashboard/videos", icon: Video },
    { label: "Exercises", to: "/dashboard/exercises", icon: Dumbbell },
    {
        label: "Appointments",
        to: "/dashboard/appointments",
        icon: CalendarDays,
    },
    { label: "Plans", to: "/dashboard/plans", icon: Sparkles },
    { label: "Payments", to: "/dashboard/payments", icon: ReceiptText },
];

const trackerItems = [
    { label: "Calorie Tracker", to: "/dashboard/calories", icon: Flame },
    { label: "Water Tracker", to: "/dashboard/water", icon: Droplets },
];

const mobileTabs = [
    { label: "Home", to: "/dashboard", icon: LayoutDashboard, end: true },
    { label: "Videos", to: "/dashboard/videos", icon: Video },
    { label: "Exercises", to: "/dashboard/exercises", icon: Dumbbell },
    { label: "Calories", to: "/dashboard/calories", icon: Flame },
    { label: "Water", to: "/dashboard/water", icon: Droplets },
];

const sideLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

export default function CustomerLayout() {
    const { user, logout } = useAuth();

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const closeDrawer = () => setIsDrawerOpen(false);

    const sidebar = (
        <nav className="flex h-full flex-col gap-6 p-4">
            <div>
                <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Menu
                </p>

                <div className="space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            onClick={closeDrawer}
                            className={sideLinkClass}
                        >
                            <item.icon className="size-[1.125rem]" />
                            {item.label}
                        </NavLink>
                    ))}

                    <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground/50">
                        <Utensils className="size-[1.125rem]" />
                        My Diet Plan
                        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide">
                            Soon
                        </span>
                    </span>
                </div>
            </div>

            <div>
                <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Daily trackers
                </p>

                <div className="space-y-1">
                    {trackerItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={closeDrawer}
                            className={sideLinkClass}
                        >
                            <item.icon className="size-[1.125rem]" />
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            </div>

            <div className="mt-auto space-y-2">
                <ButtonLink
                    to="/"
                    variant="outline"
                    size="sm"
                    className="w-full"
                >
                    <Home />
                    Back to site
                </ButtonLink>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="w-full justify-start"
                >
                    <LogOut />
                    Logout
                </Button>
            </div>
        </nav>
    );

    return (
        <div className="min-h-dvh bg-background">
            <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-lg">
                <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsDrawerOpen(true)}
                            aria-label="Open menu"
                            className="flex size-10 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-secondary lg:hidden"
                        >
                            <Menu className="size-5" />
                        </button>

                        <Brand to="/dashboard" showTagline={false} />
                    </div>

                    <div className="flex items-center gap-3">
                        <ButtonLink
                            to="/"
                            variant="ghost"
                            size="sm"
                            className="hidden sm:inline-flex"
                        >
                            <Home />
                            Site
                        </ButtonLink>

                        <NotificationBell />

                        <NavLink
                            to="/dashboard/profile"
                            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5 transition hover:border-primary/40"
                        >
                            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                                {initialsOf(
                                    user?.first_name,
                                    user?.last_name || user?.username,
                                )}
                            </span>

                            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
                                {user?.first_name || user?.username}
                            </span>
                        </NavLink>

                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={logout}
                            aria-label="Logout"
                            className="sm:hidden"
                        >
                            <LogOut />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Desktop sidebar */}
                <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 border-r border-border bg-sidebar lg:block">
                    {sidebar}
                </aside>

                {/* Mobile drawer */}
                {isDrawerOpen && (
                    <div className="fixed inset-0 z-100 lg:hidden">
                        <div
                            aria-hidden
                            onClick={closeDrawer}
                            className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]"
                        />

                        <div className="absolute inset-y-0 left-0 flex w-[17rem] flex-col border-r border-border bg-sidebar shadow-[var(--shadow-pop)] animate-in slide-in-from-left">
                            <div className="flex h-16 items-center justify-between border-b border-border px-4">
                                <Brand to="/dashboard" showTagline={false} />

                                <button
                                    type="button"
                                    onClick={closeDrawer}
                                    aria-label="Close menu"
                                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {sidebar}
                            </div>
                        </div>
                    </div>
                )}

                <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12">
                    <div className="mx-auto max-w-6xl">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Mobile bottom tab bar */}
            <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg sm:hidden">
                <div className="grid grid-cols-5">
                    {mobileTabs.map((tab) => (
                        <NavLink
                            key={tab.to}
                            to={tab.to}
                            end={tab.end}
                            className={({ isActive }) =>
                                cn(
                                    "flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium transition",
                                    isActive
                                        ? "text-primary"
                                        : "text-muted-foreground",
                                )
                            }
                        >
                            <tab.icon className="size-5" />
                            {tab.label}
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
