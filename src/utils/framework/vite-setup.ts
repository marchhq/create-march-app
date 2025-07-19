import path from "node:path";
import { BiomeConfigGenerator } from "../config/biome.js";
import { TailwindConfigGenerator } from "../config/tailwind.js";
import { TRPCConfigGenerator } from "../config/trpc.js";
import type { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import { NxCliService } from "../core/nx-cli.js";
import type { PackageManagerService } from "../core/package-manager.js";
import { UILibrarySetupService } from "../frontend/ui-library.js";
import type {
	ExecutionContext,
	ProjectAnswers,
	SetupResult,
} from "../types/index.js";

export class ViteSetupService {
	private uiLibraryService: UILibrarySetupService;
	private nxCliService: NxCliService;

	constructor(
		private fileSystem: FileSystemService,
		private packageManager: PackageManagerService,
	) {
		this.uiLibraryService = new UILibrarySetupService();
		this.nxCliService = new NxCliService();
	}

	async setup(context: ExecutionContext): Promise<SetupResult> {
		try {
			logger.step("Starting Vite setup...");

			if (context.answers.monorepoTool === "nx") {
				return await this.setupWithNx(context);
			}

			return await this.setupStandard(context);
		} catch (error) {
			const message = `Failed to setup Vite: ${error instanceof Error ? error.message : String(error)}`;
			logger.error(message);
			return { success: false, message };
		}
	}

	private async setupStandard(context: ExecutionContext): Promise<SetupResult> {
		const { projectPath, answers } = context;
		const warnings: string[] = [];

		// Create apps directory
		await this.fileSystem.ensureDirectory(path.join(projectPath, "apps"));
		logger.success("Apps directory created");

		// Create Vite app
		await this.createViteApp(context);

		const appPath = this.fileSystem.resolveAppPath(projectPath);

		// Install additional dependencies
		await this.installAdditionalDependencies(appPath, answers);

		// Setup Tailwind CSS
		await this.setupTailwind(appPath, answers);

		// Update package.json
		await this.updatePackageJson(appPath, answers);

		// Setup additional tools
		if (answers.linter === "biome") {
			await this.setupBiome(appPath, answers);
		}

		// Add UI library as dependency if using shadcn
		if (answers.useShadcn) {
			await this.addUILibraryDependency(appPath, answers);
		}

		if (answers.useTRPC) {
			await this.setupTRPC(appPath, answers);
		}

		logger.party("Vite setup completed successfully!");
		return {
			success: true,
			message: "Vite setup completed successfully!",
			...(warnings.length > 0 && { warnings }),
		};
	}

	private async setupWithNx(context: ExecutionContext): Promise<SetupResult> {
		const { projectPath, answers } = context;

		logger.rocket("Creating React/Vite app with Nx generator...");

		try {
			// Generate React/Vite application using Nx generator
			await this.nxCliService.runGenerator(
				projectPath,
				{
					generator: "@nx/react:app",
					name: "web",
					options: {
						style: "css",
						bundler: "vite",
						linter: answers.linter === "biome" ? "none" : "eslint",
						e2eTestRunner: "cypress",
						"skip-format": true,
					},
				},
				answers.packageManager,
			);

			logger.success("React/Vite app created with Nx");

			const appPath = this.fileSystem.resolveAppPath(projectPath);

			// Setup additional features
			const warnings: string[] = [];

			// Add UI library as dependency if using shadcn
			if (answers.useShadcn) {
				await this.addUILibraryDependency(appPath, answers);
			}

			if (answers.useTRPC) {
				await this.setupTRPC(appPath, answers);
			}

			logger.party("React/Vite with Nx setup completed successfully!");
			return {
				success: true,
				message: "React/Vite with Nx setup completed successfully!",
				...(warnings.length > 0 && { warnings }),
			};
		} catch (error) {
			throw new Error(
				`Failed to create React/Vite app with Nx: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async createViteApp(context: ExecutionContext): Promise<void> {
		const { projectPath, answers } = context;

		logger.rocket(
			`Creating Vite app with ${answers.useTypeScript ? "TypeScript" : "JavaScript"}...`,
		);

		const template = answers.useTypeScript ? "react-ts" : "react";

		// Create Vite app manually from template
		await this.createViteAppFromTemplate(projectPath, answers, template);

		// Create Vite specific .gitignore
		const appPath = this.fileSystem.resolveAppPath(projectPath);
		await this.createViteGitignore(appPath);

		logger.success("Vite app created successfully");
	}

	private async createViteAppFromTemplate(
		projectPath: string,
		answers: ProjectAnswers,
		_template: string,
	): Promise<void> {
		const appPath = path.join(projectPath, "apps", "web");

		// Create directory structure
		await this.fileSystem.ensureDirectory(appPath);
		await this.fileSystem.ensureDirectory(path.join(appPath, "src"));
		await this.fileSystem.ensureDirectory(path.join(appPath, "public"));

		// Create package.json
		const packageJson = {
			name: "web",
			private: true,
			version: "0.0.0",
			type: "module",
			scripts: {
				dev: "vite",
				build: "vite build",
				lint: "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
				preview: "vite preview",
			},
			dependencies: {
				react: "^18.3.1",
				"react-dom": "^18.3.1",
			},
			devDependencies: {
				"@types/react": "^18.3.3",
				"@types/react-dom": "^18.3.0",
				"@vitejs/plugin-react": "^4.3.1",
				eslint: "^8.57.0",
				"eslint-plugin-react-hooks": "^4.6.2",
				"eslint-plugin-react-refresh": "^0.4.7",
				vite: "^5.3.4",
			},
		};

		if (answers.useTypeScript) {
			(packageJson.devDependencies as Record<string, string>).typescript =
				"^5.2.2";
		}

		await this.fileSystem.writeFile(
			path.join(appPath, "package.json"),
			JSON.stringify(packageJson, null, 2),
		);

		// Create vite.config.ts/js
		const viteConfig = answers.useTypeScript
			? `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`
			: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`;

		const configFileName = answers.useTypeScript
			? "vite.config.ts"
			: "vite.config.js";
		await this.fileSystem.writeFile(
			path.join(appPath, configFileName),
			viteConfig,
		);

		// Create TypeScript config if needed
		if (answers.useTypeScript) {
			const tsConfig = {
				compilerOptions: {
					target: "ES2020",
					useDefineForClassFields: true,
					lib: ["ES2020", "DOM", "DOM.Iterable"],
					module: "ESNext",
					skipLibCheck: true,
					moduleResolution: "bundler",
					allowImportingTsExtensions: true,
					resolveJsonModule: true,
					isolatedModules: true,
					noEmit: true,
					jsx: "react-jsx",
					strict: true,
					noUnusedLocals: true,
					noUnusedParameters: true,
					noFallthroughCasesInSwitch: true,
				},
				include: ["src"],
				references: [{ path: "./tsconfig.node.json" }],
			};

			await this.fileSystem.writeFile(
				path.join(appPath, "tsconfig.json"),
				JSON.stringify(tsConfig, null, 2),
			);

			const tsConfigNode = {
				compilerOptions: {
					composite: true,
					skipLibCheck: true,
					module: "ESNext",
					moduleResolution: "bundler",
					allowSyntheticDefaultImports: true,
				},
				include: ["vite.config.ts"],
			};

			await this.fileSystem.writeFile(
				path.join(appPath, "tsconfig.node.json"),
				JSON.stringify(tsConfigNode, null, 2),
			);
		}

		// Create main App component
		const appComponent = answers.useTypeScript
			? `import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App`
			: `import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App`;

		const appFileName = answers.useTypeScript ? "App.tsx" : "App.jsx";
		await this.fileSystem.writeFile(
			path.join(appPath, "src", appFileName),
			appComponent,
		);

		// Create main.tsx/jsx
		const mainFile = answers.useTypeScript
			? `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`
			: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`;

		const mainFileName = answers.useTypeScript ? "main.tsx" : "main.jsx";
		await this.fileSystem.writeFile(
			path.join(appPath, "src", mainFileName),
			mainFile,
		);

		// Create index.html
		const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/${mainFileName}"></script>
  </body>
</html>`;

		await this.fileSystem.writeFile(
			path.join(appPath, "index.html"),
			indexHtml,
		);

		// Create CSS files
		const indexCss = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  font-weight: 500;
  color: #646cff;
  text-decoration: inherit;
}
a:hover {
  color: #535bf2;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: inherit;
  transition: border-color 0.25s;
}
button:hover {
  border-color: #646cff;
}
button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  a:hover {
    color: #747bff;
  }
  button {
    background-color: #f9f9f9;
  }
}`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "index.css"),
			indexCss,
		);

		const appCss = `#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.react:hover {
  filter: drop-shadow(0 0 2em #61dafbaa);
}

@keyframes logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  a:nth-of-type(2) .logo {
    animation: logo-spin infinite 20s linear;
  }
}

.card {
  padding: 2em;
}

.read-the-docs {
  color: #888;
}`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "App.css"),
			appCss,
		);

		// Create assets directory and React logo
		await this.fileSystem.ensureDirectory(path.join(appPath, "src", "assets"));

		const reactSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="35.93" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 228"><path fill="#00D8FF" d="M210.483 73.824a171.49 171.49 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171.23 171.23 0 0 0-6.375 5.848a155.866 155.866 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a170.974 170.974 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a145.52 145.52 0 0 0 6.921 2.165a167.467 167.467 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a145.567 145.567 0 0 0 5.342-4.923a168.064 168.064 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145.016 145.016 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844Zm-6.365 70.984c-1.4.463-2.836.91-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14Zm-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a156.726 156.726 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345a134.17 134.17 0 0 1 1.386 6.193ZM87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a156.923 156.923 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a134.668 134.668 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94ZM50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a134.718 134.718 0 0 1-6.318-1.979Zm12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144.318 144.318 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160.342 160.342 0 0 1-1.76-7.887Zm110.427 27.268a347.8 347.8 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381.151 381.151 0 0 0-7.365-13.322Zm-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322.04 322.04 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18ZM82.802 87.83a323.167 323.167 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a321.524 321.524 0 0 0-7.848 12.897Zm8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321.187 321.187 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147Zm37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486Zm52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382.417 382.417 0 0 0 7.859-13.026a347.403 347.403 0 0 0 7.425-13.565Zm-16.898 8.101a358.557 358.557 0 0 1-12.281 19.815a329.4 329.4 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310.202 310.202 0 0 1-12.513-19.846h.001a307.41 307.41 0 0 1-10.923-20.627a310.278 310.278 0 0 1 10.89-20.637l-.001.001a307.318 307.318 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329.357 329.357 0 0 1 12.335 19.695a358.489 358.489 0 0 1 11.036 20.54a329.472 329.472 0 0 1-11 20.722Zm22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026c-.344 1.668-.73 3.367-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a160.789 160.789 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3ZM128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86Z"></path></svg>`;

		await this.fileSystem.writeFile(
			path.join(appPath, "src", "assets", "react.svg"),
			reactSvg,
		);

		// Create Vite logo in public directory
		const viteSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>`;

		await this.fileSystem.writeFile(
			path.join(appPath, "public", "vite.svg"),
			viteSvg,
		);

		// Create ESLint config if not using TypeScript
		if (!answers.useTypeScript) {
			const eslintConfig = `module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}`;

			await this.fileSystem.writeFile(
				path.join(appPath, ".eslintrc.cjs"),
				eslintConfig,
			);
		}

		// Install dependencies
		const dependencies = ["react", "react-dom"];
		const devDependencies = [
			"@types/react",
			"@types/react-dom",
			"@vitejs/plugin-react",
			"eslint",
			"eslint-plugin-react-hooks",
			"eslint-plugin-react-refresh",
			"vite",
		];

		if (answers.useTypeScript) {
			devDependencies.push("typescript");
		}

		await this.packageManager.installPackages(
			dependencies,
			answers.packageManager,
			{ cwd: appPath },
		);

		await this.packageManager.installPackages(
			devDependencies,
			answers.packageManager,
			{ cwd: appPath, dev: true },
		);
	}

	/**
	 * Create Vite specific .gitignore file
	 */
	private async createViteGitignore(appPath: string): Promise<void> {
		const viteGitignore = `# Vite specific
dist/
dist-ssr/

# Development
.vite/

# Build
build/

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

# Storybook
storybook-static/
`;

		await this.fileSystem.writeFile(
			path.join(appPath, ".gitignore"),
			viteGitignore,
		);

		logger.normal("Created Vite specific .gitignore");
	}

	private async installAdditionalDependencies(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.package("Installing additional dependencies...");

		const dependencies = TailwindConfigGenerator.getDependencies("vite");
		const devDeps = [...dependencies.dev, "@types/react", "@types/react-dom"];

		await this.packageManager.installPackages(devDeps, answers.packageManager, {
			cwd: appPath,
			dev: true,
			timeout: 180000,
		});

		logger.success("Dependencies installed successfully");
	}

	private async setupTailwind(
		appPath: string,
		_answers: ProjectAnswers,
	): Promise<void> {
		logger.art("Setting up Tailwind CSS...");

		// Update vite.config.ts to include Tailwind CSS v4 plugin
		await this.updateViteConfig(appPath);

		// Update CSS file with Tailwind v4 imports
		const cssContent = TailwindConfigGenerator.generateCSS("vite");
		await this.fileSystem.writeFile(
			path.join(appPath, "src/index.css"),
			cssContent,
		);

		// Create tailwind.config.js for v4 (optional customization)
		const tailwindConfig = TailwindConfigGenerator.generateConfig("vite");
		await this.fileSystem.writeFile(
			path.join(appPath, "tailwind.config.js"),
			tailwindConfig,
		);

		logger.success("Tailwind CSS setup complete");
	}

	private async updateViteConfig(appPath: string): Promise<void> {
		const viteConfigPath = path.join(appPath, "vite.config.ts");

		let viteConfig: string;
		try {
			viteConfig = await this.fileSystem.readFile(viteConfigPath);
		} catch {
			// Fallback config if file doesn't exist
			viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})`;
		}

		// Add Tailwind CSS v4 plugin
		const tailwindImport = TailwindConfigGenerator.getVitePluginImport();
		const tailwindPlugin = TailwindConfigGenerator.getVitePluginUsage();

		const updatedViteConfig = viteConfig
			.replace(
				/import react from '@vitejs\/plugin-react'/,
				`import react from '@vitejs/plugin-react'\n${tailwindImport}`,
			)
			.replace(
				/plugins: \[react\(\)\]/,
				`plugins: [react(), ${tailwindPlugin}]`,
			);

		await this.fileSystem.writeFile(viteConfigPath, updatedViteConfig);
	}

	private async updatePackageJson(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.config("Updating package.json...");

		const additionalScripts =
			answers.linter === "biome"
				? BiomeConfigGenerator.generateScripts(answers.packageManager)
				: {
						lint: "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
						"lint:fix": "eslint . --ext ts,tsx --fix",
						format: "prettier --write .",
						"format:check": "prettier --check .",
					};

		const baseScripts = {
			"type-check": "tsc --noEmit",
			"dev:clean": "rm -rf dist && npm run dev",
			"build:analyze": "npm run build -- --mode analyze",
		};

		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				scripts: { ...additionalScripts, ...baseScripts },
			},
		);

		logger.success("Package.json updated");
	}

	private async setupBiome(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.art("Setting up Biome for Vite...");

		await this.packageManager.installPackages(
			["@biomejs/biome"],
			answers.packageManager,
			{ cwd: appPath, dev: true },
		);

		const biomeConfig = BiomeConfigGenerator.generateForFramework("vite");
		await this.fileSystem.writeJson(
			path.join(appPath, "biome.json"),
			biomeConfig,
		);

		logger.success("Biome for Vite setup complete");
	}

	/**
	 * Add UI library as dependency to the Vite app
	 */
	private async addUILibraryDependency(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		await this.uiLibraryService.addUILibraryToApp(appPath, answers);
	}

	private async setupTRPC(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.link("Setting up tRPC...");

		const dependencies = TRPCConfigGenerator.getDependencies();
		await this.packageManager.installPackages(
			dependencies,
			answers.packageManager,
			{ cwd: appPath },
		);

		const filePaths = TRPCConfigGenerator.getFilePaths("vite");

		// Ensure server directory exists
		await this.fileSystem.ensureDirectory(path.join(appPath, "src/server"));

		// Create tRPC config
		const trpcConfig = TRPCConfigGenerator.generateTRPCConfig("vite");
		await this.fileSystem.writeFile(
			path.join(appPath, filePaths.trpcConfig),
			trpcConfig,
		);

		// Create client config
		const clientConfig = TRPCConfigGenerator.generateClientConfig("vite");
		await this.fileSystem.writeFile(
			path.join(appPath, "src/api.ts"),
			clientConfig,
		);

		// Create provider config
		const providerConfig = TRPCConfigGenerator.generateProviderConfig("vite");
		await this.fileSystem.writeFile(
			path.join(appPath, "src/trpc-provider.tsx"),
			providerConfig,
		);

		logger.success("tRPC setup complete");
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