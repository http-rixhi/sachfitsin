import { useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    CalendarDays,
    Droplets,
    GlassWater,
    Pencil,
    Plus,
    Target,
    Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import {
    createWaterEntry,
    deleteWaterEntry,
    getWaterEntries,
    getWaterProfile,
    getWaterSummary,
    updateWaterEntry,
    updateWaterProfile,
    type WaterEntry,
} from "@/services/tracking";

const today = new Date().toISOString().split("T")[0];

const quickAmounts = [200, 250, 500, 750, 1000];

export default function Water() {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [selectedDate, setSelectedDate] = useState(today);
    const [showTargetForm, setShowTargetForm] = useState(false);
    const [target, setTarget] = useState("");
    const [customAmount, setCustomAmount] = useState("");
    const [editingEntry, setEditingEntry] = useState<WaterEntry | null>(
        null,
    );
    const [editAmount, setEditAmount] = useState("");

    const { data: profile } = useQuery({
        queryKey: ["water-profile"],
        queryFn: getWaterProfile,
    });

    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ["water-summary", selectedDate],
        queryFn: () => getWaterSummary(selectedDate),
    });

    const { data: entries = [], isLoading: entriesLoading } = useQuery({
        queryKey: ["water-entries", selectedDate],
        queryFn: () => getWaterEntries(selectedDate),
    });

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["water-entries"] });
        queryClient.invalidateQueries({ queryKey: ["water-summary"] });
    };

    const addWaterMutation = useMutation({
        mutationFn: (amount: number) =>
            createWaterEntry({ date: selectedDate, amount_ml: amount }),
        onSuccess: () => {
            refresh();
            setCustomAmount("");
        },
    });

    const updateEntryMutation = useMutation({
        mutationFn: ({ id, amount }: { id: number; amount: number }) =>
            updateWaterEntry(id, { amount_ml: amount }),
        onSuccess: () => {
            refresh();
            setEditingEntry(null);
            setEditAmount("");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteWaterEntry,
        onSuccess: refresh,
    });

    const targetMutation = useMutation({
        mutationFn: updateWaterProfile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["water-profile"] });
            queryClient.invalidateQueries({ queryKey: ["water-summary"] });
            notify("Daily water target saved.", "success");
            setShowTargetForm(false);
        },
    });

    const total = summary?.total_water_ml ?? 0;
    const dailyTarget = summary?.daily_target_ml ?? 0;

    const progress = Math.min(
        summary?.progress_percentage ??
            (dailyTarget > 0 ? (total / dailyTarget) * 100 : 0),
        100,
    );

    const litres = (millilitres: number) =>
        (millilitres / 1000).toFixed(2);

    const handleSetTarget = (event: React.FormEvent) => {
        event.preventDefault();

        const value = Number(target);

        if (!value || value <= 0) {
            return;
        }

        targetMutation.mutate(value);
    };

    const openTargetForm = () => {
        setTarget(
            profile?.daily_water_target_ml
                ? String(profile.daily_water_target_ml)
                : "",
        );

        setShowTargetForm(true);
    };

    const openEdit = (entry: WaterEntry) => {
        setEditingEntry(entry);
        setEditAmount(String(entry.amount_ml));
    };

    const addCustom = () => {
        const value = Number(customAmount);

        if (!value || value <= 0) {
            return;
        }

        addWaterMutation.mutate(value);
    };

    const circumference = 2 * Math.PI * 54;

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Daily tracker"
                title="Water Tracker"
                description="Stay hydrated. Log every glass and watch the ring fill up."
                actions={
                    <>
                        <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3.5">
                            <CalendarDays className="size-4 text-muted-foreground" />

                            <input
                                type="date"
                                value={selectedDate}
                                max={today}
                                onChange={(event) =>
                                    setSelectedDate(event.target.value)
                                }
                                aria-label="Pick a date"
                                className="bg-transparent text-sm outline-none"
                            />
                        </div>

                        <Button variant="outline" onClick={openTargetForm}>
                            <Target />
                            Set target
                        </Button>
                    </>
                }
            />

            <div className="grid gap-5 lg:grid-cols-3">
                {/* Progress ring */}
                <Card className="lg:col-span-1">
                    <CardBody className="flex flex-col items-center py-8">
                        {summaryLoading ? (
                            <LoadingBlock
                                label="Loading..."
                                className="border-0 bg-transparent"
                            />
                        ) : (
                            <>
                                <div className="relative size-40">
                                    <svg
                                        viewBox="0 0 120 120"
                                        className="size-full -rotate-90"
                                    >
                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="54"
                                            fill="none"
                                            stroke="var(--secondary)"
                                            strokeWidth="11"
                                        />

                                        <circle
                                            cx="60"
                                            cy="60"
                                            r="54"
                                            fill="none"
                                            stroke="var(--info)"
                                            strokeWidth="11"
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={
                                                circumference *
                                                (1 - progress / 100)
                                            }
                                            className="transition-all duration-700"
                                        />
                                    </svg>

                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <Droplets className="size-5 text-info" />

                                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                                            {Math.round(progress)}%
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            of target
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-6 text-3xl font-semibold tabular-nums">
                                    {litres(total)} L
                                </p>

                                <p className="mt-1 text-sm text-muted-foreground">
                                    {dailyTarget
                                        ? `of ${litres(dailyTarget)} L target`
                                        : "No target set yet"}
                                </p>
                            </>
                        )}
                    </CardBody>
                </Card>

                {/* Quick add */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GlassWater className="size-4.5 text-info" />
                            Add water
                        </CardTitle>
                    </CardHeader>

                    <CardBody className="space-y-5">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                            {quickAmounts.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    disabled={addWaterMutation.isPending}
                                    onClick={() =>
                                        addWaterMutation.mutate(amount)
                                    }
                                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-4 transition hover:-translate-y-0.5 hover:border-info/50 hover:shadow-[var(--shadow-lift)] disabled:opacity-50"
                                >
                                    <Droplets className="size-5 text-info" />

                                    <span className="text-sm font-semibold tabular-nums">
                                        {amount}
                                    </span>

                                    <span className="text-[0.6875rem] text-muted-foreground">
                                        ml
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <Field
                                label="Other amount (ml)"
                                htmlFor="custom-water"
                                className="flex-1"
                            >
                                <Input
                                    id="custom-water"
                                    type="number"
                                    min={1}
                                    value={customAmount}
                                    onChange={(event) =>
                                        setCustomAmount(event.target.value)
                                    }
                                    placeholder="e.g. 350"
                                />
                            </Field>

                            <Button
                                onClick={addCustom}
                                disabled={
                                    !customAmount ||
                                    addWaterMutation.isPending
                                }
                            >
                                <Plus />
                                Add
                            </Button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <StatCard
                                icon={<Droplets />}
                                tone="info"
                                label="Drunk today"
                                value={`${litres(total)} L`}
                            />

                            <StatCard
                                icon={<Target />}
                                tone="primary"
                                label="Target"
                                value={
                                    dailyTarget
                                        ? `${litres(dailyTarget)} L`
                                        : "—"
                                }
                            />

                            <StatCard
                                icon={<GlassWater />}
                                tone="neutral"
                                label="Left to drink"
                                value={
                                    summary?.remaining_water_ml != null
                                        ? `${litres(
                                              Math.max(
                                                  summary.remaining_water_ml,
                                                  0,
                                              ),
                                          )} L`
                                        : "—"
                                }
                            />
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Entries */}
            <Card>
                <CardHeader>
                    <CardTitle>Today's log</CardTitle>

                    <p className="text-sm text-muted-foreground">
                        {entries.length} entr
                        {entries.length === 1 ? "y" : "ies"} on{" "}
                        {new Date(selectedDate).toLocaleDateString()}
                    </p>
                </CardHeader>

                <CardBody className="p-0 sm:p-0">
                    {entriesLoading ? (
                        <LoadingBlock
                            label="Loading entries..."
                            className="border-0 bg-transparent"
                        />
                    ) : entries.length === 0 ? (
                        <EmptyState
                            icon={<Droplets />}
                            title="Nothing logged yet"
                            description="Tap a quick amount above to add your first glass."
                            className="border-0 bg-transparent"
                        />
                    ) : (
                        <ul className="divide-y divide-border">
                            {entries.map((entry) => (
                                <li
                                    key={entry.id}
                                    className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/12 text-info">
                                        <Droplets className="size-[1.125rem]" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold tabular-nums">
                                            {entry.amount_ml} ml
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            {new Date(
                                                entry.created_at,
                                            ).toLocaleTimeString(undefined, {
                                                hour: "numeric",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="icon-sm"
                                        aria-label="Edit entry"
                                        onClick={() => openEdit(entry)}
                                    >
                                        <Pencil />
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Delete entry"
                                        onClick={() =>
                                            deleteMutation.mutate(entry.id)
                                        }
                                        className="text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>

            {/* Target modal */}
            <Modal
                open={showTargetForm}
                onClose={() => setShowTargetForm(false)}
                size="sm"
                title="Daily water target"
                description="Most adults aim for 2000–3000 ml a day."
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowTargetForm(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="water-target-form"
                            disabled={targetMutation.isPending}
                        >
                            Save target
                        </Button>
                    </>
                }
            >
                <form
                    id="water-target-form"
                    onSubmit={handleSetTarget}
                    className="space-y-4"
                >
                    <Field
                        label="Target (ml)"
                        htmlFor="water-target"
                        required
                    >
                        <Input
                            id="water-target"
                            type="number"
                            min={1}
                            value={target}
                            onChange={(event) =>
                                setTarget(event.target.value)
                            }
                            placeholder="2500"
                            required
                        />
                    </Field>

                    <div className="flex flex-wrap gap-2">
                        {[2000, 2500, 3000, 3500].map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setTarget(String(preset))}
                                className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                            >
                                {preset} ml
                            </button>
                        ))}
                    </div>
                </form>
            </Modal>

            {/* Edit entry modal */}
            <Modal
                open={Boolean(editingEntry)}
                onClose={() => setEditingEntry(null)}
                size="sm"
                title="Edit entry"
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setEditingEntry(null)}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={() => {
                                const value = Number(editAmount);

                                if (!editingEntry || !value || value <= 0) {
                                    return;
                                }

                                updateEntryMutation.mutate({
                                    id: editingEntry.id,
                                    amount: value,
                                });
                            }}
                            disabled={updateEntryMutation.isPending}
                        >
                            Save
                        </Button>
                    </>
                }
            >
                <Field label="Amount (ml)" htmlFor="edit-water">
                    <Input
                        id="edit-water"
                        type="number"
                        min={1}
                        value={editAmount}
                        onChange={(event) =>
                            setEditAmount(event.target.value)
                        }
                    />
                </Field>
            </Modal>
        </div>
    );
}
