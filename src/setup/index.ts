import path from "node:path";
import { execa } from "execa";
import ora from "ora";
import {
	getProjectConfiguration,
	getProjectName,
	handleDirectoryConflict,
	promptCleanup,
} from "../cli/index.js";
import {
	displayError,
	displaySuccessMessage,
	displayWelcomeMessage,
} from "../display/index.js";
import {
	type FeatureSetupContext,
	setupAdditionalFeatures,
} from "../features/index.js";
import { setupMonorepo } from "../monorepo/index.js";
import {
	cleanupProject,
	createConfigurationFiles,
	createInitialCommit,
	initializeGitRepository,
	initializeProject,
	installDependencies,
	resolveDirectoryConflict,
} from "../project/index.js";
import { BackendSetupService } from "../utils/backend/index.js";
import { BiomeConfigGenerator } from "../utils/config/biome.js";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import { FrontendSetupService } from "../utils/frontend/index.js";
import type { ProjectAnswers } from "../utils/types/index.js";
// Import all modular services
import {
	validateBasicRequirements,
	validateDirectoryAvailability,
	validatePackageManager,
} from "../validation/index.js";

// Services
const fileSystemService = new FileSystemService();
const _biomeConfigGenerator = new BiomeConfigGenerator();

export interface SetupContext {
	projectPath: string;
	projectName: string;
	answers: ProjectAnswers;
	spinner: any;
	frontendService: FrontendSetupService;
	backendService: BackendSetupService;
}

/**
 * Setup code quality tools (linting/formatting)
 */
async function setupCodeQuality(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	try {
		if (answers.linter === "biome") {
			await setupBiome(projectPath, answers.packageManager);
		} else if (answers.linter === "eslint-prettier") {
			await setupEslintPrettier(projectPath, answers.packageManager, answers);
		}
	} catch (error) {
		throw new Error(
			`Failed to setup code quality tools: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Setup Biome linter/formatter
 */
async function setupBiome(
	projectPath: string,
	_packageManager: string,
): Promise<void> {
	logger.step("Setting up Biome...");
	const biomeConfig = BiomeConfigGenerator.generateForFramework("nextjs-app");
	await fileSystemService.writeJson(
		path.join(projectPath, "biome.json"),
		biomeConfig,
	);
	logger.success("Biome setup completed");
}

/**
 * Setup ESLint + Prettier
 */
async function setupEslintPrettier(
	projectPath: string,
	packageManager: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up ESLint + Prettier...");

	try {
		// Install base ESLint and Prettier dependencies
		const eslintDeps = [
			"eslint",
			"prettier",
			"@typescript-eslint/eslint-plugin",
			"@typescript-eslint/parser",
			"eslint-config-prettier",
			"eslint-plugin-prettier",
			"lint-staged",
		];

		// Add framework-specific dependencies
		const isNextJs =
			answers.frontend === "nextjs-app" || answers.frontend === "nextjs-pages";
		const isReact = isNextJs || answers.frontend === "vite";

		if (isNextJs) {
			eslintDeps.push("eslint-config-next");
		}

		if (isReact) {
			eslintDeps.push(
				"eslint-plugin-react",
				"eslint-plugin-react-hooks",
				"eslint-plugin-jsx-a11y",
			);
		}

		await execa(packageManager, ["add", "-D", ...eslintDeps], {
			cwd: projectPath,
			stdio: "inherit",
		});

		// Create framework-specific ESLint configuration
		const eslintConfig = createEslintConfig(answers);

		// Create Prettier configuration
		const prettierConfig = {
			semi: true,
			trailingComma: "es5",
			singleQuote: true,
			printWidth: 100,
			tabWidth: 2,
			useTabs: false,
			endOfLine: "lf",
		};

		// Create .prettierignore
		const prettierIgnore = `node_modules/
dist/
build/
.next/
out/
coverage/
*.min.js
*.min.css
package-lock.json
yarn.lock
pnpm-lock.yaml
bun.lockb
`;

		// Write configuration files
		await fileSystemService.writeJson(
			path.join(projectPath, ".eslintrc.json"),
			eslintConfig,
		);
		await fileSystemService.writeJson(
			path.join(projectPath, ".prettierrc"),
			prettierConfig,
		);
		await fileSystemService.writeFile(
			path.join(projectPath, ".prettierignore"),
			prettierIgnore,
		);

		// Setup lint-staged configuration
		const lintStagedConfig = {
			"*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
			"*.{json,css,md}": ["prettier --write"],
		};

		// Update package.json with scripts and lint-staged config
		await updatePackageJsonWithEslintScripts(projectPath);
		await updatePackageJsonWithLintStaged(projectPath, lintStagedConfig);

		logger.success("ESLint + Prettier setup completed");
	} catch (error) {
		throw new Error(
			`Failed to setup ESLint + Prettier: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Create framework-specific ESLint configuration
 */
function createEslintConfig(answers: ProjectAnswers): any {
	const isNextJs =
		answers.frontend === "nextjs-app" || answers.frontend === "nextjs-pages";
	const isReact = isNextJs || answers.frontend === "vite";

	const baseConfig: any = {
		env: {
			browser: true,
			es2021: true,
			node: true,
		},
		extends: ["eslint:recommended", "@typescript-eslint/recommended"],
		parser: "@typescript-eslint/parser",
		parserOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
		},
		plugins: ["@typescript-eslint", "prettier"],
		rules: {
			"prettier/prettier": "error",
			"@typescript-eslint/no-unused-vars": "error",
			"@typescript-eslint/no-explicit-any": "warn",
			"prefer-const": "error",
			"no-var": "error",
		},
		ignorePatterns: [
			"node_modules/",
			"dist/",
			"build/",
			".next/",
			"out/",
			"coverage/",
		],
	};

	// Add Next.js specific configuration
	if (isNextJs) {
		baseConfig.extends.push("next/core-web-vitals");
	}

	// Add React specific configuration
	if (isReact) {
		baseConfig.extends.push(
			"plugin:react/recommended",
			"plugin:react-hooks/recommended",
			"plugin:jsx-a11y/recommended",
		);
		baseConfig.plugins.push("react", "react-hooks", "jsx-a11y");
		baseConfig.parserOptions.ecmaFeatures = { jsx: true };
		baseConfig.settings = {
			react: {
				version: "detect",
			},
		};

		// Add React specific rules
		baseConfig.rules = {
			...baseConfig.rules,
			"react/react-in-jsx-scope": "off", // Not needed in Next.js or modern React
			"react/prop-types": "off", // Using TypeScript for prop validation
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
		};
	}

	// Add prettier at the end to override conflicting rules
	baseConfig.extends.push("prettier");

	return baseConfig;
}

/**
 * Update package.json with ESLint and Prettier scripts
 */
async function updatePackageJsonWithEslintScripts(
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

		// Add linting and formatting scripts
		packageJson.scripts.lint =
			"eslint . --ext .js,.jsx,.ts,.tsx --report-unused-disable-directives --max-warnings 0";
		packageJson.scripts["lint:fix"] = "eslint . --ext .js,.jsx,.ts,.tsx --fix";
		packageJson.scripts.format = "prettier --write .";
		packageJson.scripts["format:check"] = "prettier --check .";
		packageJson.scripts["lint-staged"] = "lint-staged";

		await fileSystemService.writeFile(
			packageJsonPath,
			JSON.stringify(packageJson, null, 2),
		);

		logger.info("Updated package.json with ESLint and Prettier scripts");
	} catch (error) {
		logger.warn("Failed to update package.json scripts:", error);
	}
}

/**
 * Update package.json with lint-staged configuration
 */
async function updatePackageJsonWithLintStaged(
	projectPath: string,
	lintStagedConfig: Record<string, string[]>,
): Promise<void> {
	const packageJsonPath = path.join(projectPath, "package.json");

	try {
		const packageJsonContent =
			await fileSystemService.readFile(packageJsonPath);
		const packageJson = JSON.parse(packageJsonContent);

		packageJson["lint-staged"] = lintStagedConfig;

		await fileSystemService.writeFile(
			packageJsonPath,
			JSON.stringify(packageJson, null, 2),
		);

		logger.info("Added lint-staged configuration to package.json");
	} catch (error) {
		logger.warn("Failed to add lint-staged configuration:", error);
	}
}

/**
 * Setup shared UI library (shadcn/ui) in the monorepo
 */
async function setupSharedUILibrary(context: SetupContext): Promise<void> {
	const { projectPath, answers, frontendService } = context;

	try {
		logger.step("Setting up shared UI library (shadcn/ui)...");

		const result = await frontendService.setupSharedUILibrary(
			projectPath,
			answers,
		);

		if (!result.success) {
			throw new Error(result.message);
		}

		if (result.warnings) {
			result.warnings.forEach((warning) => logger.warn(warning));
		}

		logger.success("Shared UI library setup completed successfully!");
	} catch (error) {
		const message = `Failed to setup shared UI library: ${error instanceof Error ? error.message : String(error)}`;
		logger.error(message);
		throw new Error(message);
	}
}

/**
 * Setup frontend with the new modular architecture
 */
async function setupFrontend(context: SetupContext): Promise<void> {
	const { projectPath, answers, frontendService } = context;

	try {
		logger.step(`Setting up ${answers.frontend} application...`);

		const result = await frontendService.setupFramework(projectPath, answers);

		if (!result.success) {
			throw new Error(result.message);
		}

		if (result.warnings) {
			result.warnings.forEach((warning) => logger.warn(warning));
		}

		logger.success(`${answers.frontend} setup completed successfully!`);
	} catch (error) {
		const message = `Failed to setup ${answers.frontend}: ${error instanceof Error ? error.message : String(error)}`;
		logger.error(message);
		throw new Error(message);
	}
}

/**
 * Setup backend with the new modular architecture
 */
async function setupBackend(context: SetupContext): Promise<void> {
	const { projectPath, answers, backendService } = context;

	try {
		logger.step(`Setting up ${answers.backendAPI} backend...`);

		const result = await backendService.setupFramework(projectPath, answers);

		if (!result.success) {
			throw new Error(result.message);
		}

		if (result.warnings) {
			result.warnings.forEach((warning) => logger.warn(warning));
		}

		logger.success(
			`${answers.backendAPI} backend setup completed successfully!`,
		);
	} catch (error) {
		const message = `Failed to setup ${answers.backendAPI} backend: ${error instanceof Error ? error.message : String(error)}`;
		logger.error(message);
		throw new Error(message);
	}
}

/**
 * Get user input for project configuration
 */
export async function getUserInput(): Promise<{
	projectName: string;
	answers: ProjectAnswers;
}> {
	displayWelcomeMessage();

	// Get project name
	const projectName = await getProjectName();

	// Get project configuration
	const answers = await getProjectConfiguration();

	// Set the project name in answers
	answers.projectName = projectName;

	return { projectName, answers };
}

/**
 * Validate system and project requirements
 */
export async function validateRequirements(
	answers: ProjectAnswers,
): Promise<void> {
	// Validate system requirements
	await validateBasicRequirements();

	// Validate package manager
	await validatePackageManager(answers.packageManager);
}

/**
 * Main project setup orchestrator with proper error handling and rollback
 */
export async function setupProject(
	projectName: string,
	answers: ProjectAnswers,
): Promise<void> {
	const projectPath = path.join(process.cwd(), projectName);
	let spinner: any;
	const frontendService = new FrontendSetupService();
	const backendService = new BackendSetupService();

	try {
		// Check if directory exists and handle conflicts
		const directoryExists = !(await validateDirectoryAvailability(projectPath));
		if (directoryExists) {
			const action = await handleDirectoryConflict(projectName);
			await resolveDirectoryConflict(projectPath, projectName, action);
		}

		// Initialize project
		await initializeProject(projectPath);

		spinner = ora("🚀 Creating your SaaS project...").start();

		// Create setup context
		const context: SetupContext = {
			projectPath,
			projectName,
			answers,
			spinner,
			frontendService,
			backendService,
		};

		// Initialize git repository early
		spinner.text = "📦 Initializing git repository...";
		await initializeGitRepository(projectPath);

		// Setup monorepo structure
		spinner.text = "🏗️  Setting up monorepo structure...";
		await setupMonorepo(projectPath, answers);

		// Setup shared UI library if using shadcn
		if (answers.useShadcn) {
			spinner.stop();
			await setupSharedUILibrary(context);
			spinner = ora("🏗️  Continuing project setup...").start();
		}

		// Setup frontend application
		spinner.stop(); // Stop spinner during frontend setup to show detailed logs
		await setupFrontend(context);
		spinner = ora("🏗️  Continuing project setup...").start();

		// Setup backend application if needed
		if (answers.backendAPI !== "none") {
			spinner.stop(); // Stop spinner during backend setup to show detailed logs
			await setupBackend(context);
			spinner = ora("🏗️  Continuing project setup...").start();
		}

		// Setup code quality tools
		if (answers.linter && answers.linter !== "none") {
			spinner.text = "🎨 Setting up code quality tools...";
			await setupCodeQuality(projectPath, answers);
		}

		// Setup additional features
		const featureContext: FeatureSetupContext = {
			projectPath,
			answers,
			spinner,
		};
		await setupAdditionalFeatures(featureContext);

		// Create configuration files
		spinner.text = "📝 Creating configuration files...";
		await createConfigurationFiles(projectPath, answers);

		// Install root dependencies
		spinner.text = "📦 Installing dependencies...";
		await installDependencies(projectPath, answers.packageManager);

		// Create initial commit
		spinner.text = "📝 Creating initial git commit...";
		await createInitialCommit(projectPath);

		spinner.succeed("🎉 Project setup completed successfully!");

		// Display success message
		displaySuccessMessage(projectName, answers);
	} catch (error) {
		if (spinner) {
			spinner.fail("❌ Project setup failed");
		}

		logger.error(
			`Setup failed: ${error instanceof Error ? error.message : String(error)}`,
		);

		// Cleanup on failure
		const shouldCleanup = await promptCleanup();
		if (shouldCleanup) {
			await cleanupProject(projectPath);
		}

		process.exit(1);
	}
}

/**
 * Main CLI entry point
 */
export async function runCLI(): Promise<void> {
	try {
		// Get user input
		const { projectName, answers } = await getUserInput();

		// Validate requirements
		await validateRequirements(answers);

		// Setup project
		await setupProject(projectName, answers);
	} catch (error) {
		displayError(
			`Setup failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		process.exit(1);
	}
}