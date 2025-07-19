import path from "node:path";
import { execa } from "execa";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import { PackageManagerService } from "../utils/core/package-manager.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();
const packageManagerService = new PackageManagerService();

/**
 * Setup Husky for Git hooks using husky init CLI
 */
export async function setupHusky(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up Husky using CLI...");

	try {
		// Use Husky CLI to initialize
		const executeCmd = packageManagerService.getExecuteCommand(
			answers.packageManager,
		);
		const execArgs = executeCmd.split(" ");
		const command = execArgs[0];

		if (!command) {
			throw new Error(`Invalid execute command for ${answers.packageManager}`);
		}

		const args = [...execArgs.slice(1), "husky", "init"];

		await execa(command, args, {
			cwd: projectPath,
			stdio: "inherit",
			env: {
				...process.env,
				CI: "true",
			},
		});

		// Create custom hooks
		// Pre-commit hook
		const preCommitHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${answers.packageManager} run lint-staged
`;

		await fileSystemService.writeFile(
			path.join(projectPath, ".husky", "pre-commit"),
			preCommitHook,
		);

		// Only create commit message hook if commitlint is selected
		if (answers.developerExperience?.includes("commitlint")) {
			await setupCommitlint(projectPath, answers);

			const commitMsgHook = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

${answers.packageManager} run commitlint --edit "$1"
`;

			await fileSystemService.writeFile(
				path.join(projectPath, ".husky", "commit-msg"),
				commitMsgHook,
			);
		}

		logger.success("Husky initialized using CLI");
	} catch (error) {
		throw new Error(
			`Failed to initialize Husky: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Setup Commitlint for commit message linting
 */
export async function setupCommitlint(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up Commitlint...");

	try {
		// Install commitlint dependencies
		const commitlintDeps = [
			"@commitlint/cli",
			"@commitlint/config-conventional",
		];

		await execa(answers.packageManager, ["add", "-D", ...commitlintDeps], {
			cwd: projectPath,
			stdio: "inherit",
		});

		// Create commitlint configuration
		const commitlintConfig = {
			extends: ["@commitlint/config-conventional"],
			rules: {
				"type-enum": [
					2,
					"always",
					[
						"feat",
						"fix",
						"docs",
						"style",
						"refactor",
						"perf",
						"test",
						"chore",
						"ci",
						"build",
						"revert",
					],
				],
				"subject-case": [
					2,
					"never",
					["sentence-case", "start-case", "pascal-case", "upper-case"],
				],
				"subject-empty": [2, "never"],
				"subject-full-stop": [2, "never", "."],
				"header-max-length": [2, "always", 100],
			},
		};

		await fileSystemService.writeFile(
			path.join(projectPath, "commitlint.config.js"),
			`module.exports = ${JSON.stringify(commitlintConfig, null, 2)};`,
		);

		// Update package.json scripts
		await updatePackageJsonWithCommitlintScripts(projectPath);

		logger.success("Commitlint configuration completed");
	} catch (error) {
		throw new Error(
			`Failed to setup Commitlint: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Update package.json with commitlint scripts
 */
async function updatePackageJsonWithCommitlintScripts(
	projectPath: string,
): Promise<void> {
	const packageJsonPath = path.join(projectPath, "package.json");

	try {
		const packageJsonContent =
			await fileSystemService.readFile(packageJsonPath);
		const packageJson = JSON.parse(packageJsonContent);

		if (!packageJson.scripts) {
			packageJson.scripts = {};
		}

		// Add commitlint script
		packageJson.scripts.commitlint =
			"commitlint --from HEAD~1 --to HEAD --verbose";

		await fileSystemService.writeFile(
			packageJsonPath,
			JSON.stringify(packageJson, null, 2),
		);

		logger.info("Updated package.json with commitlint scripts");
	} catch (error) {
		logger.warn("Failed to update package.json scripts:", error);
	}
}