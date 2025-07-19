import path from "node:path";
import { execa } from "execa";
import { BiomeConfigGenerator } from "../config/biome.js";
import { TailwindConfigGenerator } from "../config/tailwind.js";
import { TRPCConfigGenerator } from "../config/trpc.js";
import type { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import { NxCliService } from "../core/nx-cli.js";
import type { PackageManagerService } from "../core/package-manager.js";
import { UILibrarySetupService } from "../frontend/ui-library.js";
import type {
	ExecutionContext,
	ProjectAnswers,
	SetupResult,
} from "../types/index.js";

export class NextJsSetupService {
	private uiLibraryService: UILibrarySetupService;
	private nxCliService: NxCliService;

	constructor(
		private fileSystem: FileSystemService,
		private packageManager: PackageManagerService,
	) {
		this.uiLibraryService = new UILibrarySetupService();
		this.nxCliService = new NxCliService();
	}

	async setup(
		context: ExecutionContext,
		isAppRouter = true,
	): Promise<SetupResult> {
		try {
			logger.normal("Setting up Next.js");

			if (context.answers.monorepoTool === "nx") {
				return await this.setupWithNx(context, isAppRouter);
			}

			return await this.setupStandard(context, isAppRouter);
		} catch (error) {
			const message = `Failed to setup Next.js: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	private async setupStandard(
		context: ExecutionContext,
		isAppRouter: boolean,
	): Promise<SetupResult> {
		const { projectPath, answers } = context;
		const warnings: string[] = [];

		// Create apps directory
		await this.fileSystem.ensureDirectory(path.join(projectPath, "apps"));
		logger.normal("Creating apps directory");

		// Create Next.js app
		await this.createNextApp(context, isAppRouter);

		const appPath = this.fileSystem.resolveAppPath(projectPath);

		// Update package.json
		await this.updatePackageJson(appPath, answers);

		// Setup additional tools
		if (answers.linter === "biome") {
			await this.setupBiome(appPath, answers);
		}

		if (answers.useTailwind) {
			await this.setupTailwind(appPath, answers);
		}

		// Add UI library as dependency if using shadcn
		if (answers.useShadcn) {
			await this.addUILibraryDependency(appPath, answers);
		}

		if (answers.useTRPC) {
			await this.setupTRPC(appPath, isAppRouter, answers);
		}
		return {
			success: true,
			message: "Next.js setup completed successfully!",
			warnings: warnings.length > 0 ? warnings : [],
		};
	}

	private async setupWithNx(
		context: ExecutionContext,
		isAppRouter: boolean,
	): Promise<SetupResult> {
		const { projectPath, answers } = context;

		logger.normal("Creating Next.js app with Nx generator");

		try {
			// Generate Next.js application using Nx generator
			await this.nxCliService.runGenerator(
				projectPath,
				{
					generator: "@nx/next:app",
					name: "web",
					options: {
						style: "css",
						linter: answers.linter === "biome" ? "none" : "eslint",
						e2eTestRunner: "cypress",
						appDir: isAppRouter,
						"skip-format": true,
					},
				},
				answers.packageManager,
			);

			const appPath = this.fileSystem.resolveAppPath(projectPath);

			// Create Next.js specific .gitignore
			await this.createNextJsGitignore(appPath);

			// Setup additional features
			const warnings: string[] = [];

			// Add UI library as dependency if using shadcn
			if (answers.useShadcn) {
				await this.addUILibraryDependency(appPath, answers);
			}

			if (answers.useTRPC) {
				await this.setupTRPC(appPath, isAppRouter, answers);
			}

			return {
				success: true,
				message: "Next.js with Nx setup completed successfully!",
				warnings: warnings.length > 0 ? warnings : [],
			};
		} catch (error) {
			throw new Error(
				`Failed to create Next.js app with Nx: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async createNextApp(
		context: ExecutionContext,
		isAppRouter: boolean,
	): Promise<void> {
		const { projectPath, answers } = context;
		const appPath = path.join(projectPath, "apps", "web");

		logger.normal("Creating Next.js app from template");

		// Create directory structure
		await this.fileSystem.ensureDirectory(appPath);
		await this.fileSystem.ensureDirectory(path.join(appPath, "src"));
		await this.fileSystem.ensureDirectory(path.join(appPath, "public"));

		if (isAppRouter) {
			await this.fileSystem.ensureDirectory(path.join(appPath, "src", "app"));
		} else {
			await this.fileSystem.ensureDirectory(path.join(appPath, "src", "pages"));
			await this.fileSystem.ensureDirectory(
				path.join(appPath, "src", "styles"),
			);
		}

		// Create package.json
		await this.createPackageJson(appPath, answers);

		// Create TypeScript config
		await this.createTsConfig(appPath);

		// Create Next.js config
		await this.createNextConfig(appPath);

		// Create app files
		if (isAppRouter) {
			await this.createAppRouterFiles(appPath);
		} else {
			await this.createPagesRouterFiles(appPath);
		}

		// Create public files
		await this.createPublicFiles(appPath);

		// Create Next.js specific .gitignore
		await this.createNextJsGitignore(appPath);

		// Install dependencies
		await this.installNextDependencies(appPath, answers);
	}

	/**
	 * Create Next.js specific .gitignore file
	 */
	private async createNextJsGitignore(appPath: string): Promise<void> {
		const nextJsGitignore = `# Next.js specific
.next/
out/

# Production
build/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Local env files (app-specific)
.env*.local

# Vercel
.vercel

# Typescript
*.tsbuildinfo
next-env.d.ts

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
.next/cache
`;

		await this.fileSystem.writeFile(
			path.join(appPath, ".gitignore"),
			nextJsGitignore,
		);

		logger.normal("Created Next.js specific .gitignore");
	}

	private async updatePackageJson(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Updating package.json");

		const additionalScripts =
			answers.linter === "biome"
				? BiomeConfigGenerator.generateScripts(answers.packageManager)
				: {
						lint: "next lint",
						"lint:fix": "next lint --fix",
						format: "prettier --write .",
						"format:check": "prettier --check .",
					};

		const baseScripts: Record<string, string> = {
			"type-check": "tsc --noEmit",
			"dev:clean": "rm -rf .next && npm run dev",
			"build:analyze": "ANALYZE=true npm run build",
		};

		// Add turbo-specific dev script for better performance
		if (answers.monorepoTool === "turbo") {
			baseScripts.dev = "next dev --turbopack";
		}

		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				scripts: { ...additionalScripts, ...baseScripts },
			},
		);
	}

	private async setupBiome(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Setting up Biome");

		await this.packageManager.installPackages(
			["@biomejs/biome"],
			answers.packageManager,
			{ cwd: appPath, dev: true },
		);

		// Create Biome configuration manually
		const biomeConfig = {
			$schema: "https://biomejs.dev/schemas/1.9.4/schema.json",
			vcs: {
				enabled: false,
				clientKind: "git",
				useIgnoreFile: true,
			},
			files: {
				ignoreUnknown: false,
				ignore: [],
			},
			formatter: {
				enabled: true,
				indentStyle: "tab",
			},
			organizeImports: {
				enabled: true,
			},
			linter: {
				enabled: true,
				rules: {
					recommended: true,
				},
			},
			javascript: {
				formatter: {
					quoteStyle: "double",
				},
			},
		};

		await this.fileSystem.writeFile(
			path.join(appPath, "biome.json"),
			JSON.stringify(biomeConfig, null, 2),
		);

		// Run initial format
		try {
			const executeCmd = this.packageManager.getExecuteCommand(
				answers.packageManager,
			);
			const execArgs = executeCmd.split(" ");
			const command = execArgs[0];

			if (!command) {
				throw new Error(
					`Invalid execute command for ${answers.packageManager}`,
				);
			}

			await execa(
				command,
				[...execArgs.slice(1), "@biomejs/biome", "format", ".", "--write"],
				{
					cwd: appPath,
					stdio: "pipe",
				},
			);
		} catch {
			logger.warn("Formatting skipped");
		}
	}

	private async setupTailwind(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		if (!answers.useTailwind) return;

		logger.normal("Setting up Tailwind");

		const dependencies = TailwindConfigGenerator.getDependencies("nextjs-app");
		if (dependencies.dev.length > 0) {
			await this.packageManager.installPackages(
				dependencies.dev,
				answers.packageManager,
				{ cwd: appPath, dev: true },
			);
		}

		// Create PostCSS config
		const postcssConfig = TailwindConfigGenerator.generatePostCSSConfig();
		await this.fileSystem.writeFile(
			path.join(appPath, "postcss.config.mjs"),
			postcssConfig,
		);

		// Create Tailwind config
		const tailwindConfig = TailwindConfigGenerator.generateConfig("nextjs-app");
		await this.fileSystem.writeFile(
			path.join(appPath, "tailwind.config.ts"),
			tailwindConfig,
		);

		// Update globals.css
		const cssContent =
			TailwindConfigGenerator.generateCSS("nextjs-app") +
			"\n\n/* Your custom styles here */";
		await this.fileSystem.writeFile(
			path.join(appPath, "src/app/globals.css"),
			cssContent,
		);
	}

	private async setupTailwindForUiLib(
		uiLibPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Setting up Tailwind for UI library");

		const dependencies = TailwindConfigGenerator.getDependencies("nextjs-app");
		if (dependencies.dev.length > 0) {
			await this.packageManager.installPackages(
				dependencies.dev,
				answers.packageManager,
				{ cwd: uiLibPath, dev: true },
			);
		}

		// Create PostCSS config for the UI library
		const postcssConfig = TailwindConfigGenerator.generatePostCSSConfig();
		await this.fileSystem.writeFile(
			path.join(uiLibPath, "postcss.config.mjs"),
			postcssConfig,
		);

		// Create Tailwind config for the UI library
		const tailwindConfig = TailwindConfigGenerator.generateConfig("nextjs-app");
		await this.fileSystem.writeFile(
			path.join(uiLibPath, "tailwind.config.ts"),
			tailwindConfig,
		);

		// Create base CSS file for the UI library
		const cssContent = TailwindConfigGenerator.generateCSS("nextjs-app");
		await this.fileSystem.ensureDirectory(path.join(uiLibPath, "src", "lib"));
		await this.fileSystem.writeFile(
			path.join(uiLibPath, "src", "lib", "styles.css"),
			cssContent,
		);
	}

	/**
	 * Add UI library as dependency to the Next.js app
	 */
	private async addUILibraryDependency(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		await this.uiLibraryService.addUILibraryToApp(appPath, answers);
	}

	private async setupTRPC(
		appPath: string,
		_isAppRouter: boolean,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Setting up tRPC");

		const dependencies = TRPCConfigGenerator.getDependencies();
		await this.packageManager.installPackages(
			dependencies,
			answers.packageManager,
			{ cwd: appPath },
		);

		const filePaths = TRPCConfigGenerator.getFilePaths("nextjs-app");

		// Ensure server API directory exists
		await this.fileSystem.ensureDirectory(path.join(appPath, "src/server/api"));

		// Create tRPC config
		const trpcConfig = TRPCConfigGenerator.generateTRPCConfig("nextjs-app");
		await this.fileSystem.writeFile(
			path.join(appPath, filePaths.trpcConfig),
			trpcConfig,
		);

		// Create root router
		const rootRouter = TRPCConfigGenerator.generateRootRouter("nextjs-app");
		await this.fileSystem.writeFile(
			path.join(appPath, filePaths.rootRouter),
			rootRouter,
		);
	}

	private async createPackageJson(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		const packageJson = {
			name: "web",
			version: "0.1.0",
			private: true,
			scripts: {
				dev: "next dev",
				build: "next build",
				start: "next start",
				lint: "next lint",
			},
			dependencies: {
				next: "15.1.3",
				react: "^19.0.0",
				"react-dom": "^19.0.0",
			},
			devDependencies: {
				typescript: "^5.0.0",
				"@types/node": "^22.0.0",
				"@types/react": "^19.0.0",
				"@types/react-dom": "^19.0.0",
			},
		};

		if (answers.useTailwind) {
			(packageJson.devDependencies as Record<string, string>).tailwindcss =
				"^3.4.0";
			(packageJson.devDependencies as Record<string, string>).postcss =
				"^8.4.0";
			(packageJson.devDependencies as Record<string, string>).autoprefixer =
				"^10.4.0";
		}

		await this.fileSystem.writeFile(
			path.join(appPath, "package.json"),
			JSON.stringify(packageJson, null, 2),
		);
	}

	private async createTsConfig(appPath: string): Promise<void> {
		const tsConfig = {
			compilerOptions: {
				lib: ["dom", "dom.iterable", "esnext"],
				allowJs: true,
				skipLibCheck: true,
				strict: true,
				noEmit: true,
				esModuleInterop: true,
				module: "esnext",
				moduleResolution: "bundler",
				resolveJsonModule: true,
				isolatedModules: true,
				jsx: "preserve",
				incremental: true,
				plugins: [
					{
						name: "next",
					},
				],
				baseUrl: ".",
				paths: {
					"@/*": ["./src/*"],
				},
			},
			include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
			exclude: ["node_modules"],
		};

		await this.fileSystem.writeFile(
			path.join(appPath, "tsconfig.json"),
			JSON.stringify(tsConfig, null, 2),
		);
	}

	private async createNextConfig(appPath: string): Promise<void> {
		const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
};

export default nextConfig;
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "next.config.ts"),
			nextConfig,
		);
	}

	private async createAppRouterFiles(appPath: string): Promise<void> {
		// Create layout.tsx
		const layout = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Create Next App",
	description: "Generated by create next app",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body>
				{children}
			</body>
		</html>
	);
}
`;

		// Create page.tsx
		const page = `export default function Home() {
	return (
		<div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
			<main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
				<h1 className="text-4xl font-bold">Welcome to Next.js!</h1>
				<p className="text-lg">
					Get started by editing{" "}
					<code className="bg-black/[.05] dark:bg-white/[.06] px-1 py-0.5 rounded font-mono">
						src/app/page.tsx
					</code>
				</p>
			</main>
		</div>
	);
}
`;

		// Create globals.css
		const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
	--foreground-rgb: 0, 0, 0;
	--background-start-rgb: 214, 219, 220;
	--background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
	:root {
		--foreground-rgb: 255, 255, 255;
		--background-start-rgb: 0, 0, 0;
		--background-end-rgb: 0, 0, 0;
	}
}

body {
	color: rgb(var(--foreground-rgb));
	background: linear-gradient(
			to bottom,
			transparent,
			rgb(var(--background-end-rgb))
		)
		rgb(var(--background-start-rgb));
}
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "app", "layout.tsx"),
			layout,
		);

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "app", "page.tsx"),
			page,
		);

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "app", "globals.css"),
			globalsCss,
		);
	}

	private async createPagesRouterFiles(appPath: string): Promise<void> {
		// Create _app.tsx
		const app = `import '@/styles/globals.css';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
	return <Component {...pageProps} />;
}
`;

		// Create _document.tsx
		const document = `import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
	return (
		<Html lang="en">
			<Head />
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
`;

		// Create index.tsx
		const index = `export default function Home() {
	return (
		<div className="min-h-screen flex items-center justify-center">
			<main className="text-center">
				<h1 className="text-4xl font-bold mb-4">Welcome to Next.js!</h1>
				<p className="text-lg">
					Get started by editing{" "}
					<code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
						src/pages/index.tsx
					</code>
				</p>
			</main>
		</div>
	);
}
`;

		// Create globals.css
		const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
	--foreground-rgb: 0, 0, 0;
	--background-start-rgb: 214, 219, 220;
	--background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
	:root {
		--foreground-rgb: 255, 255, 255;
		--background-start-rgb: 0, 0, 0;
		--background-end-rgb: 0, 0, 0;
	}
}

body {
	color: rgb(var(--foreground-rgb));
	background: linear-gradient(
			to bottom,
			transparent,
			rgb(var(--background-end-rgb))
		)
		rgb(var(--background-start-rgb));
}
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "pages", "_app.tsx"),
			app,
		);

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "pages", "_document.tsx"),
			document,
		);

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "pages", "index.tsx"),
			index,
		);

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "styles", "globals.css"),
			globalsCss,
		);
	}

	private async createPublicFiles(appPath: string): Promise<void> {
		// Create a simple favicon.ico placeholder
		const _favicon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
	<rect width="16" height="16" fill="#000000"/>
	<text x="8" y="12" text-anchor="middle" fill="#ffffff" font-size="12" font-family="Arial">N</text>
</svg>
`;

		// Create next.svg
		const nextSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 394 80"><path fill="#000" d="M262 0h68.5v12.7h-27.2v66.6h-13.6V12.7H262V0ZM149 0v12.7H94v20.4h44.3v12.6H94v21h55v12.6H80.5V0h68.7zm34.3 0h-17.8l63.8 79.4h17.9l-32-39.7 32-39.7h-17.9l-23 28.6-23-28.6zm18.3 56.7-9-11-27.1 33.7h17.8l18.3-22.7z"/><path fill="#000" d="M81 79.3 17 0H0v79.3h13.6V17l50.2 62.3H81Zm252.6-.4c-1 0-1.8-.4-2.5-1s-1.1-1.6-1.1-2.6.3-1.8 1-2.5 1.6-1 2.6-1 1.8.3 2.5 1a3.4 3.4 0 0 1 .6 4.3 3.7 3.7 0 0 1-3 1.8zm23.2-33.5h6v23.3c0 2.1-.4 4-1.3 5.5a9.1 9.1 0 0 1-3.8 3.5c-1.6.8-3.5 1.3-5.7 1.3-2 0-3.7-.4-5.3-1s-2.8-1.8-3.7-3.2c-.9-1.3-1.4-3-1.4-5h6c.1.8.3 1.6.7 2.2s1 1.2 1.6 1.5c.7.4 1.5.5 2.4.5 1 0 1.8-.2 2.4-.6a4 4 0 0 0 1.6-1.8c.3-.8.5-1.8.5-3V45.5zm30.9 9.1a4.4 4.4 0 0 0-2-3.3 7.5 7.5 0 0 0-4.3-1.1c-1.3 0-2.4.2-3.3.5-.9.4-1.6 1-2 1.6a3.5 3.5 0 0 0-.3 4c.3.5.7.9 1.3 1.2l1.8 1 2 .5 3.2.8c1.3.3 2.5.7 3.7 1.2a13 13 0 0 1 3.2 1.8 8.1 8.1 0 0 1 3 6.5c0 2-.5 3.7-1.5 5.1a10 10 0 0 1-4.4 3.5c-1.8.8-4.1 1.2-6.8 1.2-2.6 0-4.9-.4-6.8-1.2-2-.8-3.4-2-4.5-3.5a10 10 0 0 1-1.7-5.6h6a5 5 0 0 0 3.5 4.6c1 .4 2.2.6 3.4.6 1.3 0 2.5-.2 3.5-.6 1-.4 1.8-1 2.4-1.7a4 4 0 0 0 .8-2.4c0-.9-.2-1.6-.7-2.2a11 11 0 0 0-2.1-1.4l-3.2-1-3.8-1c-2.8-.7-5-1.7-6.6-3.2a7.2 7.2 0 0 1-2.4-5.7 8 8 0 0 1 1.7-5 10 10 0 0 1 4.3-3.5c2-.8 4-1.2 6.4-1.2 2.3 0 4.4.4 6.2 1.2 1.8.8 3.2 2 4.2 3.4 1 1.4 1.5 3 1.5 5h-5.8z"/></svg>`;

		// Create vercel.svg
		const vercelSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 283 64"><path fill="black" d="M141 16c-11 0-19 7-19 18s9 18 20 18c7 0 13-3 16-7l-7-5c-2 3-6 4-9 4-5 0-9-3-10-7h28v-3c0-11-8-18-19-18zm-9 15c1-4 4-7 9-7s8 3 9 7h-18zm117-15c-11 0-19 7-19 18s9 18 20 18c6 0 12-3 16-7l-8-5c-2 3-5 4-8 4-5 0-9-3-11-7h28l1-3c0-11-8-18-19-18zm-10 15c2-4 5-7 10-7s8 3 9 7h-19zm-39 3c0 6 4 10 10 10 4 0 7-2 9-5l8 5c-3 5-9 8-17 8-11 0-19-7-19-18s8-18 19-18c8 0 14 3 17 8l-8 5c-2-3-5-5-9-5-6 0-10 4-10 10zm83-29v46h-9V5h9zM37 0l37 64H0L37 0zm92 5-27 48L74 5h10l18 30 17-30h10zm59 12v10l-3-1c-6 0-10 4-10 10v15h-9V17h9v9c0-5 6-9 13-9z"/></svg>`;

		await this.fileSystem.writeFile(
			path.join(appPath, "public", "next.svg"),
			nextSvg,
		);

		await this.fileSystem.writeFile(
			path.join(appPath, "public", "vercel.svg"),
			vercelSvg,
		);
	}

	private async installNextDependencies(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Installing Next.js dependencies");

		const baseDependencies = ["next", "react", "react-dom"];
		const devDependencies = [
			"typescript",
			"@types/node",
			"@types/react",
			"@types/react-dom",
		];

		await this.packageManager.installPackages(
			baseDependencies,
			answers.packageManager,
			{ cwd: appPath },
		);

		await this.packageManager.installPackages(
			devDependencies,
			answers.packageManager,
			{ cwd: appPath, dev: true },
		);

		if (answers.useTailwind) {
			await this.packageManager.installPackages(
				["tailwindcss", "postcss", "autoprefixer"],
				answers.packageManager,
				{ cwd: appPath, dev: true },
			);
		}
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