import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import COLORS from '../../constants/colors';

export default class RouteErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error) {
    if (__DEV__) console.error('[Wrapchik Route Error]', error?.name || 'Error');
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.eyebrow}>WRAPCHIK</Text>
      <Text style={styles.title}>This screen hit a problem</Text>
      <Text style={styles.message}>Your account and saved orders are still safe. Try loading this screen again.</Text>
      <TouchableOpacity onPress={this.retry} style={styles.button} accessibilityRole="button" accessibilityLabel="Try loading this screen again">
        <Text style={styles.buttonText}>Try again</Text>
      </TouchableOpacity>
    </View>;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: COLORS.background },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 9 },
  message: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, maxWidth: 420 },
  button: { marginTop: 18, minHeight: 48, justifyContent: 'center', paddingHorizontal: 22, borderRadius: 14, backgroundColor: COLORS.primary },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
