import React, { useContext, useEffect, useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform, Share, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Users, PlusCircle, LogIn, Lock, LogOut, ShoppingBag, Truck, Crown, CheckCircle2 } from 'lucide-react-native';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import groupService from '../services/groupService';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import COLORS from '../constants/colors';
import THEME from '../constants/theme';
import settingsService from '../services/settingsService';
import { outletDirectionsUrl } from '../utils/outletDirections';
import { getConfiguredPickupPoint } from '../utils/configuredPickupPoint';
import { validateNumericText } from '../utils/adminNumericForm.cjs';
import safeStorage from '../services/safeStorage';

export default function GroupOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const [tab, setTab] = useState('CREATE'); // CREATE, JOIN, LOBBY
  const [groupCode, setGroupCode] = useState('');
  const [orderType, setOrderType] = useState('TAKEAWAY'); // TAKEAWAY, DELIVERY
  const [hostel, setHostel] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [maxMembers, setMaxMembers] = useState('5');
  const [maxMembersError, setMaxMembersError] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDetails, setGroupDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [restoringGroup, setRestoringGroup] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const storageKey = user?._id ? `wrapchik_active_group_${user._id}` : '';
  const requestedGroupId = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const incomingCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const inviteUrl = groupDetails?.groupCode ? `wrapchik://group/${encodeURIComponent(groupDetails.groupCode)}` : '';

  useEffect(() => {
    const cleanCode = String(incomingCode || '').trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(cleanCode)) return;
    setGroupCode(cleanCode);
    setTab('JOIN');
  }, [incomingCode]);

  useEffect(() => {
    let active = true;
    settingsService.getSettings().then(response => {
      if (active) setPickupLocation(getConfiguredPickupPoint(response?.settings));
    }).catch(() => { if (active) setPickupLocation(''); });
    return () => { active = false; };
  }, []);

  // Persist only the group ID, then always revalidate access with the backend.
  useEffect(() => {
    if (!storageKey) return undefined;
    let active = true;
    (async () => {
      setRestoringGroup(true);
      setRestoreError('');
      try {
        const storedId = requestedGroupId || await safeStorage.getItem(storageKey);
        if (!active || !storedId) return;
        if (!/^[a-f\d]{24}$/i.test(String(storedId))) { void safeStorage.removeItem(storageKey); return; }
        const response = await groupService.getGroupDetails(String(storedId));
        if (active && response?.success && response.group) {
          setGroupDetails(response.group);
          setTab('LOBBY');
          void safeStorage.setItem(storageKey, String(storedId));
        }
      } catch (error) {
        // Keep a valid saved ID across temporary offline/API failures. Remove it
        // only after the backend proves the stored reference is invalid/forbidden.
        if (active && !requestedGroupId && [403, 404, 410].includes(error?.status)) void safeStorage.removeItem(storageKey);
        if (active && ![403, 404, 410].includes(error?.status)) setRestoreError(error?.message || 'Your saved group could not be checked. It is still saved; retry when you are online.');
      } finally {
        if (active) setRestoringGroup(false);
      }
    })();
    return () => { active = false; };
  }, [requestedGroupId, storageKey, restoreAttempt]);

  const shareInvite = async () => {
    if (!groupDetails?.groupCode || !inviteUrl) return;
    const text = `Join my Wrapchik Share a Meal group. Use code ${groupDetails.groupCode} or open ${inviteUrl}. The invite expires in two hours.`;
    try {
      await Share.share({ message: text, url: inviteUrl, title: 'Join Wrapchik group order' });
    } catch (error) {
      Alert.alert('Invite code', `Share this code with your group: ${groupDetails.groupCode}`);
    }
  };

  const openPickupDirections = async () => {
    try { await Linking.openURL(outletDirectionsUrl(Platform.OS, pickupLocation)); }
    catch { Alert.alert('Directions unavailable', 'Open Google Maps and search for the configured Wrapchik pickup point.'); }
  };

  useEffect(() => {
    const groupId = String(groupDetails?._id || '');
    if (!socket || !groupId) return undefined;
    const onGroupUpdated = async (update) => {
      if (String(update?.groupId) !== groupId) return;
      const isStillMember = update.members?.some((member) => String(member.userId) === String(user?._id));
      if (!isStillMember) {
        setGroupDetails(null);
        setTab('CREATE');
        if (storageKey) void safeStorage.removeItem(storageKey);
        Alert.alert('Group updated', 'You are no longer a member of this group.');
        return;
      }
      try {
        const response = await groupService.getGroupDetails(groupId);
        if (response?.success && response.group) setGroupDetails(response.group);
      } catch (error) {
        Alert.alert('Could not refresh group', error.message || 'Check your connection and try again.');
      }
    };
    const refreshGroup = async () => {
      try {
        const response = await groupService.getGroupDetails(groupId);
        if (response?.success && response.group) setGroupDetails(response.group);
      } catch (error) { console.warn('[Group refresh] Unable to reload authoritative group state:', error.message); }
    };
    socket.on('group_updated', onGroupUpdated);
    socket.on('refresh_authoritative_state', refreshGroup);
    socket.on('connect', refreshGroup);
    return () => { socket.off('group_updated', onGroupUpdated); socket.off('refresh_authoritative_state', refreshGroup); socket.off('connect', refreshGroup); };
  }, [socket, groupDetails?._id, user?._id, storageKey]);

  const handleCreateGroup = async () => {
    const memberCount = validateNumericText(maxMembers, { label: 'Maximum group members', min: 2, max: 8, integer: true });
    if (memberCount.error) { setMaxMembersError(memberCount.error); return; }
    setMaxMembersError('');
    if (orderType === 'DELIVERY' && !hostel.trim()) {
      Alert.alert('Required', 'Please enter your hostel or delivery location.');
      return;
    }
    if (orderType === 'DELIVERY' && !roomNumber.trim()) {
      Alert.alert('Required', 'Please enter the room or pickup point.');
      return;
    }
    setLoading(true);
    try {
      const data = { orderType, maxMembers: memberCount.value, ...(groupName.trim() ? { name: groupName.trim() } : {}) };
      if (orderType === 'DELIVERY') {
        data.hostel = hostel.trim();
        data.roomNumber = roomNumber.trim();
      }
      const res = await groupService.createGroup(data);
      if (res.success) {
        setGroupDetails(res.group);
        setTab('LOBBY');
        if (storageKey) void safeStorage.setItem(storageKey, String(res.group._id));
      } else {
        Alert.alert('Could Not Create', res.message || 'Failed to create group');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!groupCode.trim()) {
      Alert.alert('Required', 'Please enter a valid group code.');
      return;
    }
    setLoading(true);
    try {
      const res = await groupService.joinGroup(groupCode.trim().toUpperCase());
      if (res.success) {
        setGroupDetails(res.group);
        setTab('LOBBY');
        if (storageKey) void safeStorage.setItem(storageKey, String(res.group._id));
      } else {
        Alert.alert('Could Not Join', res.message || 'Group not found or expired');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  const handleLockGroup = async () => {
    setLoading(true);
    try {
      const res = await groupService.lockGroup(groupDetails._id);
      if (res.success) {
        setGroupDetails(res.group);
        Alert.alert('Group Locked', 'The invite is closed. New members can no longer join.');
      } else {
        Alert.alert('Error', res.message || 'Failed to lock group');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to lock group');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (member) => {
    const memberId = String(member.userId?._id || member.userId);
    const memberName = member.name || member.userId?.name || 'this member';
    Alert.alert('Remove group member', `Remove ${memberName} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await groupService.removeMember(groupDetails._id, memberId);
            setGroupDetails(response.group);
          } catch (error) {
            Alert.alert('Could not remove member', error.message || 'Refresh the group and try again.');
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = async () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await groupService.leaveGroup(groupDetails._id);
            setGroupDetails(null);
            setTab('CREATE');
            if (storageKey) void safeStorage.removeItem(storageKey);
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to leave group');
          }
        },
      },
    ]);
  };

  const isLeader = String(groupDetails?.leaderId?._id || groupDetails?.leaderId) === String(user?._id);

  return (
    <View style={styles.container}>
      <Header title="Group Ordering" showBack showCart={false} />

      {tab !== 'LOBBY' && (
        <>
        {restoringGroup ? <Text style={styles.restoreNotice}>Checking your saved group with the server…</Text> : null}
        {restoreError ? <View style={styles.restoreError}><Text style={styles.restoreErrorText}>{restoreError}</Text><TouchableOpacity onPress={() => setRestoreAttempt(value => value + 1)} accessibilityRole="button" style={styles.restoreRetry}><Text style={styles.restoreRetryText}>Retry</Text></TouchableOpacity><TouchableOpacity onPress={() => router.push('/my-groups')} accessibilityRole="button" style={styles.restoreRetry}><Text style={styles.restoreRetryText}>My Groups</Text></TouchableOpacity></View> : null}
        <TouchableOpacity onPress={() => router.push('/my-groups')} style={styles.myGroupsLink} accessibilityRole="button" accessibilityLabel="Open My Groups and resume an existing group">
          <Users size={16} color={COLORS.primary} /><Text style={styles.myGroupsLinkText}>My Groups · resume a group you created or joined</Text>
        </TouchableOpacity>
        <View style={styles.tabBar}>
          <TouchableOpacity
            onPress={() => setTab('CREATE')}
            style={[styles.tabItem, tab === 'CREATE' && styles.tabItemActive]}
            activeOpacity={0.8}
          >
            <PlusCircle size={16} color={tab === 'CREATE' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.tabText, tab === 'CREATE' && styles.tabTextActive]}>Create Group</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('JOIN')}
            style={[styles.tabItem, tab === 'JOIN' && styles.tabItemActive]}
            activeOpacity={0.8}
          >
            <LogIn size={16} color={tab === 'JOIN' ? COLORS.primary : COLORS.textSecondary} />
            <Text style={[styles.tabText, tab === 'JOIN' && styles.tabTextActive]}>Join Group</Text>
          </TouchableOpacity>
        </View>
        </>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        >
          {tab === 'CREATE' && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Start a group order invite</Text>
              <Text style={styles.formSubtitle}>Invite up to 7 friends. Groups close after 2 hours or when the leader locks the invite.</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Group name (optional)</Text>
                <TextInput style={styles.textInput} value={groupName} onChangeText={setGroupName} placeholder="e.g. Late night snacks" placeholderTextColor="#9CA3AF" maxLength={48} />
              </View>

              <Text style={styles.fieldLabel}>Order Type</Text>
              <View style={styles.typeRow}>
                <TouchableOpacity
                  onPress={() => setOrderType('TAKEAWAY')}
                  style={[styles.typeOption, orderType === 'TAKEAWAY' && styles.typeOptionActive]}
                  activeOpacity={0.8}
                >
                  <ShoppingBag size={20} color={orderType === 'TAKEAWAY' ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.typeTitle, orderType === 'TAKEAWAY' && styles.typeTitleActive]}>Takeaway</Text>
                  <Text style={styles.typeDesc}>{pickupLocation ? 'Configured campus point' : 'SAC Counter'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setOrderType('DELIVERY')}
                  style={[styles.typeOption, orderType === 'DELIVERY' && styles.typeOptionActive]}
                  activeOpacity={0.8}
                >
                  <Truck size={20} color={orderType === 'DELIVERY' ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.typeTitle, orderType === 'DELIVERY' && styles.typeTitleActive]}>Delivery</Text>
                  <Text style={styles.typeDesc}>To Hostel</Text>
                </TouchableOpacity>
              </View>

              {orderType === 'TAKEAWAY' && pickupLocation ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Campus pickup point</Text>
                  <Text style={styles.typeDesc}>{pickupLocation}</Text>
                  <TouchableOpacity onPress={openPickupDirections} accessibilityRole="button" style={styles.typeOption}>
                    <Text style={styles.typeTitle}>Get directions</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {orderType === 'DELIVERY' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Hostel / Delivery Location</Text>
                  <TextInput
                    style={styles.textInput}
                    value={hostel}
                    onChangeText={setHostel}
                    placeholder="e.g. Hostel B"
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    style={[styles.textInput, { marginTop: 10 }]}
                    value={roomNumber}
                    onChangeText={setRoomNumber}
                    placeholder="Room or pickup point"
                    placeholderTextColor="#9CA3AF"
                    maxLength={32}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Max Members (2–8)</Text>
                <TextInput
                  style={styles.textInput}
                  value={maxMembers}
                  onChangeText={value => { setMaxMembers(value); setMaxMembersError(''); }}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor="#9CA3AF"
                  maxLength={2}
                  accessibilityHint={maxMembersError || 'Enter a whole number from 2 to 8'}
                />
                {maxMembersError ? <Text accessibilityRole="alert" style={styles.validationError}>{maxMembersError}</Text> : null}
              </View>

              <Button
                title={loading ? 'Creating group…' : 'Create Group Order'}
                onPress={handleCreateGroup}
                loading={loading}
                style={styles.actionBtn}
              />
            </View>
          )}

          {tab === 'JOIN' && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Join an existing group</Text>
                <Text style={styles.formSubtitle}>Enter the six-character invite code shared by your group leader.</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Group Invite Code</Text>
                <TextInput
                  style={[styles.textInput, styles.codeInput]}
                  value={groupCode}
                  onChangeText={(text) => setGroupCode(text.toUpperCase())}
                  placeholder="e.g. A1B2C3"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  maxLength={6}
                />
              </View>

              <Button
                title={loading ? 'Joining…' : 'Join Group'}
                onPress={handleJoinGroup}
                loading={loading}
                disabled={!/^[A-F0-9]{6}$/.test(groupCode.trim())}
                style={styles.actionBtn}
              />
            </View>
          )}

          {tab === 'LOBBY' && groupDetails && (
            <View style={styles.lobbyCard}>
              <View style={styles.lobbyHeader}>
                <View style={styles.lobbyBadge}>
                  <Users size={16} color={COLORS.primary} />
                  <Text style={styles.lobbyBadgeText}>Group Order Active</Text>
                </View>
                <View style={[styles.statusBadge, groupDetails.status === 'LOCKED' && styles.statusLocked]}>
                  <Text style={styles.statusBadgeText}>{groupDetails.status}</Text>
                </View>
              </View>

              <Text style={styles.codeEyebrow}>INVITE CODE</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeString}>{groupDetails.groupCode}</Text>
              </View>
              <Text style={styles.codeHint}>Share this code within 2 hours. Only authenticated students can join.</Text>
              {groupDetails.status === 'OPEN' && new Date(groupDetails.expiresAt).getTime() > Date.now() ? <View style={styles.inviteCard}>
                <QRCode value={inviteUrl} size={150} backgroundColor="#FFFFFF" color="#1F2937" />
                <Text style={styles.inviteHint}>Scan to open the Wrapchik invite. Guests sign in before joining.</Text>
                <Button title="Share invite" variant="outline" onPress={shareInvite} style={styles.actionBtn} />
              </View> : <Text style={styles.codeHint}>This invite is locked or expired. Share a code only while the group is open.</Text>}

              <View style={styles.divider} />

              <View style={styles.membersHeader}>
                <Text style={styles.sectionTitle}>Members ({groupDetails.members?.filter((member) => member.status === 'JOINED').length || 0}/{groupDetails.maxMembers || 8})</Text>
              </View>

              <View style={styles.memberList}>
                {groupDetails.members?.map((m, i) => {
                  const memberName = m.name || m.userId?.name || `Member ${i + 1}`;
                  const memberId = String(m.userId?._id || m.userId);
                  const isUserLeader = String(groupDetails.leaderId?._id || groupDetails.leaderId) === memberId;
                  const isActiveMember = m.status === 'JOINED';
                  return (
                    <View key={m._id || `${memberId}-${i}`} style={[styles.memberRow, !isActiveMember && styles.memberLeft]}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.avatarInitial}>{memberName[0]?.toUpperCase() || 'M'}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{memberName}</Text>
                        <Text style={styles.memberRole}>{!isActiveMember ? 'Left group' : isUserLeader ? 'Group Leader' : 'Participant'}</Text>
                      </View>
                      {isUserLeader && (
                        <View style={styles.crownBadge}>
                          <Crown size={14} color="#D97706" />
                        </View>
                      )}
                      {isLeader && groupDetails.status === 'OPEN' && isActiveMember && !isUserLeader ? (
                        <TouchableOpacity accessibilityRole="button" onPress={() => handleRemoveMember(m)} style={styles.removeMemberButton}>
                          <Text style={styles.removeMemberText}>Remove</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.lobbyActions}>
                <Button
                  title="View Shared Cart & Add Food"
                  onPress={() => router.push(`/group-cart/${groupDetails._id}`)}
                  style={styles.actionBtn}
                />
                {isLeader && groupDetails.status === 'OPEN' && (
                  <Button
                    title="Lock Group Invite"
                    onPress={handleLockGroup}
                    loading={loading}
                    disabled={(groupDetails.members?.filter((member) => member.status === 'JOINED').length || 0) < 2}
                    style={styles.actionBtn}
                  />
                )}

                {groupDetails.status === 'OPEN' ? (
                  <Button title="Leave Group" variant="outline" onPress={handleLeaveGroup} style={styles.leaveBtn} />
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
  },
  myGroupsLink: { minHeight: 46, marginHorizontal: 16, marginTop: 10, marginBottom: 2, paddingHorizontal: 12, borderRadius: 13, backgroundColor: COLORS.primaryLight, flexDirection: 'row', alignItems: 'center', gap: 8 },
  myGroupsLinkText: { flex: 1, color: COLORS.primaryDark, fontSize: 12, fontWeight: '800' },
  restoreNotice: { color: COLORS.textSecondary, fontSize: 12, paddingHorizontal: 18, paddingTop: 10 },
  restoreError: { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: COLORS.warningLight, flexDirection: 'row', alignItems: 'center', gap: 8 },
  restoreErrorText: { flex: 1, color: COLORS.textPrimary, fontSize: 11, lineHeight: 16 },
  restoreRetry: { minHeight: 44, paddingHorizontal: 6, justifyContent: 'center' }, restoreRetryText: { color: COLORS.primaryDark, fontSize: 11, fontWeight: '900' },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  content: {
    padding: 20,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...THEME.shadow.sm,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  formSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  validationError: { color: COLORS.danger, fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: -8, marginBottom: 12 },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  typeOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  typeTitleActive: {
    color: COLORS.primary,
  },
  typeDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 18,
  },
  textInput: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  codeInput: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 4,
    color: COLORS.primary,
  },
  actionBtn: {
    marginTop: 8,
  },
  lobbyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...THEME.shadow.sm,
  },
  lobbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  lobbyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  lobbyBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statusBadge: {
    backgroundColor: COLORS.successLight,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  statusLocked: {
    backgroundColor: COLORS.warningLight,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.success,
  },
  codeEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  codeBox: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  codeString: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    color: COLORS.primary,
  },
  codeHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 18,
  },
  inviteCard: { alignItems: 'center', gap: 8, padding: 14, marginBottom: 18, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF' },
  inviteHint: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 18,
  },
  membersHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  memberList: {
    gap: 10,
    marginBottom: 24,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    gap: 12,
  },
  memberLeft: { opacity: 0.55 },
  removeMemberButton: { paddingHorizontal: 10, paddingVertical: 7 },
  removeMemberText: { color: COLORS.danger, fontSize: 12, fontWeight: '800' },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  memberRole: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  crownBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lobbyActions: {
    gap: 10,
  },
  leaveBtn: {
    marginTop: 4,
  },
});
