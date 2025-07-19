import { execa } from "execa";
import fs from "fs-extra";

export interface ValidationResult {
	isValid: boolean;
	message?: string;
}

/**
 * Validates basic system requirements (Node.js and git)
 */
export async function validateBasicRequirements(): Promise<void> {
	const requirements = [
		{ command: "node", version: "--version", min: "18.0.0" },
		{ command: "git", version: "--version", min: "2.0.0" },
	];

	for (const req of requirements) {
		try {
			await execa(req.command, [req.version], { stdio: "pipe" });
		} catch (_error) {
			throw new Error(
				`Required tool '${req.command}' is not installed or not in PATH. Please install it and try again.`,
			);
		}
	}
}

/**
 * Validates that the selected package manager is available
 */
export async function validatePackageManager(
	packageManager: string,
): Promise<void> {
	try {
		await execa(packageManager, ["--version"], { stdio: "pipe" });
	} catch (_error) {
		throw new Error(
			`Selected package manager '${packageManager}' is not installed or not in PATH. Please install it and try again.`,
		);
	}
}

/**
 * Validates project name against npm package naming rules
 */
export function validateProjectName(name: string): ValidationResult {
	if (!name || typeof name !== "string") {
		return { isValid: false, message: "Project name is required" };
	}

	// npm package naming rules
	if (name.length > 214) {
		return {
			isValid: false,
			message: "Project name must be less than 214 characters",
		};
	}

	if (name.startsWith(".") || name.startsWith("_")) {
		return { isValid: false, message: "Project name cannot start with . or _" };
	}

	if (!/^[a-z0-9-]+$/.test(name)) {
		return {
			isValid: false,
			message:
				"Project name can only contain lowercase letters, numbers, and dashes",
		};
	}

	if (name.includes("--") || name.startsWith("-") || name.endsWith("-")) {
		return {
			isValid: false,
			message:
				"Project name cannot have consecutive dashes or start/end with dashes",
		};
	}

	// Reserved names
	const reserved = ["node_modules", "favicon.ico", ".git", ".gitignore"];
	if (reserved.includes(name)) {
		return { isValid: false, message: `Project name '${name}' is reserved` };
	}

	return { isValid: true };
}

/**
 * Checks if directory exists and handles conflicts
 */
export async function validateDirectoryAvailability(
	projectPath: string,
): Promise<boolean> {
	return !(await fs.pathExists(projectPath));
}