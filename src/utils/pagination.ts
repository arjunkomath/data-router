import type {
	DbRow,
	PaginatedResult,
	PaginationConfig,
} from "../types/index.ts";

export const getPaginationParams = (
	config: PaginationConfig,
	request: Request,
): { offset: number; limit: number; page: number } => {
	const url = new URL(request.url);
	const pageParam = url.searchParams.get("page") || "1";
	const limitParam =
		url.searchParams.get("limit") || config.defaultLimit.toString();

	const page = Math.max(1, parseInt(pageParam, 10));
	let limit = parseInt(limitParam, 10);

	if (Number.isNaN(limit) || limit < 1) {
		limit = config.defaultLimit;
	}

	if (limit > config.maxLimit) {
		limit = config.maxLimit;
	}

	const offset = (page - 1) * limit;

	return { offset, limit, page };
};

export const createPaginatedResponse = (
	data: DbRow[],
	totalCount: number,
	page: number,
	limit: number,
): PaginatedResult => {
	const totalPages = Math.ceil(totalCount / limit);

	return {
		data,
		pagination: {
			page,
			limit,
			total: totalCount,
			pages: totalPages,
			hasNext: page < totalPages,
			hasPrev: page > 1,
		},
	};
};

export const validatePaginationParams = (
	config: PaginationConfig,
	page: number,
	limit: number,
): void => {
	if (page < 1) {
		throw new Error("Page number must be greater than 0");
	}

	if (limit < 1) {
		throw new Error("Limit must be greater than 0");
	}

	if (limit > config.maxLimit) {
		throw new Error(`Limit cannot exceed ${config.maxLimit}`);
	}
};

export const PaginationHelper = {
	getPaginationParams,
	createPaginatedResponse,
	validatePaginationParams,
};
