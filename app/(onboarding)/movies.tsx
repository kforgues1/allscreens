import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { saveOnboardingData } from '../../lib/userProfile';
import { getTopRatedMovies, discoverByGenresFiltered, type MovieResult } from '../../lib/tmdb';
import { TMDB_IMAGE_BASE } from '../../constants/api';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../lib/firebase';

const MAX_SELECTIONS = 5;
const MAX_PAGE = 10;

const GENRE_IDS: Record<string, number> = {
  'action': 28, 'adventure': 12, 'animation': 16, 'biography': 99,
  'comedy': 35, 'crime': 80, 'documentary': 99, 'drama': 18,
  'fantasy': 14, 'historical': 36, 'horror': 27, 'musical': 10402,
  'mystery': 9648, 'romance': 10749, 'rom-com': 35, 'sci-fi': 878,
  'sport': 10770, 'superhero': 28, 'thriller': 53, 'war': 10752,
  'western': 37, 'family': 10751,
};

const GENRE_LABEL_MAP: Record<number, string> = {
  28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy',
  80: 'crime', 99: 'documentary', 18: 'drama', 10751: 'family',
  14: 'fantasy', 36: 'history', 27: 'horror', 10402: 'music',
  9648: 'mystery', 10749: 'romance', 878: 'sci-fi', 53: 'thriller',
  10752: 'war', 37: 'western', 10770: 'tv movie',
};

const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function MoviesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [results, setResults] = useState<MovieResult[]>([]);
  const [selected, setSelected] = useState<MovieResult[]>([]);
  const [page, setPage] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [saving, setSaving] = useState(false);
  // Store resolved genre IDs so loadMore can reuse them without re-reading Firestore
  const genreIdsRef = useRef<number[]>([]);

  // On mount: read user's saved genres from Firestore, fetch page 1
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingInitial(true);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const savedGenres: string[] = (snap.data()?.genres ?? []) as string[];
        const ids = savedGenres
          .map(g => GENRE_IDS[g.toLowerCase()])
          .filter((id): id is number => id !== undefined);
        genreIdsRef.current = ids;

        const firstPage = ids.length > 0
          ? await discoverByGenresFiltered(ids, 1)
          : await getTopRatedMovies(1);

        if (!cancelled) {
          setResults(firstPage);
          setPage(1);
          setHasMore(firstPage.length >= 20);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loadingInitial) return;
    const nextPage = page + 1;
    if (nextPage > MAX_PAGE) { setHasMore(false); return; }

    setLoadingMore(true);
    try {
      const more = genreIdsRef.current.length > 0
        ? await discoverByGenresFiltered(genreIdsRef.current, nextPage)
        : await getTopRatedMovies(nextPage);

      setResults(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        return [...prev, ...more.filter(m => !existingIds.has(m.id))];
      });
      setPage(nextPage);
      if (more.length < 20 || nextPage >= MAX_PAGE) setHasMore(false);
    } catch { /* silent — keep existing results */ }
    finally { setLoadingMore(false); }
  }, [loadingMore, hasMore, loadingInitial, page]);

  const isSelected = (id: number) => selected.some(m => m.id === id);

  const toggle = (movie: MovieResult) => {
    if (isSelected(movie.id)) {
      setSelected(prev => prev.filter(m => m.id !== movie.id));
    } else if (selected.length < MAX_SELECTIONS) {
      setSelected(prev => [...prev, movie]);
    }
  };

  const handleNext = async () => {
    if (!user || selected.length === 0) return;
    setSaving(true);
    try {
      await saveOnboardingData(user.uid, {
        favouriteMovies: selected.map(m => ({ id: m.id, title: m.title })),
        favouriteMovieIds: selected.map(m => m.id),
      });
      router.push('/(onboarding)/streaming');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: MovieResult }) => {
    const active = isSelected(item.id);
    const atMax = selected.length >= MAX_SELECTIONS;
    const genreLabel = GENRE_LABEL_MAP[item.genres[0]] ?? '';

    return (
      <TouchableOpacity
        style={[styles.row, active && styles.rowActive, atMax && !active && styles.rowDisabled]}
        activeOpacity={0.75}
        onPress={() => toggle(item)}
        disabled={atMax && !active}
      >
        {item.posterPath ? (
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}${item.posterPath}` }}
            style={styles.poster}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]} />
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.year}{genreLabel ? ` · ${genreLabel}` : ''}
          </Text>
        </View>
        {active && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>

      <View style={[styles.header, { paddingTop: insets.top || 24 }]}>
        <View style={styles.progressRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={styles.segmentBarRow}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.segmentBar, i <= 2 ? styles.segmentBarFilled : styles.segmentBarEmpty]} />
            ))}
          </View>
        </View>
        <Text style={styles.step}>step 2 of 4</Text>
        <View style={{ height: 6 }} />
        <Text style={styles.heading}>movies you love</Text>
        <View style={{ height: 6 }} />
        <Text style={styles.sub}>
          pick up to {MAX_SELECTIONS}
          {selected.length > 0 ? ` · ${selected.length} selected` : ''}
        </Text>
      </View>

      {loadingInitial ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          ListFooterComponent={
            loadingMore
              ? <View style={styles.footerSpinner}><ActivityIndicator color="#A78BFA" size="small" /></View>
              : <View style={{ height: 120 }} />
          }
        />
      )}

      <View style={[styles.footer, { paddingBottom: (insets.bottom || 0) + 24 }]}>
        <TouchableOpacity
          style={[styles.nextBtn, gradientBtnStyle, selected.length === 0 && styles.nextBtnDisabled]}
          activeOpacity={0.85}
          onPress={handleNext}
          disabled={saving || selected.length === 0}
        >
          {saving
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.nextBtnText}>next</Text>}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 28,
    paddingBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  backArrow: {
    fontSize: 16,
    fontWeight: '300',
    color: '#A78BFA',
    width: 24,
  },
  segmentBarRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  segmentBar: {
    flex: 1,
    height: 3,
    borderRadius: 6,
  },
  segmentBarFilled: { backgroundColor: '#6D28D9' },
  segmentBarEmpty: { backgroundColor: '#DDD6FE' },
  step: {
    fontSize: 11,
    fontWeight: '300',
    color: '#A78BFA',
    letterSpacing: 2,
  },
  heading: {
    fontSize: 22,
    fontWeight: '200',
    color: '#4C1D95',
    letterSpacing: 1,
  },
  sub: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  rowActive: {
    borderColor: '#7C3AED',
    borderWidth: 1.5,
  },
  rowDisabled: { opacity: 0.4 },
  poster: {
    width: 36,
    height: 52,
    borderRadius: 4,
    backgroundColor: '#EDE9FE',
  },
  posterPlaceholder: { backgroundColor: '#DDD6FE' },
  info: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontWeight: '400', color: '#4C1D95' },
  meta: { fontSize: 11, fontWeight: '300', color: '#A78BFA' },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  footerSpinner: { paddingVertical: 16, alignItems: 'center' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingTop: 16,
    backgroundColor: 'rgba(243,240,255,0.95)',
  },
  nextBtn: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
