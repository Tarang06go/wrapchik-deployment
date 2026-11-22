import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import Button from '../common/Button';

export const ADMIN_TYPE = Object.freeze({
  pageTitle: 24,
  sectionTitle: 18,
  cardTitle: 15,
  body: 14,
  helper: 13,
  caption: 12,
});

export function AdminCard({ children, style, ...props }) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

export function AdminLoadingState({ message = 'Loading outlet data…' }) {
  return <View style={styles.loadingPage} accessibilityRole="progressbar" accessibilityLabel={message}>
    <Text style={styles.loadingMessage}>{message}</Text>
    <View style={styles.skeletonHeading} />
    {[0, 1, 2].map(row => <View key={row} style={styles.skeletonCard}>
      <View style={styles.skeletonIcon} />
      <View style={{ flex: 1, gap: 8 }}><View style={[styles.skeletonLine, { width: row === 1 ? '54%' : '68%' }]} /><View style={[styles.skeletonLine, styles.skeletonLineShort]} /></View>
      <View style={styles.skeletonAction} />
    </View>)}
  </View>;
}

export function AdminChip({ children, onPress, selected = false, style, accessibilityLabel, ...props }) {
  return <Pressable
    {...props}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ selected }}
    style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed, style]}
  >{children}</Pressable>;
}

export function AdminFormModal({ visible, title, onClose, onSave, saveTitle, saving = false, saveDisabled = false, children }) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.modal} accessibilityViewIsModal>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close form">
            <X size={19} color="#5D646B" />
          </Pressable>
        </View>
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {children}
        </ScrollView>
        <View style={styles.actions}>
          <Button title="Cancel" variant="outline" onPress={onClose} style={styles.actionButton} />
          <Button title={saving ? 'Saving…' : saveTitle} onPress={onSave} disabled={saving || saveDisabled} style={styles.actionButton} />
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#E8E4DE', borderWidth: 1, borderRadius: 12, padding: 14 },
  chip: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#E3DED8', backgroundColor: '#FFFFFF' },
  chipSelected: { backgroundColor: '#FFF0EB', borderColor: '#FF5722' },
  chipPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(20,22,24,.52)' },
  modal: { width: '100%', maxWidth: 620, maxHeight: '92%', alignSelf: 'center', padding: 18, borderRadius: 16, backgroundColor: '#FFFDFB', borderWidth: 1, borderColor: '#F0E7E0' },
  modalHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 8 },
  modalTitle: { flex: 1, color: '#252B33', fontSize: 20, fontWeight: '900' },
  closeButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: '#F4F1EE' },
  formScroll: { flexShrink: 1 },
  formContent: { paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EFEAE4' },
  actionButton: { flex: 1, minHeight: 48 },
  loadingPage: { flex: 1, backgroundColor: '#F6F4F1', padding: 16, gap: 12, justifyContent: 'center', alignSelf: 'center', width: '100%', maxWidth: 760 },
  loadingMessage: { fontSize: 13, color: '#737A82', fontWeight: '700', marginBottom: 4 },
  skeletonHeading: { width: '56%', height: 23, borderRadius: 7, backgroundColor: '#E9E5E0', marginBottom: 3 },
  skeletonCard: { minHeight: 76, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE8E3' },
  skeletonIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEEAE6' },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: '#EEEAE6' },
  skeletonLineShort: { width: '36%', height: 10 },
  skeletonAction: { width: 56, height: 36, borderRadius: 9, backgroundColor: '#F4F1ED' },
});
