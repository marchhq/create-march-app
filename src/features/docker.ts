import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";

const fileSystemService = new FileSystemService();

/**
 * Setup Docker configuration
 */
export async function setupDocker(projectPath: string): Promise<void> {
	logger.step("Setting up Docker configuration...");

	const dockerfile = `FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]`;

	await fileSystemService.writeFile(
		path.join(projectPath, "Dockerfile"),
		dockerfile,
	);

	const dockerignore = `node_modules
.next
.git
*.md
Dockerfile
.dockerignore`;

	await fileSystemService.writeFile(
		path.join(projectPath, ".dockerignore"),
		dockerignore,
	);

	// Create docker-compose for development
	const dockerCompose = `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
`;

	await fileSystemService.writeFile(
		path.join(projectPath, "docker-compose.yml"),
		dockerCompose,
	);

	logger.success("Docker configuration created");
}