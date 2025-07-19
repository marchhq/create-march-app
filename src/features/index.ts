// Re-export all feature setup functions
export { setupAuth } from "./auth.js";
export { setupGithubActions } from "./cicd.js";
export { setupDatabase } from "./database.js";
export { setupDocker } from "./docker.js";
export { setupCommitlint, setupHusky } from "./git-hooks.js";
export { setupStripe } from "./payments.js";
export { setupPWA } from "./pwa.js";
export { setupRealtimeCollaboration } from "./realtime.js";
export { setupStorybook } from "./storybook.js";
export { setupTesting } from "./testing.js";
export { setupUITools } from "./ui-tools.js";

import path from "node:path";

import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
// Import required dependencies for the orchestrator
import type { ProjectAnswers } from "../utils/types/index.js";

import { setupAuth } from "./auth.js";
import { setupGithubActions } from "./cicd.js";
import { setupDocker } from "./docker.js";
import { setupHusky } from "./git-hooks.js";
import { setupStripe } from "./payments.js";
import { setupPWA } from "./pwa.js";
import { setupRealtimeCollaboration } from "./realtime.js";
import { setupTesting } from "./testing.js";
import { setupUITools } from "./ui-tools.js";

const fileSystemService = new FileSystemService();

/**
 * Setup API connection configuration for frontend
 */
async function setupAPIConnection(
	projectPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up API connection configuration...");

	const appPath = fileSystemService.resolveAppPath(projectPath);
	const envExamplePath = path.join(appPath, ".env.example");

	const apiEnv = `# API Configuration
# Backend API URL for tRPC/REST calls
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_TRPC_URL="http://localhost:3001/api/trpc"
`;

	try {
		// Check if file exists first to avoid ENOENT errors
		const fileExists = await fileSystemService.fileExists(envExamplePath);

		if (fileExists) {
			// File exists, append to it
			const existingEnv = await fileSystemService.readFile(envExamplePath);
			await fileSystemService.writeFile(envExamplePath, existingEnv + apiEnv);
		} else {
			// File doesn't exist, create it
			await fileSystemService.writeFile(envExamplePath, apiEnv);
		}

		logger.info("Updated .env.example with API connection configuration");
	} catch (_error) {
		// Fallback: create the file with just API config
		logger.warn("Could not update existing .env.example, creating new one");
		await fileSystemService.writeFile(envExamplePath, apiEnv);
		logger.info("Created .env.example with API connection configuration");
	}

	logger.success("API connection configuration completed");
}

/**
 * Feature setup orchestrator with progress tracking
 */
export interface FeatureSetupContext {
	projectPath: string;
	answers: ProjectAnswers;
	spinner: any;
}

export async function setupAdditionalFeatures(
	context: FeatureSetupContext,
): Promise<void> {
	const { projectPath, answers, spinner } = context;

	const features = [
		{
			name: "🔐 Setting up authentication...",
			condition: answers.authentication !== "none",
			fn: () => setupAuth(projectPath, answers),
		},
		// Database setup is now handled only by backend services (Express+tRPC, NestJS, etc.)
		// This prevents duplicate schema.prisma files in both frontend and backend
		{
			name: "🌐 Setting up API connection...",
			condition: answers.backendAPI !== "none",
			fn: () => setupAPIConnection(projectPath, answers),
		},
		{
			name: "💳 Setting up Stripe integration...",
			condition: answers.payments === "stripe",
			fn: () => setupStripe(projectPath, answers),
		},
		{
			name: "🧪 Setting up testing tools...",
			condition:
				answers.testingTools.length > 0 &&
				!answers.testingTools.includes("none"),
			fn: () => setupTesting(projectPath, answers),
		},
		{
			name: "📚 Setting up UI development tools...",
			condition: answers.uiTools !== "none",
			fn: () => setupUITools(projectPath, answers),
		},
		{
			name: "📱 Setting up Progressive Web App (PWA)...",
			condition: answers.progressiveWebApp === true,
			fn: () => setupPWA(projectPath, answers),
		},
		{
			name: "🔄 Setting up realtime collaboration...",
			condition: answers.realtimeCollaboration !== "none",
			fn: () => setupRealtimeCollaboration(projectPath, answers),
		},
		{
			name: "🐳 Setting up Docker configuration...",
			condition: answers.cicdDevOps?.includes("docker") ?? false,
			fn: () => setupDocker(projectPath),
		},
		{
			name: "🔄 Setting up GitHub Actions...",
			condition: answers.cicdDevOps?.includes("github-actions") ?? false,
			fn: () => setupGithubActions(projectPath, answers),
		},
		{
			name: "🪝 Setting up Husky...",
			condition: answers.developerExperience?.includes("husky") ?? false,
			fn: () => setupHusky(projectPath, answers),
		},
	];

	// Execute features sequentially with better progress indication
	for (const feature of features) {
		if (!feature.condition) continue;

		try {
			spinner.text = feature.name;
			await feature.fn();
		} catch (error) {
			throw new Error(
				`Failed to setup ${feature.name}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}