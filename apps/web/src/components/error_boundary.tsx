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
                <div className="flex min-h-screen items-center justify-center p-4">
                    <div className="max-w-md w-full text-center">
                        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
                        <p className="text-muted-foreground mb-6">
                            We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
                        </p>
                        {this.props.fallback || (
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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
