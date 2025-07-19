import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import { PackageManagerService } from "../utils/core/package-manager.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();
const packageManagerService = new PackageManagerService();

/**
 * Setup testing tools based on user selections
 */
export async function setupTesting(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up testing tools...");

	const appPath = fileSystemService.resolveAppPath(projectPath);

	// Handle each selected testing tool
	for (const tool of answers.testingTools) {
		switch (tool) {
			case "jest":
				await setupJest(appPath, answers);
				break;
			case "none":
				logger.info("Skipping testing setup (none selected)");
				break;
		}
	}

	// Update package.json scripts
	await updatePackageJsonScripts(appPath, answers);

	logger.success("Testing tools setup completed");
}

/**
 * Setup Jest for unit testing
 */
async function setupJest(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Configuring Jest...");

	try {
		// Install Jest and related dependencies
		const jestDeps = [
			"jest",
			"@types/jest",
			"jest-environment-jsdom",
			"ts-jest",
		];

		if (
			answers.frontend?.includes("react") ||
			answers.frontend === "nextjs-app" ||
			answers.frontend === "nextjs-pages"
		) {
			jestDeps.push("@testing-library/jest-dom");
		}

		// Add dependencies to package.json
		await packageManagerService.installPackages(
			jestDeps,
			answers.packageManager,
			{
				cwd: projectPath,
				dev: true,
			},
		);

		// Create Jest configuration
		const jestConfig = createJestConfig(answers);
		await fileSystemService.writeFile(
			path.join(projectPath, "jest.config.js"),
			jestConfig,
		);

		// Create Jest setup file
		const jestSetup = createJestSetup(answers);
		await fileSystemService.writeFile(
			path.join(projectPath, "jest.setup.js"),
			jestSetup,
		);

		// Create example test file
		const exampleTest = createExampleJestTest(answers);
		await fileSystemService.ensureDirectory(
			path.join(projectPath, "src/__tests__"),
		);
		await fileSystemService.writeFile(
			path.join(projectPath, "src/__tests__/example.test.ts"),
			exampleTest,
		);

		logger.success("Jest configuration completed");
	} catch (error) {
		throw new Error(
			`Failed to setup Jest: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Create Jest configuration based on project setup
 */
function createJestConfig(answers: ProjectAnswers): string {
	const isNextJs =
		answers.frontend === "nextjs-app" || answers.frontend === "nextjs-pages";

	if (isNextJs) {
		return `const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
`;
	}

	return `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
};
`;
}

/**
 * Create Jest setup file
 */
function createJestSetup(answers: ProjectAnswers): string {

	return `// Add any global test setup here
`;
}

/**
 * Create example Jest test
 */
function createExampleJestTest(_answers: ProjectAnswers): string {
	return `// Example Jest test
describe('Example Test Suite', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should handle basic math', () => {
    expect(2 + 2).toBe(4);
  });
});
`;
}

/**
 * Update package.json scripts with testing commands
 */
async function updatePackageJsonScripts(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const packageJsonPath = path.join(projectPath, "package.json");

	try {
		const packageJsonContent =
			await fileSystemService.readFile(packageJsonPath);
		const packageJson = JSON.parse(packageJsonContent);

		if (!packageJson.scripts) {
			packageJson.scripts = {};
		}

		// Add test scripts based on selected tools
		if (answers.testingTools.includes("jest")) {
			packageJson.scripts.test = "jest";
			packageJson.scripts["test:watch"] = "jest --watch";
			packageJson.scripts["test:coverage"] = "jest --coverage";
		}


		// Add combined test script if multiple tools are selected
		if (
			answers.testingTools.length > 1 &&
			!answers.testingTools.includes("none")
		) {
			const testCommands = [];
			if (answers.testingTools.includes("jest")) {
				testCommands.push("jest");
			}
			packageJson.scripts["test:all"] = testCommands.join(" && ");
		}

		await fileSystemService.writeFile(
			packageJsonPath,
			JSON.stringify(packageJson, null, 2),
		);

		logger.info("Updated package.json with testing scripts");
	} catch (error) {
		logger.warn("Failed to update package.json scripts:", error);
	}
}