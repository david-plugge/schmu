const BASE_URL = 'https://de.wiktionary.org/w/api.php';
const HEADERS = {
	'User-Agent': 'SchmuGame/1.0 (party game; fetching random German words)',
	Accept: 'application/json'
};

const WORD_RE = /^[A-ZÄÖÜ][a-zäöüß]+$/;
const MIN_LENGTH = 4;
const RANDOM_API_LIMIT = 200;
const CATEGORY_API_LIMIT = 200;
const TITLES_CHUNK = 50;
const FILTER_CHUNK_DELAY = 300;
const OBSCURE_CATEGORIES = ['Kategorie:Fremdwort', 'Kategorie:veralteter Wortschatz (Deutsch)'];
const INFLECTED_CATEGORIES = ['Deklinierte Form (Deutsch)', 'Konjugierte Form (Deutsch)'];
const PROPER_NOUN_CATEGORIES = [
	'Toponym (Deutsch)',
	'Vorname (Deutsch)',
	'Nachname (Deutsch)',
	'Familienname (Deutsch)',
	'Eigenname (Deutsch)'
];

export const RATE_LIMIT_BACKOFF = 5000;

interface WiktionaryTitle {
	title: string;
}

interface WiktionaryPage {
	title: string;
	categories?: WiktionaryTitle[];
}

interface RandomResponse {
	query: { random: WiktionaryTitle[] };
}

interface CategoryMembersResponse {
	query: { categorymembers: WiktionaryTitle[] };
}

interface PagesResponse {
	query: { pages: Record<string, WiktionaryPage> };
}

export function delay(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

function shuffle<T>(arr: T[]): void {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
}

async function wiktionaryFetch<T>(params: URLSearchParams): Promise<T | null> {
	const res = await fetch(`${BASE_URL}?${params}`, { headers: HEADERS });

	if (res.status === 429) {
		const retryAfter = parseInt(res.headers.get('retry-after') || '5', 10);
		const backoff = retryAfter * 1000 || RATE_LIMIT_BACKOFF;
		console.log(`  Rate limited, waiting ${backoff / 1000}s...`);
		await delay(backoff);
		const retry = await fetch(`${BASE_URL}?${params}`, { headers: HEADERS });
		if (!retry.ok) return null;
		return (await retry.json()) as T;
	}

	if (!res.ok) return null;

	// Wiktionary sometimes returns HTML error text instead of JSON
	const text = await res.text();
	try {
		return JSON.parse(text) as T;
	} catch {
		console.log(`  Rate limited (non-JSON response), waiting ${RATE_LIMIT_BACKOFF / 1000}s...`);
		await delay(RATE_LIMIT_BACKOFF);
		return null;
	}
}

export async function fetchRandomGermanWords(count: number): Promise<string[]> {
	const [randomWords, obscureWords] = await Promise.all([
		fetchRandomBaseWords(count),
		fetchFromObscureCategories(count)
	]);
	const all = [...new Set([...obscureWords, ...randomWords])];
	shuffle(all);
	return all.slice(0, count);
}

async function fetchRandomBaseWords(count: number): Promise<string[]> {
	const limit = Math.min(Math.max(count * 3, 50), RANDOM_API_LIMIT);

	const data = await wiktionaryFetch<RandomResponse>(
		new URLSearchParams({
			action: 'query',
			list: 'random',
			rnnamespace: '0',
			rnlimit: String(limit),
			rnfilterredir: 'nonredirects',
			format: 'json'
		})
	);
	if (!data) return [];

	const candidates = data.query.random
		.map((p) => p.title)
		.filter((t) => WORD_RE.test(t) && t.length >= MIN_LENGTH);

	return await filterAcceptableWords(candidates);
}

async function fetchFromObscureCategories(count: number): Promise<string[]> {
	const perCategory = Math.min(
		Math.max(Math.ceil((count * 3) / OBSCURE_CATEGORIES.length), 50),
		CATEGORY_API_LIMIT
	);
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

	const results = await Promise.all(
		OBSCURE_CATEGORIES.map(async (category) => {
			try {
				const startLetter = letters[Math.floor(Math.random() * letters.length)];
				const data = await wiktionaryFetch<CategoryMembersResponse>(
					new URLSearchParams({
						action: 'query',
						list: 'categorymembers',
						cmtitle: category,
						cmnamespace: '0',
						cmlimit: String(perCategory),
						cmstartsortkeyprefix: startLetter,
						format: 'json'
					})
				);
				if (!data) return [];

				const members = data.query.categorymembers
					.map((m) => m.title)
					.filter((t) => WORD_RE.test(t) && t.length >= MIN_LENGTH);
				shuffle(members);
				return await filterAcceptableWords(members);
			} catch {
				return [];
			}
		})
	);

	return results.flat();
}

async function filterAcceptableWords(titles: string[]): Promise<string[]> {
	if (titles.length === 0) return [];

	const result: string[] = [];
	for (let i = 0; i < titles.length; i += TITLES_CHUNK) {
		if (i > 0) await delay(FILTER_CHUNK_DELAY);
		const chunk = titles.slice(i, i + TITLES_CHUNK);
		result.push(...(await filterChunk(chunk)));
	}
	return result;
}

async function filterChunk(titles: string[]): Promise<string[]> {
	const data = await wiktionaryFetch<PagesResponse>(
		new URLSearchParams({
			action: 'query',
			titles: titles.join('|'),
			prop: 'categories',
			cllimit: 'max',
			format: 'json'
		})
	);
	if (!data) return [];

	const result: string[] = [];
	for (const page of Object.values(data.query.pages)) {
		const cats = (page.categories ?? []).map((c) => c.title);
		const isGerman = cats.some((c) => c.includes('(Deutsch)'));
		const isInflected = cats.some((c) => INFLECTED_CATEGORIES.some((inf) => c.includes(inf)));
		const isProperNoun = cats.some((c) => PROPER_NOUN_CATEGORIES.some((pn) => c.includes(pn)));
		if (isGerman && !isInflected && !isProperNoun) result.push(page.title);
	}

	return result;
}
