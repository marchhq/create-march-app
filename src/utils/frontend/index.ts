import { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import { PackageManagerService } from "../core/package-manager.js";
import { AstroSetupService } from "../framework/astro-setup.js";
import { NextJsSetupService } from "../framework/nextjs-setup.js";
import { ViteSetupService } from "../framework/vite-setup.js";
import type {
	ExecutionContext,
	ProjectAnswers,
	SetupResult,
} from "../types/index.js";
import { UILibrarySetupService } from "./ui-library.js";

export class FrontendSetupService {
	private fileSystem: FileSystemService;
	private packageManager: PackageManagerService;
	private nextJsService: NextJsSetupService;
	private viteService: ViteSetupService;
	private astroService: AstroSetupService;
	private uiLibraryService: UILibrarySetupService;

	constructor() {
		this.fileSystem = new FileSystemService();
		this.packageManager = new PackageManagerService();
		this.nextJsService = new NextJsSetupService(
			this.fileSystem,
			this.packageManager,
		);
		this.viteService = new ViteSetupService(
			this.fileSystem,
			this.packageManager,
		);
		this.astroService = new AstroSetupService(
			this.fileSystem,
			this.packageManager,
		);
		this.uiLibraryService = new UILibrarySetupService();
	}

	/**
	 * Setup shared UI library (shadcn/ui) in the monorepo
	 */
	async setupSharedUILibrary(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		try {
			return await this.uiLibraryService.setupUILibrary(projectPath, answers);
		} catch (error) {
			const message = `Failed to setup UI library: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	/**
	 * Setup Next.js application with proper configuration
	 */
	async setupNextJs(
		projectPath: string,
		answers: ProjectAnswers,
		isAppRouter = true,
	): Promise<SetupResult> {
		try {
			const context: ExecutionContext = {
				projectPath,
				appPath: this.fileSystem.resolveAppPath(projectPath),
				answers,
			};

			return await this.nextJsService.setup(context, isAppRouter);
		} catch (error) {
			const message = `Failed to setup Next.js: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	/**
	 * Setup Vite application with proper configuration
	 */
	async setupVite(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		try {
			const context: ExecutionContext = {
				projectPath,
				appPath: this.fileSystem.resolveAppPath(projectPath),
				answers,
			};

			return await this.viteService.setup(context);
		} catch (error) {
			const message = `Failed to setup Vite: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	/**
	 * Setup Astro application with proper configuration
	 */
	async setupAstro(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		try {
			const context: ExecutionContext = {
				projectPath,
				appPath: this.fileSystem.resolveAppPath(projectPath),
				answers,
			};

			return await this.astroService.setup(context);
		} catch (error) {
			const message = `Failed to setup Astro: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	/**
	 * Setup frontend framework based on user's choice
	 */
	async setupFramework(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		switch (answers.frontend) {
			case "nextjs-app":
				return await this.setupNextJs(projectPath, answers, answers.appRouter);
			case "nextjs-pages":
				return await this.setupNextJs(projectPath, answers, false);
			case "vite":
				return await this.setupVite(projectPath, answers);
			case "astro":
				return await this.setupAstro(projectPath, answers);
			case "none":
				logger.info("Skipping frontend setup as requested");
				return { success: true, message: "Frontend setup skipped" };
			default: {
				const message = `Unsupported frontend framework: ${answers.frontend}`;
				logger.error(message);
				return { success: false, message };
			}
		}
	}
}

// Export legacy functions for backward compatibility
export async function setupNextJs(
	projectPath: string,
	answers: ProjectAnswers,
	isAppRouter = true,
): Promise<void> {
	const service = new FrontendSetupService();
	const result = await service.setupNextJs(projectPath, answers, isAppRouter);

	if (!result.success) {
		throw new Error(result.message);
	}

	if (result.warnings) {
		result.warnings.forEach((warning) => logger.warn(warning));
	}
}

export async function setupVite(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const service = new FrontendSetupService();
	const result = await service.setupVite(projectPath, answers);

	if (!result.success) {
		throw new Error(result.message);
	}

	if (result.warnings) {
		result.warnings.forEach((warning) => logger.warn(warning));
	}
}

export async function setupAstro(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const service = new FrontendSetupService();
	const result = await service.setupAstro(projectPath, answers);

	if (!result.success) {
		throw new Error(result.message);
	}

	if (result.warnings) {
		result.warnings.forEach((warning) => logger.warn(warning));
	}
}

// Export configuration generators
export { BiomeConfigGenerator } from "../config/biome.js";
export { TailwindConfigGenerator } from "../config/tailwind.js";
export { TRPCConfigGenerator } from "../config/trpc.js";
// Export core services
export { FileSystemService } from "../core/file-system.js";
export { logger } from "../core/logger.js";
export { PackageManagerService } from "../core/package-manager.js";
export { AstroSetupService } from "../framework/astro-setup.js";
// Export services for advanced usage
export { NextJsSetupService } from "../framework/nextjs-setup.js";
export { ViteSetupService } from "../framework/vite-setup.js";
// Export types
export type * from "../types/index.js";
export { UILibrarySetupService } from "./ui-library.js";