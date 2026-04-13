import { TMDB_API_KEY, TMDB_BASE_URL } from '../constants/api';

export interface MovieResult {
  id: number;
  title: string;
  year: string;
  genres: number[];
  posterPath: string | null;
}

function mapMovie(raw: any): MovieResult {
  return {
    id: raw.id,
    title: raw.title,
    year: raw.release_date ? raw.release_date.slice(0, 4) : '',
    genres: raw.genre_ids ?? [],
    posterPath: raw.poster_path ?? null,
  };
}

export async function getTopRatedMovies(page: number = 1): Promise<MovieResult[]> {
  const url = `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
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
