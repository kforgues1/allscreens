import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { saveOnboardingData } from '../../lib/userProfile';
import { getTopRatedMovies, searchMovies, MovieResult } from '../../lib/tmdb';
import { TMDB_IMAGE_BASE } from '../../constants/api';
import { useTheme } from '../../context/ThemeContext';

const MAX_SELECTIONS = 5;

const gradientBtnStyle =
  Platform.OS === 'web'
    ? ({ background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any)
    : { backgroundColor: '#6D28D9' };

export default function MoviesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [selected, setSelected] = useState<MovieResult[]>([]);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load top-rated on mount
  useEffect(() => {
    setFetching(true);
    getTopRatedMovies()
      .then(setResults)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setFetching(true);
      getTopRatedMovies()
        .then(setResults)
        .catch(() => {})
        .finally(() => setFetching(false));
      return;
    }
    setFetching(true);
    searchMovies(q)
      .then(setResults)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (v.length === 0 || v.length > 2) runSearch(v);
  };

  const isSelected = (id: number) => selected.some((m) => m.id === id);

  const toggle = (movie: MovieResult) => {
    if (isSelected(movie.id)) {
      setSelected((prev) => prev.filter((m) => m.id !== movie.id));
    } else if (selected.length < MAX_SELECTIONS) {
      setSelected((prev) => [...prev, movie]);
    }
  };

  const handleNext = async () => {
    if (!user || selected.length === 0) return;
    setSaving(true);
    try {
      await saveOnboardingData(user.uid, {
        favouriteMovies: selected.map((m) => ({ id: m.id, title: m.title })),
      });
      router.push('/(onboarding)/streaming');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: MovieResult }) => {
    const active = isSelected(item.id);
    const atMax = selected.length >= MAX_SELECTIONS;
    return (
      <TouchableOpacity
        style={[styles.card, active && styles.cardActive, atMax && !active && styles.cardDisabled]}
        activeOpacity={0.75}
        onPress={() => toggle(item)}
        disabled={atMax && !active}
      >
        {item.posterPath ? (
          <Image
            source={{ uri: `${TMDB_IMAGE_BASE}${item.posterPath}` }}
            style={styles.poster}
          />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]} />
        )}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, active && styles.cardTitleActive]} numberOfLines={2}>
            {item.title}
          </Text>
          {!!item.year && (
            <Text style={[styles.cardYear, active && styles.cardYearActive]}>{item.year}</Text>
          )}
        </View>
        {active && (
          <View style={styles.checkBadge}>
            <Text style={styles.checkBadgeText}>✓</Text>
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
            {[1,2,3,4].map(i => (
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
        <View style={{ height: 14 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="search movies…"
          placeholderTextColor="#A78BFA"
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => runSearch(query)}
        />
      </View>

      {fetching && results.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      )}

      <View style={[styles.footer, { paddingBottom: (insets.bottom || 0) + 24 }]}>
        <TouchableOpacity
          style={[
            styles.nextBtn,
            gradientBtnStyle,
            selected.length === 0 && styles.nextBtnDisabled,
          ]}
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

const CARD_GAP = 12;
const CARD_H_PAD = 24;

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
  searchInput: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '300',
    color: '#4C1D95',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: CARD_H_PAD,
    paddingTop: 12,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },
  card: {
    flex: 1,
    maxWidth: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: '#7C3AED',
    borderWidth: 2,
  },
  cardDisabled: {
    opacity: 0.4,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    backgroundColor: '#EDE9FE',
  },
  posterPlaceholder: {
    backgroundColor: '#DDD6FE',
  },
  cardInfo: {
    padding: 8,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '300',
    color: '#4C1D95',
    lineHeight: 16,
  },
  cardTitleActive: {
    fontWeight: '400',
    color: '#4C1D95',
  },
  cardYear: {
    fontSize: 11,
    fontWeight: '300',
    color: '#A78BFA',
    marginTop: 2,
  },
  cardYearActive: {
    color: '#7C3AED',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
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
  nextBtnDisabled: {
    opacity: 0.45,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },
});
