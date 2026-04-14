import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Image, Platform, KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path, Rect, Line } from 'react-native-svg';
import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE } from '../../constants/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, addDoc, serverTimestamp, query, orderBy,
  onSnapshot, doc, setDoc, getDocs, where, limit, getDoc,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  searchMovies, getTrending, getMovieRecommendations,
  discoverMoviesByGenres, type MovieResult,
} from '../../lib/tmdb';

// ─── Types ────────────────────────────────────────────────────────────────────

type InnerTab = 'discover' | 'friends' | 'watched';

interface DiscoverMovie {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  genreIds: number[];
  streamingServices?: string[];
}

interface DiscoverShelf {
  id: string;
  label: string;
  sourceName?: string; // for "because you liked [sourceName]" — rendered in weight 500
  movies: DiscoverMovie[];
  highlight?: boolean;
}

interface MovieDetail extends DiscoverMovie {
  runtime?: number;
  overview?: string;
  fetchedServices?: string[];
  existingRating?: number;
}

interface FriendReview {
  id: string;
  authorName: string;
  authorInitials: string;
  movieTitle: string;
  rating: number;
  reviewText: string;
  timestamp: string;
  posterPath?: string | null;
  movieId?: number;
}

interface WatchEntry {
  id: string;
  movieId: number;
  movieTitle: string;
  posterPath: string | null;
  rating: number;
  reviewText: string;
  watchedAt: any;
}

// ─── Genre ID map ─────────────────────────────────────────────────────────────

const GENRE_ID_MAP: Record<string, number> = {
  'action': 28, 'adventure': 12, 'animation': 16, 'biography': 18,
  'comedy': 35, 'crime': 80, 'documentary': 99, 'drama': 18, 'family': 10751,
  'fantasy': 14, 'historical': 36, 'horror': 27, 'musical': 10402,
  'mystery': 9648, 'romance': 10749, 'rom-com': 10749, 'sci-fi': 878,
  'superhero': 28, 'sport': 18, 'thriller': 53, 'war': 10752, 'western': 37,
};

const GENRE_LABEL_MAP: Record<number, string> = {
  28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy',
  80: 'crime', 99: 'documentary', 18: 'drama', 10751: 'family',
  14: 'fantasy', 36: 'history', 27: 'horror', 10402: 'music',
  9648: 'mystery', 10749: 'romance', 878: 'sci-fi', 53: 'thriller',
  10752: 'war', 37: 'western',
};

// ─── Mock friend data ─────────────────────────────────────────────────────────

const MOCK_FRIEND_REVIEWS: FriendReview[] = [
  {
    id: 'm1', authorName: 'jamie l.', authorInitials: 'JL',
    movieTitle: 'everything everywhere all at once',
    rating: 5, reviewText: 'absolutely mind-bending. cried twice.',
    timestamp: '2h ago', movieId: 545611,
  },
  {
    id: 'm3', authorName: 'maya k.', authorInitials: 'MK',
    movieTitle: 'past lives',
    rating: 4, reviewText: 'quietly devastating. stayed with me for days.',
    timestamp: '1d ago', movieId: 1075794,
  },
  {
    id: 'm5', authorName: 'jamie l.', authorInitials: 'JL',
    movieTitle: 'aftersun',
    rating: 5, reviewText: 'nothing prepared me for this.',
    timestamp: '3d ago', movieId: 892699,
  },
];

// ─── TMDB helpers ─────────────────────────────────────────────────────────────

function toMovie(r: MovieResult): DiscoverMovie {
  return {
    id: r.id, title: r.title, year: r.year,
    posterPath: r.posterPath, genreIds: r.genres ?? [],
  };
}

async function fetchWatchProviders(movieId: number, region: string): Promise<string[]> {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/movie/${movieId}/watch/providers?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results?.[region]?.flatrate ?? []) as any[])
      .map((p: any) => (p.provider_name as string).toLowerCase());
  } catch { return []; }
}

async function fetchMovieDetail(id: number): Promise<{ runtime?: number; overview?: string }> {
  try {
    const res = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return {};
    const data = await res.json();
    return { runtime: data.runtime ?? undefined, overview: data.overview ?? undefined };
  } catch { return {}; }
}

async function fetchNewToStreaming(services: string[], region: string): Promise<DiscoverMovie[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const gte = sixMonthsAgo.toISOString().slice(0, 10);
  try {
    const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=release_date.desc&primary_release_date.gte=${gte}&vote_count.gte=50`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const movies: DiscoverMovie[] = (data.results as any[]).map(r => ({
      id: r.id, title: r.title,
      year: r.release_date ? r.release_date.slice(0, 4) : '',
      posterPath: r.poster_path ?? null, genreIds: r.genre_ids ?? [],
    }));
    if (services.length === 0) return movies.slice(0, 5);
    const withProviders = await Promise.all(
      movies.slice(0, 15).map(async m => ({
        ...m,
        streamingServices: await fetchWatchProviders(m.id, region),
      }))
    );
    const filtered = withProviders.filter(m =>
      services.some(s => (m.streamingServices ?? []).some(p => p.includes(s) || s.includes(p)))
    );
    return (filtered.length > 0 ? filtered : withProviders).slice(0, 5);
  } catch { return []; }
}

// ─── Shared small components ──────────────────────────────────────────────────

function Poster({ path, width = 36, height = 52, radius = 5 }: {
  path?: string | null; width?: number; height?: number; radius?: number;
}) {
  if (path) {
    return (
      <Image
        source={{ uri: `${TMDB_IMAGE_BASE}${path}` }}
        style={{ width, height, borderRadius: radius, backgroundColor: '#EDE9FE' }}
        resizeMode="cover"
      />
    );
  }
  return <View style={{ width, height, borderRadius: radius, backgroundColor: '#EDE9FE' }} />;
}

function Avatar({ initials, size = 20 }: { initials: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

function StarRow({ rating, size = 8 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} style={[{ fontSize: size }, i <= rating ? styles.starFilled : styles.starEmpty]}>★</Text>
      ))}
    </View>
  );
}

function TappableStars({ rating, onChange, size = 20 }: {
  rating: number; onChange: (n: number) => void; size?: number;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onChange(i)}>
          <Text style={[{ fontSize: size }, i <= rating ? styles.starFilled : styles.starEmpty]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ServiceBadge({ name }: { name: string }) {
  return (
    <View style={styles.serviceBadge}>
      <Text style={styles.serviceBadgeText}>{name}</Text>
    </View>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function FriendsEmptyIcon() {
  return (
    <Svg width={36} height={32} viewBox="0 0 36 32" fill="none">
      <Circle cx={13} cy={9} r={5} stroke="#6D28D9" strokeWidth={1.4} />
      <Path d="M2 28 C2 21 6 18 13 18 C20 18 24 21 24 28" stroke="#6D28D9" strokeWidth={1.4} strokeLinecap="round" />
      <Circle cx={26} cy={10} r={4} stroke="#7C3AED" strokeWidth={1.2} />
      <Path d="M19 28 C19.5 23.5 22 21 26 21 C30 21 33 23.5 33.5 28" stroke="#7C3AED" strokeWidth={1.2} strokeLinecap="round" />
    </Svg>
  );
}

function WatchedEmptyIcon() {
  return (
    <Svg width={32} height={36} viewBox="0 0 32 36" fill="none">
      <Rect x={4} y={2} width={22} height={28} rx={3} stroke="#6D28D9" strokeWidth={1.4} />
      <Rect x={8} y={6} width={14} height={20} rx={2} stroke="#A78BFA" strokeWidth={1} />
      <Line x1={2} y1={7} x2={4} y2={7} stroke="#6D28D9" strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={2} y1={13} x2={4} y2={13} stroke="#6D28D9" strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={2} y1={19} x2={4} y2={19} stroke="#6D28D9" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg width={8} height={8} viewBox="0 0 10 10" fill="none">
      <Path d="M7 1 L9 3 L3 9 L1 9 L1 7 Z" stroke="white" strokeWidth={1.2} strokeLinejoin="round" />
      <Line x1={5.5} y1={2.5} x2={7.5} y2={4.5} stroke="white" strokeWidth={1} />
    </Svg>
  );
}

// ─── Movie Detail Sheet ───────────────────────────────────────────────────────

function MovieDetailSheet({ movie, uid, onClose, onDecide }: {
  movie: MovieDetail;
  uid: string;
  onClose: () => void;
  onDecide: () => void;
}) {
  const [detail, setDetail] = useState<{ runtime?: number; overview?: string }>({});
  const [providers, setProviders] = useState<string[]>([]);
  const [rating, setRating] = useState(movie.existingRating ?? 0);
  const [addedToWatchlist, setAddedToWatchlist] = useState(false);
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    fetchMovieDetail(movie.id).then(setDetail);
    fetchWatchProviders(movie.id, 'US').then(setProviders);
  }, [movie.id]);

  const handleRating = async (n: number) => {
    setRating(n);
    if (!uid) return;
    setSavingRating(true);
    try {
      await setDoc(doc(db, 'users', uid, 'reviews', String(movie.id)), {
        movieId: movie.id, movieTitle: movie.title,
        posterPath: movie.posterPath, rating: n,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } finally { setSavingRating(false); }
  };

  const handleAddWatchlist = async () => {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid, 'watchlist', String(movie.id)), {
      movieId: movie.id, movieTitle: movie.title,
      posterPath: movie.posterPath, addedAt: serverTimestamp(),
    });
    setAddedToWatchlist(true);
  };

  const genres = movie.genreIds.slice(0, 3).map(id => GENRE_LABEL_MAP[id]).filter(Boolean);
  const service = providers[0] ?? (movie.streamingServices?.[0] ?? null);

  return (
    <>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.detailSheet}>
        <View style={styles.sheetHandle} />

        {/* Poster + info row */}
        <View style={styles.detailTopRow}>
          <Poster path={movie.posterPath} width={56} height={80} radius={8} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.detailTitle}>{movie.title}</Text>
            <Text style={styles.detailMeta}>
              {movie.year}{detail.runtime ? ` · ${detail.runtime}m` : ''}
            </Text>
            {genres.length > 0 && (
              <View style={styles.genrePills}>
                {genres.map(g => (
                  <View key={g} style={styles.genrePill}>
                    <Text style={styles.genrePillText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Streaming service */}
        {service && (
          <View style={styles.serviceRow}>
            <View style={styles.serviceColorDot} />
            <Text style={styles.serviceRowText}>available on {service}</Text>
          </View>
        )}

        {/* Rating */}
        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>your rating {savingRating ? '·  saving…' : ''}</Text>
          <TappableStars rating={rating} onChange={handleRating} size={18} />
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.detailPrimaryBtn, addedToWatchlist && { opacity: 0.6 }]}
          onPress={handleAddWatchlist}
          disabled={addedToWatchlist}
          activeOpacity={0.85}
        >
          <Text style={styles.detailPrimaryBtnText}>
            {addedToWatchlist ? '✓ added to watchlist' : '+ add to watchlist'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.detailSecondaryBtn} onPress={onDecide} activeOpacity={0.8}>
          <Text style={styles.detailSecondaryBtnText}>decide with this movie</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Log Watch Sheet ──────────────────────────────────────────────────────────

function LogWatchSheet({ uid, existing, onClose, onSaved }: {
  uid: string;
  existing?: WatchEntry | null;
  onClose: () => void;
  onSaved: (entry: WatchEntry) => void;
}) {
  const [query, setQuery] = useState(existing?.movieTitle ?? '');
  const [results, setResults] = useState<MovieResult[]>([]);
  const [selected, setSelected] = useState<MovieResult | null>(null);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [reviewText, setReviewText] = useState(existing?.reviewText ?? '');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try { setResults((await searchMovies(query)).slice(0, 6)); } catch { /* ignore */ }
    }, 400);
  }, [query]);

  const handleSave = async () => {
    if (!selected || rating === 0 || !uid) return;
    setSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'users', uid, 'watchHistory'), {
        movieId: selected.id, movieTitle: selected.title,
        posterPath: selected.posterPath ?? null, rating,
        reviewText: reviewText.trim(), watchedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'users', uid, 'reviews', String(selected.id)), {
        movieId: selected.id, movieTitle: selected.title,
        posterPath: selected.posterPath ?? null, rating,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      onSaved({
        id: docRef.id, movieId: selected.id, movieTitle: selected.title,
        posterPath: selected.posterPath ?? null, rating,
        reviewText: reviewText.trim(), watchedAt: new Date(),
      });
      onClose();
    } finally { setSaving(false); }
  };

  const canSave = !!selected && rating > 0;

  const sheetContent = (
    <>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetTitle}>log a watch</Text>

      {/* STATE B: search bar shows selected movie + "tap to change" */}
      {selected ? (
        <TouchableOpacity
          style={styles.selectedSearchBar}
          onPress={() => { setSelected(null); setQuery(''); }}
          activeOpacity={0.7}
        >
          <Text style={styles.selectedSearchBarText} numberOfLines={1}>
            {selected.title}
            <Text style={styles.selectedSearchBarHint}> · tap to change</Text>
          </Text>
        </TouchableOpacity>
      ) : (
        <TextInput
          style={styles.searchInput}
          placeholder="search for a movie…"
          placeholderTextColor="#A78BFA"
          value={query}
          onChangeText={v => setQuery(v)}
          autoFocus={!existing}
        />
      )}

      {/* STATE A: search results */}
      {!selected && results.length > 0 && (
        <Text style={styles.resultsLabel}>results</Text>
      )}
      {!selected && results.map(r => (
        <TouchableOpacity
          key={r.id}
          style={styles.searchResult}
          onPress={() => { setSelected(r); setResults([]); }}
        >
          <Text style={styles.searchResultTitle}>{r.title}</Text>
          <Text style={styles.searchResultYear}>{r.year}</Text>
        </TouchableOpacity>
      ))}
      {!selected && results.length > 0 && (
        <Text style={styles.searchHint}>tap a result to select</Text>
      )}

      {/* STATE B: selected movie details */}
      {selected && (
        <>
          <View style={styles.selectedMovieRow}>
            <Poster path={selected.posterPath} width={44} height={64} radius={6} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.selectedTitle}>{selected.title}</Text>
              <Text style={styles.selectedMeta}>
                {selected.year}
                {(selected.genres ?? []).slice(0, 2).map(id => GENRE_LABEL_MAP[id]).filter(Boolean).map(g => ` · ${g}`).join('')}
              </Text>
            </View>
          </View>

          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>your rating</Text>
            <TappableStars rating={rating} onChange={setRating} size={20} />
          </View>

          <TextInput
            style={styles.reviewInput}
            placeholder="add a review (optional)…"
            placeholderTextColor="#A78BFA"
            value={reviewText}
            onChangeText={v => setReviewText(v.slice(0, 280))}
            multiline
            maxLength={280}
          />
          <Text style={styles.charCount}>{reviewText.length}/280</Text>
        </>
      )}

      {/* Save button — always rendered so it stays reachable */}
      <TouchableOpacity
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled, { marginBottom: 16 }]}
        onPress={handleSave}
        disabled={!canSave || saving}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.saveBtnText}>save to watch history</Text>}
      </TouchableOpacity>
    </>
  );

  return (
    <>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      {Platform.OS === 'web' ? (
        <View style={[styles.sheet, { maxHeight: '75%', overflowY: 'auto' } as any]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {sheetContent}
          </ScrollView>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.sheet}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {sheetContent}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </>
  );
}

// ─── Add Friends Sheet ────────────────────────────────────────────────────────

function AddFriendsSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
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
      setResults(snap.docs.filter(d => d.id !== uid).map(d => ({
        uid: d.id,
        name: (d.data().displayName ?? d.data().firstName ?? d.id) as string,
      })));
    } catch { /* ignore */ }
    finally { setSearching(false); }
  };

  const handleFollow = async (friendUid: string) => {
    await setDoc(doc(db, 'users', uid, 'following', friendUid), { followedAt: serverTimestamp() });
    await setDoc(doc(db, 'users', friendUid, 'followers', uid), { followedAt: serverTimestamp() });
    setFollowing(prev => new Set([...prev, friendUid]));
  };

  return (
    <>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, Platform.OS === 'web' && ({ maxHeight: '65%', overflowY: 'auto' } as any)]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>find friends</Text>
        <View style={styles.searchInputWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={[styles.searchInput, { flex: 1, borderWidth: 0, height: 36, paddingHorizontal: 4 }]}
            placeholder="search by name…"
            placeholderTextColor="#A78BFA"
            value={searchText}
            onChangeText={handleSearch}
            autoFocus
          />
        </View>
        {searching && <ActivityIndicator color="#6D28D9" size="small" />}
        {results.map(r => (
          <View key={r.uid} style={styles.friendSearchRow}>
            <View style={[styles.avatar, { width: 24, height: 24, borderRadius: 12 }]}>
              <Text style={[styles.avatarText, { fontSize: 9 }]}>{r.name[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <Text style={styles.friendSearchName}>{r.name}</Text>
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
    </>
  );
}

// ─── Discover Tab ─────────────────────────────────────────────────────────────

function DiscoverTab({ uid, onMovieTap }: {
  uid: string;
  onMovieTap: (m: MovieDetail) => void;
}) {
  const [shelves, setShelves] = useState<DiscoverShelf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        const userData = userSnap.data() ?? {};
        const userGenres: string[] = ((userData.genres ?? []) as string[]).map((g: string) => g.toLowerCase());
        const genreIds = userGenres.map(g => GENRE_ID_MAP[g]).filter((id): id is number => !!id);
        const userServices: string[] = ((userData.streamingServices ?? []) as string[]).map((s: string) => s.toLowerCase());
        const userRegion: string = userData.region ?? userData.streamingRegion ?? 'US';

        // Get source movies for "because you liked"
        const historySnap = await getDocs(
          query(collection(db, 'users', uid, 'watchHistory'), orderBy('watchedAt', 'desc'), limit(3))
        );
        const sourceMoves = historySnap.docs.map(d => ({
          id: d.data().movieId as number,
          title: d.data().movieTitle as string,
        }));

        const [trendingResults, genreResults, newResults, ...recResults] = await Promise.all([
          getTrending(1).catch(() => [] as MovieResult[]),
          genreIds.length > 0 ? discoverMoviesByGenres(genreIds, 1).catch(() => [] as MovieResult[]) : Promise.resolve([] as MovieResult[]),
          fetchNewToStreaming(userServices, userRegion),
          ...sourceMoves.map(s => getMovieRecommendations(s.id).catch(() => [] as MovieResult[])),
        ]);

        if (cancelled) return;

        const result: DiscoverShelf[] = [];

        // Because you liked shelves
        sourceMoves.forEach((src, i) => {
          const recs = recResults[i] ?? [];
          if (recs.length > 0) {
            result.push({
              id: `rec-${src.id}`,
              label: 'because you liked',
              sourceName: src.title.toLowerCase(),
              movies: recs.slice(0, 3).map(toMovie),
              highlight: true,
            });
          }
        });

        result.push({ id: 'trending', label: 'trending this week', movies: trendingResults.slice(0, 5).map(toMovie) });
        if (newResults.length > 0) result.push({ id: 'new', label: 'new to your streaming', movies: newResults });
        if (genreResults.length > 0) result.push({ id: 'genres', label: 'your genres', movies: genreResults.slice(0, 5).map(toMovie) });

        setShelves(result);
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [uid]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color="#6D28D9" /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {shelves.map(shelf => (
        <View key={shelf.id} style={styles.shelf}>
          <Text style={styles.shelfLabel}>
            {shelf.label}
            {shelf.sourceName ? (
              <Text style={styles.shelfLabelSource}> {shelf.sourceName}</Text>
            ) : null}
          </Text>
          {shelf.movies.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.movieCard, shelf.highlight && styles.movieCardHighlight]}
              onPress={() => onMovieTap({ ...m })}
              activeOpacity={0.85}
            >
              <Poster path={m.posterPath} width={36} height={52} radius={5} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.movieCardTitle} numberOfLines={1}>{m.title}</Text>
                <Text style={styles.movieCardMeta}>
                  {m.year}
                  {m.genreIds[0] ? ` · ${GENRE_LABEL_MAP[m.genreIds[0]] ?? ''}` : ''}
                </Text>
                {(m.streamingServices ?? []).length > 0 && (
                  <ServiceBadge name={(m.streamingServices ?? [])[0]} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Friends Tab ──────────────────────────────────────────────────────────────

function FriendsTab({ uid, userInitials, onMovieTap, onAddFriends, onLogWatch }: {
  uid: string;
  userInitials: string;
  onMovieTap: (m: MovieDetail) => void;
  onAddFriends: () => void;
  onLogWatch: () => void;
}) {
  const [friendReviews, setFriendReviews] = useState<FriendReview[]>(MOCK_FRIEND_REVIEWS);
  const [ownReviews, setOwnReviews] = useState<FriendReview[]>([]);

  // Fetch poster paths for mock reviews once
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      MOCK_FRIEND_REVIEWS.map(async r => ({
        ...r,
        posterPath: r.movieId
          ? (await searchMovies(r.movieTitle).catch(() => []))[0]?.posterPath ?? null
          : null,
      }))
    ).then(updated => { if (!cancelled) setFriendReviews(updated); });
    return () => { cancelled = true; };
  }, []);

  // Load own reviews
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'reviews'), orderBy('updatedAt', 'desc'), limit(10));
    return onSnapshot(q, snap => {
      setOwnReviews(snap.docs.map(d => ({
        id: d.id, authorName: 'you', authorInitials: userInitials,
        movieTitle: d.data().movieTitle ?? '',
        rating: d.data().rating ?? 0, reviewText: '',
        timestamp: 'recently', posterPath: d.data().posterPath ?? null,
        movieId: d.data().movieId,
      })));
    });
  }, [uid, userInitials]);

  const allReviews = [...ownReviews, ...friendReviews];
  const hasFriends = friendReviews.length > 0; // mock friends always present

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        {/* Add friends pill */}
        <TouchableOpacity style={styles.addFriendsPill} onPress={onAddFriends} activeOpacity={0.8}>
          <Text style={styles.addFriendsPillText}>+ add friends</Text>
        </TouchableOpacity>

        {!hasFriends ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <FriendsEmptyIcon />
            </View>
            <Text style={styles.emptyTitle}>no friends yet</Text>
            <Text style={styles.emptySub}>add friends to see what they're watching and rating</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={onAddFriends} activeOpacity={0.85}>
              <Text style={styles.emptyBtnText}>+ add friends</Text>
            </TouchableOpacity>
          </View>
        ) : (
          allReviews.map(r => (
            <TouchableOpacity
              key={r.id}
              style={styles.friendCard}
              onPress={() => r.movieId ? onMovieTap({ id: r.movieId, title: r.movieTitle, year: '', posterPath: r.posterPath ?? null, genreIds: [] }) : undefined}
              activeOpacity={0.85}
            >
              <Poster path={r.posterPath} width={56} height={80} radius={7} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.friendCardTopRow}>
                  <Avatar initials={r.authorInitials} size={20} />
                  <Text style={styles.friendCardName}>{r.authorName}</Text>
                  <Text style={styles.friendCardTime}>{r.timestamp}</Text>
                </View>
                <Text style={styles.friendCardMovie} numberOfLines={1}>{r.movieTitle}</Text>
                <StarRow rating={r.rating} size={8} />
                {!!r.reviewText && (
                  <Text style={styles.reviewText}>"{r.reviewText}"</Text>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Log a review pill */}
      <View style={[styles.fabWrap, { bottom: 88 }]}>
        <TouchableOpacity style={styles.fab} onPress={onLogWatch} activeOpacity={0.85}>
          <Text style={styles.fabText}>+ log a review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Watched Tab ──────────────────────────────────────────────────────────────

function WatchedTab({ uid, onMovieTap, onLogWatch, onEditWatch }: {
  uid: string;
  onMovieTap: (m: MovieDetail) => void;
  onLogWatch: () => void;
  onEditWatch: (entry: WatchEntry) => void;
}) {
  const [history, setHistory] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'watchHistory'), orderBy('watchedAt', 'desc'));
    return onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({
        id: d.id,
        movieId: d.data().movieId,
        movieTitle: d.data().movieTitle,
        posterPath: d.data().posterPath ?? null,
        rating: d.data().rating ?? 0,
        reviewText: d.data().reviewText ?? '',
        watchedAt: d.data().watchedAt,
      })));
      setLoading(false);
    });
  }, [uid]);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color="#6D28D9" /></View>;
  }

  if (history.length === 0) {
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <WatchedEmptyIcon />
        </View>
        <Text style={styles.emptyTitle}>nothing logged yet</Text>
        <Text style={styles.emptySub}>add movies you've watched to build your taste profile</Text>
        <TouchableOpacity style={styles.emptyBtn} onPress={onLogWatch} activeOpacity={0.85}>
          <Text style={styles.emptyBtnText}>+ add a movie</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Header row */}
      <View style={styles.watchedHeader}>
        <Text style={styles.watchedHeaderLabel}>your watch history</Text>
        <View style={styles.watchedHeaderRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{history.length} films</Text>
          </View>
          <TouchableOpacity onPress={onLogWatch} style={styles.addCircleBtn} activeOpacity={0.8}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={10} stroke="#6D28D9" strokeWidth={1.4} />
              <Line x1={12} y1={7} x2={12} y2={17} stroke="#6D28D9" strokeWidth={1.4} strokeLinecap="round" />
              <Line x1={7} y1={12} x2={17} y2={12} stroke="#6D28D9" strokeWidth={1.4} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>
      </View>

      {/* 3-column grid */}
      <View style={styles.watchGrid}>
        {history.map(entry => (
          <TouchableOpacity
            key={entry.id}
            style={styles.watchGridCell}
            onPress={() => onMovieTap({ id: entry.movieId, title: entry.movieTitle, year: '', posterPath: entry.posterPath, genreIds: [], existingRating: entry.rating })}
            activeOpacity={0.85}
          >
            <View style={{ position: 'relative' }}>
              {entry.posterPath ? (
                <Image
                  source={{ uri: `${TMDB_IMAGE_BASE}${entry.posterPath}` }}
                  style={styles.watchPoster}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.watchPoster, { backgroundColor: '#EDE9FE' }]} />
              )}
              {/* Edit badge */}
              <TouchableOpacity
                style={styles.editBadge}
                onPress={e => { e.stopPropagation?.(); onEditWatch(entry); }}
                activeOpacity={0.8}
              >
                <PencilIcon />
              </TouchableOpacity>
            </View>
            <Text style={styles.watchGridTitle} numberOfLines={1}>{entry.movieTitle}</Text>
            <StarRow rating={entry.rating} size={7} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [innerTab, setInnerTab] = useState<InnerTab>('discover');
  const [movieDetail, setMovieDetail] = useState<MovieDetail | null>(null);
  const [logWatchOpen, setLogWatchOpen] = useState(false);
  const [editingWatch, setEditingWatch] = useState<WatchEntry | null>(null);
  const [addFriendsOpen, setAddFriendsOpen] = useState(false);

  const uid = user?.uid ?? '';
  const displayName = (user?.displayName ?? '');
  const parts = displayName.split(' ');
  const userInitials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'ME';

  const openLogWatch = (entry?: WatchEntry) => {
    setEditingWatch(entry ?? null);
    setLogWatchOpen(true);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>explore</Text>
      </View>

      {/* Inner tab bar */}
      <View style={styles.innerTabBar}>
        {(['discover', 'friends', 'watched'] as InnerTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.innerTab, innerTab === tab && styles.innerTabActive]}
            onPress={() => setInnerTab(tab)}
            activeOpacity={0.7}
          >
            <Text style={[styles.innerTabLabel, innerTab === tab && styles.innerTabLabelActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {innerTab === 'discover' && (
        <DiscoverTab uid={uid} onMovieTap={setMovieDetail} />
      )}
      {innerTab === 'friends' && (
        <FriendsTab
          uid={uid}
          userInitials={userInitials}
          onMovieTap={setMovieDetail}
          onAddFriends={() => setAddFriendsOpen(true)}
          onLogWatch={() => openLogWatch()}
        />
      )}
      {innerTab === 'watched' && (
        <WatchedTab
          uid={uid}
          onMovieTap={setMovieDetail}
          onLogWatch={() => openLogWatch()}
          onEditWatch={entry => openLogWatch(entry)}
        />
      )}

      {/* ── Sheets (absolutely positioned, always above content) ── */}

      {movieDetail && (
        <MovieDetailSheet
          movie={movieDetail}
          uid={uid}
          onClose={() => setMovieDetail(null)}
          onDecide={() => { setMovieDetail(null); router.replace('/(tabs)/decide'); }}
        />
      )}

      {logWatchOpen && (
        <LogWatchSheet
          uid={uid}
          existing={editingWatch}
          onClose={() => { setLogWatchOpen(false); setEditingWatch(null); }}
          onSaved={() => { setLogWatchOpen(false); setEditingWatch(null); }}
        />
      )}

      {addFriendsOpen && (
        <AddFriendsSheet uid={uid} onClose={() => setAddFriendsOpen(false)} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#F3F0FF',
  },
  headerTitle: {
    fontSize: 18, fontWeight: '200', color: '#4C1D95', letterSpacing: 3,
  },

  // ── Inner tab bar ──────────────────────────────────────────────────────────
  innerTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#DDD6FE',
    backgroundColor: '#F3F0FF',
  },
  innerTab: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
  },
  innerTabActive: {
    borderBottomWidth: 1.5, borderBottomColor: '#6D28D9', marginBottom: -1,
  },
  innerTabLabel: {
    fontSize: 11, fontWeight: '300', color: '#A78BFA', letterSpacing: 0.5,
  },
  innerTabLabelActive: {
    color: '#6D28D9', fontWeight: '500',
  },

  // ── Tab content ────────────────────────────────────────────────────────────
  tabContent: {
    paddingHorizontal: 16, paddingTop: 16, gap: 12,
  },

  // ── Shelf (Discover) ───────────────────────────────────────────────────────
  shelf: { gap: 8 },
  shelfLabel: {
    fontSize: 12, fontWeight: '400', color: '#4C1D95',
    marginBottom: 8,
  },
  shelfLabelSource: {
    fontWeight: '500',
  },
  movieCard: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD6FE',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
  },
  movieCardHighlight: { borderColor: '#6D28D9' },
  movieCardTitle: { fontSize: 13, fontWeight: '500', color: '#4C1D95' },
  movieCardMeta: { fontSize: 11, fontWeight: '300', color: '#A78BFA' },
  serviceBadge: {
    alignSelf: 'flex-start', backgroundColor: '#EDE9FE',
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  serviceBadgeText: { fontSize: 7, color: '#6D28D9', fontWeight: '300' },

  // ── Friends tab ────────────────────────────────────────────────────────────
  addFriendsPill: {
    alignSelf: 'flex-start', borderWidth: 0.5, borderColor: '#6D28D9',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
  },
  addFriendsPillText: { fontSize: 8, color: '#6D28D9', fontWeight: '300' },
  friendCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDD6FE',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8,
  },
  friendCardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  friendCardName: { fontSize: 10, fontWeight: '500', color: '#4C1D95', flex: 1 },
  friendCardTime: { fontSize: 9, color: '#A78BFA' },
  friendCardMovie: { fontSize: 11, fontWeight: '500', color: '#4C1D95' },
  reviewText: {
    fontSize: 10, fontWeight: '300', color: '#7C3AED',
    lineHeight: 15, fontStyle: 'italic',
  },

  // ── Empty state (shared) ───────────────────────────────────────────────────
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 60, gap: 10,
  },
  emptyIconWrap: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 12, fontWeight: '500', color: '#4C1D95' },
  emptySub: {
    fontSize: 10, color: '#A78BFA', textAlign: 'center', lineHeight: 15,
  },
  emptyBtn: {
    backgroundColor: '#6D28D9', borderRadius: 16,
    paddingVertical: 10, paddingHorizontal: 20, marginTop: 4,
  },
  emptyBtnText: { fontSize: 12, fontWeight: '400', color: '#FFFFFF' },

  // ── Watched tab ────────────────────────────────────────────────────────────
  watchedHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  watchedHeaderLabel: { fontSize: 9, color: '#A78BFA', fontWeight: '400', letterSpacing: 1 },
  watchedHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: {
    backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  countBadgeText: { fontSize: 9, color: '#6D28D9', fontWeight: '300' },
  addCircleBtn: { padding: 2 },
  watchGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  watchGridCell: {
    width: '30.5%', gap: 4,
  },
  watchPoster: {
    width: '100%', aspectRatio: 2 / 3, borderRadius: 6, backgroundColor: '#EDE9FE',
  },
  watchGridTitle: {
    fontSize: 8, fontWeight: '500', color: '#4C1D95',
  },
  editBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: 'rgba(109,40,217,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── FAB ────────────────────────────────────────────────────────────────────
  fabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: {
    backgroundColor: '#6D28D9', borderRadius: 16,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  fabText: { fontSize: 13, fontWeight: '400', color: '#FFFFFF' },

  // ── Shared sheet bits ──────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,20,0.55)', zIndex: 100,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 101,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 1, borderBottomWidth: 0, borderColor: '#DDD6FE',
    padding: 20, paddingBottom: 40, gap: 12,
  },
  sheetHandle: {
    width: 32, height: 4, borderRadius: 2,
    backgroundColor: '#DDD6FE', alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontSize: 12, fontWeight: '500', color: '#4C1D95', letterSpacing: 0.5 },

  // ── Movie detail sheet ─────────────────────────────────────────────────────
  detailSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 101,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 1, borderBottomWidth: 0, borderColor: '#DDD6FE',
    padding: 20, paddingBottom: 40, gap: 12,
  },
  detailTopRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  detailTitle: { fontSize: 14, fontWeight: '500', color: '#4C1D95' },
  detailMeta: { fontSize: 10, color: '#A78BFA' },
  genrePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  genrePill: {
    backgroundColor: '#EDE9FE', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  genrePillText: { fontSize: 8, color: '#6D28D9' },
  serviceRow: {
    backgroundColor: '#F3F0FF', borderRadius: 8, padding: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  serviceColorDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#6D28D9',
  },
  serviceRowText: { fontSize: 10, color: '#4C1D95' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratingLabel: { fontSize: 9, color: '#A78BFA', letterSpacing: 0.5 },
  detailPrimaryBtn: {
    height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any
      : { backgroundColor: '#6D28D9' }),
  },
  detailPrimaryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '400' },
  detailSecondaryBtn: {
    height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#6D28D9',
  },
  detailSecondaryBtnText: { color: '#4C1D95', fontSize: 13, fontWeight: '300' },

  // ── Log watch / search ─────────────────────────────────────────────────────
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F0FF', borderRadius: 8,
    paddingHorizontal: 10, height: 40,
  },
  searchIcon: { fontSize: 16, color: '#A78BFA', marginRight: 4 },
  searchInput: {
    height: 44, borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 8,
    paddingHorizontal: 14, fontSize: 13, fontWeight: '300', color: '#4C1D95',
    backgroundColor: '#F3F0FF',
  },
  resultsLabel: {
    fontSize: 9, fontWeight: '400', color: '#A78BFA', letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: -4,
  },
  searchHint: {
    fontSize: 10, color: '#C4B5FD', textAlign: 'center', paddingVertical: 8,
    fontStyle: 'italic',
  },
  selectedSearchBar: {
    height: 44, borderWidth: 1, borderColor: '#6D28D9', borderRadius: 8,
    paddingHorizontal: 14, justifyContent: 'center', backgroundColor: '#F3F0FF',
  },
  selectedSearchBarText: { fontSize: 13, fontWeight: '300', color: '#4C1D95' },
  selectedSearchBarHint: { fontSize: 12, fontWeight: '300', color: '#A78BFA' },
  searchResult: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F0FF',
  },
  searchResultTitle: { fontSize: 11, fontWeight: '300', color: '#4C1D95', flex: 1 },
  searchResultYear: { fontSize: 10, color: '#A78BFA' },
  selectedMovieRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  selectedTitle: { fontSize: 11, fontWeight: '500', color: '#4C1D95' },
  selectedMeta: { fontSize: 9, color: '#A78BFA' },
  reviewInput: {
    borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 8,
    paddingHorizontal: 14, paddingTop: 10, fontSize: 12, fontWeight: '300', color: '#4C1D95',
    minHeight: 72, textAlignVertical: 'top', backgroundColor: '#F3F0FF',
  },
  charCount: { fontSize: 9, color: '#A78BFA', textAlign: 'right' },
  saveBtn: {
    height: 44, borderRadius: 12,
    ...(Platform.OS === 'web'
      ? { background: 'linear-gradient(135deg, #4C1D95, #7C3AED)' } as any
      : { backgroundColor: '#6D28D9' }),
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#DDD6FE' },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '400' },

  // ── Add friends sheet ──────────────────────────────────────────────────────
  friendSearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6,
  },
  friendSearchName: { fontSize: 10, fontWeight: '500', color: '#4C1D95', flex: 1 },
  followBtn: {
    backgroundColor: '#6D28D9', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5,
  },
  followBtnDone: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#6D28D9' },
  followBtnText: { fontSize: 8, color: '#FFFFFF', fontWeight: '300' },
  followBtnTextDone: { color: '#6D28D9' },
  noResults: { fontSize: 11, color: '#A78BFA', textAlign: 'center', paddingVertical: 8 },

  // ── Avatar / stars ─────────────────────────────────────────────────────────
  avatar: { backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '500', color: '#6D28D9' },
  starRow: { flexDirection: 'row', gap: 1 },
  starFilled: { color: '#6D28D9' },
  starEmpty: { color: '#DDD6FE' },
});
