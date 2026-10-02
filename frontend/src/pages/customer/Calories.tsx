import { useMemo, useState } from "react";
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    CalendarDays,
    Coffee,
    Cookie,
    Flame,
    Moon,
    Pencil,
    Plus,
    Sun,
    Target,
    Trash2,
    Utensils,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader, StatCard } from "@/components/ui/page-header";
import { LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import {
    createCalorieEntry,
    deleteCalorieEntry,
    getCalorieEntries,
    getCalorieProfile,
    getCalorieSummary,
    updateCalorieEntry,
    updateCalorieProfile,
    type CalorieEntry,
    type CreateCalorieEntryData,
    type MealType,
} from "@/services/tracking";

const meals: Array<{
    type: MealType;
    label: string;
    icon: typeof Coffee;
}> = [
    { type: "BREAKFAST", label: "Breakfast", icon: Coffee },
    { type: "LUNCH", label: "Lunch", icon: Sun },
    { type: "DINNER", label: "Dinner", icon: Moon },
    { type: "SNACK", label: "Snacks", icon: Cookie },
];

const today = new Date().toISOString().split("T")[0];

const emptyEntry: CreateCalorieEntryData = {
    date: today,
    meal_type: "BREAKFAST",
    food_name: "",
    quantity: "",
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
};

export default function Calories() {
    const queryClient = useQueryClient();
    const { notify } = useToast();

    const [selectedDate, setSelectedDate] = useState(today);
    const [showEntryForm, setShowEntryForm] = useState(false);
    const [editingEntry, setEditingEntry] = useState<CalorieEntry | null>(
        null,
    );
    const [entryForm, setEntryForm] =
        useState<CreateCalorieEntryData>(emptyEntry);
    const [showTargets, setShowTargets] = useState(false);
    const [targetForm, setTargetForm] = useState({
        daily_calorie_target: "",
        protein_target_g: "",
        carbs_target_g: "",
        fat_target_g: "",
    });

    const { data: profile } = useQuery({
        queryKey: ["calorie-profile"],
        queryFn: getCalorieProfile,
    });

    const { data: summary, isLoading: summaryLoading } = useQuery({
        queryKey: ["calorie-summary", selectedDate],
        queryFn: () => getCalorieSummary(selectedDate),
    });

    const { data: entries = [], isLoading: entriesLoading } = useQuery({
        queryKey: ["calorie-entries", selectedDate],
        queryFn: () => getCalorieEntries(selectedDate),
    });

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["calorie-entries"] });
        queryClient.invalidateQueries({ queryKey: ["calorie-summary"] });
    };

    const saveEntryMutation = useMutation({
        mutationFn: async (data: CreateCalorieEntryData) => {
            if (editingEntry) {
                return updateCalorieEntry(editingEntry.id, data);
            }

            return createCalorieEntry(data);
        },
        onSuccess: () => {
            refresh();
            setShowEntryForm(false);
            setEditingEntry(null);
            setEntryForm({ ...emptyEntry, date: selectedDate });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteCalorieEntry,
        onSuccess: refresh,
    });

    const profileMutation = useMutation({
        mutationFn: updateCalorieProfile,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["calorie-profile"] });
            queryClient.invalidateQueries({ queryKey: ["calorie-summary"] });
            notify("Targets saved.", "success");
            setShowTargets(false);
        },
    });

    const groupedEntries = useMemo(() => {
        return {
            BREAKFAST: entries.filter((e) => e.meal_type === "BREAKFAST"),
            LUNCH: entries.filter((e) => e.meal_type === "LUNCH"),
            DINNER: entries.filter((e) => e.meal_type === "DINNER"),
            SNACK: entries.filter((e) => e.meal_type === "SNACK"),
        } as Record<MealType, CalorieEntry[]>;
    }, [entries]);

    const openAddForm = (mealType?: MealType) => {
        setEditingEntry(null);

        setEntryForm({
            ...emptyEntry,
            date: selectedDate,
            meal_type: mealType ?? "BREAKFAST",
        });

        setShowEntryForm(true);
    };

    const openEditForm = (entry: CalorieEntry) => {
        setEditingEntry(entry);

        setEntryForm({
            date: entry.date,
            meal_type: entry.meal_type,
            food_name: entry.food_name,
            quantity: entry.quantity,
            calories: entry.calories,
            protein_g: entry.protein_g,
            carbs_g: entry.carbs_g,
            fat_g: entry.fat_g,
        });

        setShowEntryForm(true);
    };

    const openTargets = () => {
        setTargetForm({
            daily_calorie_target: profile?.daily_calorie_target
                ? String(profile.daily_calorie_target)
                : "",
            protein_target_g: profile?.protein_target_g
                ? String(profile.protein_target_g)
                : "",
            carbs_target_g: profile?.carbs_target_g
                ? String(profile.carbs_target_g)
                : "",
            fat_target_g: profile?.fat_target_g
                ? String(profile.fat_target_g)
                : "",
        });

        setShowTargets(true);
    };

    const handleEntrySubmit = (event: React.FormEvent) => {
        event.preventDefault();
        saveEntryMutation.mutate(entryForm);
    };

    const handleTargetSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        const toNumber = (value: string) =>
            value.trim() === "" ? null : Number(value);

        profileMutation.mutate({
            daily_calorie_target: toNumber(targetForm.daily_calorie_target),
            protein_target_g: toNumber(targetForm.protein_target_g),
            carbs_target_g: toNumber(targetForm.carbs_target_g),
            fat_target_g: toNumber(targetForm.fat_target_g),
        });
    };

    const consumed = summary?.calories_consumed ?? 0;
    const calorieTarget = summary?.calorie_target ?? 0;

    const progress =
        calorieTarget > 0
            ? Math.min((consumed / calorieTarget) * 100, 100)
            : 0;

    const overTarget = calorieTarget > 0 && consumed > calorieTarget;

    const macros = [
        {
            label: "Protein",
            value: summary?.protein_g ?? 0,
            target: profile?.protein_target_g ?? null,
            colour: "bg-primary",
        },
        {
            label: "Carbs",
            value: summary?.carbs_g ?? 0,
            target: profile?.carbs_target_g ?? null,
            colour: "bg-info",
        },
        {
            label: "Fat",
            value: summary?.fat_g ?? 0,
            target: profile?.fat_target_g ?? null,
            colour: "bg-warning",
        },
    ];

    const circumference = 2 * Math.PI * 54;

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Daily tracker"
                title="Calorie Tracker"
                description="Log what you eat and see how the day adds up."
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

                        <Button variant="outline" onClick={openTargets}>
                            <Target />
                            Targets
                        </Button>

                        <Button onClick={() => openAddForm()}>
                            <Plus />
                            Add food
                        </Button>
                    </>
                }
            />

            <div className="grid gap-5 lg:grid-cols-3">
                {/* Ring */}
                <Card>
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
                                            stroke={
                                                overTarget
                                                    ? "var(--destructive)"
                                                    : "var(--warning)"
                                            }
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
                                        <Flame className="size-5 text-warning" />

                                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                                            {Math.round(consumed)}
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            kcal eaten
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-6 text-sm text-muted-foreground">
                                    {calorieTarget
                                        ? overTarget
                                            ? `${Math.round(
                                                  consumed - calorieTarget,
                                              )} kcal over your target`
                                            : `${Math.round(
                                                  calorieTarget - consumed,
                                              )} kcal left today`
                                        : "Set a daily target to track progress"}
                                </p>

                                {!calorieTarget && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={openTargets}
                                    >
                                        <Target />
                                        Set target
                                    </Button>
                                )}
                            </>
                        )}
                    </CardBody>
                </Card>

                {/* Macros */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Today's nutrition</CardTitle>
                    </CardHeader>

                    <CardBody className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <StatCard
                                icon={<Flame />}
                                tone="warning"
                                label="Calories"
                                value={Math.round(consumed)}
                                sub={
                                    calorieTarget
                                        ? `of ${calorieTarget} kcal`
                                        : "No target set"
                                }
                            />

                            <StatCard
                                icon={<Utensils />}
                                tone="primary"
                                label="Foods logged"
                                value={entries.length}
                                sub="Across all meals"
                            />

                            <StatCard
                                icon={<Target />}
                                tone="info"
                                label="Remaining"
                                value={
                                    summary?.remaining_calories != null
                                        ? Math.round(
                                              summary.remaining_calories,
                                          )
                                        : "—"
                                }
                                sub="kcal"
                            />
                        </div>

                        <div className="space-y-4">
                            {macros.map((macro) => {
                                const percent = macro.target
                                    ? Math.min(
                                          (macro.value /
                                              Number(macro.target)) *
                                              100,
                                          100,
                                      )
                                    : 0;

                                return (
                                    <div key={macro.label}>
                                        <div className="mb-1.5 flex items-center justify-between text-sm">
                                            <span className="font-medium">
                                                {macro.label}
                                            </span>

                                            <span className="tabular-nums text-muted-foreground">
                                                {Math.round(macro.value)} g
                                                {macro.target
                                                    ? ` / ${macro.target} g`
                                                    : ""}
                                            </span>
                                        </div>

                                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${macro.colour}`}
                                                style={{
                                                    width: `${percent}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Meals */}
            {entriesLoading ? (
                <LoadingBlock label="Loading your food log..." />
            ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                    {meals.map((meal) => {
                        const mealEntries = groupedEntries[meal.type];

                        const mealCalories = mealEntries.reduce(
                            (sum, entry) => sum + Number(entry.calories),
                            0,
                        );

                        return (
                            <Card key={meal.type}>
                                <CardHeader className="flex-row items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                                            <meal.icon className="size-[1.125rem]" />
                                        </span>

                                        <div>
                                            <CardTitle>
                                                {meal.label}
                                            </CardTitle>

                                            <p className="text-sm tabular-nums text-muted-foreground">
                                                {Math.round(mealCalories)} kcal
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="icon-sm"
                                        aria-label={`Add to ${meal.label}`}
                                        onClick={() => openAddForm(meal.type)}
                                    >
                                        <Plus />
                                    </Button>
                                </CardHeader>

                                <CardBody className="p-0 sm:p-0">
                                    {mealEntries.length === 0 ? (
                                        <p className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6">
                                            Nothing logged for {meal.label.toLowerCase()} yet.
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-border">
                                            {mealEntries.map((entry) => (
                                                <li
                                                    key={entry.id}
                                                    className="flex items-center gap-3 px-5 py-3.5 sm:px-6"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium">
                                                            {entry.food_name}
                                                        </p>

                                                        <p className="text-xs text-muted-foreground">
                                                            {entry.quantity ||
                                                                "1 serving"}{" "}
                                                            ·{" "}
                                                            {Math.round(
                                                                Number(
                                                                    entry.protein_g,
                                                                ),
                                                            )}
                                                            P /{" "}
                                                            {Math.round(
                                                                Number(
                                                                    entry.carbs_g,
                                                                ),
                                                            )}
                                                            C /{" "}
                                                            {Math.round(
                                                                Number(
                                                                    entry.fat_g,
                                                                ),
                                                            )}
                                                            F
                                                        </p>
                                                    </div>

                                                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                                                        {Math.round(
                                                            Number(
                                                                entry.calories,
                                                            ),
                                                        )}
                                                    </span>

                                                    <Button
                                                        variant="outline"
                                                        size="icon-sm"
                                                        aria-label="Edit food"
                                                        onClick={() =>
                                                            openEditForm(entry)
                                                        }
                                                    >
                                                        <Pencil />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon-sm"
                                                        aria-label="Delete food"
                                                        onClick={() =>
                                                            deleteMutation.mutate(
                                                                entry.id,
                                                            )
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
                        );
                    })}
                </div>
            )}

            {/* Entry modal */}
            <Modal
                open={showEntryForm}
                onClose={() => setShowEntryForm(false)}
                title={editingEntry ? "Edit food" : "Add food"}
                description="Enter what you ate and roughly how much."
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowEntryForm(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="calorie-entry-form"
                            disabled={saveEntryMutation.isPending}
                        >
                            {editingEntry ? "Save changes" : "Add food"}
                        </Button>
                    </>
                }
            >
                <form
                    id="calorie-entry-form"
                    onSubmit={handleEntrySubmit}
                    className="space-y-5"
                >
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Meal" htmlFor="meal_type">
                            <Select
                                id="meal_type"
                                value={entryForm.meal_type}
                                onChange={(event) =>
                                    setEntryForm({
                                        ...entryForm,
                                        meal_type: event.target
                                            .value as MealType,
                                    })
                                }
                            >
                                {meals.map((meal) => (
                                    <option
                                        key={meal.type}
                                        value={meal.type}
                                    >
                                        {meal.label}
                                    </option>
                                ))}
                            </Select>
                        </Field>

                        <Field label="Date" htmlFor="entry-date">
                            <Input
                                id="entry-date"
                                type="date"
                                value={entryForm.date}
                                max={today}
                                onChange={(event) =>
                                    setEntryForm({
                                        ...entryForm,
                                        date: event.target.value,
                                    })
                                }
                            />
                        </Field>
                    </div>

                    <Field label="Food" htmlFor="food_name" required>
                        <Input
                            id="food_name"
                            value={entryForm.food_name}
                            onChange={(event) =>
                                setEntryForm({
                                    ...entryForm,
                                    food_name: event.target.value,
                                })
                            }
                            placeholder="e.g. Oats with milk"
                            required
                        />
                    </Field>

                    <Field
                        label="Quantity"
                        htmlFor="quantity"
                        hint="How much you ate — a bowl, 2 rotis, 100 g."
                    >
                        <Input
                            id="quantity"
                            value={entryForm.quantity}
                            onChange={(event) =>
                                setEntryForm({
                                    ...entryForm,
                                    quantity: event.target.value,
                                })
                            }
                            placeholder="1 bowl"
                        />
                    </Field>

                    <Field label="Calories (kcal)" htmlFor="calories" required>
                        <Input
                            id="calories"
                            type="number"
                            min={0}
                            value={entryForm.calories}
                            onChange={(event) =>
                                setEntryForm({
                                    ...entryForm,
                                    calories: Number(event.target.value),
                                })
                            }
                            required
                        />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-3">
                        <Field label="Protein (g)" htmlFor="protein_g">
                            <Input
                                id="protein_g"
                                type="number"
                                min={0}
                                step="0.1"
                                value={entryForm.protein_g}
                                onChange={(event) =>
                                    setEntryForm({
                                        ...entryForm,
                                        protein_g: Number(event.target.value),
                                    })
                                }
                            />
                        </Field>

                        <Field label="Carbs (g)" htmlFor="carbs_g">
                            <Input
                                id="carbs_g"
                                type="number"
                                min={0}
                                step="0.1"
                                value={entryForm.carbs_g}
                                onChange={(event) =>
                                    setEntryForm({
                                        ...entryForm,
                                        carbs_g: Number(event.target.value),
                                    })
                                }
                            />
                        </Field>

                        <Field label="Fat (g)" htmlFor="fat_g">
                            <Input
                                id="fat_g"
                                type="number"
                                min={0}
                                step="0.1"
                                value={entryForm.fat_g}
                                onChange={(event) =>
                                    setEntryForm({
                                        ...entryForm,
                                        fat_g: Number(event.target.value),
                                    })
                                }
                            />
                        </Field>
                    </div>
                </form>
            </Modal>

            {/* Targets modal */}
            <Modal
                open={showTargets}
                onClose={() => setShowTargets(false)}
                size="sm"
                title="Daily targets"
                description="Leave a field empty if you do not want to track it."
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setShowTargets(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="submit"
                            form="calorie-target-form"
                            disabled={profileMutation.isPending}
                        >
                            Save targets
                        </Button>
                    </>
                }
            >
                <form
                    id="calorie-target-form"
                    onSubmit={handleTargetSubmit}
                    className="space-y-5"
                >
                    <Field label="Calories (kcal)" htmlFor="target-calories">
                        <Input
                            id="target-calories"
                            type="number"
                            min={0}
                            value={targetForm.daily_calorie_target}
                            onChange={(event) =>
                                setTargetForm({
                                    ...targetForm,
                                    daily_calorie_target: event.target.value,
                                })
                            }
                            placeholder="1800"
                        />
                    </Field>

                    <div className="grid gap-5 sm:grid-cols-3">
                        <Field label="Protein (g)" htmlFor="target-protein">
                            <Input
                                id="target-protein"
                                type="number"
                                min={0}
                                value={targetForm.protein_target_g}
                                onChange={(event) =>
                                    setTargetForm({
                                        ...targetForm,
                                        protein_target_g: event.target.value,
                                    })
                                }
                                placeholder="90"
                            />
                        </Field>

                        <Field label="Carbs (g)" htmlFor="target-carbs">
                            <Input
                                id="target-carbs"
                                type="number"
                                min={0}
                                value={targetForm.carbs_target_g}
                                onChange={(event) =>
                                    setTargetForm({
                                        ...targetForm,
                                        carbs_target_g: event.target.value,
                                    })
                                }
                                placeholder="200"
                            />
                        </Field>

                        <Field label="Fat (g)" htmlFor="target-fat">
                            <Input
                                id="target-fat"
                                type="number"
                                min={0}
                                value={targetForm.fat_target_g}
                                onChange={(event) =>
                                    setTargetForm({
                                        ...targetForm,
                                        fat_target_g: event.target.value,
                                    })
                                }
                                placeholder="55"
                            />
                        </Field>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
