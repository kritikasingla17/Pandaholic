import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import AppCrashPage from '../pages/AppCrashPage';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

// Catches errors outside the router (providers, router setup); page errors are handled by RouteErrorPage.
export default class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Unhandled app error:', error, info.componentStack);
  }

  render() {
    return this.state.hasError ? <AppCrashPage /> : this.props.children;
  }
}
