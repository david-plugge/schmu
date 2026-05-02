import { delay, fetchRandomGermanWords, RATE_LIMIT_BACKOFF } from './wiktionary';

const FETCH_SIZE = 200;
const REFILL_THRESHOLD = 80;

export class WordBuffer {
	private queue: string[] = [];
	private seen: Set<string>;
	private waiters: Array<() => void> = [];
	private stopped = false;

	constructor(seedSeen: Iterable<string>) {
		this.seen = new Set(seedSeen);
	}

	start() {
		this.fillLoop().catch((err) => console.error('  [buffer] fill loop crashed:', err));
	}

	stop() {
		this.stopped = true;
		this.notify();
	}

	async take(n: number): Promise<string[]> {
		while (this.queue.length < n && !this.stopped) {
			await this.waitForChange();
		}
		const taken = this.queue.splice(0, n);
		this.notify();
		return taken;
	}

	private notify() {
		const w = this.waiters;
		this.waiters = [];
		w.forEach((fn) => fn());
	}

	private waitForChange(): Promise<void> {
		return new Promise((r) => this.waiters.push(r));
	}

	private async fillLoop() {
		while (!this.stopped) {
			while (this.queue.length >= REFILL_THRESHOLD && !this.stopped) {
				await this.waitForChange();
			}
			if (this.stopped) return;

			try {
				const words = await fetchRandomGermanWords(FETCH_SIZE);
				const fresh = words.filter((w) => !this.seen.has(w));
				if (fresh.length === 0) {
					console.log('  [buffer] no new words from Wiktionary, backing off...');
					await delay(RATE_LIMIT_BACKOFF);
					continue;
				}
				for (const w of fresh) this.seen.add(w);
				this.queue.push(...fresh);
				console.log(`  [buffer] +${fresh.length} fresh (queue: ${this.queue.length})`);
				this.notify();
			} catch (err) {
				console.error('  [buffer] fetch failed, retrying...', err);
				await delay(RATE_LIMIT_BACKOFF);
			}
		}
	}
}
