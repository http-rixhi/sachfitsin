import { BrandMark } from "@/components/Brand";
import { Spinner } from "@/components/ui/states";

export function FullPageLoader({
    label = "Loading...",
}: {
    label?: string;
}) {
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
            <BrandMark className="size-12 [&_svg]:size-7" />

            <div className="flex items-center gap-2.5">
                <Spinner />

                <p className="text-sm text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}
