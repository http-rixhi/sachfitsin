import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    CalendarClock,
    Infinity as InfinityIcon,
    PackageOpen,
    Pencil,
    Plus,
    Power,
    Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ApiErrorState } from "@/components/ui/error-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { Modal } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import {
    EmptyState,
    LoadingBlock,
    Spinner,
} from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import {
    createProduct,
    getManagedProducts,
    updateProduct,
    type AdminProduct,
    type ProductInput,
} from "@/services/products";
import { errorMessage, fieldErrors } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const NO_PRODUCTS: AdminProduct[] = [];

const emptyForm: ProductInput = {
    code: "",
    name: "",
    description: "",
    billing_type: "ONE_TIME",
    price: "",
    duration_days: null,
    status: "ACTIVE",
};

function formatPrice(product: AdminProduct) {
    const amount = Number(product.price);

    if (product.billing_type === "FREE" || amount === 0) {
        return "Free";
    }

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
}

export default function Plans() {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState<AdminProduct | null>(null);
    const [form, setForm] = useState<ProductInput>(emptyForm);
    const [error, setError] = useState("");
    const [fields, setFields] = useState<Record<string, string>>({});

    const productsQuery = useQuery({
        queryKey: ["admin", "products"],
        queryFn: getManagedProducts,
    });

    const products = productsQuery.data ?? NO_PRODUCTS;

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
        // The customer-facing list reads from the same products.
        queryClient.invalidateQueries({ queryKey: ["products"] });
    };

    const onError = (mutationError: unknown) => {
        setError(errorMessage(mutationError));
        setFields(fieldErrors(mutationError));
    };

    const createMutation = useMutation({
        mutationFn: createProduct,
        onSuccess: () => {
            invalidate();
            notify("Plan created.", "success");
            close();
        },
        onError,
    });

    const updateMutation = useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: number;
            data: Partial<ProductInput>;
        }) => updateProduct(id, data),
        onSuccess: () => {
            invalidate();
            close();
        },
        onError,
    });

    function close() {
        setIsOpen(false);
        setEditing(null);
        setForm(emptyForm);
        setError("");
        setFields({});
    }

    function openCreate() {
        setEditing(null);
        setForm(emptyForm);
        setError("");
        setFields({});
        setIsOpen(true);
    }

    function openEdit(product: AdminProduct) {
        setEditing(product);

        setForm({
            code: product.code,
            name: product.name,
            description: product.description,
            billing_type: product.billing_type,
            price: product.price,
            duration_days: product.duration_days,
            status: product.status,
        });

        setError("");
        setFields({});
        setIsOpen(true);
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        setError("");
        setFields({});

        if (editing) {
            // The backend ignores a changed code; not sending it keeps
            // that obvious here too.
            const data = { ...form };
            delete data.code;

            updateMutation.mutate({ id: editing.id, data });
        } else {
            createMutation.mutate(form);
        }
    }

    function toggleStatus(product: AdminProduct) {
        updateMutation.mutate({
            id: product.id,
            data: {
                status:
                    product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
            },
        });
    }

    const totals = useMemo(() => {
        return {
            active: products.filter((p) => p.status === "ACTIVE").length,
            customers: products.reduce(
                (sum, p) => sum + p.customer_count,
                0,
            ),
        };
    }, [products]);

    const isSaving =
        createMutation.isPending || updateMutation.isPending;

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Billing"
                title="Plans & Pricing"
                description="What customers can buy, and what it costs. Changes show up on their Plans page straight away."
                actions={
                    <Button onClick={openCreate}>
                        <Plus />
                        Add plan
                    </Button>
                }
            />

            {products.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <StatCard
                        icon={<PackageOpen />}
                        label="Plans on sale"
                        value={totals.active}
                        sub={`${products.length} in total`}
                    />

                    <StatCard
                        icon={<Users />}
                        tone="success"
                        label="Customers with access"
                        value={totals.customers}
                        sub="Across all plans"
                    />
                </div>
            )}

            {productsQuery.isLoading && (
                <LoadingBlock label="Loading plans..." />
            )}

            {productsQuery.isError && (
                <ApiErrorState
                    error={productsQuery.error}
                    title="Unable to load the plans"
                    onRetry={() => productsQuery.refetch()}
                    isRetrying={productsQuery.isFetching}
                />
            )}

            {!productsQuery.isLoading &&
                !productsQuery.isError &&
                products.length === 0 && (
                    <EmptyState
                        icon={<PackageOpen />}
                        title="No plans yet"
                        description="Create your first plan so customers have something to buy."
                        action={
                            <Button onClick={openCreate}>
                                <Plus />
                                Add your first plan
                            </Button>
                        }
                    />
                )}

            {products.length > 0 && (
                <div className="grid gap-5 lg:grid-cols-2">
                    {products.map((product) => (
                        <Card
                            key={product.id}
                            className={cn(
                                product.status === "INACTIVE" &&
                                    "opacity-65",
                            )}
                        >
                            <CardBody className="space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold">
                                            {product.name}
                                        </h3>

                                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                            {product.code}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                                        <span className="text-xl font-semibold tabular-nums">
                                            {formatPrice(product)}
                                        </span>

                                        <Badge
                                            tone={
                                                product.status === "ACTIVE"
                                                    ? "success"
                                                    : "neutral"
                                            }
                                        >
                                            {product.status === "ACTIVE"
                                                ? "On sale"
                                                : "Hidden"}
                                        </Badge>
                                    </div>
                                </div>

                                {product.description && (
                                    <p className="line-clamp-2 text-sm text-muted-foreground">
                                        {product.description}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Badge
                                        tone={
                                            product.billing_type ===
                                            "MONTHLY"
                                                ? "primary"
                                                : "neutral"
                                        }
                                    >
                                        {product.billing_type === "MONTHLY"
                                            ? "Monthly"
                                            : product.billing_type ===
                                                "FREE"
                                              ? "Free"
                                              : "One time"}
                                    </Badge>

                                    {product.duration_days ? (
                                        <Badge>
                                            <CalendarClock className="size-3.5" />
                                            {product.duration_days} days
                                        </Badge>
                                    ) : (
                                        <Badge>
                                            <InfinityIcon className="size-3.5" />
                                            No expiry
                                        </Badge>
                                    )}

                                    <Badge
                                        tone={
                                            product.customer_count > 0
                                                ? "success"
                                                : "neutral"
                                        }
                                    >
                                        <Users className="size-3.5" />
                                        {product.customer_count} customer
                                        {product.customer_count === 1
                                            ? ""
                                            : "s"}
                                    </Badge>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEdit(product)}
                                    >
                                        <Pencil />
                                        Edit
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={updateMutation.isPending}
                                        onClick={() =>
                                            toggleStatus(product)
                                        }
                                        title={
                                            product.status === "ACTIVE"
                                                ? "Hide from customers"
                                                : "Put back on sale"
                                        }
                                    >
                                        <Power />
                                        {product.status === "ACTIVE"
                                            ? "Take off sale"
                                            : "Put on sale"}
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={isOpen}
                onClose={close}
                size="md"
                title={editing ? "Edit plan" : "Add a plan"}
                description={
                    editing
                        ? "Price changes apply to new purchases only. Customers who already bought keep what they paid for."
                        : "Customers see this on their Plans page as soon as it is on sale."
                }
                footer={
                    <>
                        <Button variant="outline" onClick={close}>
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="plan-form"
                            disabled={isSaving}
                        >
                            {isSaving && (
                                <Spinner className="size-4 text-primary-foreground" />
                            )}
                            {editing ? "Save changes" : "Create plan"}
                        </Button>
                    </>
                }
            >
                <form
                    id="plan-form"
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <FormError message={error} />

                    <Field
                        label="Plan name"
                        htmlFor="plan-name"
                        error={fields.name}
                        required
                    >
                        <Input
                            id="plan-name"
                            value={form.name}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    name: event.target.value,
                                })
                            }
                            placeholder="e.g. Personalized Diet Plan"
                            required
                        />
                    </Field>

                    {editing ? (
                        <Field
                            label="Code"
                            hint="Cannot be changed. Customers who bought this plan are linked to it by code."
                        >
                            <Input value={form.code} disabled />
                        </Field>
                    ) : (
                        <Field
                            label="Code"
                            htmlFor="plan-code"
                            hint="A short id used internally, e.g. DIET_PLAN. It cannot be changed later."
                            error={fields.code}
                            required
                        >
                            <Input
                                id="plan-code"
                                value={form.code}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        code: event.target.value,
                                    })
                                }
                                placeholder="DIET_PLAN"
                                required
                            />
                        </Field>
                    )}

                    <Field
                        label="Description"
                        htmlFor="plan-description"
                        hint="Shown to the customer on the plan card."
                        error={fields.description}
                    >
                        <Textarea
                            id="plan-description"
                            rows={3}
                            value={form.description}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    description: event.target.value,
                                })
                            }
                        />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field
                            label="Billing"
                            htmlFor="plan-billing"
                            error={fields.billing_type}
                        >
                            <Select
                                id="plan-billing"
                                value={form.billing_type}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        billing_type: event.target
                                            .value as ProductInput["billing_type"],
                                    })
                                }
                            >
                                <option value="ONE_TIME">One time</option>
                                <option value="MONTHLY">Monthly</option>
                                <option value="FREE">Free</option>
                            </Select>
                        </Field>

                        <Field
                            label="Price (₹)"
                            htmlFor="plan-price"
                            error={fields.price}
                            required={form.billing_type !== "FREE"}
                        >
                            <Input
                                id="plan-price"
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.price}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        price: event.target.value,
                                    })
                                }
                                placeholder="999.00"
                            />
                        </Field>
                    </div>

                    <Field
                        label="Access length (days)"
                        htmlFor="plan-duration"
                        hint={
                            form.billing_type === "MONTHLY"
                                ? "Required for a monthly plan. 30 is typical."
                                : "Leave empty for access that never expires."
                        }
                        error={fields.duration_days}
                    >
                        <Input
                            id="plan-duration"
                            type="number"
                            min={1}
                            value={form.duration_days ?? ""}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    duration_days: event.target.value
                                        ? Number(event.target.value)
                                        : null,
                                })
                            }
                            placeholder={
                                form.billing_type === "MONTHLY" ? "30" : ""
                            }
                        />
                    </Field>

                    <Field
                        label="Status"
                        htmlFor="plan-status"
                        hint="Hidden plans disappear from the customer's Plans page. Nobody loses access they already bought."
                    >
                        <Select
                            id="plan-status"
                            value={form.status}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    status: event.target
                                        .value as ProductInput["status"],
                                })
                            }
                        >
                            <option value="ACTIVE">On sale</option>
                            <option value="INACTIVE">Hidden</option>
                        </Select>
                    </Field>
                </form>
            </Modal>
        </div>
    );
}
