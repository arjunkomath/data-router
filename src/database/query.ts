import type { SQL } from "bun";
import type { DbRow, QueryResult, RouteConfig } from "../types/index.ts";

export class QueryExecutor {
	constructor(private sql: SQL) {}

	async executeQuery(
		route: RouteConfig,
		params: Record<string, string | number> = {},
		paginationParams?: { offset: number; limit: number },
	): Promise<QueryResult> {
		try {
			// Build SQL template with parameters
			const result = await this.buildAndExecuteQuery(
				route,
				params,
				paginationParams,
			);

			return {
				rows: Array.isArray(result) ? result : [result],
				rowCount: Array.isArray(result) ? result.length : 1,
			};
		} catch (error) {
			console.error("Query execution error:", error);
			throw new Error(
				`Query execution failed: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
		}
	}

	private async buildAndExecuteQuery(
		route: RouteConfig,
		params: Record<string, string | number> = {},
		paginationParams?: { offset: number; limit: number },
	): Promise<DbRow[]> {
		let query = route.query;
		const values: (string | number)[] = [];

		// Replace $1, $2, etc. with parameter values
		if (route.params && route.params.length > 0) {
			for (let i = 0; i < route.params.length; i++) {
				const paramName = route.params[i];
				const paramValue = params[paramName];

				if (paramValue === undefined || paramValue === null) {
					throw new Error(`Missing required parameter: ${paramName}`);
				}

				values.push(paramValue);
			}
		}

		// Add pagination if enabled
		if (route.pagination?.enabled && paginationParams) {
			const { offset, limit } = paginationParams;

			if (
				!query.toLowerCase().includes("limit") &&
				!query.toLowerCase().includes("offset")
			) {
				query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
				values.push(limit, offset);
			}
		}

		console.log("Executing query:", query);
		console.log("With parameters:", values);

		// Convert parameterized query to template literal format
		return await this.executeTemplate(query, values);
	}

	private async executeTemplate(
		query: string,
		values: (string | number)[],
	): Promise<DbRow[]> {
		// Use Function constructor to create the template literal
		const sqlFunction = new Function(
			"sql",
			"values",
			`
      const [${values.map((_, i) => `v${i}`).join(", ")}] = values;
      return sql\`${query.replace(/\$(\d+)/g, (_match, num) => `\${v${parseInt(num, 10) - 1}}`)}\`;
    `,
		);

		return await sqlFunction(this.sql, values);
	}

	async executeCountQuery(
		route: RouteConfig,
		params: Record<string, string | number> = {},
	): Promise<number> {
		try {
			const baseQuery = route.query.toLowerCase();
			const selectIndex = baseQuery.indexOf("select");
			const fromIndex = baseQuery.indexOf("from");

			if (selectIndex === -1 || fromIndex === -1) {
				throw new Error("Cannot generate count query from this SQL statement");
			}

			const fromClause = route.query.substring(fromIndex);
			const orderByIndex = fromClause.toLowerCase().indexOf("order by");
			const limitIndex = fromClause.toLowerCase().indexOf("limit");

			let whereClause = fromClause;
			if (orderByIndex !== -1) {
				whereClause = fromClause.substring(0, orderByIndex);
			} else if (limitIndex !== -1) {
				whereClause = fromClause.substring(0, limitIndex);
			}

			const countQuery = `SELECT COUNT(*) as total ${whereClause}`;
			const values: (string | number)[] = [];

			if (route.params && route.params.length > 0) {
				for (let i = 0; i < route.params.length; i++) {
					const paramName = route.params[i];
					const paramValue = params[paramName];

					if (paramValue === undefined || paramValue === null) {
						throw new Error(`Missing required parameter: ${paramName}`);
					}

					values.push(paramValue);
				}
			}

			console.log("Executing count query:", countQuery);
			console.log("With parameters:", values);

			const result = await this.executeTemplate(countQuery, values);
			const countResult = Array.isArray(result) ? result[0] : result;

			return parseInt(String(countResult.total), 10) || 0;
		} catch (error) {
			console.error("Count query execution error:", error);
			return 0;
		}
	}
}
