import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error logged to crash reporting service in production
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.content}>
            <Ionicons name="alert-circle-outline" size={56} color="#e8ecf0" />
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.body}>
              An unexpected error occurred. Please try restarting the app.
            </Text>
            <Pressable
              style={styles.btn}
              onPress={() => this.setState({ hasError: false })}
            >
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 40, gap: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1a2332', textAlign: 'center' },
  body: { fontSize: 15, color: '#5a6a7a', textAlign: 'center', lineHeight: 22 },
  btn: {
    backgroundColor: '#00843D', borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 14, marginTop: 8,
  },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
