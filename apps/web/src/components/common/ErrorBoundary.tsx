import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Kutilmagan interfeys xatosi:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="gm-error-boundary" role="alert">
          <h1>Nimadir noto‘g‘ri ketdi</h1>
          <p>Sahifani qayta yuklab ko‘ring. Muammo davom etsa, keyinroq qaytadan urinib ko‘ring.</p>
          <Button onClick={() => window.location.reload()}>Sahifani qayta yuklash</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
