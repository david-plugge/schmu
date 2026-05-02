export const CATEGORIES = {
	medizin: 'Medizin & Anatomie',
	recht: 'Recht & Politik',
	wissenschaft: 'Wissenschaft & Technik',
	natur: 'Natur & Biologie',
	kunst: 'Kunst & Kultur',
	religion: 'Religion & Mythologie',
	sprache: 'Sprache & Grammatik',
	handwerk: 'Handwerk & Beruf',
	alltag: 'Alltag & Gegenstände',
	sonstiges: 'Sonstiges'
} as const;

export type CategorySlug = keyof typeof CATEGORIES;

export const CATEGORY_SLUGS = Object.keys(CATEGORIES) as CategorySlug[];

export function categoryLabel(slug: CategorySlug): string {
	return CATEGORIES[slug];
}
