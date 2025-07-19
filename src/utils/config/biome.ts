/** biome-ignore-all lint/complexity/noThisInStatic: <explanation> */
/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation> */

import { PackageManagerService } from "../core/package-manager.js";
import type { BiomeConfig, Frontend, PackageManager } from "../types/index.js";

export class BiomeConfigGenerator {
	static generateForFramework(framework: Frontend): BiomeConfig {
		const baseConfig: BiomeConfig = {
			$schema: "https://biomejs.dev/schemas/1.8.3/schema.json",
			vcs: {
				enabled: true,
				clientKind: "git",
				useIgnoreFile: true,
			},
			files: {
				include: ["src/**/*.{js,jsx,ts,tsx}", "*.{js,jsx,ts,tsx}"],
				ignore: ["node_modules/**", "dist/**", "build/**", "*.d.ts"],
			},
			formatter: {
				enabled: true,
				formatWithErrors: false,
				indentStyle: "space",
				indentWidth: 2,
				lineWidth: 100,
				lineEnding: "lf",
			},
			organizeImports: {
				enabled: true,
			},
			linter: {
				enabled: true,
				rules: {
					recommended: true,
					correctness: {
						useExhaustiveDependencies: "warn",
						useHookAtTopLevel: "error",
					},
					a11y: {
						useKeyWithClickEvents: "error",
						useKeyWithMouseEvents: "error",
						noSvgWithoutTitle: "warn",
						useAltText: "error",
					},
					performance: {
						noAccumulatingSpread: "warn",
					},
					security: {
						noDangerouslySetInnerHtml: "error",
					},
					style: {
						useImportType: "error",
						useConst: "error",
						useTemplate: "error",
					},
					suspicious: {
						noExplicitAny: "warn",
						noConsoleLog: "warn",
						useAwait: "error",
					},
				},
			},
			javascript: {
				formatter: {
					jsxQuoteStyle: "double",
					quoteProperties: "asNeeded",
					trailingComma: "es5",
					semicolons: "always",
					arrowParentheses: "always",
					bracketSpacing: true,
					bracketSameLine: false,
					quoteStyle: "double",
				},
				globals: ["React", "JSX"],
			},
		};

		// Framework-specific customizations
		switch (framework) {
			case "nextjs-app":
			case "nextjs-pages":
				return this.customizeForNextJs(baseConfig);
			case "vite":
			case "react-vanilla":
				return this.customizeForVite(baseConfig);
			case "remix":
				return this.customizeForRemix(baseConfig);
			case "astro":
				return this.customizeForAstro(baseConfig);
			default:
				return baseConfig;
		}
	}

	private static customizeForNextJs(config: BiomeConfig): BiomeConfig {
		return {
			...config,
			files: {
				...config.files,
				include: [
					...config.files.include,
					"pages/**/*.{js,jsx,ts,tsx}",
					"app/**/*.{js,jsx,ts,tsx}",
					"components/**/*.{js,jsx,ts,tsx}",
					"lib/**/*.{js,jsx,ts,tsx}",
					"utils/**/*.{js,jsx,ts,tsx}",
				],
				ignore: [
					...config.files.ignore,
					".next/**",
					"out/**",
					"next.config.js",
					"tailwind.config.js",
					"postcss.config.js",
				],
			},
			overrides: [
				{
					include: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
					linter: {
						rules: {
							suspicious: {
								noConsoleLog: "off",
							},
						},
					},
				},
				{
					include: ["next.config.{js,ts}", "tailwind.config.{js,ts}"],
					linter: {
						rules: {
							style: {
								useImportType: "off",
							},
						},
					},
				},
			],
		};
	}

	private static customizeForVite(config: BiomeConfig): BiomeConfig {
		return {
			...config,
			files: {
				...config.files,
				ignore: [
					...config.files.ignore,
					"vite.config.{js,ts}",
					"vitest.config.{js,ts}",
				],
			},
		};
	}

	private static customizeForRemix(config: BiomeConfig): BiomeConfig {
		return {
			...config,
			files: {
				...config.files,
				include: [
					...config.files.include,
					"app/**/*.{js,jsx,ts,tsx}",
					"app/routes/**/*.{js,jsx,ts,tsx}",
					"app/components/**/*.{js,jsx,ts,tsx}",
				],
				ignore: [
					...config.files.ignore,
					"remix.config.js",
					"build/**",
					"public/build/**",
				],
			},
		};
	}

	private static customizeForAstro(config: BiomeConfig): BiomeConfig {
		return {
			...config,
			files: {
				...config.files,
				include: [
					...config.files.include,
					"src/**/*.{js,jsx,ts,tsx,astro}",
					"src/components/**/*.{js,jsx,ts,tsx,astro}",
					"src/layouts/**/*.{js,jsx,ts,tsx,astro}",
					"src/pages/**/*.{js,jsx,ts,tsx,astro}",
				],
				ignore: [
					...config.files.ignore,
					"astro.config.{js,ts,mjs}",
					"tailwind.config.{js,ts,mjs}",
					".astro/**",
					"dist/**",
				],
			},
			overrides: [
				{
					include: ["**/*.test.{js,jsx,ts,tsx}", "**/*.spec.{js,jsx,ts,tsx}"],
					linter: {
						rules: {
							suspicious: {
								noConsoleLog: "off",
							},
						},
					},
				},
				{
					include: ["astro.config.{js,ts,mjs}", "tailwind.config.{js,ts,mjs}"],
					linter: {
						rules: {
							style: {
								useImportType: "off",
							},
						},
					},
				},
			],
		};
	}

	static generateScripts(packageManager: PackageManager = "npm") {
		const packageManagerService = new PackageManagerService();
		const executeCmd = packageManagerService.getExecuteCommand(packageManager);

		return {
			lint: `${executeCmd} @biomejs/biome check .`,
			"lint:fix": `${executeCmd} @biomejs/biome check . --apply`,
			"lint:unsafe": `${executeCmd} @biomejs/biome check . --apply-unsafe`,
			format: `${executeCmd} @biomejs/biome format . --write`,
			"format:check": `${executeCmd} @biomejs/biome format . --check`,
			"check:all": `${executeCmd} @biomejs/biome check .`,
			"fix:all": `${executeCmd} @biomejs/biome check . --apply && ${executeCmd} @biomejs/biome format . --write`,
			"ci:check": `${executeCmd} @biomejs/biome ci .`,
		};
	}

	static generateEditorConfig(): string {
		return `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.{js,jsx,ts,tsx}]
indent_size = 2

[*.{json,yml,yaml}]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
`;
	}
}