export interface AuthConfig {
	required: boolean;
	type: "apikey";
	header?: string;
}

export interface PaginationConfig {
	enabled: boolean;
	defaultLimit: number;
	maxLimit: number;
	type?: "offset" | "cursor";
}

export interface ResponseConfig {
	transform?: "camelCase" | "snake_case" | "none";
	exclude?: string[];
	include?: string[];
	wrapper?: {
		data?: string;
		meta?: string;
		success?: string;
	};
}

export interface CacheConfig {
	type: "memory";
	ttl: number;
}

export interface RouteConfig {
	path: string;
	method: "GET";
	query: string;
	params?: string[];
	auth?: AuthConfig;
	pagination?: PaginationConfig;
	response?: ResponseConfig;
	cache?: CacheConfig;
	description?: string;
}

export interface GlobalConfig {
	cors?: {
		origins: string[];
		credentials?: boolean;
		methods?: string[];
	};
	errorHandler?: {
		includeStack?: boolean;
		includeQuery?: boolean;
	};
}

export interface Config {
	routes: RouteConfig[];
	global?: GlobalConfig;
}

export type DbRow = Record<string, unknown>;

export interface QueryResult {
	rows: DbRow[];
	rowCount: number;
	fields?: Record<string, unknown>[];
}

export interface PaginatedResult {
	data: DbRow[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		pages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
}

export interface ApiErrorDetails {
	message: string;
	code?: string;
	details?: Record<string, unknown>;
}

export interface ApiResponse {
	success: boolean;
	data?: DbRow[] | DbRow | Record<string, unknown>;
	error?: ApiErrorDetails;
	meta?: {
		pagination?: PaginatedResult["pagination"];
		timestamp: string;
		query?: string;
		rowCount?: number;
	};
}
