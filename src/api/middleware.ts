import type { AuthConfig } from "../types/index.ts";

type CorsConfig = {
	origins: string[];
	credentials?: boolean;
	methods?: string[];
};

const getApiKeys = (): string[] => {
	const apiKey = process.env.API_KEY;
	if (!apiKey) {
		throw new Error(
			"API_KEY environment variable is required when authentication is enabled",
		);
	}

	return apiKey
		.split(",")
		.map((key) => key.trim())
		.filter((key) => key.length > 0);
};

export const authenticate = (
	authConfig: AuthConfig,
	request: Request,
): boolean => {
	if (!authConfig.required) {
		return true;
	}

	const validApiKeys = getApiKeys();
	const headerName = authConfig.header || "x-api-key";
	const providedKey = request.headers.get(headerName);

	if (!providedKey) {
		throw new Error(`Missing required header: ${headerName}`);
	}

	if (!validApiKeys.includes(providedKey)) {
		throw new Error("Invalid API key");
	}

	return true;
};

export const createAuthError = (message: string): Response =>
	new Response(
		JSON.stringify({
			success: false,
			error: {
				message,
				code: "AUTHENTICATION_FAILED",
			},
			meta: {
				timestamp: new Date().toISOString(),
			},
		}),
		{
			status: 401,
			headers: {
				"Content-Type": "application/json",
			},
		},
	);

export const handleCors = (
	request: Request,
	corsConfig?: CorsConfig,
): Response | null => {
	if (request.method !== "OPTIONS") {
		return null;
	}

	const headers = new Headers();

	if (corsConfig) {
		const origin = request.headers.get("Origin");
		if (origin && corsConfig.origins.includes(origin)) {
			headers.set("Access-Control-Allow-Origin", origin);
		} else if (corsConfig.origins.includes("*")) {
			headers.set("Access-Control-Allow-Origin", "*");
		}

		if (corsConfig.credentials) {
			headers.set("Access-Control-Allow-Credentials", "true");
		}

		const allowedMethods = corsConfig.methods || ["GET", "OPTIONS"];
		headers.set("Access-Control-Allow-Methods", allowedMethods.join(", "));
	} else {
		headers.set("Access-Control-Allow-Origin", "*");
		headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
	}

	headers.set(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization, x-api-key",
	);
	headers.set("Access-Control-Max-Age", "86400");

	return new Response(null, {
		status: 200,
		headers,
	});
};

export const addCorsHeaders = (
	response: Response,
	request: Request,
	corsConfig?: CorsConfig,
): Response => {
	const headers = new Headers(response.headers);

	if (corsConfig) {
		const origin = request.headers.get("Origin");
		if (origin && corsConfig.origins.includes(origin)) {
			headers.set("Access-Control-Allow-Origin", origin);
		} else if (corsConfig.origins.includes("*")) {
			headers.set("Access-Control-Allow-Origin", "*");
		}

		if (corsConfig.credentials) {
			headers.set("Access-Control-Allow-Credentials", "true");
		}
	} else {
		headers.set("Access-Control-Allow-Origin", "*");
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
};

export const AuthMiddleware = {
	authenticate,
	createAuthError,
};

export const CorsMiddleware = {
	handleCors,
	addCorsHeaders,
};
