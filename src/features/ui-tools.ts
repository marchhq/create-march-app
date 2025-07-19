import path from "node:path";
import { execa } from "execa";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import type { ProjectAnswers } from "../utils/types/index.js";
import { setupStorybook } from "./storybook.js";

const fileSystemService = new FileSystemService();

/**
 * Setup UI development tools based on user selection
 */
export async function setupUITools(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up UI development tools...");

	switch (answers.uiTools) {
		case "storybook":
			await setupStorybook(projectPath, answers);
			break;
		case "none":
			logger.info("Skipping UI tools setup (none selected)");
			break;
		default:
			logger.warn(`Unknown UI tool: ${answers.uiTools}`);
	}

	logger.success("UI development tools setup completed");
}