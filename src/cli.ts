#!/usr/bin/env node

import { Command } from "commander";
// import { runCLI } from "./setup/index.js";
import { PROJECT_DESCRIPTION, PROJECT_NAME, PROJECT_VERSION } from "./utils/constants/contants.js";
import { logger } from "./utils/core/logger.js";

/**
 * Main CLI program
 */
async function main(): Promise<void> {
	const program = new Command();

	program
		.name(PROJECT_NAME)
		.description(PROJECT_DESCRIPTION)
		.version(PROJECT_VERSION)
		.action(async () => {
			try {
				// await runCLI();
        logger.info("Hello World");
			} catch (error) {
				console.error("❌ Setup failed:", error);
				process.exit(1);
			}
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