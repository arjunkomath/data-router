import { readFileSync } from "node:fs";
import type { Config } from "../types/index.ts";
import { isValidSqlQuery, validateConfig } from "./validator.ts";

export class ConfigParser {
	private config: Config | null = null;

	async loadFromFile(filePath: string): Promise<Config> {
		try {
			const fileContent = readFileSync(filePath, "utf-8");
			const rawConfig = JSON.parse(fileContent);
			return this.parseConfig(rawConfig);
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(
					`Failed to load config from ${filePath}: ${error.message}`,
				);
			}
			throw new Error(`Failed to load config from ${filePath}: Unknown error`);
		}
	}

	parseConfig(rawConfig: unknown): Config {
		const config = validateConfig(rawConfig);

		for (const route of config.routes) {
			if (!isValidSqlQuery(route.query)) {
				throw new Error(
					`Invalid or potentially unsafe SQL query in route ${route.method} ${route.path}: ${route.query}`,
				);
			}

			this.validateParameterBindings(route.query, route.params || []);
		}

		this.config = config;
		return config;
	}

	getConfig(): Config {
		if (!this.config) {
			throw new Error(
				"Config not loaded. Call loadFromFile or parseConfig first.",
			);
		}
		return this.config;
	}

	private validateParameterBindings(query: string, params: string[]): void {
		const paramRegex = /\$(\d+)/g;
		const matches = [...query.matchAll(paramRegex)];
		const queryParamNumbers = matches.map((match) => parseInt(match[1], 10));

		if (queryParamNumbers.length === 0 && params.length === 0) {
			return;
		}

		if (queryParamNumbers.length === 0 && params.length > 0) {
			throw new Error(
				`Route defines ${params.length} parameters but query contains no parameter placeholders ($1, $2, etc.)`,
			);
		}

		if (queryParamNumbers.length > 0 && params.length === 0) {
			throw new Error(
				`Query contains parameter placeholders but no parameters are defined in route config`,
			);
		}

		const maxParam = Math.max(...queryParamNumbers);
		const expectedParams = Array.from({ length: maxParam }, (_, i) => i + 1);

		for (const expectedParam of expectedParams) {
			if (!queryParamNumbers.includes(expectedParam)) {
				throw new Error(
					`Query parameter $${expectedParam} is missing from the query`,
				);
			}
		}

		if (params.length !== maxParam) {
			throw new Error(
				`Mismatch between query parameters ($1-$${maxParam}) and defined params (${params.length} items)`,
			);
		}

		const uniqueParams = new Set(params);
		if (uniqueParams.size !== params.length) {
			throw new Error(`Duplicate parameter names found: ${params.join(", ")}`);
		}
	}
}
