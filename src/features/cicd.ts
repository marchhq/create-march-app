import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();

/**
 * Setup GitHub Actions CI/CD
 */
export async function setupGithubActions(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  logger.step("Setting up GitHub Actions...");

  await fileSystemService.ensureDirectory(
    path.join(projectPath, ".github", "workflows"),
  );

  // Build testing steps based on selected tools
  const testingSteps = createTestingSteps(answers);

  const ciWorkflow = `name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: '${answers.packageManager}'
    
    - name: Install dependencies
      run: ${answers.packageManager} install

    - name: Run linter
      run: ${answers.packageManager} run lint
    
    - name: Run type check
      run: ${answers.packageManager} run type-check
    ${testingSteps.unitTests}
    - name: Build
      run: ${answers.packageManager} run build`;

  await fileSystemService.writeFile(
    path.join(projectPath, ".github", "workflows", "ci.yml"),
    ciWorkflow,
  );

  // Create deployment workflow for Vercel
  const deployWorkflow = `name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: \${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: \${{ secrets.ORG_ID }}
        vercel-project-id: \${{ secrets.PROJECT_ID }}
        vercel-args: '--prod'`;

  await fileSystemService.writeFile(
    path.join(projectPath, ".github", "workflows", "deploy.yml"),
    deployWorkflow,
  );

  logger.success("GitHub Actions setup completed");
}

/**
 * Create testing steps for CI workflow based on selected testing tools
 */
function createTestingSteps(answers: ProjectAnswers): {
  unitTests: string;
} {
  const hasJest = answers.testingTools.includes("jest");

  let unitTests = "";



  // Add unit testing step if Jest or React Testing Library is selected
  if (hasJest) {
    unitTests = `
    - name: Run unit tests
      run: ${answers.packageManager} run test
    `;
  }

  return {
    unitTests,
  };
}