import { SQL } from "bun";

export class DatabaseConnection {
	private sql: SQL | null = null;

	constructor() {
		const connectionString = process.env.DATABASE_URL || "";
		if (!connectionString) {
			throw new Error("DATABASE_URL environment variable is required");
		}
	}

	async connect(): Promise<void> {
		try {
			const connectionString = process.env.DATABASE_URL || "";
			this.sql = new SQL(connectionString);
			console.log("Connected to database");
		} catch (error) {
			throw new Error(
				`Failed to connect to database: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	async disconnect(): Promise<void> {
		if (this.sql) {
			try {
				// Close the database connection properly
				await this.sql.close();
				console.log("Disconnected from database");
			} catch (error) {
				console.error("Error closing database connection:", error);
			} finally {
				this.sql = null;
			}
		}
	}

	getConnection(): SQL {
		if (!this.sql) {
			throw new Error("Database not connected. Call connect() first.");
		}
		return this.sql;
	}

	async ping(): Promise<boolean> {
		try {
			if (!this.sql) return false;
			await this.sql`SELECT 1`;
			return true;
		} catch (error) {
			console.error("Database ping failed:", error);
			return false;
		}
	}
}
