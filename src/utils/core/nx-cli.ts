import path from "node:path";
import { execa } from "execa";
import type { PackageManager, ProjectAnswers } from "../types/index.js";
import { FileSystemService } from "./file-system.js";
import { logger } from "./logger.js";
import { PackageManagerService } from "./package-manager.js";

export interface NxGeneratorOptions {
	generator: string;
	name: string;
	options?: Record<string, string | boolean>;
	skipInteractive?: boolean;
	dryRun?: boolean;
}

export interface NxPluginConfig {
	name: string;
	version?: string;
	required: boolean;
}

export class NxCliService {
	private packageManager: PackageManagerService;
	private fileSystem: FileSystemService;

	constructor() {
		this.packageManager = new PackageManagerService();
		this.fileSystem = new FileSystemService();
	}

	/**
	 * Initialize Nx workspace using proper CLI
	 */
	async initializeWorkspace(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.step("Initializing Nx workspace...");

		try {
			// First install core Nx packages
			await this.installCorePackages(projectPath, answers.packageManager);

			// Create nx.json with proper configuration
			await this.createNxConfig(projectPath);

			// Install workspace-specific packages
			await this.installWorkspacePackages(projectPath, answers.packageManager);

			logger.success("Nx workspace initialized successfully");
		} catch (error) {
			throw new Error(
				`Failed to initialize Nx workspace: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Install required Nx plugin for a specific framework
	 */
	async installPlugin(
		projectPath: string,
		plugin: NxPluginConfig,
		packageManager: PackageManager,
	): Promise<void> {
		const packageName = plugin.version
			? `${plugin.name}@${plugin.version}`
			: `${plugin.name}@latest`;

		logger.step(`Installing Nx plugin: ${plugin.name}`);

		try {
			await this.packageManager.installPackages([packageName], packageManager, {
				cwd: projectPath,
				dev: true,
			});

			logger.success(`Nx plugin ${plugin.name} installed successfully`);
		} catch (error) {
			if (plugin.required) {
				throw new Error(
					`Failed to install required Nx plugin ${plugin.name}: ${error instanceof Error ? error.message : String(error)}`,
				);
			} else {
				logger.warn(
					`Failed to install optional Nx plugin ${plugin.name}, continuing...`,
				);
			}
		}
	}

	/**
	 * Run Nx generator with proper error handling
	 */
	async runGenerator(
		projectPath: string,
		generatorOptions: NxGeneratorOptions,
		packageManager: PackageManager,
	): Promise<void> {
		const {
			generator,
			name,
			options = {},
			skipInteractive = true,
			dryRun = false,
		} = generatorOptions;

		logger.step(`Running Nx generator: ${generator} for ${name}`);

		try {
			// Build arguments
			const args = [
				"nx",
				"g",
				generator,
				name,
				...(skipInteractive ? ["--no-interactive"] : []),
				...(dryRun ? ["--dry-run"] : ["--dry-run=false"]),
			];

			// Add options
			for (const [key, value] of Object.entries(options)) {
				if (typeof value === "boolean") {
					args.push(value ? `--${key}` : `--no-${key}`);
				} else {
					args.push(`--${key}=${value}`);
				}
			}

			// Get execute command for package manager
			const executeCmd = this.packageManager.getExecuteCommand(packageManager);
			const execArgs = executeCmd.split(" ");
			const command = execArgs[0];

			if (!command) {
				throw new Error(`Invalid execute command for ${packageManager}`);
			}

			const finalArgs = [...execArgs.slice(1), ...args];

			// Execute the generator
			const nxProcess = execa(command, finalArgs, {
				cwd: projectPath,
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 300000,
				env: {
					...process.env,
					CI: "true",
					FORCE_COLOR: "0",
					NX_INTERACTIVE: "false",
				},
			});

			// Attach logging for better debugging
			this.attachProcessLogging(nxProcess, generator);
			await nxProcess;

			logger.success(`Nx generator ${generator} completed successfully`);
		} catch (error) {
			throw new Error(
				`Failed to run Nx generator ${generator}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Get required plugins for specific frameworks
	 */
	getRequiredPlugins(answers: ProjectAnswers): NxPluginConfig[] {
		const plugins: NxPluginConfig[] = [];

		// Add framework-specific plugins
		if (
			answers.frontend === "nextjs-app" ||
			answers.frontend === "nextjs-pages"
		) {
			plugins.push({ name: "@nx/next", required: true });
		}

		if (answers.frontend === "vite") {
			plugins.push({ name: "@nx/react", required: true });
			plugins.push({ name: "@nx/vite", required: true });
		}

		if (answers.backendAPI === "nestjs") {
			plugins.push({ name: "@nx/nest", required: true });
		}

		if (answers.backendAPI === "trpc") {
			plugins.push({ name: "@nx/node", required: true });
		}

		if (answers.backendAPI === "graphql-apollo") {
			plugins.push({ name: "@nx/node", required: true });
		}

		// Add testing plugins if needed
		if (
			answers.testingTools &&
			answers.testingTools.length > 0 &&
			!answers.testingTools.includes("none")
		) {
			if (answers.testingTools.includes("jest")) {
				plugins.push({ name: "@nx/jest", required: false });
			}
			plugins.push({ name: "@nx/cypress", required: false });
		}

		// Add linting plugins
		if (answers.linter === "eslint-prettier") {
			plugins.push({ name: "@nx/eslint", required: false });
		}

		return plugins;
	}

	/**
	 * Validate Nx installation
	 */
	async validateInstallation(projectPath: string): Promise<boolean> {
		try {
			await execa("nx", ["--version"], { cwd: projectPath, stdio: "pipe" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Install core Nx packages
	 */
	private async installCorePackages(
		projectPath: string,
		packageManager: PackageManager,
	): Promise<void> {
		const corePackages = ["nx@latest", "@nx/workspace@latest"];

		await this.packageManager.installPackages(corePackages, packageManager, {
			cwd: projectPath,
			dev: true,
		});
	}

	/**
	 * Install workspace-specific packages
	 */
	private async installWorkspacePackages(
		projectPath: string,
		packageManager: PackageManager,
	): Promise<void> {
		const workspacePackages = ["typescript@latest", "@types/node@latest"];

		await this.packageManager.installPackages(
			workspacePackages,
			packageManager,
			{ cwd: projectPath, dev: true },
		);
	}

	/**
	 * Create nx.json configuration
	 */
	private async createNxConfig(projectPath: string): Promise<void> {
		const _projectName = path.basename(projectPath);

		const nxConfig = {
			$schema: "./node_modules/nx/schemas/nx-schema.json",
			version: 3,
			namedInputs: {
				default: ["{projectRoot}/**/*", "sharedGlobals"],
				production: [
					"default",
					"!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
					"!{projectRoot}/tsconfig.spec.json",
					"!{projectRoot}/.eslintrc.json",
					"!{projectRoot}/eslint.config.js",
				],
				sharedGlobals: [],
			},
			targetDefaults: {
				build: {
					cache: true,
					dependsOn: ["^build"],
					inputs: ["production", "^production"],
				},
				test: {
					cache: true,
					inputs: ["default", "^production", "{workspaceRoot}/jest.preset.js"],
				},
				lint: {
					cache: true,
					inputs: [
						"default",
						"{workspaceRoot}/.eslintrc.json",
						"{workspaceRoot}/.eslintignore",
						"{workspaceRoot}/eslint.config.js",
					],
				},
				e2e: {
					cache: true,
					inputs: ["default", "^production"],
				},
			},
			defaultBase: "main",
		};

		await this.fileSystem.writeJson(
			path.join(projectPath, "nx.json"),
			nxConfig,
		);
	}

	/**
	 * Attach process logging for better debugging
	 */
	private attachProcessLogging(process: any, operationName: string): void {
		process.stdout?.on("data", (data: Buffer) => {
			const output = data.toString().trim();
			if (output) {
				logger.normal(`[${operationName}] ${output}`);
			}
		});

		process.stderr?.on("data", (data: Buffer) => {
			const output = data.toString().trim();
			if (output && !output.includes("npm WARN")) {
				logger.normal(`[${operationName}] ${output}`);
			}
		});
	}
}