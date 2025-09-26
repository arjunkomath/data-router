type CacheEntry<T> = {
	value: T;
	expiresAt: number;
};

export interface CachedResponse {
	body: string;
	status: number;
	headers: Record<string, string>;
}

export class InMemoryCache<T = CachedResponse> {
	private store = new Map<string, CacheEntry<T>>();

	constructor(private readonly now: () => number = () => Date.now()) {}

	get(key: string): T | null {
		const entry = this.store.get(key);
		if (!entry) {
			return null;
		}

		if (entry.expiresAt <= this.now()) {
			this.store.delete(key);
			return null;
		}

		return entry.value;
	}

	set(key: string, value: T, ttlSeconds: number): void {
		const ttlMilliseconds = ttlSeconds * 1000;
		const expiresAt = this.now() + ttlMilliseconds;
		this.store.set(key, { value, expiresAt });
	}

	delete(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}
