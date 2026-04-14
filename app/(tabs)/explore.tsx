import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, ActivityIndicator, Image, Platform,
} from 'react-native';
import { TMDB_IMAGE_BASE } from '../../constants/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { searchMovies, type MovieResult } from '../../lib/tmdb';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  type: 'friend' | 'own';
  authorName: string;
  authorInitials: string;
  movieTitle: string;
  rating: number;
  reviewText: string;
  timestamp: string;
  posterPath?: string | null;
}

interface Recommendation {
  id: string;
  type: 'rec';
  becauseOf: string;
  movieTitle: string;
  service: string;
  year: string;
  posterPath?: string | null;
}

type FeedItem = Review | Recommendation;

// ─── Mock seed data ────────────────────────────────────────────────────────────

const MOCK_FEED: FeedItem[] = [
  {
    id: 'm1', type: 'friend', authorName: 'jamie l.', authorInitials: 'JL',
    movieTitle: 'everything everywhere all at once',
    rating: 5, reviewText: 'absolutely mind-bending. cried twice.',
    timestamp: '2h ago',
  },
  {
    id: 'm2', type: 'rec', becauseOf: 'parasite',
    movieTitle: 'the handmaiden', service: 'mubi', year: '2016',
  } as Recommendation,
  {
    id: 'm3', type: 'friend', authorName: 'maya k.', authorInitials: 'MK',
    movieTitle: 'past lives',
    rating: 4, reviewText: 'quietly devastating. stayed with me for days.',
    timestamp: '1d ago',
  },
  {
    id: 'm4', type: 'rec', becauseOf: 'the handmaiden',
    movieTitle: 'burning', service: 'mubi', year: '2018',
  } as Recommendation,
  {
    id: 'm5', type: 'friend', authorName: 'jamie l.', authorInitials: 'JL',
    movieTitle: 'aftersun',
    rating: 5, reviewText: 'nothing prepared me for this.',
    timestamp: '3d ago',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toTitleCase(str: string): string {
  const minors = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of','up','as','is']);
  return str
    .split(' ')
    .map((w, i) => (i === 0 || !minors.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

async function fetchPosterPath(title: string): Promise<string | null> {
  try {
    const results = await searchMovies(title);
    return results[0]?.posterPath ?? null;
  } catch {
    return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Poster({ path }: { path?: string | null }) {
  if (path) {
    return (
      <Image
        source={{ uri: `${TMDB_IMAGE_BASE}${path}` }}
        style={styles.posterPlaceholder}
        resizeMode="cover"
      />
    );
  }
  return <View style={styles.posterPlaceholder} />;
}

function Avatar({ initials, isOwn }: { initials: string; isOwn?: boolean }) {
  return (
    <View style={[styles.avatar, isOwn && styles.avatarOwn]}>
      <Text style={[styles.avatarText, isOwn && styles.avatarTextOwn]}>{initials}</Text>
    </View>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={[styles.star, i <= rating ? styles.starFilled : styles.starEmpty]}>★</Text>
      ))}
    </View>
  );
}

function ReviewCard({ item, ownInitials }: { item: Review; ownInitials: string }) {
  const isOwn = item.type === 'own';
  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Avatar initials={isOwn ? ownInitials : item.authorInitials} isOwn={isOwn} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={styles.authorName}>{isOwn ? 'you' : item.authorName}</Text>
              <Text style={styles.movieName}>{toTitleCase(item.movieTitle)}</Text>
            </View>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>
          <StarRow rating={item.rating} />
          {!!item.reviewText && (
            <Text style={styles.reviewText}>"{item.reviewText}"</Text>
          )}
        </View>
        <Poster path={item.posterPath} />
      </View>
    </View>
  );
}

function RecCard({ item, onPress }: { item: Recommendation; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.recCard} onPress={onPress} activeOpacity={0.85}>
      <View style={{ flex: 1 }}>
        <Text style={styles.recBecause}>because you liked {toTitleCase(item.becauseOf)}</Text>
        <Text style={styles.recTitle}>{toTitleCase(item.movieTitle)}</Text>
        <Text style={styles.recSub}>{item.service} · {item.year}</Text>
      </View>
      <Poster path={item.posterPath} />
    </TouchableOpacity>
  );
}

// ─── Log Review Sheet ─────────────────────────────────────────────────────────

function LogReviewSheet({ visible, onClose, onSaved, uid, userInitials }: {
  visible: boolean;
  onClose: () => void;
  onSaved: (review: Review) => void;
  uid: string;
  userInitials: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [selected, setSelected] = useState<MovieResult | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchMovies(searchQuery);
        setResults(res.slice(0, 6));
      } catch { /* ignore */ }
    }, 400);
  }, [searchQuery]);

  const reset = () => {
    setSearchQuery(''); setResults([]); setSelected(null);
    setRating(0); setReviewText('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = async () => {
    if (!selected || rating === 0 || !uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'users', uid, 'reviews'), {
        movieId: selected.id,
        movieTitle: selected.title,
        rating,
        reviewText: reviewText.trim(),
        createdAt: serverTimestamp(),
      });
      onSaved({
        id: Date.now().toString(),
        type: 'own',
        authorName: 'you',
        authorInitials: userInitials,
        movieTitle: selected.title,
        rating,
        reviewText: reviewText.trim(),
        timestamp: 'just now',
        posterPath: selected.posterPath,
      });
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const sheetInner = (
    <View style={[styles.sheet, Platform.OS === 'web' && ({ maxHeight: '75%', overflowY: 'auto' } as any)]}>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetTitle}>log a review</Text>

      {!selected ? (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder="search for a movie…"
            placeholderTextColor="#A78BFA"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {results.map(r => (
            <TouchableOpacity
              key={r.id}
              style={styles.searchResult}
              onPress={() => { setSelected(r); setResults([]); }}
            >
              <Text style={styles.searchResultTitle}>{r.title}</Text>
              <Text style={styles.searchResultYear}>{r.year}</Text>
            </TouchableOpacity>
          ))}
        </>
      ) : (
        <>
          <View style={styles.selectedMovie}>
            <Text style={styles.selectedTitle}>{selected.title}</Text>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.changeBtn}>change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.starSelector}>
            {[1, 2, 3, 4, 5].map(i => (
              <TouchableOpacity key={i} onPress={() => setRating(i)}>
                <Text style={[styles.starLarge, i <= rating ? styles.starFilled : styles.starEmpty]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.reviewInput}
            placeholder="write a review (optional)"
            placeholderTextColor="#A78BFA"
            value={reviewText}
            onChangeText={v => setReviewText(v.slice(0, 280))}
            multiline
            maxLength={280}
          />
          <Text style={styles.charCount}>{reviewText.length}/280</Text>

          <TouchableOpacity
            style={[styles.saveBtn, (!selected || rating === 0) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!selected || rating === 0 || saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.saveBtnText}>save review</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
        {sheetInner}
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose} />
      {sheetInner}
    </Modal>
  );
}

// ─── Movie Detail Stub ────────────────────────────────────────────────────────

function MovieDetailModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.detailModal}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.detailSub}>movie details coming soon</Text>
        <TouchableOpacity onPress={onClose} style={styles.detailClose}>
          <Text style={styles.detailCloseText}>close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [mockFeed, setMockFeed] = useState<FeedItem[]>(MOCK_FEED);
  const [ownReviews, setOwnReviews] = useState<Review[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState<string | null>(null);

  const feed = [...ownReviews, ...mockFeed];

  const firstName = (user?.displayName ?? '').split(' ')[0] ?? '';
  const lastName  = (user?.displayName ?? '').split(' ')[1] ?? '';
  const userInitials = ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase() || 'ME';

  // Fetch poster paths for mock feed items
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const updated = await Promise.all(
        MOCK_FEED.map(async item => ({
          ...item,
          posterPath: await fetchPosterPath(item.movieTitle),
        }))
      );
      if (!cancelled) setMockFeed(updated);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load own reviews from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'reviews'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      const reviews: Review[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: 'own',
          authorName: 'you',
          authorInitials: userInitials,
          movieTitle: data.movieTitle ?? '',
          rating: data.rating ?? 0,
          reviewText: data.reviewText ?? '',
          timestamp: 'recently',
        };
      });
      setOwnReviews(reviews);
    });
    return unsub;
  }, [user?.uid]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>explore</Text>
      </View>

      {/* Feed */}
      <ScrollView contentContainerStyle={styles.feed} showsVerticalScrollIndicator={false}>
        {feed.map(item => {
          if (item.type === 'rec') {
            return (
              <RecCard
                key={item.id}
                item={item as Recommendation}
                onPress={() => setDetailTitle((item as Recommendation).movieTitle)}
              />
            );
          }
          return (
            <ReviewCard key={item.id} item={item as Review} ownInitials={userInitials} />
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Log a review pill */}
      <View style={[styles.fabWrap, { bottom: insets.bottom + 88 }]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setSheetOpen(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.fabText}>+ log a review</Text>
        </TouchableOpacity>
      </View>

      <LogReviewSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={r => setOwnReviews(prev => [r, ...prev])}
        uid={user?.uid ?? ''}
        userInitials={userInitials}
      />

      {detailTitle && (
        <MovieDetailModal title={detailTitle} onClose={() => setDetailTitle(null)} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#F3F0FF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '200',
    color: '#4C1D95',
    letterSpacing: 3,
  },

  feed: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 12,
    padding: 12,
  },
  cardInner: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  avatarOwn: { backgroundColor: '#6D28D9' },
  avatarText: { fontSize: 11, fontWeight: '500', color: '#6D28D9' },
  avatarTextOwn: { color: '#FFFFFF' },
  authorName: { fontSize: 12, fontWeight: '400', color: '#4C1D95' },
  movieName:  { fontSize: 12, fontWeight: '300', color: '#7C3AED' },
  timestamp:  { fontSize: 10, color: '#A78BFA', marginLeft: 4 },
  starRow:    { flexDirection: 'row', gap: 2, marginTop: 6 },
  star:       { fontSize: 12 },
  starFilled: { color: '#6D28D9' },
  starEmpty:  { color: '#DDD6FE' },
  reviewText: {
    fontSize: 12, fontWeight: '300', color: '#7C3AED',
    lineHeight: 19, fontStyle: 'italic', marginTop: 4,
  },

  recCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#6D28D9',
    borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  recBecause: {
    fontSize: 10, fontWeight: '300', color: '#A78BFA', letterSpacing: 1, marginBottom: 4,
  },
  recTitle:   { fontSize: 14, fontWeight: '400', color: '#4C1D95', marginBottom: 2 },
  recSub:     { fontSize: 11, color: '#7C3AED' },
  posterPlaceholder: {
    width: 40, height: 56, borderRadius: 6, backgroundColor: '#EDE9FE', flexShrink: 0, marginTop: 2,
  },

  fabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: { backgroundColor: '#6D28D9', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 20 },
  fabText: { fontSize: 13, fontWeight: '400', color: '#FFFFFF' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 100,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderBottomWidth: 0, borderColor: '#DDD6FE',
    padding: 20, paddingBottom: 40, gap: 12,
    zIndex: 101,
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
  searchResult: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F0FF',
  },
  searchResultTitle: { fontSize: 13, fontWeight: '300', color: '#4C1D95', flex: 1 },
  searchResultYear:  { fontSize: 12, color: '#A78BFA' },
  selectedMovie: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#F3F0FF', borderRadius: 8, padding: 10,
  },
  selectedTitle: { fontSize: 13, fontWeight: '400', color: '#4C1D95', flex: 1 },
  changeBtn: { fontSize: 11, color: '#7C3AED', textDecorationLine: 'underline' },
  starSelector: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  starLarge:    { fontSize: 28 },
  reviewInput: {
    borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 10,
    paddingHorizontal: 14, paddingTop: 10, fontSize: 13, fontWeight: '300', color: '#4C1D95',
    minHeight: 80, textAlignVertical: 'top',
  },
  charCount:    { fontSize: 10, color: '#A78BFA', textAlign: 'right' },
  saveBtn: {
    height: 48, borderRadius: 12, backgroundColor: '#6D28D9',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: '#DDD6FE' },
  saveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '400', letterSpacing: 0.5 },

  detailModal: {
    position: 'absolute', top: '30%', left: 32, right: 32,
    backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6FE',
    padding: 24, alignItems: 'center', gap: 12,
  },
  detailTitle: { fontSize: 16, fontWeight: '300', color: '#4C1D95', textAlign: 'center' },
  detailSub:   { fontSize: 12, color: '#A78BFA', fontWeight: '300' },
  detailClose: {
    marginTop: 8, paddingVertical: 8, paddingHorizontal: 24,
    borderRadius: 20, borderWidth: 1, borderColor: '#DDD6FE',
  },
  detailCloseText: { fontSize: 13, color: '#7C3AED', fontWeight: '300' },
});
