import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import { NxCliService } from "../utils/core/nx-cli.js";
import { PackageManagerService } from "../utils/core/package-manager.js";
import type { MonorepoTool, ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();
const _packageManagerService = new PackageManagerService();
const nxCliService = new NxCliService();

/**
 * Create comprehensive .gitignore file for the project root
 */
async function createProjectGitignore(projectPath: string): Promise<void> {
	const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Monorepo tools
.turbo/
.nx/cache/
.nx/workspace-data

# Package manager cache
.npm
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary folders
tmp/
temp/

# Logs
logs/
*.log

# Build outputs (general)
dist/
build/
out/

# TypeScript
*.tsbuildinfo

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variable files
.env.*.local

# Vercel
.vercel

# Misc
*.pem
`;

	await fileSystemService.writeFile(
		path.join(projectPath, ".gitignore"),
		gitignore,
	);
}

/**
 * Initialize Nx workspace manually without CLI
 */
async function _initializeNxWorkspace(
	projectPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	const projectName = path.basename(projectPath);

	// Create nx.json
	const nxConfig = {
		$schema: "./node_modules/nx/schemas/nx-schema.json",
		version: 3,
		namedInputs: {
			default: ["{projectRoot}/**/*", "sharedGlobals"],
			production: [
				"default",
				"!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
				"!{projectRoot}/tsconfig.spec.json",
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
				],
			},
		},
		defaultBase: "main",
	};

	await fileSystemService.writeJson(
		path.join(projectPath, "nx.json"),
		nxConfig,
	);

	// Create package.json for Nx workspace
	const packageJson = {
		name: projectName,
		version: "0.0.0",
		license: "MIT",
		scripts: {
			build: "nx build",
			test: "nx test",
			lint: "nx workspace-lint && nx lint",
			e2e: "nx e2e",
		},
		private: true,
		devDependencies: {
			"@nx/workspace": "19.8.4",
			nx: "19.8.4",
		},
	};

	await fileSystemService.writeJson(
		path.join(projectPath, "package.json"),
		packageJson,
	);

	// Create apps and packages directories
	await fileSystemService.ensureDirectory(path.join(projectPath, "apps"));
	await fileSystemService.ensureDirectory(path.join(projectPath, "packages"));

	// Create .nxignore
	const nxIgnore = `node_modules
dist
.env
.env.local
coverage
`;

	await fileSystemService.writeFile(
		path.join(projectPath, ".nxignore"),
		nxIgnore,
	);
}

/**
 * Setup Turborepo configuration manually
 */
export async function setupTurboRepo(
	projectPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	try {
		// Create apps and packages directories
		await fileSystemService.ensureDirectory(path.join(projectPath, "apps"));
		await fileSystemService.ensureDirectory(path.join(projectPath, "packages"));

		// Create comprehensive .gitignore file
		await createProjectGitignore(projectPath);

		// Create initial package.json if it doesn't exist
		const packageJsonPath = path.join(projectPath, "package.json");
		const initialPackageJson = {
			name: path.basename(projectPath),
			version: "0.0.1",
			private: true,
			workspaces: ["apps/*", "packages/*"],
			scripts: {
				build: "turbo run build",
				dev: "turbo run dev",
				lint: "turbo run lint",
				test: "turbo run test",
				"type-check": "turbo run type-check",
			},
		};
		await fileSystemService.writeJson(packageJsonPath, initialPackageJson);

		// Create turbo.json configuration
		const turboConfig = {
			$schema: "https://turbo.build/schema.json",
			globalDependencies: [".env"],
			pipeline: {
				build: {
					outputs: [".next/**", "!.next/cache/**", "dist/**"],
					dependsOn: ["^build"],
				},
				lint: {
					dependsOn: ["^lint"],
				},
				dev: {
					cache: false,
					persistent: true,
				},
				test: {
					dependsOn: ["^build"],
				},
				"type-check": {
					dependsOn: ["^type-check"],
				},
			},
		};

		await fileSystemService.writeJson(
			path.join(projectPath, "turbo.json"),
			turboConfig,
		);

		logger.success("Turborepo initialized manually");
	} catch (error) {
		throw new Error(
			`Failed to initialize Turborepo: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Setup Nx configuration with proper CLI integration
 */
export async function setupNx(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up Nx...");

	try {
		// Initialize Nx workspace using the CLI service
		await nxCliService.initializeWorkspace(projectPath, answers);

		// Install required plugins for the selected frameworks
		const requiredPlugins = nxCliService.getRequiredPlugins(answers);
		for (const plugin of requiredPlugins) {
			await nxCliService.installPlugin(
				projectPath,
				plugin,
				answers.packageManager,
			);
		}

		// Create apps and libs directories based on Nx conventions
		await fileSystemService.ensureDirectory(path.join(projectPath, "apps"));
		await fileSystemService.ensureDirectory(path.join(projectPath, "libs"));

		// Create comprehensive .gitignore file for the project root
		await createProjectGitignore(projectPath);

		logger.success("Nx workspace initialized with CLI");
	} catch (error) {
		throw new Error(
			`Failed to initialize Nx workspace: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Setup npm workspaces
 */
export async function setupNpmWorkspaces(
	projectPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up npm workspaces...");

	// Update package.json with workspaces
	const packageJsonPath = path.join(projectPath, "package.json");
	await fileSystemService.updatePackageJson(packageJsonPath, {
		workspaces: ["apps/*", "packages/*"],
	});

	// Ensure .gitignore exists for npm workspaces
	await createProjectGitignore(projectPath);

	logger.success("npm workspaces configuration created");
}

/**
 * Setup Nx workspace libraries using Nx generators
 */
export async function setupNxWorkspaceLibraries(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up Nx workspace libraries...");

	try {
		// Generate shared UI library using Nx generator
		if (answers.useShadcn) {
			await nxCliService.runGenerator(
				projectPath,
				{
					generator: "@nx/react:library",
					name: "ui",
					options: {
						directory: "libs/ui",
						bundler: "vite",
						unitTestRunner: "jest",
						"skip-format": true,
					},
				},
				answers.packageManager,
			);
		}

		// Generate shared utilities library using Nx generator
		await nxCliService.runGenerator(
			projectPath,
			{
				generator: "@nx/js:library",
				name: "utils",
				options: {
					directory: "libs/utils",
					bundler: "vite",
					unitTestRunner: "jest",
					"skip-format": true,
				},
			},
			answers.packageManager,
		);

		logger.success("Nx workspace libraries setup completed");
	} catch (_error) {
		logger.warn(
			"Failed to generate some Nx libraries, continuing with manual setup...",
		);

		// Fallback to manual library creation
		await setupNxLibrariesManually(projectPath, answers);
	}
}

/**
 * Fallback manual library setup for Nx
 */
async function setupNxLibrariesManually(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	// Create libs directory (Nx convention)
	const libsDir = path.join(projectPath, "libs");
	await fileSystemService.ensureDirectory(libsDir);

	// Create shared UI package structure
	if (answers.useShadcn) {
		const uiLibDir = path.join(libsDir, "ui");
		await fileSystemService.ensureDirectory(uiLibDir);

		const uiPackageJson = {
			name: "@workspace/ui",
			version: "0.1.0",
			main: "./src/index.ts",
			types: "./src/index.ts",
			exports: {
				".": "./src/index.ts",
			},
		};

		await fileSystemService.writeJson(
			path.join(uiLibDir, "package.json"),
			uiPackageJson,
		);

		await fileSystemService.ensureDirectory(path.join(uiLibDir, "src"));
		await fileSystemService.writeFile(
			path.join(uiLibDir, "src", "index.ts"),
			"// Shared UI components\nexport {};\n",
		);
	}

	// Create shared utils package
	const utilsLibDir = path.join(libsDir, "utils");
	await fileSystemService.ensureDirectory(utilsLibDir);

	const utilsPackageJson = {
		name: "@workspace/utils",
		version: "0.1.0",
		main: "./src/index.ts",
		types: "./src/index.ts",
		exports: {
			".": "./src/index.ts",
		},
	};

	await fileSystemService.writeJson(
		path.join(utilsLibDir, "package.json"),
		utilsPackageJson,
	);

	await fileSystemService.ensureDirectory(path.join(utilsLibDir, "src"));
	await fileSystemService.writeFile(
		path.join(utilsLibDir, "src", "index.ts"),
		"// Shared utilities\nexport {};\n",
	);

	logger.success("Nx workspace libraries setup completed manually");
}

/**
 * Generate additional Nx workspace configuration
 */
export async function generateNxWorkspaceConfig(
	projectPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	logger.step("Generating Nx workspace config...");

	// Create .nxignore file
	const nxIgnore = `node_modules
dist
.next
.env
.env.local
coverage
`;

	await fileSystemService.writeFile(
		path.join(projectPath, ".nxignore"),
		nxIgnore,
	);

	logger.success("Nx workspace config generated");
}

/**
 * Main monorepo setup orchestrator
 */
export async function setupMonorepo(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	try {
		switch (answers.monorepoTool) {
			case "turbo":
				await setupTurboRepo(projectPath, answers);
				break;
			case "nx":
				await setupNx(projectPath, answers);
				await setupNxWorkspaceLibraries(projectPath, answers);
				await generateNxWorkspaceConfig(projectPath, answers);
				break;
			case "none":
				await setupNpmWorkspaces(projectPath, answers);
				break;
			default:
				throw new Error(`Unknown monorepo tool: ${answers.monorepoTool}`);
		}
	} catch (error) {
		throw new Error(
			`Failed to setup ${answers.monorepoTool}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Get monorepo-specific dependencies
 */
export function getMonorepoDependencies(tool: MonorepoTool): {
	dependencies: string[];
	devDependencies: string[];
} {
	switch (tool) {
		case "turbo":
			return {
				dependencies: [],
				devDependencies: ["turbo@latest"],
			};
		case "nx":
			return {
				dependencies: [],
				devDependencies: ["nx@latest", "@nx/workspace@latest"],
			};
		default:
			return {
				dependencies: [],
				devDependencies: [],
			};
	}
}