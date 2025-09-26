import { z } from "zod";

const AuthConfigSchema = z.object({
	required: z.boolean(),
	type: z.enum(["apikey"]),
	header: z.string().optional(),
});

const PaginationConfigSchema = z
	.object({
		enabled: z.boolean(),
		defaultLimit: z.number().positive(),
		maxLimit: z.number().positive(),
		type: z.enum(["offset", "cursor"]).default("offset"),
	})
	.refine((data) => data.defaultLimit <= data.maxLimit, {
		message: "defaultLimit must be less than or equal to maxLimit",
	});

const ResponseConfigSchema = z.object({
	transform: z.enum(["camelCase", "snake_case", "none"]).default("none"),
	exclude: z.array(z.string()).optional(),
	include: z.array(z.string()).optional(),
	wrapper: z
		.object({
			data: z.string().optional(),
			meta: z.string().optional(),
			success: z.string().optional(),
		})
		.optional(),
});

const CacheConfigSchema = z.object({
	type: z.literal("memory"),
	ttl: z.number().int().positive(),
});

const RouteConfigSchema = z.object({
	path: z.string().min(1, "Route path is required"),
	method: z.enum(["GET"]),
	query: z.string().min(1, "SQL query is required"),
	params: z.array(z.string()).optional(),
	auth: AuthConfigSchema.optional(),
	pagination: PaginationConfigSchema.optional(),
	response: ResponseConfigSchema.optional(),
	cache: CacheConfigSchema.optional(),
	description: z.string().optional(),
});

const GlobalConfigSchema = z.object({
	cors: z
		.object({
			origins: z.array(z.string()),
			credentials: z.boolean().optional(),
			methods: z.array(z.string()).optional(),
		})
		.optional(),
	errorHandler: z
		.object({
			includeStack: z.boolean().optional(),
			includeQuery: z.boolean().optional(),
		})
		.optional(),
});

export const ConfigSchema = z
	.object({
		routes: z.array(RouteConfigSchema).min(1, "At least one route is required"),
		global: GlobalConfigSchema.optional(),
	})
	.refine(
		(data) => {
			const paths = new Set();
			for (const route of data.routes) {
				const routeKey = `${route.method}:${route.path}`;
				if (paths.has(routeKey)) {
					return false;
				}
				paths.add(routeKey);
			}
			return true;
		},
		{
			message: "Duplicate route configurations found (same method and path)",
		},
	);

export function validateConfig(config: unknown) {
	return ConfigSchema.parse(config);
}

export function isValidSqlQuery(query: string): boolean {
	const normalizedQuery = query.trim().toLowerCase();

	const allowedOperations = ["select", "with"];
	const hasValidStart = allowedOperations.some((op) =>
		normalizedQuery.startsWith(op),
	);

	const forbiddenPatterns = [
		/\binsert\b/,
		/\bupdate\b/,
		/\bdelete\b/,
		/\bdrop\b/,
		/\bcreate\b/,
		/\balter\b/,
		/\btruncate\b/,
		/\bgrant\b/,
		/\brevoke\b/,
		/\bexec\b/,
		/\bexecute\b/,
		/\bxp_[a-z0-9_]+/,
		/\bsp_[a-z0-9_]+/,
	];

	const hasForbiddenKeywords = forbiddenPatterns.some((pattern) =>
		pattern.test(normalizedQuery),
	);

	return hasValidStart && !hasForbiddenKeywords;
}
