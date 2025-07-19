import inquirer from "inquirer";
import type { ProjectAnswers } from "../utils/types/index.js";
import { validateProjectName } from "../validation/index.js";

/**
 * Get project name through interactive prompt
 */
export async function getProjectName(): Promise<string> {
	const { projectName } = await inquirer.prompt([
		{
			type: "input",
			name: "projectName",
			message: "What's your project name?",
			default: "my-march-saas",
			validate: (input: string) => {
				const result = validateProjectName(input);
				return result.isValid || result.message || "Invalid project name";
			},
		},
	]);

	return projectName;
}

/**
 * Get project configuration through interactive prompts
 */
export async function getProjectConfiguration(): Promise<ProjectAnswers> {
	const answers = await inquirer.prompt([
		{
			type: "list",
			name: "packageManager",
			message: "📦 Choose your package manager:",
			choices: [
				{ name: "🥟 bun (blazing fast)", value: "bun" },
				{ name: "📦 npm (stable, widely used)", value: "npm" },
				{ name: "🧶 yarn (classic, reliable)", value: "yarn" },
				{ name: "⚡ pnpm (fast, efficient)", value: "pnpm" },
			],
			default: "bun",
		},
		{
			type: "list",
			name: "monorepoTool",
			message: "🏗️  Choose your monorepo tool:",
			choices: [
				{
					name: "🚀 Turborepo (recommended - fast builds & caching)",
					value: "turbo",
				},
				{ name: "🅧 Nx (powerful dev tools & generators)", value: "nx" },
				{ name: "📁 npm workspaces (simple & lightweight)", value: "none" },
			],
			default: "turbo",
		},
		{
			type: "list",
			name: "frontend",
			message: "⚛️  Choose your frontend framework:",
			choices: [
				{ name: "▲ Next.js (App Router)", value: "nextjs-app" },
				{ name: "📄 Next.js (Pages Router)", value: "nextjs-pages" },
				{ name: "⚡ Vite + React", value: "vite" },
				{ name: "🚫 None (backend only)", value: "none" },
			],
			default: "nextjs-app",
		},
		{
			type: "list",
			name: "backendAPI",
			message: "🔌 Choose your backend / API layer:",
			choices: [
				{ name: "🔗 tRPC (type-safe APIs)", value: "trpc" },
				{ name: "🏗️  NestJS (enterprise framework)", value: "nestjs" },
				{
					name: "🚀 Apollo GraphQL (flexible GraphQL server)",
					value: "graphql-apollo",
				},
				{ name: "🚫 None", value: "none" },
			],
			default: "trpc",
			when: (answers: any) => answers.frontend !== "none",
		},
		{
			type: "list",
			name: "uiComponents",
			message: "🧩 Choose your UI components:",
			choices: [
				{
					name: "🎨 shadcn/ui (beautiful, accessible components)",
					value: "shadcn",
				},
				{ name: "💨 Tailwind CSS only", value: "tailwind-only" },
				{ name: "🚫 None", value: "none" },
			],
			default: "shadcn",
			when: (answers: any) => answers.frontend !== "none",
		},
		{
			type: "list",
			name: "baseColor",
			message: "🎨 Choose a base color for shadcn/ui:",
			choices: [
				{ name: "Slate (Default)", value: "slate" },
				{ name: "Gray", value: "gray" },
				{ name: "Zinc", value: "zinc" },
				{ name: "Neutral", value: "neutral" },
				{ name: "Stone", value: "stone" },
			],
			default: "slate",
			when: (answers: any) => answers.uiComponents === "shadcn",
		},
		{
			type: "list",
			name: "ormDatabase",
			message: "🗄️  Choose your ORM / Database layer:",
			choices: [
				{ name: "🔷 Prisma (popular, feature-rich)", value: "prisma" },
				{ name: "💧 Drizzle ORM (lightweight, type-safe)", value: "drizzle" },
				{ name: "🚫 None", value: "none" },
			],
			default: "prisma",
			when: (answers: any) => answers.backendAPI !== "none",
		},
		{
			type: "list",
			name: "databaseProvider",
			message: "🌐 Choose your database provider:",
			choices: [
				{ name: "⚡ Neon (serverless Postgres)", value: "neon" },
				{
					name: "🔥 Supabase (open source Firebase alternative)",
					value: "supabase",
				},
				{ name: "🚫 None", value: "none" },
			],
			default: "supabase",
			when: (answers: any) => answers.ormDatabase !== "none",
		},
		{
			type: "list",
			name: "authentication",
			message: "🔐 Choose your authentication:",
			choices: [
				{ name: "🔑 NextAuth.js / Auth.js (flexible auth)", value: "nextauth" },
				{ name: "🚫 None", value: "none" },
			],
			default: "nextauth",
		},
		{
			type: "list",
			name: "payments",
			message: "💳 Choose your payments:",
			choices: [
				{ name: "💰 Stripe (payment processing)", value: "stripe" },
				{ name: "🚫 None", value: "none" },
			],
			default: "stripe",
		},
		{
			type: "checkbox",
			name: "testingTools",
			message: "🧪 Select testing tools:",
			choices: [
				{ name: "🃏 Jest (unit testing)", value: "jest" },
				{ name: "🚫 None", value: "none" },
			],
			default: ["jest"],
			when: (answers: any) => answers.frontend !== "none",
		},
		{
			type: "checkbox",
			name: "cicdDevOps",
			message: "🔄 Select CI/CD & DevOps tools:",
			choices: [
				{
					name: "🔄 GitHub Actions (CI/CD automation)",
					value: "github-actions",
				},
				{ name: "🐳 Docker (containerization)", value: "docker" },
				{ name: "🚫 None", value: "none" },
			],
			default: ["github-actions"],
		},
		{
			type: "list",
			name: "linter",
			message: "🎨 Choose your code quality tools:",
			choices: [
				{
					name: "🔧 ESLint + Prettier (traditional setup)",
					value: "eslint-prettier",
				},
				{ name: "🔥 Biome (fast, all-in-one)", value: "biome" },
				{ name: "🚫 None", value: "none" },
			],
			default: "biome",
		},
		{
			type: "checkbox",
			name: "developerExperience",
			message: "🛠️  Select developer experience tools:",
			choices: [
				{ name: "🪝 Husky (Git hooks)", value: "husky" },
				{ name: "📝 Commitlint (commit message linting)", value: "commitlint" },
				{ name: "🚫 None", value: "none" },
			],
			default: ["husky"],
		},
		{
			type: "list",
			name: "uiTools",
			message: "📚 Choose UI development tools:",
			choices: [
				{ name: "📖 Storybook (component library)", value: "storybook" },
				{ name: "🚫 None", value: "none" },
			],
			default: "none",
			when: (answers: any) => answers.frontend !== "none",
		},
		{
			type: "confirm",
			name: "progressiveWebApp",
			message: "📱 Enable Progressive Web App (PWA) support?",
			default: false,
			when: (answers: any) => answers.frontend !== "none",
		},
		{
			type: "list",
			name: "realtimeCollaboration",
			message: "🔄 Choose realtime / collaboration features:",
			choices: [
				{ name: "🎯 Liveblocks (realtime collaboration)", value: "liveblocks" },
				{ name: "🚫 None", value: "none" },
			],
			default: "none",
		},
	]);

	// Set default values and ensure type safety
	const projectAnswers: ProjectAnswers = {
		projectName: "", // Will be set by the caller
		packageManager: answers.packageManager || "npm",
		monorepoTool: answers.monorepoTool || "turbo",
		frontend: answers.frontend || "nextjs-app",
		backendAPI: answers.backendAPI || "trpc",
		uiComponents: answers.uiComponents || "shadcn",
		ormDatabase: answers.ormDatabase || "prisma",
		databaseProvider: answers.databaseProvider || "supabase",
		authentication: answers.authentication || "nextauth",
		payments: answers.payments || "stripe",
		testingTools: answers.testingTools || [],
		cicdDevOps: answers.cicdDevOps || [],
		linter: answers.linter || "biome",
		developerExperience: answers.developerExperience || [],
		uiTools: answers.uiTools || "none",
		progressiveWebApp: answers.progressiveWebApp || false,
		realtimeCollaboration: answers.realtimeCollaboration || "none",
		useTypeScript: true, // Always true in our setup
		baseColor: answers.baseColor || "slate",
		// Legacy fields for backward compatibility
		useTailwind:
			answers.uiComponents === "shadcn" ||
			answers.uiComponents === "tailwind-only",
		useShadcn: answers.uiComponents === "shadcn",
		useTRPC: answers.backendAPI === "trpc",
		appRouter: answers.frontend === "nextjs-app",
		features: [], // Convert new structure to legacy if needed
		database: answers.databaseProvider,
	};

	return projectAnswers;
}

/**
 * Handle directory conflict resolution
 */
export async function handleDirectoryConflict(
	projectName: string,
): Promise<"cancel" | "remove" | "continue"> {
	const { action } = await inquirer.prompt([
		{
			type: "list",
			name: "action",
			message: `Directory '${projectName}' already exists. What would you like to do?`,
			choices: [
				{ name: "Cancel and choose a different name", value: "cancel" },
				{ name: "Remove existing directory and continue", value: "remove" },
				{ name: "Use existing directory (risky)", value: "continue" },
			],
		},
	]);

	return action;
}

/**
 * Prompt for cleanup after failed setup
 */
export async function promptCleanup(): Promise<boolean> {
	const { cleanup } = await inquirer.prompt([
		{
			type: "confirm",
			name: "cleanup",
			message: "Would you like to remove the partially created project?",
			default: true,
		},
	]);

	return cleanup;
}