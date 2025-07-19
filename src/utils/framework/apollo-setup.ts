import path from "node:path";
import type { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import type { PackageManagerService } from "../core/package-manager.js";
import type {
	ExecutionContext,
	ProjectAnswers,
	SetupResult,
} from "../types/index.js";

export class ApolloGraphQLSetupService {
	constructor(
		private fileSystem: FileSystemService,
		private packageManager: PackageManagerService,
	) {}

	async setup(context: ExecutionContext): Promise<SetupResult> {
		try {
			logger.normal("Setting up Apollo GraphQL backend");
			return await this.setupStandard(context);
		} catch (error) {
			const message = `Failed to setup Apollo GraphQL: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	private async setupStandard(context: ExecutionContext): Promise<SetupResult> {
		const { projectPath, appPath, answers } = context;

		// Create backend directory
		await this.fileSystem.ensureDirectory(appPath);
		logger.normal("Creating Apollo GraphQL backend directory");

		// Initialize backend package.json
		await this.createPackageJson(appPath, answers);

		// Create backend structure
		await this.createBackendStructure(appPath, answers);

		// Create Apollo GraphQL specific .gitignore
		await this.createApolloGraphQLGitignore(appPath);

		return {
			success: true,
			message: "Apollo GraphQL backend setup completed successfully!",
		};
	}

	private async createPackageJson(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		const packageJson = {
			name: `${answers.projectName}-api`,
			version: "1.0.0",
			description: "Apollo GraphQL API server",
			main: "dist/index.js",
			scripts: {
				dev: "tsx watch src/index.ts",
				build: "tsup src/index.ts --dts",
				start: "node dist/index.js",
			},
			dependencies: {
				"@apollo/server": "^4.9.5",
				graphql: "^16.8.1",
				fastify: "^4.24.3",
			},
			devDependencies: {
				"@types/node": "^20.10.0",
				tsx: "^4.6.0",
				tsup: "^8.0.1",
				typescript: "^5.3.0",
			},
		};

		await this.fileSystem.writeJson(
			path.join(appPath, "package.json"),
			packageJson,
		);
	}

	private async createBackendStructure(
		appPath: string,
		_answers: ProjectAnswers,
	): Promise<void> {
		// Create src directory
		await this.fileSystem.ensureDirectory(path.join(appPath, "src"));

		// Create main server file
		const serverContent = `import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const typeDefs = \`#graphql
  type Query {
    hello: String
  }
\`;

const resolvers = {
  Query: {
    hello: () => 'Hello world!',
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const { url } = await startStandaloneServer(server, {
  listen: { port: 3001 },
});

console.log(\`🚀 Server ready at: \${url}\`);
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src/index.ts"),
			serverContent,
		);
	}

	/**
	 * Create Apollo GraphQL specific .gitignore file
	 */
	private async createApolloGraphQLGitignore(appPath: string): Promise<void> {
		const apolloGitignore = `# Apollo GraphQL specific
dist/

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

# Logs
logs/
*.log

# Database
*.db
*.sqlite

# GraphQL
schema.graphql
generated/

# Apollo
.apollo/

# Build artifacts
build/
`;

		await this.fileSystem.writeFile(
			path.join(appPath, ".gitignore"),
			apolloGitignore,
		);

		logger.normal("Created Apollo GraphQL specific .gitignore");
	}
}