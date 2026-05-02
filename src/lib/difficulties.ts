export const DIFFICULTIES = {
	leicht: 'Leicht',
	mittel: 'Mittel',
	schwer: 'Schwer'
} as const;

export type DifficultySlug = keyof typeof DIFFICULTIES;

export const DIFFICULTY_SLUGS = Object.keys(DIFFICULTIES) as DifficultySlug[];

export function difficultyLabel(slug: DifficultySlug): string {
	return DIFFICULTIES[slug];
}
