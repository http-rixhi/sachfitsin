import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
    BookOpen,
    CalendarDays,
    Dumbbell,
    Home,
    LayoutDashboard,
    LogOut,
    Menu,
    Tag,
    Users,
    Utensils,
    UserRound,
    Video,
    X,
} from "lucide-react";

import { Brand } from "@/components/Brand";
import { NotificationBell } from "@/components/NotificationBell";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { cn, initialsOf } from "@/lib/utils";

const navGroups = [
    {
        title: "Overview",
        items: [
            {
                label: "Dashboard",
                to: "/admin",
                icon: LayoutDashboard,
                end: true,
            },
            { label: "Customers", to: "/admin/customers", icon: Users },
            {
                label: "Appointments",
                to: "/admin/appointments",
                icon: CalendarDays,
            },
        ],
    },
    {
        title: "Library",
        items: [
            { label: "Videos", to: "/admin/videos", icon: Video },
            {
                label: "Personalized Videos",
                to: "/admin/videos/personalized",
                icon: UserRound,
            },
            { label: "Exercises", to: "/admin/exercises", icon: Dumbbell },
            { label: "Content", to: "/admin/content", icon: BookOpen },
        ],
    },
    {
        title: "Billing",
        items: [
            { label: "Plans & Pricing", to: "/admin/plans", icon: Tag },
        ],
    },
];

const comingSoon = [
    { label: "Diet Plans", icon: Utensils },
];

const sideLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
    );

export default function AdminLayout() {
    const { user, logout } = useAuth();

    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const closeDrawer = () => setIsDrawerOpen(false);

    const sidebar = (
        <nav className="flex h-full flex-col gap-6 p-4">
            {navGroups.map((group) => (
                <div key={group.title}>
                    <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {group.title}
                    </p>

                    <div className="space-y-1">
                        {group.items.map((item) => (
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
                    </div>
                </div>
            ))}

            <div>
                <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Coming soon
                </p>

                <div className="space-y-1">
                    {comingSoon.map((item) => (
                        <span
                            key={item.label}
                            className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
                        >
                            <item.icon className="size-[1.125rem]" />
                            {item.label}
                        </span>
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
                    View public site
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

                        <Brand to="/admin" showTagline={false} />

                        <Badge tone="primary" className="hidden sm:inline-flex">
                            Admin
                        </Badge>
                    </div>

                    <div className="flex items-center gap-3">
                        <NotificationBell />

                        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
                                {initialsOf(
                                    user?.first_name,
                                    user?.last_name || user?.username,
                                )}
                            </span>

                            <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
                                {user?.first_name || user?.username}
                            </span>
                        </div>

                        <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={logout}
                            aria-label="Logout"
                            className="lg:hidden"
                        >
                            <LogOut />
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex">
                <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-sidebar lg:block">
                    {sidebar}
                </aside>

                {isDrawerOpen && (
                    <div className="fixed inset-0 z-100 lg:hidden">
                        <div
                            aria-hidden
                            onClick={closeDrawer}
                            className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]"
                        />

                        <div className="absolute inset-y-0 left-0 flex w-[17rem] flex-col border-r border-border bg-sidebar shadow-[var(--shadow-pop)] animate-in slide-in-from-left">
                            <div className="flex h-16 items-center justify-between border-b border-border px-4">
                                <Brand to="/admin" showTagline={false} />

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

                <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className="mx-auto max-w-6xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
