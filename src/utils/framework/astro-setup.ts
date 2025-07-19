import path from "node:path";
import { BiomeConfigGenerator } from "../config/biome.js";
import { TailwindConfigGenerator } from "../config/tailwind.js";
import { TRPCConfigGenerator } from "../config/trpc.js";
import type { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import type { PackageManagerService } from "../core/package-manager.js";
import { UILibrarySetupService } from "../frontend/ui-library.js";
import type {
	ExecutionContext,
	ProjectAnswers,
	SetupResult,
} from "../types/index.js";

export class AstroSetupService {
	private uiLibraryService: UILibrarySetupService;

	constructor(
		private fileSystem: FileSystemService,
		private packageManager: PackageManagerService,
	) {
		this.uiLibraryService = new UILibrarySetupService();
	}

	async setup(context: ExecutionContext): Promise<SetupResult> {
		try {
			logger.step("Starting Astro setup...");

			if (context.answers.monorepoTool === "nx") {
				return await this.setupWithNx(context);
			}

			return await this.setupStandard(context);
		} catch (error) {
			const message = `Failed to setup Astro: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	private async setupStandard(context: ExecutionContext): Promise<SetupResult> {
		const { projectPath, answers } = context;
		const warnings: string[] = [];

		// Create apps directory
		await this.fileSystem.ensureDirectory(path.join(projectPath, "apps"));
		logger.success("Apps directory created");

		// Create Astro app
		await this.createAstroApp(context);

		const appPath = this.fileSystem.resolveAppPath(projectPath);

		// Install additional dependencies
		await this.installAdditionalDependencies(appPath, answers);

		// Setup Tailwind CSS
		if (answers.useTailwind) {
			await this.setupTailwind(appPath, answers);
		}

		// Update package.json
		await this.updatePackageJson(appPath, answers);

		// Setup additional tools
		if (answers.linter === "biome") {
			await this.setupBiome(appPath, answers);
		}

		// Add UI library as dependency if using shadcn
		if (answers.useShadcn) {
			await this.addUILibraryDependency(appPath, answers);
		}

		if (answers.useTRPC) {
			await this.setupTRPC(appPath, answers);
		}

		logger.party("Astro setup completed successfully!");
		return {
			success: true,
			message: "Astro setup completed successfully!",
			...(warnings.length > 0 && { warnings }),
		};
	}

	private async setupWithNx(context: ExecutionContext): Promise<SetupResult> {
		const { projectPath, answers } = context;
		const _warnings: string[] = [];

		logger.warn(
			"Nx with Astro is not officially supported yet. Setting up standard Astro app...",
		);

		// Fallback to standard setup for now
		return await this.setupStandard(context);
	}

	private async createAstroApp(context: ExecutionContext): Promise<void> {
		const { projectPath, answers } = context;

		logger.rocket(
			`Creating Astro app with ${answers.useTypeScript ? "TypeScript" : "JavaScript"}...`,
		);

		const template = answers.useTypeScript ? "minimal" : "minimal";

		// Create Astro app manually from template
		await this.createAstroAppFromTemplate(projectPath, answers, template);

		// Create Astro specific .gitignore
		const appPath = this.fileSystem.resolveAppPath(projectPath);
		await this.createAstroGitignore(appPath);

		logger.success("Astro app created successfully");
	}

	private async createAstroAppFromTemplate(
		projectPath: string,
		answers: ProjectAnswers,
		_template: string,
	): Promise<void> {
		const appPath = path.join(projectPath, "apps", "web");

		// Create directory structure
		await this.fileSystem.ensureDirectory(appPath);
		await this.fileSystem.ensureDirectory(path.join(appPath, "src"));
		await this.fileSystem.ensureDirectory(path.join(appPath, "src", "pages"));
		await this.fileSystem.ensureDirectory(path.join(appPath, "public"));

		// Create package.json
		const packageJson = {
			name: "web",
			type: "module",
			version: "0.0.1",
			scripts: {
				dev: "astro dev",
				start: "astro dev",
				build: "astro check && astro build",
				preview: "astro preview",
				astro: "astro",
			},
			dependencies: {
				astro: "^4.15.0",
			},
			devDependencies: answers.useTypeScript
				? {
						"@types/node": "^22.0.0",
						typescript: "^5.0.0",
					}
				: {},
		};

		await this.fileSystem.writeFile(
			path.join(appPath, "package.json"),
			JSON.stringify(packageJson, null, 2),
		);

		// Create astro.config.mjs
		const astroConfig = `import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({});`;

		await this.fileSystem.writeFile(
			path.join(appPath, "astro.config.mjs"),
			astroConfig,
		);

		// Create TypeScript config if needed
		if (answers.useTypeScript) {
			const tsConfig = {
				extends: "astro/tsconfigs/strict",
				compilerOptions: {
					baseUrl: ".",
					paths: {
						"@/*": ["src/*"],
					},
				},
			};

			await this.fileSystem.writeFile(
				path.join(appPath, "tsconfig.json"),
				JSON.stringify(tsConfig, null, 2),
			);
		}

		// Create main page
		const indexPage = answers.useTypeScript
			? `---
// Welcome to Astro! Everything between these triple-dash code fences
// is your "component script" that runs on the server.
console.log('This runs in the server console!');
---

<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="description" content="Astro description" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<title>Astro</title>
	</head>
	<body>
		<main>
			<h1>Welcome to <span class="text-gradient">Astro</span></h1>
			<p>
				To get started, open the directory <code>src/pages</code> in your project.<br />
				<strong>Code Challenge:</strong> Tweak the "Welcome to Astro" message above.
			</p>
			<ul role="list" class="link-card-grid">
				<li class="link-card">
					<a href="https://docs.astro.build/">
						<h2>Documentation</h2>
						<p>Learn how Astro works and explore the official API docs.</p>
					</a>
				</li>
				<li class="link-card">
					<a href="https://astro.build/integrations/">
						<h2>Integrations</h2>
						<p>Supercharge your project with new frameworks and libraries.</p>
					</a>
				</li>
				<li class="link-card">
					<a href="https://astro.build/themes/">
						<h2>Themes</h2>
						<p>Explore a galaxy of community-built starter themes.</p>
					</a>
				</li>
				<li class="link-card">
					<a href="https://astro.build/chat/">
						<h2>Community</h2>
						<p>Come say hi to our amazing Discord community. ✨</p>
					</a>
				</li>
			</ul>
		</main>
		<style>
			main {
				margin: auto;
				padding: 1rem;
				width: 800px;
				max-width: calc(100% - 2rem);
				color: white;
				font-size: 20px;
				line-height: 1.6;
			}
			.astro-a {
				position: absolute;
				top: -32px;
				left: 50%;
				transform: translatex(-50%);
				width: 220px;
				height: auto;
				z-index: -1;
			}
			h1 {
				font-size: 4rem;
				font-weight: 700;
				line-height: 1;
				text-align: center;
				margin-bottom: 1em;
			}
			.text-gradient {
				background-image: var(--accent-gradient);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-size: 400%;
				background-position: 0%;
			}
			.link-card-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(24ch, 1fr));
				gap: 2rem;
				padding: 0;
			}
		</style>

		<style is:global>
			:root {
				--accent: 136, 58, 234;
				--accent-light: 224, 204, 250;
				--accent-dark: 49, 10, 101;
				--accent-gradient: linear-gradient(
					45deg,
					rgb(var(--accent)),
					rgb(var(--accent-light)) 30%,
					white 60%
				);
			}
			html {
				font-family: system-ui, sans-serif;
				background: #13151a;
				background-size: 224px 224px;
			}
			code {
				font-family:
					Menlo,
					Monaco,
					Lucida Console,
					Liberation Mono,
					DejaVu Sans Mono,
					Bitstream Vera Sans Mono,
					Courier New,
					monospace;
			}
		</style>
	</body>
</html>`
			: `---
// Welcome to Astro! Everything between these triple-dash code fences
// is your "component script" that runs on the server.
console.log('This runs in the server console!');
---

<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="description" content="Astro description" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<title>Astro</title>
	</head>
	<body>
		<main>
			<h1>Welcome to <span class="text-gradient">Astro</span></h1>
			<p>
				To get started, open the directory <code>src/pages</code> in your project.<br />
				<strong>Code Challenge:</strong> Tweak the "Welcome to Astro" message above.
			</p>
		</main>
	</body>
</html>`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "pages", "index.astro"),
			indexPage,
		);

		// Create favicon.svg
		const favicon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 128 128">
    <path d="M50.4 78.5a75.1 75.1 0 0 0-28.5 6.9l24.2-65.7c.7-2 1.9-3.2 3.4-3.2h29c1.5 0 2.7 1.2 3.4 3.2l24.2 65.7s-11.6-7-28.5-7L67 45.5c-.4-1.7-1.6-2.8-2.9-2.8-1.3 0-2.5 1.1-2.9 2.7L50.4 78.5Zm-1.1 28.2Zm-4.2-20.2c-2 6.6-.6 15.8 4.2 20.2a17.5 17.5 0 0 1 .2-.7 5.5 5.5 0 0 1 5.7-4.5c2.8.1 4.3 1.5 4.7 4.7.2 1.1.2 2.3.2 3.5v.4c0 2.7.7 5.2 2.2 7.4a13 13 0 0 0 5.7 4.9v-.3l-.2-.3c-1.8-5.6-.5-9.5 4.4-12.8l1.5-1a73 73 0 0 0 3.2-2.2 16 16 0 0 0 6.8-11.4c.3-2 .1-4-.6-6l-.8.6-1.6 1a37 37 0 0 1-22.4 2.7c-5-.7-9.7-2-13.2-6.2Z"/>
    <style>
        path { fill: #000; }
        @media (prefers-color-scheme: dark) {
            path { fill: #FFF; }
        }
    </style>
</svg>`;

		await this.fileSystem.writeFile(
			path.join(appPath, "public", "favicon.svg"),
			favicon,
		);

		// Install dependencies
		await this.packageManager.installPackages(
			["astro"],
			answers.packageManager,
			{ cwd: appPath },
		);

		if (answers.useTypeScript) {
			await this.packageManager.installPackages(
				["@types/node", "typescript"],
				answers.packageManager,
				{ cwd: appPath, dev: true },
			);
		}
	}

	/**
	 * Create Astro specific .gitignore file
	 */
	private async createAstroGitignore(appPath: string): Promise<void> {
		const astroGitignore = `# Astro specific
dist/
.astro/

# Build outputs
build/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Local env files (app-specific)
.env*.local

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output

# Cache
.eslintcache

# Typescript
*.tsbuildinfo

# Storybook
storybook-static/
`;

		await this.fileSystem.writeFile(
			path.join(appPath, ".gitignore"),
			astroGitignore,
		);

		logger.normal("Created Astro specific .gitignore");
	}

	private async installAdditionalDependencies(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.package("Installing additional dependencies...");

		const devDeps = ["@types/node"];

		// Add React types if using React integration
		if (answers.useShadcn || answers.useTRPC) {
			devDeps.push(
				"@astrojs/react",
				"@types/react",
				"@types/react-dom",
				"react",
				"react-dom",
			);
		}

		if (devDeps.length > 0) {
			await this.packageManager.installPackages(
				devDeps,
				answers.packageManager,
				{
					cwd: appPath,
					dev: true,
					timeout: 180000,
				},
			);
		}

		logger.success("Dependencies installed successfully");
	}

	private async setupTailwind(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.art("Setting up Tailwind CSS...");

		// Install Tailwind integration for Astro
		await this.packageManager.installPackages(
			["@astrojs/tailwind", "tailwindcss"],
			answers.packageManager,
			{ cwd: appPath, dev: true },
		);

		// Update astro.config.mjs to include Tailwind
		await this.updateAstroConfig(appPath, answers);

		// Create tailwind.config.mjs
		const tailwindConfig = TailwindConfigGenerator.generateConfig("astro");
		await this.fileSystem.writeFile(
			path.join(appPath, "tailwind.config.mjs"),
			tailwindConfig,
		);

		logger.success("Tailwind CSS setup complete");
	}

	private async updateAstroConfig(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		const astroConfigPath = path.join(appPath, "astro.config.mjs");

		let _astroConfig: string;
		try {
			_astroConfig = await this.fileSystem.readFile(astroConfigPath);
		} catch {
			// Fallback config if file doesn't exist
			_astroConfig = `import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({});`;
		}

		const integrations = [];
		const imports = [];

		// Add Tailwind integration
		if (answers.useTailwind) {
			imports.push("import tailwind from '@astrojs/tailwind';");
			integrations.push("tailwind()");
		}

		// Add React integration if needed
		if (answers.useShadcn || answers.useTRPC) {
			imports.push("import react from '@astrojs/react';");
			integrations.push("react()");
		}

		const updatedConfig = `import { defineConfig } from 'astro/config';
${imports.join("\n")}

// https://astro.build/config
export default defineConfig({
  integrations: [${integrations.join(", ")}],
});`;

		await this.fileSystem.writeFile(astroConfigPath, updatedConfig);
	}

	private async updatePackageJson(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.config("Updating package.json...");

		const additionalScripts =
			answers.linter === "biome"
				? BiomeConfigGenerator.generateScripts(answers.packageManager)
				: {
						lint: "astro check",
						"lint:fix": "astro check --fix",
						format: "prettier --write .",
						"format:check": "prettier --check .",
					};

		const baseScripts = {
			"type-check": "astro check",
			"dev:clean": "rm -rf dist && npm run dev",
			"build:analyze": "npm run build -- --mode analyze",
		};

		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				scripts: { ...additionalScripts, ...baseScripts },
			},
		);

		logger.success("Package.json updated");
	}

	private async setupBiome(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.art("Setting up Biome for Astro...");

		await this.packageManager.installPackages(
			["@biomejs/biome"],
			answers.packageManager,
			{ cwd: appPath, dev: true },
		);

		const biomeConfig = BiomeConfigGenerator.generateForFramework("astro");
		await this.fileSystem.writeJson(
			path.join(appPath, "biome.json"),
			biomeConfig,
		);

		logger.success("Biome for Astro setup complete");
	}

	/**
	 * Add UI library as dependency to the Astro app
	 */
	private async addUILibraryDependency(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		await this.uiLibraryService.addUILibraryToApp(appPath, answers);
	}

	private async setupTRPC(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.link("Setting up tRPC...");

		const dependencies = TRPCConfigGenerator.getDependencies();
		await this.packageManager.installPackages(
			dependencies,
			answers.packageManager,
			{ cwd: appPath },
		);

		const filePaths = TRPCConfigGenerator.getFilePaths("astro");

		// Ensure server directory exists
		await this.fileSystem.ensureDirectory(path.join(appPath, "src/server"));

		// Create tRPC config
		const trpcConfig = TRPCConfigGenerator.generateTRPCConfig("astro");
		await this.fileSystem.writeFile(
			path.join(appPath, filePaths.trpcConfig),
			trpcConfig,
		);

		// Create client config
		const clientConfig = TRPCConfigGenerator.generateClientConfig("astro");
		await this.fileSystem.writeFile(
			path.join(appPath, "src/api.ts"),
			clientConfig,
		);

		logger.success("tRPC setup complete");
	}

	private attachProcessLogging(process: any): void {
		process.stdout?.on("data", (data: any) => {
			logger.package(data.toString().trim());
		});

		process.stderr?.on("data", (data: any) => {
			logger.error(data.toString().trim());
		});
	}
}