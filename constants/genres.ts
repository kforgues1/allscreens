export interface Genre {
  id: string;
  label: string;
}

export const GENRES: Genre[] = [
  { id: 'action',      label: 'action' },
  { id: 'adventure',   label: 'adventure' },
  { id: 'animation',   label: 'animation' },
  { id: 'biography',   label: 'biography' },
  { id: 'comedy',      label: 'comedy' },
  { id: 'crime',       label: 'crime' },
  { id: 'documentary', label: 'documentary' },
  { id: 'drama',       label: 'drama' },
  { id: 'fantasy',     label: 'fantasy' },
  { id: 'historical',  label: 'historical' },
  { id: 'horror',      label: 'horror' },
  { id: 'musical',     label: 'musical' },
  { id: 'mystery',     label: 'mystery' },
  { id: 'romance',     label: 'romance' },
  { id: 'rom-com',     label: 'rom-com' },
  { id: 'sci-fi',      label: 'sci-fi' },
  { id: 'sport',       label: 'sport' },
  { id: 'superhero',   label: 'superhero' },
  { id: 'thriller',    label: 'thriller' },
  { id: 'war',         label: 'war' },
  { id: 'western',     label: 'western' },
  { id: 'family',      label: 'family' },
];
