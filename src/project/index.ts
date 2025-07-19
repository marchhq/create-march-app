import path from "node:path";
import { execa } from "execa";
import fs from "fs-extra";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import { PackageManagerService } from "../utils/core/package-manager.js";
import type { PackageManager, ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();
const _packageManagerService = new PackageManagerService();

/**
 * Initialize project directory and validate permissions
 */
export async function initializeProject(projectPath: string): Promise<void> {
  try {
    await fs.ensureDir(projectPath);

    // Test write permissions
    const testFile = path.join(projectPath, ".write-test");
    await fs.writeFile(testFile, "test");
    await fs.remove(testFile);
  } catch (error) {
    throw new Error(
      `Cannot create project directory or insufficient permissions: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Initialize git repository
 */
export async function initializeGitRepository(
  projectPath: string,
): Promise<void> {
  logger.step("Initializing git repository...");

  try {
    await execa("git", ["init"], { cwd: projectPath });
    await execa("git", ["config", "init.defaultBranch", "main"], {
      cwd: projectPath,
    });

    // Create .gitignore file
    const gitignore = `# Dependencies
node_modules/
.pnp
.pnp.js

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
lerna-debug.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Monorepo tools
.turbo/
.nx/cache/
.nx/workspace-data

# Package manager cache
.npm
.yarn/cache
.yarn/unplugged
.yarn/build-state.yml
.yarn/install-state.gz
.pnp.*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Temporary folders
tmp/
temp/

# Logs
logs/
*.log

# Build outputs (general)
dist/
build/
out/

# TypeScript
*.tsbuildinfo

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variable files
.env.*.local

# Vercel
.vercel

# Misc
*.pem
`;

    await fileSystemService.writeFile(
      path.join(projectPath, ".gitignore"),
      gitignore,
    );
    logger.success("Git repository initialized");
  } catch (error) {
    throw new Error(
      `Failed to initialize git repository: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create initial git commit
 */
export async function createInitialCommit(projectPath: string): Promise<void> {
  try {
    await execa("git", ["add", "."], { cwd: projectPath });
    await execa("git", ["commit", "-m", "Initial commit"], {
      cwd: projectPath,
    });
    logger.success("Initial git commit created");
  } catch (_error) {
    logger.warn(
      "Failed to create initial git commit. You can commit manually later.",
    );
  }
}

/**
 * Install dependencies for the project
 */
export async function installDependencies(
  projectPath: string,
  packageManager: PackageManager = "npm",
): Promise<void> {
  try {
    logger.step(`Installing dependencies with ${packageManager}...`);

    const args = ["install"];
    await execa(packageManager, args, {
      cwd: projectPath,
      stdio: "pipe", // Prevent output from interfering with spinner
    });

    logger.success("Dependencies installed successfully");
  } catch (error) {
    throw new Error(
      `Failed to install dependencies with ${packageManager}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create .env.example file based on selected features
 */
export function createEnvExample(answers: ProjectAnswers): string {
  let envContent = `# Database Configuration\n`;

  if (
    answers.databaseProvider &&
    ["neon", "both"].includes(answers.databaseProvider)
  ) {
    envContent += `DATABASE_URL="postgres://user:password@host/database"\n`;
  }

  if (
    answers.databaseProvider &&
    ["supabase", "both"].includes(answers.databaseProvider)
  ) {
    envContent += `NEXT_PUBLIC_SUPABASE_URL="your-project-url"\n`;
    envContent += `NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"\n`;
  }

  if (answers.authentication !== "none") {
    envContent += `\n# Authentication\n`;

    if (answers.authentication === "nextauth") {
      envContent += `NEXTAUTH_SECRET="your-secret-key"\n`;
      envContent += `NEXTAUTH_URL="http://localhost:3000"\n`;
    }
  }

  if (answers.payments === "stripe") {
    envContent += `\n# Stripe\n`;
    envContent += `STRIPE_SECRET_KEY="sk_test_..."\n`;
    envContent += `STRIPE_WEBHOOK_SECRET="whsec_..."\n`;
    envContent += `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."\n`;
  }

  return envContent;
}

/**
 * Create project README
 */
export function createProjectReadme(
  projectPath: string,
  answers: ProjectAnswers,
): string {
  const projectName = path.basename(projectPath);
  const packageManager = answers.packageManager || "npm";

  // Package manager specific commands
  const installCmd =
    packageManager === "npm"
      ? "npm install"
      : packageManager === "yarn"
        ? "yarn install"
        : packageManager === "pnpm"
          ? "pnpm install"
          : "bun install";

  const devCmd =
    packageManager === "npm"
      ? "npm run dev"
      : packageManager === "yarn"
        ? "yarn dev"
        : packageManager === "pnpm"
          ? "pnpm dev"
          : "bun dev";

  const buildCmd =
    packageManager === "npm"
      ? "npm run build"
      : packageManager === "yarn"
        ? "yarn build"
        : packageManager === "pnpm"
          ? "pnpm build"
          : "bun build";

  return `# ${projectName}

A modern SaaS application built with the latest technologies.

## Tech Stack

- **Frontend**: ${answers.frontend.startsWith("nextjs") ? "Next.js" : answers.frontend === "vite" ? "Vite + React" : answers.frontend === "remix" ? "Remix" : "React"}
- **Package Manager**: ${packageManager}
- **Monorepo Tool**: ${answers.monorepoTool}
- **Code Quality**: ${answers.linter}
${answers.useTailwind ? "- **Styling**: Tailwind CSS v4\n" : ""}${answers.useShadcn ? "- **UI Components**: shadcn/ui\n" : ""}${answers.useTRPC ? "- **API**: tRPC\n" : ""}${answers.ormDatabase !== "none" ? `- **Database**: ${answers.ormDatabase} + ${answers.databaseProvider}\n` : ""}${answers.authentication !== "none" ? `- **Authentication**: ${answers.authentication}\n` : ""}${answers.payments === "stripe" ? "- **Payments**: Stripe\n" : ""}
## Getting Started

1. Install dependencies:
\`\`\`bash
${installCmd}
\`\`\`

2. Copy environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

3. Start the development server:
\`\`\`bash
${devCmd}
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- \`${devCmd}\` - Start development server
- \`${buildCmd}\` - Build for production
- \`${packageManager} run lint\` - Run linter
- \`${packageManager} run format\` - Format code
- \`${packageManager} run type-check\` - Check TypeScript types

## Project Structure

\`\`\`
${projectName}/
├── apps/
│   └── web/                 # Main application
├── packages/                # Shared packages
├── .env.example            # Environment variables template
└── README.md               # This file
\`\`\`

## Development

This project uses ${answers.monorepoTool === "nx" ? "Nx" : answers.monorepoTool === "turbo" ? "Turborepo" : "npm workspaces"} for monorepo management.

${answers.linter === "biome"
      ? `
### Code Quality

This project uses Biome for linting and formatting:

- \`${packageManager} run lint\` - Check for issues
- \`${packageManager} run lint:fix\` - Fix auto-fixable issues
- \`${packageManager} run format\` - Format code
`
      : ""
    }

## Deployment

Build the project for production:

\`\`\`bash
${buildCmd}
\`\`\`

The application is ready to be deployed to platforms like Vercel, Netlify, or any Node.js hosting service.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
`;
}

/**
 * Create configuration files and documentation
 */
export async function createConfigurationFiles(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  logger.step("Creating configuration files...");

  // Create .env.example file
  const envExample = createEnvExample(answers);
  await fileSystemService.writeFile(
    path.join(projectPath, ".env.example"),
    envExample,
  );

  // Create project README
  const readme = createProjectReadme(projectPath, answers);
  await fileSystemService.writeFile(
    path.join(projectPath, "README.md"),
    readme,
  );

  // Create root package.json
  const rootPackageJson: Record<string, any> = {
    name: path.basename(projectPath),
    version: "0.1.0",
    private: true,
    scripts: {
      dev:
        answers.monorepoTool === "turbo"
          ? "turbo dev"
          : answers.monorepoTool === "nx"
            ? "nx run-many --target=dev"
            : "npm run dev --workspaces",
      build:
        answers.monorepoTool === "turbo"
          ? "turbo build"
          : answers.monorepoTool === "nx"
            ? "nx run-many --target=build"
            : "npm run build --workspaces",
      lint:
        answers.monorepoTool === "turbo"
          ? "turbo lint"
          : answers.monorepoTool === "nx"
            ? "nx run-many --target=lint"
            : "npm run lint --workspaces",
      format:
        answers.linter === "biome"
          ? "biome format --write ."
          : "prettier --write .",
      "type-check": "tsc --noEmit",
    },
    devDependencies: {
      typescript: "^5.3.3",
      "@types/node": "^20.10.5",
    },
  };

  if (answers.monorepoTool !== "none") {
    rootPackageJson.workspaces = ["apps/*", "packages/*"];
  }

  await fileSystemService.writeJson(
    path.join(projectPath, "package.json"),
    rootPackageJson,
  );

  logger.success("Configuration files created");
}

/**
 * Handle directory conflicts with user interaction
 */
export async function resolveDirectoryConflict(
  projectPath: string,
  _projectName: string,
  conflictAction: "cancel" | "remove" | "continue",
): Promise<void> {
  if (!(await fs.pathExists(projectPath))) {
    return; // No conflict
  }

  switch (conflictAction) {
    case "cancel": {
      logger.info(
        "Operation cancelled. Please choose a different project name.",
      );
      process.exit(0);
      // @ts-ignore
      return; // This line is never reached but satisfies the linter
    }
    case "remove": {
      logger.step("Removing existing directory...");
      await fs.remove(projectPath);
      logger.success("Existing directory removed");
      break;
    }
    case "continue": {
      logger.warn("⚠️  Using existing directory. This may cause conflicts.");
      break;
    }
  }
}

/**
 * Project cleanup utility for failed setups
 */
export async function cleanupProject(projectPath: string): Promise<void> {
  if (await fs.pathExists(projectPath)) {
    await fs.remove(projectPath);
    logger.info("Cleaned up partially created project.");
  }
}