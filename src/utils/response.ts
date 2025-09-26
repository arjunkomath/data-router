import type {
	ApiErrorDetails,
	ApiResponse,
	DbRow,
	PaginatedResult,
	ResponseConfig,
} from "../types/index.ts";

const toCamelCase = (str: string): string =>
	str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const toSnakeCase = (str: string): string =>
	str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const transformKeys = (
	obj: DbRow,
	transformType: "camelCase" | "snake_case" | "none",
): DbRow => {
	if (transformType === "none" || !obj || typeof obj !== "object") {
		return obj;
	}

	const transformed: DbRow = {};

	for (const [key, value] of Object.entries(obj)) {
		let newKey = key;

		if (transformType === "camelCase") {
			newKey = toCamelCase(key);
		} else if (transformType === "snake_case") {
			newKey = toSnakeCase(key);
		}

		if (
			value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			!(value instanceof Date)
		) {
			transformed[newKey] = transformKeys(value as DbRow, transformType);
		} else if (Array.isArray(value)) {
			transformed[newKey] = value.map((item) =>
				typeof item === "object" && !(item instanceof Date)
					? transformKeys(item as DbRow, transformType)
					: item,
			);
		} else {
			transformed[newKey] = value;
		}
	}

	return transformed;
};

export const transformData = (
	data: DbRow[],
	config?: ResponseConfig,
): DbRow[] => {
	if (!config) return data;

	return data.map((item) => {
		let transformed: DbRow = { ...item };

		if (config.exclude && config.exclude.length > 0) {
			for (const field of config.exclude) {
				delete transformed[field];
			}
		}

		if (config.include && config.include.length > 0) {
			const filtered: DbRow = {};
			for (const field of config.include) {
				if (field in transformed) {
					filtered[field] = transformed[field];
				}
			}
			transformed = filtered;
		}

		if (config.transform) {
			transformed = transformKeys(transformed, config.transform);
		}

		return transformed;
	});
};

export const createApiResponse = (
	data: DbRow[] | DbRow | Record<string, unknown> | undefined,
	config?: ResponseConfig,
	error?: ApiErrorDetails,
	meta?: Record<string, unknown>,
): ApiResponse => {
	const response: ApiResponse = {
		success: !error,
		meta: {
			timestamp: new Date().toISOString(),
			...meta,
		},
	};

	if (error) {
		response.error = error;
	} else {
		response.data = data;
	}

	if (config?.wrapper) {
		const wrapped: Record<string, unknown> = {};

		if (config.wrapper.success !== undefined) {
			wrapped[config.wrapper.success] = response.success;
		}

		if (config.wrapper.data !== undefined && response.data !== undefined) {
			wrapped[config.wrapper.data] = response.data;
		}

		if (config.wrapper.meta !== undefined && response.meta) {
			wrapped[config.wrapper.meta] = response.meta;
		}

		if (response.error) {
			wrapped.error = response.error;
		}

		return wrapped as unknown as ApiResponse;
	}

	return response;
};

export const createPaginatedApiResponse = (
	result: PaginatedResult,
	config?: ResponseConfig,
	meta?: Record<string, unknown>,
): ApiResponse => {
	const transformedData = transformData(result.data, config);

	return createApiResponse(transformedData, config, undefined, {
		pagination: result.pagination,
		...meta,
	});
};

export const createErrorResponse = (
	message: string,
	code?: string,
	details?: Record<string, unknown>,
	status = 500,
): Response => {
	const errorResponse = createApiResponse(undefined, undefined, {
		message,
		code,
		details,
	});

	return new Response(JSON.stringify(errorResponse), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
};

export const ResponseTransformer = {
	transformData,
	createApiResponse,
	createPaginatedApiResponse,
	createErrorResponse,
};
