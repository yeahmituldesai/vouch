import React from 'react';
import { Text, View } from 'react-native';
import { C } from './theme';
import { Button } from './ui';

type State = { hasError: boolean; message: string };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: '' };
  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: String(err?.message ?? err ?? 'Something went wrong') };
  }
  componentDidCatch(err: any) {
    // eslint-disable-next-line no-console
    console.error('Vouch crashed:', err);
  }
  reset = () => this.setState({ hasError: false, message: '' });
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: C.t, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center', marginBottom: 20 }}>{this.state.message}</Text>
        <Button title="Try again" onPress={this.reset} />
      </View>
    );
  }
}