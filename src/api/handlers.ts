import type { DatabaseConnection } from "../database/connection.ts";
import { QueryExecutor } from "../database/query.ts";
import type { Config, RouteConfig } from "../types/index.ts";
import { PaginationHelper } from "../utils/pagination.ts";
import { ResponseTransformer } from "../utils/response.ts";
import { InMemoryCache, type CachedResponse } from "../utils/cache.ts";
import { AuthMiddleware, CorsMiddleware } from "./middleware.ts";

export class RequestHandler {
	constructor(
		private config: Config,
		private dbConnection: DatabaseConnection,
	) {}

	private cache = new InMemoryCache<CachedResponse>();

	async handleRequest(request: Request): Promise<Response> {
		try {
			const corsResponse = CorsMiddleware.handleCors(
				request,
				this.config.global?.cors,
			);
			if (corsResponse) {
				return corsResponse;
			}

			const url = new URL(request.url);

			// Handle health check endpoint
			if (url.pathname === "/health" && request.method === "GET") {
				const healthResponse = await this.handleHealthCheck();
				return CorsMiddleware.addCorsHeaders(
					healthResponse,
					request,
					this.config.global?.cors,
				);
			}

			const route = this.findMatchingRoute(
				url.pathname,
				request.method as "GET",
			);

			if (!route) {
				const errorResponse = ResponseTransformer.createErrorResponse(
					`Route not found: ${request.method} ${url.pathname}`,
					"ROUTE_NOT_FOUND",
					undefined,
					404,
				);
				return CorsMiddleware.addCorsHeaders(
					errorResponse,
					request,
					this.config.global?.cors,
				);
			}

			if (route.auth) {
				try {
					AuthMiddleware.authenticate(route.auth, request);
				} catch (error) {
					const authErrorResponse = AuthMiddleware.createAuthError(
						error instanceof Error ? error.message : "Authentication failed",
					);
					return CorsMiddleware.addCorsHeaders(
						authErrorResponse,
						request,
						this.config.global?.cors,
					);
				}
			}

			const cacheKey = this.getCacheKey(route, url);
			const cacheConfig = route.cache;
			if (cacheKey && cacheConfig?.type === "memory") {
				const cached = this.cache.get(cacheKey);
				if (cached) {
					const cachedResponse = new Response(cached.body, {
						headers: cached.headers,
						status: cached.status,
					});
					return CorsMiddleware.addCorsHeaders(
						cachedResponse,
						request,
						this.config.global?.cors,
					);
				}
			}

			const params = this.extractPathParams(route.path, url.pathname);
			const queryExecutor = new QueryExecutor(
				this.dbConnection.getConnection(),
			);

			let response: Response;
			let responseBody: string | null = null;
			const responseStatus = 200;

			if (route.pagination?.enabled) {
				const paginationParams = PaginationHelper.getPaginationParams(
					route.pagination,
					request,
				);

				try {
					PaginationHelper.validatePaginationParams(
						route.pagination,
						paginationParams.page,
						paginationParams.limit,
					);
				} catch (error) {
					const paginationErrorResponse =
						ResponseTransformer.createErrorResponse(
							error instanceof Error
								? error.message
								: "Invalid pagination parameters",
							"INVALID_PAGINATION",
							undefined,
							400,
						);
					return CorsMiddleware.addCorsHeaders(
						paginationErrorResponse,
						request,
						this.config.global?.cors,
					);
				}

				const [queryResult, totalCount] = await Promise.all([
					queryExecutor.executeQuery(route, params, paginationParams),
					queryExecutor.executeCountQuery(route, params),
				]);

				const paginatedResult = PaginationHelper.createPaginatedResponse(
					queryResult.rows,
					totalCount,
					paginationParams.page,
					paginationParams.limit,
				);

				const apiResponse = ResponseTransformer.createPaginatedApiResponse(
					paginatedResult,
					route.response,
					{ query: route.description },
				);

				responseBody = JSON.stringify(apiResponse);
				response = new Response(responseBody, {
					headers: { "Content-Type": "application/json" },
					status: responseStatus,
				});
			} else {
				const queryResult = await queryExecutor.executeQuery(route, params);
				const transformedData = ResponseTransformer.transformData(
					queryResult.rows,
					route.response,
				);

				const apiResponse = ResponseTransformer.createApiResponse(
					transformedData,
					route.response,
					undefined,
					{ query: route.description, rowCount: queryResult.rowCount },
				);

				responseBody = JSON.stringify(apiResponse);
				response = new Response(responseBody, {
					headers: { "Content-Type": "application/json" },
					status: responseStatus,
				});
			}

			if (cacheKey && cacheConfig?.type === "memory" && responseBody !== null) {
				this.cache.set(
					cacheKey,
					{
						body: responseBody,
						status: responseStatus,
						headers: { "Content-Type": "application/json" },
					},
					cacheConfig.ttl,
				);
			}

			return CorsMiddleware.addCorsHeaders(
				response,
				request,
				this.config.global?.cors,
			);
		} catch (error) {
			console.error("Request handling error:", error);

			const errorResponse = ResponseTransformer.createErrorResponse(
				error instanceof Error ? error.message : "Internal server error",
				"INTERNAL_ERROR",
				this.config.global?.errorHandler?.includeStack
					? error instanceof Error && error.stack
						? { stack: error.stack }
						: undefined
					: undefined,
				500,
			);

			return CorsMiddleware.addCorsHeaders(
				errorResponse,
				request,
				this.config.global?.cors,
			);
		}
	}

	private findMatchingRoute(path: string, method: "GET"): RouteConfig | null {
		for (const route of this.config.routes) {
			if (route.method === method && this.matchPath(route.path, path)) {
				return route;
			}
		}
		return null;
	}

	private matchPath(routePath: string, requestPath: string): boolean {
		const routeParts = routePath.split("/").filter(Boolean);
		const requestParts = requestPath.split("/").filter(Boolean);

		if (routeParts.length !== requestParts.length) {
			return false;
		}

		for (let i = 0; i < routeParts.length; i++) {
			const routePart = routeParts[i];
			const requestPart = requestParts[i];

			if (routePart.startsWith(":")) {
				continue;
			}

			if (routePart !== requestPart) {
				return false;
			}
		}

		return true;
	}

	private extractPathParams(
		routePath: string,
		requestPath: string,
	): Record<string, string> {
		const routeParts = routePath.split("/").filter(Boolean);
		const requestParts = requestPath.split("/").filter(Boolean);
		const params: Record<string, string> = {};

		for (let i = 0; i < routeParts.length; i++) {
			const routePart = routeParts[i];
			if (routePart.startsWith(":")) {
				const paramName = routePart.substring(1);
				params[paramName] = requestParts[i];
			}
		}

		return params;
	}

	private getCacheKey(route: RouteConfig, url: URL): string | null {
		if (route.cache?.type !== "memory") {
			return null;
		}

		const normalizedSearch = url.searchParams.toString();
		const queryPart = normalizedSearch ? `?${normalizedSearch}` : "";
		return `${route.method}:${url.pathname}${queryPart}`;
	}

	private async handleHealthCheck(): Promise<Response> {
		try {
			const isDbConnected = await this.dbConnection.ping();

			const health = {
				status: isDbConnected ? "healthy" : "unhealthy",
				timestamp: new Date().toISOString(),
				database: {
					connected: isDbConnected,
				},
				uptime: process.uptime(),
			};

			return new Response(JSON.stringify(health), {
				status: isDbConnected ? 200 : 503,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			return ResponseTransformer.createErrorResponse(
				"Health check failed",
				"HEALTH_CHECK_ERROR",
				error instanceof Error ? { message: error.message } : undefined,
				503,
			);
		}
	}
}
