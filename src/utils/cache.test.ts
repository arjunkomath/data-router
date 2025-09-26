import { describe, expect, it } from "bun:test";

import { InMemoryCache, type CachedResponse } from "./cache.ts";

describe("InMemoryCache", () => {
	it("returns cached value before expiration", () => {
		const now = 0;
		const cache = new InMemoryCache<CachedResponse>(() => now);
		const payload: CachedResponse = {
			body: "example",
			headers: { "Content-Type": "application/json" },
			status: 200,
		};

		cache.set("key", payload, 60);

		expect(cache.get("key")).toEqual(payload);
	});

	it("evicts values after ttl passes", () => {
		let now = 0;
		const cache = new InMemoryCache<CachedResponse>(() => now);
		const payload: CachedResponse = {
			body: "example",
			headers: { "Content-Type": "application/json" },
			status: 200,
		};

		cache.set("key", payload, 1);

		now = 500; // 0.5 seconds
		expect(cache.get("key")).toEqual(payload);

		now = 1100; // 1.1 seconds
		expect(cache.get("key")).toBeNull();
	});
});
