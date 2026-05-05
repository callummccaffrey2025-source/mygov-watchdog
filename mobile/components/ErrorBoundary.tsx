import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { reportError } from '../lib/errorReporting';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, {
      componentStack: info.componentStack ?? undefined,
      severity: 'fatal',
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={{
          flex: 1, backgroundColor: '#ffffff',
          alignItems: 'center', justifyContent: 'center',
          padding: 40, paddingTop: 80,
        }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>!</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a2332', textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, color: '#DC3545', textAlign: 'center', marginTop: 12, fontFamily: 'Courier' }}>
            {this.state.errorMessage}
          </Text>
          <Text style={{ fontSize: 15, color: '#5a6a7a', textAlign: 'center', lineHeight: 22, marginTop: 16 }}>
            Please restart the app. If this keeps happening, contact support@verity.au
          </Text>
          <Pressable
            style={{
              backgroundColor: '#00843D', borderRadius: 12,
              paddingHorizontal: 32, paddingVertical: 14, marginTop: 24,
            }}
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
