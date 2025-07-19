#!/usr/bin/env tsx

import { Command } from "commander";
import { runCLI } from "./src/setup/index.js";
import { logger } from "./src/utils/core/logger.js";

/**
 * Main CLI program
 */
async function main(): Promise<void> {
	const program = new Command();

	program
		.name("create-march-app")
		.description(
			"Create a modern SaaS application with the latest technologies",
		)
		.version("1.0.0")
		.action(async () => {
			await runCLI();
		});

	program.parse();
}

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
	logger.error("Unhandled rejection:", error);
	process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception:", error);
	process.exit(1);
});

main().catch((error) => {
	logger.error("Fatal error:", error);
	process.exit(1);
});