import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  doc, getDoc, onSnapshot, setDoc, collection,
  query, where, getDocs, limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  firstName: string;
  lastName: string;
  region: string;
  streamingServices: string[];
  genres: string[];
}

interface FriendEntry {
  uid: string;
  name: string;
  initials: string;
  activity: string;
}

// ─── Mock activity strings ────────────────────────────────────────────────────

const MOCK_ACTIVITIES = [
  'rated 3 movies this week',
  'in a session now',
  'last seen 2 days ago',
  'added 5 movies to their list',
];

function mockActivity(): string {
  return MOCK_ACTIVITIES[Math.floor(Math.random() * MOCK_ACTIVITIES.length)];
}

function initials(first: string, last: string): string {
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?';
}

// ─── Add Friend Sheet ─────────────────────────────────────────────────────────

function AddFriendSheet({
  visible, onClose, uid,
}: { visible: boolean; onClose: () => void; uid: string }) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<{ uid: string; name: string }[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);

  const handleSearch = async (text: string) => {
    setSearchText(text);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('displayName', '>=', text),
        where('displayName', '<=', text + '\uf8ff'),
        limit(10),
      );
      const snap = await getDocs(q);
      const found = snap.docs
        .filter(d => d.id !== uid)
        .map(d => ({ uid: d.id, name: d.data().displayName ?? d.data().firstName ?? d.id }));
      setResults(found);
    } catch { /* ignore */ }
    finally { setSearching(false); }
  };

  const handleFollow = async (friendUid: string) => {
    await setDoc(doc(db, 'users', uid, 'following', friendUid), { followedAt: new Date() });
    setFollowing(prev => new Set([...prev, friendUid]));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>add a friend</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="search by name…"
          placeholderTextColor="#A78BFA"
          value={searchText}
          onChangeText={handleSearch}
          autoFocus
        />
        {searching && <ActivityIndicator color="#6D28D9" />}
        {results.map(r => (
          <View key={r.uid} style={styles.searchRow}>
            <View style={styles.friendAvatar}>
              <Text style={styles.friendAvatarText}>{r.name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <Text style={styles.friendName}>{r.name}</Text>
            <TouchableOpacity
              style={[styles.followBtn, following.has(r.uid) && styles.followBtnDone]}
              onPress={() => handleFollow(r.uid)}
              disabled={following.has(r.uid)}
            >
              <Text style={[styles.followBtnText, following.has(r.uid) && styles.followBtnTextDone]}>
                {following.has(r.uid) ? 'following' : 'follow'}
              </Text>
            </TouchableOpacity>
          </View>
        ))}
        {results.length === 0 && searchText.length >= 2 && !searching && (
          <Text style={styles.noResults}>no users found</Text>
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [addFriendOpen, setAddFriendOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      console.log('[profile] raw Firestore doc:', snap.data());
      const d = snap.data();
      if (d) {
        setProfile({
          firstName: d.firstName ?? '',
          lastName: d.lastName ?? '',
          region: d.region ?? d.streamingRegion ?? 'US',
          streamingServices: d.streamingServices ?? [],
          genres: d.genres ?? [],
        });
      }
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users', user.uid, 'following'), async snap => {
      const entries: FriendEntry[] = await Promise.all(
        snap.docs.map(async d => {
          try {
            const u = await getDoc(doc(db, 'users', d.id));
            const data = u.data();
            const first = data?.firstName ?? '';
            const last = data?.lastName ?? '';
            const name = `${first} ${last}`.trim() || d.id;
            return {
              uid: d.id,
              name,
              initials: initials(first, last),
              activity: mockActivity(),
            };
          } catch {
            return { uid: d.id, name: d.id, initials: '?', activity: 'recently active' };
          }
        }),
      );
      setFriends(entries);
    });
    return unsub;
  }, [user?.uid]);

  if (!user || !profile) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#6D28D9" />
      </View>
    );
  }

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const userInitials = initials(profile.firstName, profile.lastName);
  const servicesLabel = profile.streamingServices.length
    ? profile.streamingServices.join(', ')
    : 'none set';
  const genresLabel = profile.genres.slice(0, 3).join(', ') || 'none set';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Avatar + name ── */}
      <View style={styles.topSection}>
        <View style={styles.bigAvatar}>
          <Text style={styles.bigAvatarText}>{userInitials}</Text>
        </View>
        <Text style={styles.userName}>{fullName || 'your name'}</Text>
        <Text style={styles.userMeta}>{profile.region} · {friends.length} friends</Text>
        <TouchableOpacity
          style={styles.editPill}
          onPress={() => router.push('/(onboarding)/genres')}
          activeOpacity={0.8}
        >
          <Text style={styles.editPillText}>edit profile</Text>
        </TouchableOpacity>
      </View>

      {/* ── Settings card ── */}
      <View style={styles.card}>
        <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(onboarding)/streaming')} activeOpacity={0.8}>
          <Text style={styles.settingsLabel}>streaming</Text>
          <Text style={styles.settingsValue} numberOfLines={1}>{servicesLabel}</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/(onboarding)/genres')} activeOpacity={0.8}>
          <Text style={styles.settingsLabel}>genres</Text>
          <Text style={styles.settingsValue}>{genresLabel}</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <View style={styles.settingsRow}>
          <Text style={styles.settingsLabel}>region</Text>
          <Text style={styles.settingsValue}>{profile.region}</Text>
        </View>
      </View>

      {/* ── Friends section ── */}
      <Text style={styles.sectionLabel}>friends</Text>

      {friends.length === 0 ? (
        <Text style={styles.emptyFriends}>no friends yet — add some below</Text>
      ) : (
        friends.map(f => (
          <View key={f.uid} style={styles.friendRow}>
            <View style={styles.friendAvatar}>
              <Text style={styles.friendAvatarText}>{f.initials}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.friendName}>{f.name}</Text>
              <Text style={styles.friendActivity}>{f.activity}</Text>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.addFriendBtn}
        onPress={() => setAddFriendOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.addFriendBtnText}>+ add a friend</Text>
      </TouchableOpacity>

      <AddFriendSheet
        visible={addFriendOpen}
        onClose={() => setAddFriendOpen(false)}
        uid={user.uid}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 12 },

  topSection: { alignItems: 'center', gap: 6, marginBottom: 8 },
  bigAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#6D28D9', alignItems: 'center', justifyContent: 'center',
  },
  bigAvatarText: { fontSize: 18, fontWeight: '400', color: '#FFFFFF' },
  userName: { fontSize: 16, fontWeight: '300', color: '#4C1D95' },
  userMeta: { fontSize: 11, color: '#A78BFA' },
  editPill: {
    borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 6, marginTop: 4,
  },
  editPillText: { fontSize: 12, fontWeight: '300', color: '#7C3AED' },

  card: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 12,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingsLabel: { fontSize: 13, fontWeight: '300', color: '#4C1D95' },
  settingsValue: {
    fontSize: 12, fontWeight: '300', color: '#7C3AED',
    maxWidth: 180, textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: '#F3F0FF', marginHorizontal: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: '400', color: '#4C1D95', letterSpacing: 1, marginTop: 8,
  },
  emptyFriends: { fontSize: 12, fontWeight: '300', color: '#A78BFA' },
  friendRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD6FE',
    borderRadius: 10, padding: 12,
  },
  friendAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  friendAvatarText: { fontSize: 13, fontWeight: '400', color: '#6D28D9' },
  friendName: { fontSize: 13, fontWeight: '400', color: '#4C1D95' },
  friendActivity: { fontSize: 11, fontWeight: '300', color: '#A78BFA', marginTop: 1 },
  addFriendBtn: {
    borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 4,
  },
  addFriendBtnText: { fontSize: 13, fontWeight: '300', color: '#7C3AED' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderBottomWidth: 0, borderColor: '#DDD6FE',
    padding: 20, paddingBottom: 40, gap: 12,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#DDD6FE', alignSelf: 'center', marginBottom: 8,
  },
  sheetTitle: { fontSize: 14, fontWeight: '300', color: '#4C1D95', letterSpacing: 1 },
  searchInput: {
    height: 44, borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 10,
    paddingHorizontal: 14, fontSize: 14, fontWeight: '300', color: '#4C1D95',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  followBtn: {
    borderWidth: 1, borderColor: '#6D28D9', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  followBtnDone: { borderColor: '#DDD6FE' },
  followBtnText: { fontSize: 12, fontWeight: '300', color: '#6D28D9' },
  followBtnTextDone: { color: '#A78BFA' },
  noResults: { fontSize: 12, color: '#A78BFA', textAlign: 'center' },
});
