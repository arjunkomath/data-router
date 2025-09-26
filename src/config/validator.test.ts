import { describe, expect, it } from "bun:test";

import { isValidSqlQuery, validateConfig } from "./validator.ts";

describe("isValidSqlQuery", () => {
	it("allows select statements with columns like created_at", () => {
		const query = "SELECT id, created_at FROM users";
		expect(isValidSqlQuery(query)).toBe(true);
	});

	it("rejects destructive statements", () => {
		const query = "DROP TABLE users";
		expect(isValidSqlQuery(query)).toBe(false);
	});

	it("rejects extended stored procedure calls", () => {
		const query = "SELECT * FROM xp_cmdshell";
		expect(isValidSqlQuery(query)).toBe(false);
	});
});

describe("validateConfig", () => {
	it("accepts cache configuration", () => {
		expect(() =>
			validateConfig({
				routes: [
					{
						path: "/users",
						method: "GET",
						query: "SELECT 1",
						cache: { type: "memory", ttl: 60 },
					},
				],
			}),
		).not.toThrow();
	});

	it("rejects non-positive cache ttl", () => {
		expect(() =>
			validateConfig({
				routes: [
					{
						path: "/users",
						method: "GET",
						query: "SELECT 1",
						cache: { type: "memory", ttl: 0 },
					},
				],
			}),
		).toThrow();
	});
});
