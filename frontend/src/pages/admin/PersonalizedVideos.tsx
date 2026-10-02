import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
    ArrowUpRight,
    ExternalLink,
    Pencil,
    Plus,
    Search,
    UserRound,
    Video,
} from "lucide-react";

import { AssignVideoModal } from "@/components/admin/AssignVideoModal";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import {
    EmptyState,
    LoadingBlock,
} from "@/components/ui/states";
import { getCustomers } from "@/services/customerManagement";
import {
    getPersonalizedVideos,
    type PersonalizedVideo,
} from "@/services/videos";
import { formatDate } from "@/lib/utils";

const NO_ASSIGNMENTS: PersonalizedVideo[] = [];

export default function PersonalizedVideos() {
    const [search, setSearch] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickedCustomer, setPickedCustomer] = useState(0);

    const [assign, setAssign] = useState<{
        open: boolean;
        customerId: number;
        customerName: string;
        editing: PersonalizedVideo | null;
    }>({ open: false, customerId: 0, customerName: "", editing: null });

    const customersQuery = useQuery({
        queryKey: ["admin", "customers"],
        queryFn: getCustomers,
    });

    const personalizedQuery = useQuery({
        queryKey: ["admin", "personalized-videos"],
        queryFn: () => getPersonalizedVideos(),
    });

    const customers = customersQuery.data ?? [];
    const assignments = personalizedQuery.data ?? NO_ASSIGNMENTS;

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return assignments;
        }

        return assignments.filter(
            (item) =>
                item.customer_username.toLowerCase().includes(query) ||
                item.video_title.toLowerCase().includes(query),
        );
    }, [assignments, search]);

    const nameOf = (customerId: number) => {
        const customer = customers.find((item) => item.id === customerId);

        if (!customer) {
            return "this customer";
        }

        return (
            `${customer.first_name} ${customer.last_name}`.trim() ||
            customer.username
        );
    };

    const startAssign = () => {
        setPickedCustomer(0);
        setPickerOpen(true);
    };

    const confirmCustomer = () => {
        if (!pickedCustomer) {
            return;
        }

        setPickerOpen(false);

        setAssign({
            open: true,
            customerId: pickedCustomer,
            customerName: nameOf(pickedCustomer),
            editing: null,
        });
    };

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Assignments"
                title="Personalized Videos"
                description="Videos assigned to individual customers. You can also assign from a customer's profile."
                actions={
                    <Button onClick={startAssign}>
                        <Plus />
                        Assign video
                    </Button>
                }
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-md">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by customer or video..."
                        aria-label="Search assignments"
                        className="pl-11"
                    />
                </div>

                <p className="text-sm text-muted-foreground">
                    {filtered.length} assignment
                    {filtered.length === 1 ? "" : "s"}
                </p>
            </div>

            {personalizedQuery.isLoading && (
                <LoadingBlock label="Loading assignments..." />
            )}

            {personalizedQuery.isError && (
                <ApiErrorState
                    error={personalizedQuery.error}
                    title="Unable to load personalized videos"
                    onRetry={() => personalizedQuery.refetch()}
                    isRetrying={personalizedQuery.isFetching}
                />
            )}

            {!personalizedQuery.isLoading &&
                !personalizedQuery.isError &&
                filtered.length === 0 && (
                    <EmptyState
                        icon={<Video />}
                        title={
                            assignments.length === 0
                                ? "No videos assigned yet"
                                : "No assignments match your search"
                        }
                        description={
                            assignments.length === 0
                                ? "Pick a customer and send them their first video."
                                : "Try a different customer or video name."
                        }
                        action={
                            assignments.length === 0 && (
                                <Button onClick={startAssign}>
                                    <Plus />
                                    Assign your first video
                                </Button>
                            )
                        }
                    />
                )}

            {filtered.length > 0 && (
                <>
                    {/* Desktop table */}
                    <Card className="hidden overflow-hidden lg:block">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b border-border bg-surface">
                                    <tr>
                                        {[
                                            "Customer",
                                            "Video",
                                            "Start",
                                            "End",
                                            "Status",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="px-5 py-3.5 text-left font-medium text-muted-foreground"
                                            >
                                                {heading}
                                            </th>
                                        ))}

                                        <th className="px-5 py-3.5 text-right font-medium text-muted-foreground">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border">
                                    {filtered.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="transition hover:bg-secondary/50"
                                        >
                                            <td className="px-5 py-4">
                                                <Link
                                                    to={`/admin/customers/${item.customer}`}
                                                    className="inline-flex items-center gap-2 font-medium hover:text-primary"
                                                >
                                                    <UserRound className="size-4 text-muted-foreground" />
                                                    @{item.customer_username}
                                                    <ArrowUpRight className="size-3.5" />
                                                </Link>
                                            </td>

                                            <td className="px-5 py-4">
                                                {item.video_title}
                                            </td>

                                            <td className="px-5 py-4 text-muted-foreground">
                                                {item.starts_at
                                                    ? formatDate(
                                                          item.starts_at,
                                                      )
                                                    : "Immediately"}
                                            </td>

                                            <td className="px-5 py-4 text-muted-foreground">
                                                {item.ends_at
                                                    ? formatDate(item.ends_at)
                                                    : "No expiry"}
                                            </td>

                                            <td className="px-5 py-4">
                                                <StatusBadge
                                                    value={item.status}
                                                />
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    {item.video_url && (
                                                        <a
                                                            href={
                                                                item.video_url
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            aria-label="Open video"
                                                            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-primary"
                                                        >
                                                            <ExternalLink className="size-4" />
                                                        </a>
                                                    )}

                                                    <Button
                                                        variant="outline"
                                                        size="icon-sm"
                                                        aria-label="Edit assignment"
                                                        onClick={() =>
                                                            setAssign({
                                                                open: true,
                                                                customerId:
                                                                    item.customer,
                                                                customerName: `@${item.customer_username}`,
                                                                editing: item,
                                                            })
                                                        }
                                                    >
                                                        <Pencil />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Mobile cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
                        {filtered.map((item) => (
                            <Card key={item.id}>
                                <CardBody className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {item.video_title}
                                            </p>

                                            <Link
                                                to={`/admin/customers/${item.customer}`}
                                                className="text-xs text-muted-foreground hover:text-primary"
                                            >
                                                @{item.customer_username}
                                            </Link>
                                        </div>

                                        <StatusBadge value={item.status} />
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        {item.starts_at
                                            ? formatDate(item.starts_at)
                                            : "Immediately"}
                                        {" → "}
                                        {item.ends_at
                                            ? formatDate(item.ends_at)
                                            : "No expiry"}
                                    </p>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setAssign({
                                                open: true,
                                                customerId: item.customer,
                                                customerName: `@${item.customer_username}`,
                                                editing: item,
                                            })
                                        }
                                    >
                                        <Pencil />
                                        Edit
                                    </Button>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* Step 1: pick the customer */}
            <Modal
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                size="sm"
                title="Choose a customer"
                description="Pick who this video is for."
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setPickerOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={confirmCustomer}
                            disabled={!pickedCustomer}
                        >
                            Continue
                        </Button>
                    </>
                }
            >
                <Select
                    value={pickedCustomer || ""}
                    onChange={(event) =>
                        setPickedCustomer(Number(event.target.value))
                    }
                    aria-label="Customer"
                >
                    <option value="">Select customer</option>

                    {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                            {`${customer.first_name} ${customer.last_name}`.trim() ||
                                customer.username}{" "}
                            (@{customer.username})
                        </option>
                    ))}
                </Select>
            </Modal>

            {/* Step 2: the assignment form */}
            <AssignVideoModal
                open={assign.open}
                onClose={() =>
                    setAssign({
                        open: false,
                        customerId: 0,
                        customerName: "",
                        editing: null,
                    })
                }
                customerId={assign.customerId}
                customerName={assign.customerName}
                editing={assign.editing}
            />
        </div>
    );
}
