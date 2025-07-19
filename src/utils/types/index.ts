export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
export type MonorepoTool = "nx" | "turbo" | "none";
export type LinterType = "eslint-prettier" | "biome" | "none";
export type Frontend =
  | "nextjs-app"
  | "nextjs-pages"
  | "vite"
  | "react-vanilla"
  | "remix"
  | "astro"
  | "none";
export type BackendAPI = "trpc" | "nestjs" | "graphql-apollo" | "none";
export type UIComponents = "shadcn" | "tailwind-only" | "none";
export type ORMDatabase = "prisma" | "drizzle" | "none";
export type DatabaseProvider = "neon" | "supabase" | "none";
export type Authentication = "nextauth" | "none";
export type Payments = "stripe" | "none";
export type TestingTools =
  | "jest"
  | "none";
export type CICDDevOps = "github-actions" | "docker" | "none";
export type DeveloperExperience = "husky" | "commitlint" | "none";
export type UITools =
  | "storybook"
  | "none";
export type RealtimeCollaboration = "liveblocks" | "none";

export interface ProjectAnswers {
  projectName: string;
  packageManager: PackageManager;
  monorepoTool: MonorepoTool;
  frontend: Frontend;
  backendAPI: BackendAPI;
  uiComponents: UIComponents;
  ormDatabase: ORMDatabase;
  databaseProvider: DatabaseProvider;
  authentication: Authentication;
  payments: Payments;
  testingTools: TestingTools[];
  cicdDevOps: CICDDevOps[];
  linter: LinterType;
  developerExperience: DeveloperExperience[];
  uiTools: UITools;
  progressiveWebApp: boolean;
  realtimeCollaboration: RealtimeCollaboration;
  useTypeScript: boolean;
  useTailwind?: boolean;
  useShadcn?: boolean;
  useTRPC?: boolean;
  appRouter?: boolean;
  features?: string[];
  database?: string;
  baseColor?: string;
}

export interface PackageInstallOptions {
  cwd?: string;
  dev?: boolean;
  packageManager?: PackageManager;
  timeout?: number;
}

export interface ExecutionContext {
  projectPath: string;
  appPath: string;
  answers: ProjectAnswers;
}

export interface SetupResult {
  success: boolean;
  message: string;
  warnings?: string[];
}

export interface FrameworkSetupConfig {
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  configFiles: ConfigFile[];
}

export interface ConfigFile {
  path: string;
  content: string;
  overwrite?: boolean;
}

export interface BiomeConfig {
  $schema: string;
  vcs: {
    enabled: boolean;
    clientKind: string;
    useIgnoreFile: boolean;
  };
  files: {
    include: string[];
    ignore: string[];
  };
  formatter: {
    enabled: boolean;
    formatWithErrors: boolean;
    indentStyle: string;
    indentWidth: number;
    lineWidth: number;
    lineEnding: string;
  };
  organizeImports: {
    enabled: boolean;
  };
  linter: {
    enabled: boolean;
    rules: Record<string, any>;
  };
  javascript: {
    formatter: Record<string, any>;
    globals?: string[];
  };
  overrides?: Array<{
    include: string[];
    linter: {
      rules: Record<string, any>;
    };
  }>;
}