import { execa } from "execa";
import type { PackageInstallOptions, PackageManager } from "../types/index.js";
import { logger } from "./logger.js";

export class PackageManagerError extends Error {
	constructor(
		message: string,
		public packageManager: PackageManager,
		public packages: string[],
		public originalError?: Error,
	) {
		super(message);
		this.name = "PackageManagerError";
	}
}

export interface PackageManagerStrategy {
	install(packages: string[], options?: PackageInstallOptions): Promise<void>;
	installDev(
		packages: string[],
		options?: PackageInstallOptions,
	): Promise<void>;
	getInstallCommand(): string[];
	getExecuteCommand(): string;
}

class NpmStrategy implements PackageManagerStrategy {
	install(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["install", ...packages], options);
	}

	installDev(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["install", "-D", ...packages], options);
	}

	getInstallCommand(): string[] {
		return ["install"];
	}

	getExecuteCommand(): string {
		return "npx";
	}

	private async executeInstall(
		args: string[],
		options: PackageInstallOptions,
	): Promise<void> {
		const { cwd = process.cwd(), timeout = 180000 } = options;

		await execa("npm", args, {
			cwd,
			stdio: "pipe",
			timeout,
			env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
		});
	}
}

class YarnStrategy implements PackageManagerStrategy {
	install(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["add", ...packages], options);
	}

	installDev(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["add", "-D", ...packages], options);
	}

	getInstallCommand(): string[] {
		return ["install"];
	}

	getExecuteCommand(): string {
		return "yarn dlx";
	}

	private async executeInstall(
		args: string[],
		options: PackageInstallOptions,
	): Promise<void> {
		const { cwd = process.cwd(), timeout = 180000 } = options;

		await execa("yarn", args, {
			cwd,
			stdio: "pipe",
			timeout,
			env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
		});
	}
}

class PnpmStrategy implements PackageManagerStrategy {
	install(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["add", ...packages], options);
	}

	installDev(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["add", "-D", ...packages], options);
	}

	getInstallCommand(): string[] {
		return ["install"];
	}

	getExecuteCommand(): string {
		return "pnpm dlx";
	}

	private async executeInstall(
		args: string[],
		options: PackageInstallOptions,
	): Promise<void> {
		const { cwd = process.cwd(), timeout = 180000 } = options;

		await execa("pnpm", args, {
			cwd,
			stdio: "pipe",
			timeout,
			env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
		});
	}
}

class BunStrategy implements PackageManagerStrategy {
	install(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["add", ...packages], options);
	}

	installDev(
		packages: string[],
		options: PackageInstallOptions = {},
	): Promise<void> {
		return this.executeInstall(["add", "-d", ...packages], options);
	}

	getInstallCommand(): string[] {
		return ["install"];
	}

	getExecuteCommand(): string {
		return "bunx";
	}

	private async executeInstall(
		args: string[],
		options: PackageInstallOptions,
	): Promise<void> {
		const { cwd = process.cwd(), timeout = 180000 } = options;

		// Use longer timeout for bun as it can be slower than other package managers
		// Especially with large packages or when resolving complex dependencies
		const bunTimeout = Math.max(timeout, 300000); // At least 5 minutes, or longer if specified

		// Check for known slow packages that might need even more time
		const hasSlowPackages = args.some(
			(arg) =>
				arg.includes("prisma") ||
				arg.includes("@prisma") ||
				arg.includes("playwright") ||
				arg.includes("@playwright") ||
				arg.includes("nextjs") ||
				arg.includes("webpack") ||
				arg.includes("vite") ||
				arg.includes("typescript") ||
				arg.includes("@types"),
		);

		// Use extra long timeout for known slow packages
		const actualTimeout = hasSlowPackages
			? Math.max(bunTimeout, 600000)
			: bunTimeout; // 10 minutes for slow packages

		try {
			await execa("bun", args, {
				cwd,
				stdio: "pipe",
				timeout: actualTimeout,
				env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
			});
		} catch (error) {
			// If bun installation fails with timeout, fallback to npm for reliability
			if (error instanceof Error && error.message.includes("timed out")) {
				logger.warn(
					`Bun timed out installing packages [${args.slice(1).join(", ")}], falling back to npm...`,
				);

				// Convert bun args to npm args
				const npmArgs = args.map((arg) => {
					if (arg === "add") return "install";
					if (arg === "-d") return "-D";
					return arg;
				});

				await execa("npm", npmArgs, {
					cwd,
					stdio: "pipe",
					timeout: actualTimeout,
					env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
				});
			} else {
				throw error;
			}
		}
	}
}

export class PackageManagerService {
	private strategies: Record<PackageManager, PackageManagerStrategy> = {
		npm: new NpmStrategy(),
		yarn: new YarnStrategy(),
		pnpm: new PnpmStrategy(),
		bun: new BunStrategy(),
	};

	async installPackages(
		packages: string[],
		packageManager: PackageManager,
		options: PackageInstallOptions = {},
	): Promise<void> {
		try {
			logger.package(
				`Installing packages: ${packages.join(", ")} with ${packageManager}`,
			);

			const strategy = this.strategies[packageManager];
			const method = options.dev ? "installDev" : "install";

			await strategy[method](packages, options);

			logger.success(`Packages installed successfully: ${packages.join(", ")}`);
		} catch (error) {
			const message = `Failed to install packages ${packages.join(", ")} with ${packageManager}`;
			logger.error(message, error);
			throw new PackageManagerError(
				message,
				packageManager,
				packages,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	getStrategy(packageManager: PackageManager): PackageManagerStrategy {
		return this.strategies[packageManager];
	}

	getExecuteCommand(packageManager: PackageManager): string {
		return this.strategies[packageManager].getExecuteCommand();
	}
}