// Filet de sécurité pour les crashs au lancement : sans appareil branché (adb logcat)
// ni service de crash reporting, un crash natif "silencieux" ne laisse aucune trace
// exploitable. Ce composant capture au moins les erreurs JS survenant pendant le rendu
// React et les affiche à l'écran (message + stack) au lieu de laisser l'app se fermer
// sans aucune information.
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Crash capturé :', error, errorInfo?.componentStack);
    this.setState({ componentStack: errorInfo?.componentStack || null });
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.title}>💥 Pulse a rencontré une erreur</Text>
          <Text style={styles.message}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
          {!!this.state.componentStack && (
            <Text style={styles.stack}>{this.state.componentStack}</Text>
          )}
          <Text style={styles.hint}>
            Fais une capture d'écran de ce message et envoie-la pour qu'on corrige le bug.
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080510' },
  content: { padding: 20, paddingTop: 60 },
  title: { color: '#ef4444', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  message: { color: '#fff', fontSize: 14, marginBottom: 16 },
  stack: {
    color: '#9b8cb0', fontSize: 11, marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  hint: { color: '#C9A84C', fontSize: 12 },
});
