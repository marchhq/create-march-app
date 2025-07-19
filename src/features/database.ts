import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import { PackageManagerService } from "../utils/core/package-manager.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();
const packageManagerService = new PackageManagerService();

/**
 * Setup database configuration
 */
export async function setupDatabase(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  logger.step("Setting up database configuration...");

  // Handle "none" option - skip database setup entirely
  if (answers.ormDatabase === "none" || answers.databaseProvider === "none") {
    logger.info("Skipping database setup (none selected)");
    return;
  }

  if (answers.ormDatabase === "prisma") {
    await setupPrisma(projectPath, answers);
  } else if (answers.ormDatabase === "drizzle") {
    await setupDrizzle(projectPath, answers);
  }

  // Create provider-specific environment file template
  await createEnvironmentTemplate(projectPath, answers);

  logger.success("Database configuration completed");
}

/**
 * Create environment template with provider-specific configurations
 */
async function createEnvironmentTemplate(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  const appPath = fileSystemService.resolveAppPath(projectPath);
  const envExamplePath = path.join(appPath, ".env.example");

  let envContent = "";

  switch (answers.databaseProvider) {
    case "neon":
      envContent = `# Neon Database Configuration
# Get your connection string from: https://console.neon.tech/
# Format: postgresql://[user]:[password]@[endpoint]/[dbname]?sslmode=require
DATABASE_URL="postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"

# Optional: Direct URL for migrations (Prisma only)
DIRECT_URL="postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
`;
      break;

    case "supabase":
      envContent = `# Supabase Database Configuration
# Get your connection string from: https://app.supabase.com/project/_/settings/database
# Use the "Connection string" from the Database settings (not the pooled connection)
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Optional: Pooled connection for serverless environments
# DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Supabase API Configuration (if using Supabase auth/storage)
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
`;
      break;


    default:
      envContent = `# Database Configuration
# Replace with your database connection string
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
`;
  }

  await fileSystemService.writeFile(envExamplePath, envContent);
  logger.info(
    `Created .env.example with ${answers.databaseProvider} configuration`,
  );
}

/**
 * Create provider-specific Prisma schema
 */
function createPrismaSchema(databaseProvider: string): string {
  // PostgreSQL-specific schema (Neon, Supabase, etc.)
  const directUrlComment =
    databaseProvider === "neon"
      ? `  // Neon uses connection pooling, directUrl is recommended for migrations
  directUrl = env("DIRECT_URL")`
      : "";

  const providerComment =
    databaseProvider === "supabase"
      ? `// Supabase uses PostgreSQL with some extensions enabled by default`
      : databaseProvider === "neon"
        ? `// Neon serverless PostgreSQL database`
        : `// PostgreSQL database configuration`;

  return `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema
${providerComment}

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")${directUrlComment}
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}
`;
}

/**
 * Setup Prisma ORM manually without CLI
 */
async function setupPrisma(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  logger.step("Configuring Prisma...");

  const appPath = fileSystemService.resolveAppPath(projectPath);

  try {
    // Install Prisma dependencies
    await packageManagerService.installPackages(
      ["@prisma/client"],
      answers.packageManager,
      { cwd: appPath },
    );

    await packageManagerService.installPackages(
      ["prisma"],
      answers.packageManager,
      { cwd: appPath, dev: true },
    );

    // Create prisma directory and schema
    await fileSystemService.ensureDirectory(path.join(appPath, "prisma"));

    const schemaContent = createPrismaSchema(answers.databaseProvider);
    await fileSystemService.writeFile(
      path.join(appPath, "prisma", "schema.prisma"),
      schemaContent,
    );

    // Create Prisma client configuration
    const prismaClient = `import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
`;

    await fileSystemService.ensureDirectory(path.join(appPath, "src/lib"));
    await fileSystemService.writeFile(
      path.join(appPath, "src/lib/prisma.ts"),
      prismaClient,
    );

    logger.success("Prisma initialized");
    logger.info(
      "Run 'npx prisma generate' after setup to generate the Prisma client",
    );
  } catch (error) {
    throw new Error(
      `Failed to initialize Prisma: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create provider-specific Drizzle schema
 */
function createDrizzleSchema(databaseProvider: string): string {
  const comment =
    databaseProvider === "neon"
      ? "// Neon serverless PostgreSQL with Drizzle ORM"
      : databaseProvider === "supabase"
        ? "// Supabase PostgreSQL with Drizzle ORM"
        : "// PostgreSQL with Drizzle ORM";

  return `${comment}
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
`;
}

/**
 * Create provider-specific Drizzle config
 */
function createDrizzleConfig(databaseProvider: string): string {
  return `import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
`;
}

/**
 * Create provider-specific Drizzle client
 */
function createDrizzleClient(databaseProvider: string): string {
  const comment =
    databaseProvider === "neon"
      ? "// Neon serverless PostgreSQL connection"
      : databaseProvider === "supabase"
        ? "// Supabase PostgreSQL connection"
        : "// PostgreSQL connection";

  return `${comment}
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);
`;
}

/**
 * Setup Drizzle ORM using drizzle-kit CLI
 */
async function setupDrizzle(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  logger.step("Configuring Drizzle using CLI...");

  const appPath = fileSystemService.resolveAppPath(projectPath);

  try {
    // Create Drizzle schema directory
    await fileSystemService.ensureDirectory(path.join(appPath, "src/db"));

    // Create Drizzle schema
    const drizzleSchema = createDrizzleSchema(answers.databaseProvider);
    await fileSystemService.writeFile(
      path.join(appPath, "src/db/schema.ts"),
      drizzleSchema,
    );

    // Create Drizzle config file using drizzle-kit patterns
    const drizzleConfig = createDrizzleConfig(answers.databaseProvider);
    await fileSystemService.writeFile(
      path.join(appPath, "drizzle.config.ts"),
      drizzleConfig,
    );

    // Create Drizzle client configuration
    const drizzleClient = createDrizzleClient(answers.databaseProvider);

    await fileSystemService.writeFile(
      path.join(appPath, "src/db/index.ts"),
      drizzleClient,
    );

    logger.success("Drizzle initialized with CLI patterns");
  } catch (error) {
    throw new Error(
      `Failed to initialize Drizzle: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}