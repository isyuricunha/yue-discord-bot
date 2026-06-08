import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error?: Error
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo)
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div data-theme="yudark" className="flex min-h-screen items-center justify-center bg-canvas p-4 text-foreground">
                    <div className="cursor-card w-full max-w-md p-6 text-center">
                        <h1 className="mb-4 text-xl font-semibold">Something went wrong</h1>
                        <p className="mb-6 text-sm text-muted-foreground">
                            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
                        </p>
                        {this.props.fallback || (
                            <button
                                onClick={() => window.location.reload()}
                                className="rounded-xl border border-accent/40 bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-yellowGlow transition-colors hover:bg-accent-hover"
                            >
                                Refresh Page
                            </button>
                        )}
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
