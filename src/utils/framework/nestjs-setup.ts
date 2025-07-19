import path from "node:path";
import { execa } from "execa";
import type { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import { NxCliService } from "../core/nx-cli.js";
import type { PackageManagerService } from "../core/package-manager.js";
import type {
	ExecutionContext,
	ProjectAnswers,
	SetupResult,
} from "../types/index.js";

export class NestJsSetupService {
	private nxCliService: NxCliService;

	constructor(
		private fileSystem: FileSystemService,
		private packageManager: PackageManagerService,
	) {
		this.nxCliService = new NxCliService();
	}

	async setup(context: ExecutionContext): Promise<SetupResult> {
		try {
			logger.normal("Setting up NestJS backend");

			if (context.answers.monorepoTool === "nx") {
				return await this.setupWithNx(context);
			}

			return await this.setupStandard(context);
		} catch (error) {
			const message = `Failed to setup NestJS: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	private async setupStandard(context: ExecutionContext): Promise<SetupResult> {
		const { projectPath, appPath, answers } = context;

		// Create NestJS application
		await this.createNestApp(projectPath, answers);

		// Setup database integration if needed
		if (answers.ormDatabase !== "none") {
			await this.setupDatabase(appPath, answers);
		}

		// Setup authentication if needed
		if (answers.authentication !== "none") {
			await this.setupAuthentication(appPath, answers);
		}

		return {
			success: true,
			message: "NestJS backend setup completed successfully!",
		};
	}

	private async setupWithNx(context: ExecutionContext): Promise<SetupResult> {
		const { projectPath, answers } = context;

		logger.normal("Creating NestJS backend with Nx generator");

		try {
			// Generate NestJS application using Nx generator
			await this.nxCliService.runGenerator(
				projectPath,
				{
					generator: "@nx/nest:app",
					name: "api",
					options: {
						"skip-format": true,
					},
				},
				answers.packageManager,
			);

			const appPath = this.fileSystem.resolveBackendPath(projectPath);

			// Create NestJS specific .gitignore
			await this.createNestJsGitignore(appPath);

			// Setup database integration if needed
			if (answers.ormDatabase !== "none") {
				await this.setupDatabase(appPath, answers);
			}

			// Setup authentication if needed
			if (answers.authentication !== "none") {
				await this.setupAuthentication(appPath, answers);
			}

			return {
				success: true,
				message: "NestJS with Nx setup completed successfully!",
			};
		} catch (error) {
			throw new Error(
				`Failed to create NestJS app with Nx: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async createNestApp(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Creating NestJS application");

		const packageManagerFlag = this.getPackageManagerFlag(
			answers.packageManager,
		);

		const createNestArgs = [
			"@nestjs/cli@latest",
			"new",
			"api",
			packageManagerFlag,
			"--skip-git",
			"--skip-install",
		];

		const executeCmd = this.packageManager.getExecuteCommand(
			answers.packageManager,
		);
		const execArgs = executeCmd.split(" ");
		const command = execArgs[0];

		if (!command) {
			throw new Error(`Invalid execute command for ${answers.packageManager}`);
		}

		const createNestProcess = execa(
			command,
			[...execArgs.slice(1), ...createNestArgs],
			{
				cwd: path.join(projectPath, "apps"),
				stdio: ["pipe", "pipe", "pipe"],
				timeout: 300000,
				env: {
					...process.env,
					CI: "true",
					FORCE_COLOR: "0",
				},
			},
		);

		this.attachProcessLogging(createNestProcess);
		await createNestProcess;

		// Update the generated files
		const appPath = this.fileSystem.resolveBackendPath(projectPath);
		await this.customizeNestApp(appPath, answers);

		// Create NestJS specific .gitignore
		await this.createNestJsGitignore(appPath);
	}

	/**
	 * Create NestJS specific .gitignore file
	 */
	private async createNestJsGitignore(appPath: string): Promise<void> {
		const nestJsGitignore = `# NestJS specific
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

# Prisma
prisma/migrations/
!prisma/migrations/.gitkeep

# Uploads
uploads/
`;

		await this.fileSystem.writeFile(
			path.join(appPath, ".gitignore"),
			nestJsGitignore,
		);

		logger.normal("Created NestJS specific .gitignore");
	}

	private async customizeNestApp(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Customizing NestJS application");

		// Update main.ts with CORS and environment configuration
		const mainContent = this.generateMainFile(answers);
		await this.fileSystem.writeFile(
			path.join(appPath, "src/main.ts"),
			mainContent,
		);

		// Create health check controller
		const healthContent = this.generateHealthController();
		await this.fileSystem.writeFile(
			path.join(appPath, "src/health/health.controller.ts"),
			healthContent,
		);

		// Update app.module.ts to include health check
		await this.updateAppModule(appPath, answers);

		// Create environment configuration
		const envContent = this.generateEnvFile(answers);
		await this.fileSystem.writeFile(
			path.join(appPath, ".env.example"),
			envContent,
		);

		// Update package.json scripts
		await this.updatePackageJson(appPath, answers);
	}

	private generateMainFile(answers: ProjectAnswers): string {
		return `import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('${answers.projectName} API')
    .setDescription('API documentation for ${answers.projectName}')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(\`🚀 NestJS server running on http://localhost:\${port}\`);
  console.log(\`📚 API documentation available at http://localhost:\${port}/api/docs\`);
}

bootstrap();
`;
	}

	private generateHealthController(): string {
		return `import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
`;
	}

	private async updateAppModule(
		appPath: string,
		_answers: ProjectAnswers,
	): Promise<void> {
		const appModuleContent = `import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Add your feature modules here
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src/app.module.ts"),
			appModuleContent,
		);
	}

	private async updatePackageJson(
		appPath: string,
		_answers: ProjectAnswers,
	): Promise<void> {
		// Add additional dependencies
		const additionalDeps = {
			"@nestjs/config": "^3.1.1",
			"@nestjs/swagger": "^7.1.17",
			"class-validator": "^0.14.0",
			"class-transformer": "^0.5.1",
		};

		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				dependencies: additionalDeps,
			},
		);
	}

	private generateEnvFile(answers: ProjectAnswers): string {
		let envContent = `# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key

`;

		if (answers.ormDatabase !== "none") {
			if (answers.databaseProvider === "neon") {
				envContent += `# Neon Database
DATABASE_URL="postgresql://username:password@host/database"

`;
			} else if (answers.databaseProvider === "supabase") {
				envContent += `# Supabase Database
DATABASE_URL="postgresql://postgres:password@db.supabase.co:5432/postgres"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

`;
			}
		}

		return envContent;
	}

	private async setupDatabase(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal(`Setting up ${answers.ormDatabase} with NestJS`);

		if (answers.ormDatabase === "prisma") {
			await this.setupPrisma(appPath, answers);
		} else if (answers.ormDatabase === "drizzle") {
			await this.setupDrizzle(appPath, answers);
		}
	}

	private async setupPrisma(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		// Add Prisma dependencies
		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				dependencies: {
					"@prisma/client": "^5.7.0",
				},
				devDependencies: {
					prisma: "^5.7.0",
				},
			},
		);

		// Initialize Prisma
		try {
			const provider = "postgresql";
			const executeCmd = this.packageManager.getExecuteCommand(
				answers.packageManager,
			);
			const execArgs = executeCmd.split(" ");
			const command = execArgs[0];

			if (!command) {
				throw new Error(
					`Invalid execute command for ${answers.packageManager}`,
				);
			}

			await execa(
				command,
				[
					...execArgs.slice(1),
					"prisma",
					"init",
					"--datasource-provider",
					provider,
				],
				{
					cwd: appPath,
					stdio: "pipe",
				},
			);
		} catch (_error) {
			logger.warn("Prisma init failed, creating basic schema");
		}

		// Create Prisma service
		const prismaService = `import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
`;

		await this.fileSystem.ensureDirectory(path.join(appPath, "src/prisma"));
		await this.fileSystem.writeFile(
			path.join(appPath, "src/prisma/prisma.service.ts"),
			prismaService,
		);
	}

	private async setupDrizzle(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		// Add Drizzle dependencies
		const deps = {
						"drizzle-orm": "^0.29.0",
						postgres: "^3.4.3",
					};

		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				dependencies: deps,
				devDependencies: {
					"drizzle-kit": "^0.20.6",
				},
			},
		);

		// Create database directory and schema
		await this.fileSystem.ensureDirectory(path.join(appPath, "src/db"));

		const schemaContent =`import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src/db/schema.ts"),
			schemaContent,
		);

		// Create Drizzle service
		const drizzleService =`import { Injectable } from '@nestjs/common';
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

@Injectable()
export class DrizzleService {
  private client = postgres(process.env.DATABASE_URL!);
  public db = drizzle(this.client);
}
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src/db/drizzle.service.ts"),
			drizzleService,
		);

		// Create Drizzle config
		const drizzleConfig =`import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "drizzle.config.ts"),
			drizzleConfig,
		);
	}

	private async setupAuthentication(
		appPath: string,
		_answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Setting up authentication with NestJS");

		// Add authentication dependencies
		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				dependencies: {
					"@nestjs/jwt": "^10.2.0",
					"@nestjs/passport": "^10.0.2",
					passport: "^0.7.0",
					"passport-jwt": "^4.0.1",
					"passport-local": "^1.0.0",
					bcrypt: "^5.1.1",
				},
				devDependencies: {
					"@types/passport-jwt": "^3.0.13",
					"@types/passport-local": "^1.0.38",
					"@types/bcrypt": "^5.0.2",
				},
			},
		);

		// Create auth module structure
		await this.fileSystem.ensureDirectory(path.join(appPath, "src/auth"));

		// Create basic auth service
		const authService = `import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async validateUser(email: string, password: string): Promise<any> {
    // Implement user validation logic here
    // This is a placeholder implementation
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(email: string, password: string, name?: string) {
    // Implement user registration logic here
    // This is a placeholder implementation
    const hashedPassword = await bcrypt.hash(password, 10);
    return { email, hashedPassword, name };
  }
}
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src/auth/auth.service.ts"),
			authService,
		);

		// Create auth controller
		const authController = `import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(@Body() loginDto: { email: string; password: string }) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  async register(@Body() registerDto: { email: string; password: string; name?: string }) {
    return this.authService.register(registerDto.email, registerDto.password, registerDto.name);
  }
}
`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src/auth/auth.controller.ts"),
			authController,
		);
	}

	private getPackageManagerFlag(packageManager: string): string {
		switch (packageManager) {
			case "yarn":
				return "--package-manager=yarn";
			case "pnpm":
				return "--package-manager=pnpm";
			case "bun":
				return "--package-manager=npm"; // Fallback to npm for NestJS CLI
			default:
				return "--package-manager=npm";
		}
	}

	private attachProcessLogging(process: any): void {
		process.stdout?.on("data", (data: any) => {
			logger.package(data.toString().trim());
		});

		process.stderr?.on("data", (data: any) => {
			logger.error(data.toString().trim());
		});
	}
}