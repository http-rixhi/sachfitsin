import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowUpRight, Search, Users } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    EmptyState,
    LoadingBlock,
} from "@/components/ui/states";
import {
    getCustomers,
    type CustomerListItem,
} from "@/services/customerManagement";
import { formatDate, initialsOf } from "@/lib/utils";

const NO_CUSTOMERS: CustomerListItem[] = [];

export default function Customers() {
    const [search, setSearch] = useState("");

    const customersQuery = useQuery({
        queryKey: ["admin", "customers"],
        queryFn: getCustomers,
    });

    const customers = customersQuery.data ?? NO_CUSTOMERS;
    const { isLoading, isError } = customersQuery;

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return customers;
        }

        return customers.filter((customer) => {
            const fullName =
                `${customer.first_name} ${customer.last_name}`.toLowerCase();

            return (
                fullName.includes(query) ||
                customer.username.toLowerCase().includes(query) ||
                customer.email.toLowerCase().includes(query)
            );
        });
    }, [customers, search]);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Admin"
                title="Customers"
                description="Open a customer to view their profile and assign videos or exercises."
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by name, username or email..."
                        aria-label="Search customers"
                        className="pl-11"
                    />
                </div>

                <p className="text-sm text-muted-foreground">
                    {filtered.length} of {customers.length} customer
                    {customers.length === 1 ? "" : "s"}
                </p>
            </div>

            {isLoading && <LoadingBlock label="Loading customers..." />}

            {isError && (
                <ApiErrorState
                    error={customersQuery.error}
                    title="Unable to load customers"
                    onRetry={() => customersQuery.refetch()}
                    isRetrying={customersQuery.isFetching}
                />
            )}

            {!isLoading && !isError && filtered.length === 0 && (
                <EmptyState
                    icon={<Users />}
                    title={
                        search
                            ? "No customers match your search"
                            : "No customers yet"
                    }
                    description={
                        search
                            ? "Try a different name, username or email."
                            : "New sign-ups will appear here automatically."
                    }
                />
            )}

            {filtered.length > 0 && (
                <>
                    {/* Table on desktop */}
                    <Card className="hidden overflow-hidden md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-border bg-surface">
                                    <tr>
                                        <th className="px-5 py-3.5 text-left font-medium text-muted-foreground">
                                            Customer
                                        </th>

                                        <th className="px-5 py-3.5 text-left font-medium text-muted-foreground">
                                            Email
                                        </th>

                                        <th className="px-5 py-3.5 text-left font-medium text-muted-foreground">
                                            Joined
                                        </th>

                                        <th className="px-5 py-3.5 text-right font-medium text-muted-foreground">
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border">
                                    {filtered.map((customer) => {
                                        const fullName =
                                            `${customer.first_name} ${customer.last_name}`.trim();

                                        return (
                                            <tr
                                                key={customer.id}
                                                className="transition hover:bg-secondary/50"
                                            >
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-xs font-semibold text-accent-foreground">
                                                            {initialsOf(
                                                                customer.first_name,
                                                                customer.last_name ||
                                                                    customer.username,
                                                            )}
                                                        </span>

                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">
                                                                {fullName ||
                                                                    customer.username}
                                                            </p>

                                                            <p className="truncate text-xs text-muted-foreground">
                                                                @
                                                                {
                                                                    customer.username
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4 text-muted-foreground">
                                                    {customer.email}
                                                </td>

                                                <td className="px-5 py-4 text-muted-foreground">
                                                    {formatDate(
                                                        customer.created_at,
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <ButtonLink
                                                        to={`/admin/customers/${customer.id}`}
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        Open
                                                        <ArrowUpRight />
                                                    </ButtonLink>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Cards on mobile */}
                    <div className="grid gap-4 sm:grid-cols-2 md:hidden">
                        {filtered.map((customer) => {
                            const fullName =
                                `${customer.first_name} ${customer.last_name}`.trim();

                            return (
                                <Link
                                    key={customer.id}
                                    to={`/admin/customers/${customer.id}`}
                                    className="block"
                                >
                                    <Card className="h-full transition hover:border-primary/40 hover:shadow-[var(--shadow-lift)]">
                                        <CardBody className="flex items-center gap-3">
                                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground">
                                                {initialsOf(
                                                    customer.first_name,
                                                    customer.last_name ||
                                                        customer.username,
                                                )}
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">
                                                    {fullName ||
                                                        customer.username}
                                                </p>

                                                <p className="truncate text-xs text-muted-foreground">
                                                    {customer.email}
                                                </p>

                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Joined{" "}
                                                    {formatDate(
                                                        customer.created_at,
                                                    )}
                                                </p>
                                            </div>

                                            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                                        </CardBody>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
