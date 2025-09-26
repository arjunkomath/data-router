import { RequestHandler } from "./api/handlers.ts";
import { ConfigParser } from "./config/parser.ts";
import { DatabaseConnection } from "./database/connection.ts";
import { ResponseTransformer } from "./utils/response.ts";

class DbRouter {
	private configParser: ConfigParser;
	private dbConnection: DatabaseConnection;
	private requestHandler: RequestHandler | null = null;
	private port: number;

	constructor() {
		this.configParser = new ConfigParser();
		this.dbConnection = new DatabaseConnection();
		this.port = parseInt(process.env.PORT || "3000", 10);
	}

	async initialize(configPath: string = "routes.json"): Promise<void> {
		try {
			console.log("🚀 Starting db-router...");

			console.log("📋 Loading configuration...");
			const config = await this.configParser.loadFromFile(configPath);
			console.log(`✅ Loaded ${config.routes.length} routes`);

			console.log("🔌 Connecting to database...");
			await this.dbConnection.connect();

			const isConnected = await this.dbConnection.ping();
			if (!isConnected) {
				throw new Error("Database health check failed");
			}
			console.log("✅ Database connected successfully");

			this.requestHandler = new RequestHandler(config, this.dbConnection);

			console.log("📚 Available routes:");
			config.routes.forEach((route) => {
				const authStatus = route.auth?.required ? "🔒" : "🔓";
				const paginationStatus = route.pagination?.enabled ? "📄" : "";
				console.log(
					`  ${authStatus} ${route.method} ${route.path} ${paginationStatus}`,
				);
				if (route.description) {
					console.log(`     ${route.description}`);
				}
			});

			console.log(`✅ db-router initialized successfully`);
		} catch (error) {
			console.error("❌ Initialization failed:", error);
			throw error;
		}
	}

	async start(): Promise<void> {
		if (!this.requestHandler) {
			throw new Error("Router not initialized. Call initialize() first.");
		}

		const server = Bun.serve({
			port: this.port,
			fetch: async (request: Request) => {
				try {
					return await this.requestHandler?.handleRequest(request) ?? new Response("Server not ready", { status: 503 });
				} catch (error) {
					console.error("Request error:", error);
					return ResponseTransformer.createErrorResponse(
						"Internal server error",
						"INTERNAL_ERROR",
					);
				}
			},
		});

		console.log(`🌐 Server running on http://localhost:${server.port}`);

		process.on("SIGINT", async () => {
			console.log("\n🛑 Shutting down gracefully...");
			await this.shutdown();
			process.exit(0);
		});

		process.on("SIGTERM", async () => {
			console.log("\n🛑 Shutting down gracefully...");
			await this.shutdown();
			process.exit(0);
		});
	}

	async shutdown(): Promise<void> {
		try {
			await this.dbConnection.disconnect();
			console.log("✅ Shutdown complete");
		} catch (error) {
			console.error("❌ Error during shutdown:", error);
		}
	}

	async healthCheck(): Promise<Response> {
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

if (import.meta.main) {
	const router = new DbRouter();

	try {
		await router.initialize();
		await router.start();
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}

export { DbRouter };
