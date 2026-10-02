import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

/**
 * Catches render-time crashes so a bug in one component shows a readable
 * page instead of a blank white screen.
 *
 * This only catches errors thrown while rendering. Failed requests are
 * handled by React Query and the Axios layer instead.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Kept in the console rather than shown, so nothing internal
        // reaches the customer.
        console.error("Unhandled render error:", error, info.componentStack);
    }

    handleReload = () => {
        window.location.assign("/");
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
                <BrandMark className="size-12 [&_svg]:size-7" />

                <div>
                    <h1 className="text-2xl">Something went wrong</h1>

                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                        The page could not be displayed. Reloading usually
                        fixes it.
                    </p>
                </div>

                <Button onClick={this.handleReload}>
                    <RefreshCw />
                    Reload the app
                </Button>
            </div>
        );
    }
}
