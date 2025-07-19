import { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import { PackageManagerService } from "../core/package-manager.js";
import { ApolloGraphQLSetupService } from "../framework/apollo-setup.js";
import { ExpressTRPCSetupService } from "../framework/express-trpc-setup.js";
import { NestJsSetupService } from "../framework/nestjs-setup.js";
import type {
	ExecutionContext,
	ProjectAnswers,
	SetupResult,
} from "../types/index.js";

export class BackendSetupService {
	private fileSystem: FileSystemService;
	private packageManager: PackageManagerService;
	private nestJsService: NestJsSetupService;
	private expressTrpcService: ExpressTRPCSetupService;
	private apolloService: ApolloGraphQLSetupService;

	constructor() {
		this.fileSystem = new FileSystemService();
		this.packageManager = new PackageManagerService();
		this.nestJsService = new NestJsSetupService(
			this.fileSystem,
			this.packageManager,
		);
		this.expressTrpcService = new ExpressTRPCSetupService(
			this.fileSystem,
			this.packageManager,
		);
		this.apolloService = new ApolloGraphQLSetupService(
			this.fileSystem,
			this.packageManager,
		);
	}

	/**
	 * Setup NestJS backend application
	 */
	async setupNestJs(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		try {
			const context: ExecutionContext = {
				projectPath,
				appPath: this.fileSystem.resolveBackendPath(projectPath),
				answers,
			};

			return await this.nestJsService.setup(context);
		} catch (error) {
			const message = `Failed to setup NestJS: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	/**
	 * Setup Express + tRPC backend application
	 */
	async setupExpressTRPC(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		try {
			const context: ExecutionContext = {
				projectPath,
				appPath: this.fileSystem.resolveBackendPath(projectPath),
				answers,
			};

			return await this.expressTrpcService.setup(context);
		} catch (error) {
			const message = `Failed to setup Express + tRPC: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	/**
	 * Setup Apollo GraphQL backend application
	 */
	async setupApolloGraphQL(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		try {
			const context: ExecutionContext = {
				projectPath,
				appPath: this.fileSystem.resolveBackendPath(projectPath),
				answers,
			};

			return await this.apolloService.setup(context);
		} catch (error) {
			const message = `Failed to setup Apollo GraphQL: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	/**
	 * Setup backend framework based on user's choice
	 */
	async setupFramework(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		switch (answers.backendAPI) {
			case "trpc":
				return await this.setupExpressTRPC(projectPath, answers);
			case "nestjs":
				return await this.setupNestJs(projectPath, answers);
			case "graphql-apollo":
				return await this.setupApolloGraphQL(projectPath, answers);
			case "none":
				logger.info("Skipping backend setup as requested");
				return { success: true, message: "Backend setup skipped" };
			default: {
				const message = `Unsupported backend framework: ${answers.backendAPI}`;
				logger.error(message);
				return { success: false, message };
			}
		}
	}
}

// Export legacy functions for backward compatibility
export async function setupNestJs(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const service = new BackendSetupService();
	const result = await service.setupNestJs(projectPath, answers);

	if (!result.success) {
		throw new Error(result.message);
	}

	if (result.warnings) {
		result.warnings.forEach((warning) => logger.warn(warning));
	}
}

export async function setupExpressTRPC(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const service = new BackendSetupService();
	const result = await service.setupExpressTRPC(projectPath, answers);

	if (!result.success) {
		throw new Error(result.message);
	}

	if (result.warnings) {
		result.warnings.forEach((warning) => logger.warn(warning));
	}
}

export async function setupApolloGraphQL(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const service = new BackendSetupService();
	const result = await service.setupApolloGraphQL(projectPath, answers);

	if (!result.success) {
		throw new Error(result.message);
	}

	if (result.warnings) {
		result.warnings.forEach((warning) => logger.warn(warning));
	}
}

export { ApolloGraphQLSetupService } from "../framework/apollo-setup.js";
export { ExpressTRPCSetupService } from "../framework/express-trpc-setup.js";
// Export services for advanced usage
export { NestJsSetupService } from "../framework/nestjs-setup.js";