import { TMDB_API_KEY, TMDB_BASE_URL } from '../constants/api';

export interface MovieResult {
  id: number;
  title: string;
  year: string;
  genres: number[];
  posterPath: string | null;
  voteAverage: number;
  voteCount: number;
  popularity: number;
  originalLanguage: string;
}

function mapMovie(raw: any): MovieResult {
  return {
    id: raw.id,
    title: raw.title,
    year: raw.release_date ? raw.release_date.slice(0, 4) : '',
    genres: raw.genre_ids ?? [],
    posterPath: raw.poster_path ?? null,
    voteAverage: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    popularity: raw.popularity ?? 0,
    originalLanguage: raw.original_language ?? 'en',
  };
}

export async function getTopRatedMovies(page: number = 1): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function getPopularMovies(page: number = 1): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/movie/popular?language=en-US&api_key=${TMDB_API_KEY}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function searchMovies(query: string): Promise<MovieResult[]> {
  const encoded = encodeURIComponent(query.trim());
  const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encoded}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function discoverMoviesByGenres(genreIds: number[], page: number = 1): Promise<MovieResult[]> {
  const genres = genreIds.join('|');
  const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genres}&sort_by=popularity.desc&primary_release_date.gte=2016-01-01&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function discoverPopularRecent(page: number = 1): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&primary_release_date.gte=2018-01-01&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function discoverHighRatedRecent(page: number = 1): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=vote_average.desc&vote_count.gte=1000&primary_release_date.gte=2015-01-01&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function getNowPlaying(page: number = 1): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function getTrending(page: number = 1): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function discoverByGenresFiltered(genreIds: number[], page: number = 1): Promise<MovieResult[]> {
  const genres = genreIds.join('|'); // OR logic — any of the user's genres
  const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genres}&sort_by=vote_average.desc&vote_count.gte=500&language=en-US&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results as any[]).map(mapMovie);
}

export async function fetchMovieRuntime(movieId: number): Promise<number | null> {
  const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return typeof data.runtime === 'number' && data.runtime > 0 ? data.runtime : null;
}

export async function getMovieRecommendations(movieId: number): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/movie/${movieId}/recommendations?api_key=${TMDB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.results as any[]) ?? []).slice(0, 5).map(mapMovie);
}
