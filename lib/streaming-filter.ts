import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  discoverPopularRecent, discoverHighRatedRecent, getNowPlaying, getTrending,
  discoverMoviesByGenres, getMovieRecommendations, type MovieResult,
} from './tmdb';
import { TMDB_API_KEY, TMDB_BASE_URL } from '../constants/api';
import { toISORegion } from '../constants/regions';

export type Movie = MovieResult & {
  runtime?: number;
  voteAverage?: number;
  streamingServices?: string[];
};

// Region used for TMDB watch providers — can be made user-configurable later.
const DEFAULT_REGION = 'US';

const GENRE_ID_MAP: Record<string, number> = {
  'action': 28, 'adventure': 12, 'animation': 16, 'comedy': 35,
  'crime': 80, 'documentary': 99, 'drama': 18, 'family': 10751,
  'fantasy': 14, 'history': 36, 'horror': 27, 'music': 10402,
  'mystery': 9648, 'romance': 10749, 'science fiction': 878, 'sci-fi': 878,
  'thriller': 53, 'war': 10752, 'western': 37,
};

// ── In-memory cache keyed by uid ─────────────────────────────────────────────
const cache = new Map<string, { movies: Movie[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clear any stale cache from previous filter logic
cache.clear();

async function fetchWatchProviders(
  movieId: number,
  region: string,
): Promise<string[]> {
  try {
    const url = `${TMDB_BASE_URL}/movie/${movieId}/watch/providers?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const regionData = data.results?.[region];
    if (!regionData?.flatrate) return [];
    // Normalise provider names to lowercase for comparison
    return (regionData.flatrate as any[]).map((p: any) =>
      (p.provider_name as string).toLowerCase(),
    );
  } catch {
    return [];
  }
}

/**
 * Returns up to 50 top-rated movies that are available on at least one of
 * the user's chosen streaming services. Results are cached for 5 minutes.
 */
export async function getWatchableMovies(uid: string): Promise<Movie[]> {
  const cached = cache.get(uid);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.movies;
  }

  // 1. Read user data from Firestore
  let userServices: string[] = [];
  let userRegion = DEFAULT_REGION;
  let userGenreIds: number[] = [];
  let favouriteMovieIds: number[] = [];
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const data = snap.data();
    userServices = ((data?.streamingServices as string[]) ?? []).map((s: string) => s.toLowerCase());
    userRegion = toISORegion((data?.region ?? data?.streamingRegion ?? DEFAULT_REGION) as string);
    const userGenres: string[] = ((data?.genres as string[]) ?? []).map((g: string) => g.toLowerCase());
    userGenreIds = userGenres.map(g => GENRE_ID_MAP[g]).filter((id): id is number => id !== undefined);
    favouriteMovieIds = (
      (data?.favouriteMovieIds ?? data?.favoriteMovieIds ?? data?.savedMovieIds) as number[]
    ) ?? [];
  } catch { /* fall through */ }

  const filterByService = userServices.length > 0;

  // 2. Fetch all sources in parallel
  const [
    popularRecentPages,
    highRatedPages,
    nowPlayingPages,
    trendingPages,
    genrePages,
    recPages,
  ] = await Promise.all([
    Promise.all([1, 2, 3, 4].map(p => discoverPopularRecent(p).catch(() => [] as MovieResult[]))),
    Promise.all([1, 2].map(p => discoverHighRatedRecent(p).catch(() => [] as MovieResult[]))),
    Promise.all([1, 2].map(p => getNowPlaying(p).catch(() => [] as MovieResult[]))),
    Promise.all([1, 2].map(p => getTrending(p).catch(() => [] as MovieResult[]))),
    userGenreIds.length > 0
      ? Promise.all([1, 2].map(p => discoverMoviesByGenres(userGenreIds, p).catch(() => [] as MovieResult[])))
      : Promise.resolve([] as MovieResult[][]),
    favouriteMovieIds.length > 0
      ? Promise.all(favouriteMovieIds.slice(0, 5).map(id => getMovieRecommendations(id).catch(() => [] as MovieResult[])))
      : Promise.resolve([] as MovieResult[][]),
  ]);

  const popularRecent = popularRecentPages.flat();
  const highRated    = highRatedPages.flat();
  const nowPlaying   = nowPlayingPages.flat();
  const trending     = trendingPages.flat();
  const genreMatched = (genrePages as MovieResult[][]).flat();
  const recs         = (recPages as MovieResult[][]).flat();

  // Build ID sets for scoring bonuses
  const trendingIds = new Set(trending.map(m => m.id));
  const recIds      = new Set(recs.map(m => m.id));
  const genreHitIds = new Set(genreMatched.map(m => m.id));

  // 3. Deduplicate; filter to English-only and voteCount >= 200
  const seen = new Set<number>();
  const candidates: MovieResult[] = [];
  for (const m of [...popularRecent, ...highRated, ...nowPlaying, ...trending, ...genreMatched, ...recs]) {
    if (seen.has(m.id)) continue;
    if (m.originalLanguage !== 'en') continue;
    if (m.voteCount < 200) continue;
    seen.add(m.id);
    candidates.push(m);
  }

  // 4. Fetch watch providers — include movie regardless of result
  const withProviders: Movie[] = await Promise.all(
    candidates.map(async movie => {
      const providers = await fetchWatchProviders(movie.id, userRegion);
      return { ...movie, streamingServices: providers };
    }),
  );

  // 5. Filter to only movies available on the user's subscribed services
  const filtered = filterByService
    ? withProviders.filter(m =>
        userServices.some(svc =>
          (m.streamingServices ?? []).some(p => p.includes(svc) || svc.includes(p)),
        ),
      )
    : withProviders;

  // 6. Score, sort, cap at 50
  const sorted = filtered
    .map(m => {
      let score = (m.popularity ?? 0) * 0.4 + (m.voteAverage ?? 0) * 10 * 0.3;
      if (genreHitIds.has(m.id)) score += 20;
      if (recIds.has(m.id))      score += 30;
      if (trendingIds.has(m.id)) score += 15;
      return { movie: m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map(s => s.movie);

  cache.set(uid, { movies: sorted, fetchedAt: Date.now() });
  return sorted;
}

/** Invalidate cached results for a user (e.g. after they update streaming services) */
export function invalidateWatchableMoviesCache(uid: string) {
  cache.delete(uid);
}
