import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    CheckCircle2,
    HeartPulse,
    Ruler,
    Save,
    Salad,
    Target,
    UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ApiErrorState } from "@/components/ui/error-state";
import { FormError } from "@/components/ui/form-error";
import { LoadingBlock, Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast-context";
import { errorMessage, fieldErrors } from "@/lib/api-error";
import {
    getCustomerProfile,
    updateCustomerProfile,
    type CustomerProfileInput,
} from "@/services/customerProfile";

const initialForm: CustomerProfileInput = {
    phone_number: "",
    profession: "",
    current_diet: "",
    dietary_preference: "",
    allergies: "",
    food_dislikes: "",
    height_cm: null,
    current_weight_kg: null,
    target_weight_kg: null,
    activity_level: "",
    goals: "",
};

const activityLevels = [
    { value: "SEDENTARY", label: "Sedentary, mostly sitting" },
    { value: "LIGHT", label: "Lightly active, light walking" },
    { value: "MODERATE", label: "Moderately active, regular exercise" },
    { value: "VERY_ACTIVE", label: "Very active, daily hard exercise" },
    { value: "ATHLETE", label: "Athlete, training most days" },
];

const dietaryPreferences = [
    "Vegetarian",
    "Vegan",
    "Eggetarian",
    "Non-vegetarian",
    "Jain",
    "Keto",
    "Gluten free",
];

export default function Profile() {
    const { notify } = useToast();

    const [form, setForm] = useState<CustomerProfileInput>(initialForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<unknown>(null);
    const [saveError, setSaveError] = useState("");
    const [fieldMessages, setFieldMessages] = useState<
        Record<string, string>
    >({});

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const profile = await getCustomerProfile();

                setForm({
                    phone_number: profile.phone_number ?? "",
                    profession: profile.profession ?? "",
                    current_diet: profile.current_diet ?? "",
                    dietary_preference: profile.dietary_preference ?? "",
                    allergies: profile.allergies ?? "",
                    food_dislikes: profile.food_dislikes ?? "",
                    height_cm: profile.height_cm,
                    current_weight_kg: profile.current_weight_kg,
                    target_weight_kg: profile.target_weight_kg,
                    activity_level: profile.activity_level ?? "",
                    goals: profile.goals ?? "",
                });
            } catch (error) {
                setLoadError(error);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, []);

    const completion = useMemo(() => {
        const values = Object.values(form);

        const filled = values.filter(
            (value) => value !== null && value !== undefined && value !== "",
        ).length;

        return Math.round((filled / values.length) * 100);
    }, [form]);

    const bmi = useMemo(() => {
        if (!form.height_cm || !form.current_weight_kg) {
            return null;
        }

        const metres = Number(form.height_cm) / 100;

        if (!metres) {
            return null;
        }

        return (Number(form.current_weight_kg) / (metres * metres)).toFixed(
            1,
        );
    }, [form.height_cm, form.current_weight_kg]);

    const setField = (
        field: keyof CustomerProfileInput,
        value: string | number | null,
    ) => {
        setForm((previous) => ({ ...previous, [field]: value }));
    };

    const numberField = (value: number | null) =>
        value === null || value === undefined ? "" : value;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        setSaving(true);
        setSaveError("");
        setFieldMessages({});

        try {
            await updateCustomerProfile(form);
            notify("Profile saved.", "success");
        } catch (error) {
            setSaveError(errorMessage(error));
            setFieldMessages(fieldErrors(error));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <LoadingBlock label="Loading your profile..." />;
    }

    if (loadError) {
        return (
            <ApiErrorState
                error={loadError}
                title="Unable to load your profile"
                onRetry={() => window.location.reload()}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Your details"
                title="My Profile"
                description="Tell your dietician about yourself so your plan fits your real life."
                actions={
                    <Button
                        type="submit"
                        form="profile-form"
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <Spinner className="size-4 text-primary-foreground" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save />
                                Save profile
                            </>
                        )}
                    </Button>
                }
            />

            {/* Completion strip */}
            <Card>
                <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                            {completion === 100 ? (
                                <CheckCircle2 className="size-5" />
                            ) : (
                                <UserRound className="size-5" />
                            )}
                        </span>

                        <div>
                            <p className="text-sm font-medium">
                                Profile {completion}% complete
                            </p>

                            <p className="text-xs text-muted-foreground">
                                {completion === 100
                                    ? "Everything is filled in. Thank you."
                                    : "Fill the empty fields for a better plan."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {bmi && (
                            <div className="text-right">
                                <p className="text-xs text-muted-foreground">
                                    BMI
                                </p>

                                <p className="text-lg font-semibold tabular-nums">
                                    {bmi}
                                </p>
                            </div>
                        )}

                        <div className="h-2.5 w-40 overflow-hidden rounded-full bg-secondary">
                            <div
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{ width: `${completion}%` }}
                            />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <FormError message={saveError} />

            <form
                id="profile-form"
                onSubmit={handleSubmit}
                className="grid gap-5 lg:grid-cols-2"
            >
                {/* About you */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserRound className="size-4.5 text-primary" />
                            About you
                        </CardTitle>
                    </CardHeader>

                    <CardBody className="space-y-5">
                        <Field label="Phone number" htmlFor="phone_number" error={fieldMessages.phone_number}>
                            <Input
                                id="phone_number"
                                type="tel"
                                value={form.phone_number}
                                onChange={(event) =>
                                    setField(
                                        "phone_number",
                                        event.target.value,
                                    )
                                }
                                placeholder="+91 00000 00000"
                            />
                        </Field>

                        <Field label="Profession" htmlFor="profession" error={fieldMessages.profession}>
                            <Input
                                id="profession"
                                value={form.profession}
                                onChange={(event) =>
                                    setField("profession", event.target.value)
                                }
                                placeholder="e.g. Software engineer"
                            />
                        </Field>

                        <Field
                            label="Activity level"
                            htmlFor="activity_level"
                            hint="How much you move on a normal day."
                        >
                            <Select
                                id="activity_level"
                                value={form.activity_level}
                                onChange={(event) =>
                                    setField(
                                        "activity_level",
                                        event.target.value,
                                    )
                                }
                            >
                                <option value="">Select activity level</option>

                                {activityLevels.map((level) => (
                                    <option
                                        key={level.value}
                                        value={level.value}
                                    >
                                        {level.label}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </CardBody>
                </Card>

                {/* Body */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Ruler className="size-4.5 text-primary" />
                            Body measurements
                        </CardTitle>
                    </CardHeader>

                    <CardBody className="space-y-5">
                        <Field label="Height (cm)" htmlFor="height_cm" error={fieldMessages.height_cm}>
                            <Input
                                id="height_cm"
                                type="number"
                                step="0.1"
                                min={0}
                                value={numberField(form.height_cm)}
                                onChange={(event) =>
                                    setField(
                                        "height_cm",
                                        event.target.value
                                            ? Number(event.target.value)
                                            : null,
                                    )
                                }
                                placeholder="170"
                            />
                        </Field>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <Field
                                label="Current weight (kg)"
                                htmlFor="current_weight_kg"
                                error={fieldMessages.current_weight_kg}
                            >
                                <Input
                                    id="current_weight_kg"
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    value={numberField(
                                        form.current_weight_kg,
                                    )}
                                    onChange={(event) =>
                                        setField(
                                            "current_weight_kg",
                                            event.target.value
                                                ? Number(event.target.value)
                                                : null,
                                        )
                                    }
                                    placeholder="72"
                                />
                            </Field>

                            <Field
                                label="Target weight (kg)"
                                htmlFor="target_weight_kg"
                                error={fieldMessages.target_weight_kg}
                            >
                                <Input
                                    id="target_weight_kg"
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    value={numberField(form.target_weight_kg)}
                                    onChange={(event) =>
                                        setField(
                                            "target_weight_kg",
                                            event.target.value
                                                ? Number(event.target.value)
                                                : null,
                                        )
                                    }
                                    placeholder="66"
                                />
                            </Field>
                        </div>

                        {bmi && (
                            <div className="flex items-center gap-3 rounded-xl bg-accent p-3.5">
                                <Activity className="size-5 text-accent-foreground" />

                                <p className="text-sm text-accent-foreground">
                                    Your BMI is{" "}
                                    <strong className="tabular-nums">
                                        {bmi}
                                    </strong>
                                    . Your dietician will explain what this
                                    means for you.
                                </p>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Food */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Salad className="size-4.5 text-primary" />
                            Food & diet
                        </CardTitle>
                    </CardHeader>

                    <CardBody className="space-y-5">
                        <Field
                            label="Dietary preference"
                            htmlFor="dietary_preference"
                        >
                            <Input
                                id="dietary_preference"
                                list="dietary-preferences"
                                value={form.dietary_preference}
                                onChange={(event) =>
                                    setField(
                                        "dietary_preference",
                                        event.target.value,
                                    )
                                }
                                placeholder="e.g. Vegetarian"
                            />

                            <datalist id="dietary-preferences">
                                {dietaryPreferences.map((preference) => (
                                    <option
                                        key={preference}
                                        value={preference}
                                    />
                                ))}
                            </datalist>
                        </Field>

                        <Field
                            label="What you eat now"
                            htmlFor="current_diet"
                            hint="A normal day of meals is enough."
                        >
                            <Textarea
                                id="current_diet"
                                rows={4}
                                value={form.current_diet}
                                onChange={(event) =>
                                    setField(
                                        "current_diet",
                                        event.target.value,
                                    )
                                }
                                placeholder="Breakfast: ... Lunch: ... Dinner: ..."
                            />
                        </Field>

                        <Field label="Food dislikes" htmlFor="food_dislikes">
                            <Textarea
                                id="food_dislikes"
                                rows={3}
                                value={form.food_dislikes}
                                onChange={(event) =>
                                    setField(
                                        "food_dislikes",
                                        event.target.value,
                                    )
                                }
                                placeholder="Foods you would rather avoid"
                            />
                        </Field>
                    </CardBody>
                </Card>

                {/* Health */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <HeartPulse className="size-4.5 text-primary" />
                            Health & goals
                        </CardTitle>
                    </CardHeader>

                    <CardBody className="space-y-5">
                        <Field
                            label="Allergies"
                            htmlFor="allergies"
                            hint="Important. This keeps your plan safe."
                        >
                            <Textarea
                                id="allergies"
                                rows={3}
                                value={form.allergies}
                                onChange={(event) =>
                                    setField("allergies", event.target.value)
                                }
                                placeholder="e.g. peanuts, lactose"
                            />
                        </Field>

                        <Field label="Your goals" htmlFor="goals" error={fieldMessages.goals}>
                            <Textarea
                                id="goals"
                                rows={5}
                                value={form.goals}
                                onChange={(event) =>
                                    setField("goals", event.target.value)
                                }
                                placeholder="e.g. Lose 6 kg in 4 months and feel less tired"
                            />
                        </Field>

                        <div className="flex items-center gap-3 rounded-xl bg-surface p-3.5">
                            <Target className="size-5 shrink-0 text-primary" />

                            <p className="text-sm text-muted-foreground">
                                Clear goals help your dietician set a realistic
                                plan instead of a generic one.
                            </p>
                        </div>
                    </CardBody>
                </Card>
            </form>

            <div className="flex justify-end">
                <Button
                    type="submit"
                    form="profile-form"
                    size="lg"
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <Spinner className="size-4 text-primary-foreground" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save />
                            Save profile
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
