import path from "node:path";
import fs from "fs-extra";
import type { ConfigFile } from "../types/index.js";
import { logger } from "./logger.js";

export class FileSystemError extends Error {
	constructor(
		message: string,
		public filePath: string,
		public originalError?: Error,
	) {
		super(message);
		this.name = "FileSystemError";
	}
}

export class FileSystemService {
	async ensureDirectory(dirPath: string): Promise<void> {
		try {
			await fs.ensureDir(dirPath);
			logger.debug(`Directory ensured: ${dirPath}`);
		} catch (error) {
			const message = `Failed to ensure directory: ${dirPath}`;
			logger.error(message, error);
			throw new FileSystemError(
				message,
				dirPath,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	async writeFile(filePath: string, content: string): Promise<void> {
		try {
			await fs.writeFile(filePath, content, "utf-8");
			logger.debug(`File written: ${filePath}`);
		} catch (error) {
			const message = `Failed to write file: ${filePath}`;
			logger.error(message, error);
			throw new FileSystemError(
				message,
				filePath,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	async writeJson(
		filePath: string,
		data: any,
		options: { spaces?: number } = {},
	): Promise<void> {
		try {
			await fs.writeJson(filePath, data, { spaces: options.spaces || 2 });
			logger.debug(`JSON file written: ${filePath}`);
		} catch (error) {
			const message = `Failed to write JSON file: ${filePath}`;
			logger.error(message, error);
			throw new FileSystemError(
				message,
				filePath,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	async readFile(filePath: string): Promise<string> {
		try {
			const content = await fs.readFile(filePath, "utf-8");
			logger.debug(`File read: ${filePath}`);
			return content;
		} catch (error) {
			const message = `Failed to read file: ${filePath}`;
			logger.error(message, error);
			throw new FileSystemError(
				message,
				filePath,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	async readJson<T = any>(filePath: string): Promise<T> {
		try {
			const data = await fs.readJson(filePath);
			logger.debug(`JSON file read: ${filePath}`);
			return data;
		} catch (error) {
			const message = `Failed to read JSON file: ${filePath}`;
			logger.error(message, error);
			throw new FileSystemError(
				message,
				filePath,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	async fileExists(filePath: string): Promise<boolean> {
		try {
			await fs.access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	async updatePackageJson(
		packageJsonPath: string,
		updates: {
			scripts?: Record<string, string>;
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
			[key: string]: any;
		},
	): Promise<void> {
		try {
			const packageJson = await this.readJson(packageJsonPath);

			Object.entries(updates).forEach(([key, value]) => {
				if (value && typeof value === "object" && !Array.isArray(value)) {
					packageJson[key] = { ...packageJson[key], ...value };
				} else {
					packageJson[key] = value;
				}
			});

			await this.writeJson(packageJsonPath, packageJson);
			logger.config(`Updated package.json: ${packageJsonPath}`);
		} catch (error) {
			const message = `Failed to update package.json: ${packageJsonPath}`;
			logger.error(message, error);
			throw new FileSystemError(
				message,
				packageJsonPath,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	async writeConfigFiles(
		basePath: string,
		configFiles: ConfigFile[],
	): Promise<void> {
		const writePromises = configFiles.map(async (configFile) => {
			const fullPath = path.join(basePath, configFile.path);

			if (!configFile.overwrite && (await this.fileExists(fullPath))) {
				logger.warn(`Skipping existing file: ${fullPath}`);
				return;
			}

			// Ensure directory exists
			const dir = path.dirname(fullPath);
			await this.ensureDirectory(dir);

			await this.writeFile(fullPath, configFile.content);
			logger.config(`Config file written: ${configFile.path}`);
		});

		await Promise.all(writePromises);
	}

	resolveAppPath(projectPath: string, appName: string = "web"): string {
		return path.join(projectPath, "apps", appName);
	}

	resolveBackendPath(projectPath: string, backendName: string = "api"): string {
		return path.join(projectPath, "apps", backendName);
	}

	resolveProjectPaths(projectPath: string, appName: string = "web") {
		return {
			projectPath,
			appsDir: path.join(projectPath, "apps"),
			appPath: this.resolveAppPath(projectPath, appName),
			backendPath: this.resolveBackendPath(projectPath),
			packagesDir: path.join(projectPath, "packages"),
		};
	}
}