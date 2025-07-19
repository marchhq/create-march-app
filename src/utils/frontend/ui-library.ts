import path from "node:path";
import { FileSystemService } from "../core/file-system.js";
import { logger } from "../core/logger.js";
import { PackageManagerService } from "../core/package-manager.js";
import type { ProjectAnswers, SetupResult } from "../types/index.js";

export class UILibrarySetupService {
	private fileSystem = new FileSystemService();
	private packageManager = new PackageManagerService();

	/**
	 * Setup shadcn/ui as a shared library in the monorepo
	 */
	async setupUILibrary(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<SetupResult> {
		if (!answers.useShadcn) {
			return { success: true, message: "shadcn/ui setup skipped" };
		}

		try {
			logger.normal("Setting up shadcn/ui as shared library");

			const uiLibPath = await this.createUILibraryStructure(
				projectPath,
				answers,
			);
			await this.setupShadcnInLibrary(uiLibPath, answers);
			await this.setupLibraryExports(uiLibPath);
			await this.setupLibraryPackageJson(uiLibPath, answers);

			// Create UI library specific .gitignore
			await this.createUILibraryGitignore(uiLibPath);

			logger.success("shadcn/ui library setup complete");
			return { success: true, message: "shadcn/ui library setup complete" };
		} catch (error) {
			const message = `Could not setup shadcn/ui library: ${error instanceof Error ? error.message : String(error)}`;
			logger.warn(message);
			return { success: false, message };
		}
	}

	/**
	 * Create the UI library directory structure
	 */
	private async createUILibraryStructure(
		projectPath: string,
		answers: ProjectAnswers,
	): Promise<string> {
		// Determine library path based on monorepo tool
		const libPath = this.getLibraryPath(projectPath, answers.monorepoTool);

		// Create directory structure
		await this.fileSystem.ensureDirectory(libPath);
		await this.fileSystem.ensureDirectory(path.join(libPath, "src"));
		await this.fileSystem.ensureDirectory(path.join(libPath, "src", "lib"));

		logger.normal(`Created UI library structure at ${libPath}`);
		return libPath;
	}

	/**
	 * Get the appropriate library path based on monorepo tool
	 */
	private getLibraryPath(projectPath: string, monorepoTool: string): string {
		switch (monorepoTool) {
			case "nx":
				return path.join(projectPath, "libs", "ui");
			default:
				return path.join(projectPath, "packages", "ui");
		}
	}

	/**
	 * Initialize shadcn/ui in the library
	 */
	private async setupShadcnInLibrary(
		libPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		logger.normal("Initializing shadcn/ui in library");

		// Create components.json for the library
		const componentsConfig = {
			$schema: "https://ui.shadcn.com/schema.json",
			style: "new-york",
			rsc: true,
			tsx: true,
			tailwind: {
				config: "tailwind.config.ts",
				css: "src/lib/globals.css",
				baseColor: answers.baseColor || "slate",
				cssVariables: true,
				prefix: "",
			},
			aliases: {
				components: "@/components",
				utils: "@/lib/utils",
				ui: "@/components/ui",
				lib: "@/lib",
				hooks: "@/hooks",
			},
			iconLibrary: "lucide",
		};

		await this.fileSystem.writeFile(
			path.join(libPath, "components.json"),
			JSON.stringify(componentsConfig, null, 2),
		);

		// Create utils file
		const utilsContent = `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`;
		await this.fileSystem.writeFile(
			path.join(libPath, "src", "lib", "utils.ts"),
			utilsContent,
		);

		// Create globals.css for the library
		const globalsContent = `@import "tailwindcss";

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
}

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --chart-1: 12 76% 61%;
  --chart-2: 173 58% 39%;
  --chart-3: 197 37% 24%;
  --chart-4: 43 74% 66%;
  --chart-5: 27 87% 67%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 84% 4.9%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  --destructive: 0 62.8% 30.6%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 94.1%;
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
}
`;
		await this.fileSystem.writeFile(
			path.join(libPath, "src", "lib", "globals.css"),
			globalsContent,
		);

		// Create tailwind config for the library
		const tailwindConfig = `import type { Config } from "tailwindcss";
	import { fontFamily } from "tailwindcss/defaultTheme";

	const config = {
		darkMode: ["class"],
		content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
		theme: {
			container: {
				center: true,
				padding: "2rem",
				screens: {
					"2xl": "1400px",
				},
			},
			extend: {
				colors: {
					border: "hsl(var(--border))",
					input: "hsl(var(--input))",
					ring: "hsl(var(--ring))",
					background: "hsl(var(--background))",
					foreground: "hsl(var(--foreground))",
					primary: {
						DEFAULT: "hsl(var(--primary))",
						foreground: "hsl(var(--primary-foreground))",
					},
					secondary: {
						DEFAULT: "hsl(var(--secondary))",
						foreground: "hsl(var(--secondary-foreground))",
					},
					destructive: {
						DEFAULT: "hsl(var(--destructive))",
						foreground: "hsl(var(--destructive-foreground))",
					},
					muted: {
						DEFAULT: "hsl(var(--muted))",
						foreground: "hsl(var(--muted-foreground))",
					},
					accent: {
						DEFAULT: "hsl(var(--accent))",
						foreground: "hsl(var(--accent-foreground))",
					},
					popover: {
						DEFAULT: "hsl(var(--popover))",
						foreground: "hsl(var(--popover-foreground))",
					},
					card: {
						DEFAULT: "hsl(var(--card))",
						foreground: "hsl(var(--card-foreground))",
					},
				},
				borderRadius: {
					lg: "var(--radius)",
					md: "calc(var(--radius) - 2px)",
					sm: "calc(var(--radius) - 4px)",
				},
				fontFamily: {
					sans: ["var(--font-sans)", ...fontFamily.sans],
				},
				keyframes: {
					"accordion-down": {
						from: { height: "0" },
						to: { height: "var(--radix-accordion-content-height)" },
					},
					"accordion-up": {
						from: { height: "var(--radix-accordion-content-height)" },
						to: { height: "0" },
					},
				},
				animation: {
					"accordion-down": "accordion-down 0.2s ease-out",
					"accordion-up": "accordion-up 0.2s ease-out",
				},
			},
		},
		plugins: [require("tailwindcss-animate")],
	} satisfies Config;

	export default config;
	`;
		await this.fileSystem.writeFile(
			path.join(libPath, "tailwind.config.ts"),
			tailwindConfig,
		);

		// Create basic components directory structure
		await this.fileSystem.ensureDirectory(
			path.join(libPath, "src", "components", "ui"),
		);

		// Create basic components
		await this.createBasicComponents(libPath);

		logger.success("shadcn/ui initialized successfully");
	}

	/**
	 * Create basic shadcn/ui components
	 */
	private async createBasicComponents(libPath: string): Promise<void> {
		const componentsPath = path.join(libPath, "src", "components", "ui");

		// Button component
		const buttonComponent = `"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }`;

		// Input component
		const inputComponent = `"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }`;

		// Label component
		const labelComponent = `"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }`;

		// Card component
		const cardComponent = `"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-card text-card-foreground shadow",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }`;

		await this.fileSystem.writeFile(
			path.join(componentsPath, "button.tsx"),
			buttonComponent,
		);
		await this.fileSystem.writeFile(
			path.join(componentsPath, "input.tsx"),
			inputComponent,
		);
		await this.fileSystem.writeFile(
			path.join(componentsPath, "label.tsx"),
			labelComponent,
		);
		await this.fileSystem.writeFile(
			path.join(componentsPath, "card.tsx"),
			cardComponent,
		);

		// Create index.ts to export all components
		const indexContent = `export * from "./button"
export * from "./card"
export * from "./input"
export * from "./label"`;

		await this.fileSystem.writeFile(
			path.join(componentsPath, "index.ts"),
			indexContent,
		);
	}

	/**
	 * Setup library exports
	 */
	private async setupLibraryExports(libPath: string): Promise<void> {
		const indexContent = `// Components
export * from "./components/ui";

// Utilities
export * from "./lib/utils";

// Styles
import "./lib/globals.css";`;

		await this.fileSystem.writeFile(
			path.join(libPath, "src", "index.ts"),
			indexContent,
		);

		logger.normal("Created library exports");
	}

	/**
	 * Setup package.json for the UI library
	 */
	private async setupLibraryPackageJson(
		libPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		const packageName = `@${answers.projectName}/ui`;

		const packageJson = {
			name: packageName,
			version: "0.0.0",
			private: true,
			type: "module",
			exports: {
				".": {
					import: "./src/index.ts",
					require: "./src/index.ts",
				},
				"./styles": "./src/lib/globals.css",
			},
			files: ["src"],
			scripts: {
				build: "tsc",
				"type-check": "tsc --noEmit",
			},
			dependencies: {
				"@radix-ui/react-label": "^2.0.2",
				"@radix-ui/react-slot": "^1.0.2",
				"class-variance-authority": "^0.7.0",
				clsx: "^2.1.0",
				"lucide-react": "^0.344.0",
				"tailwind-merge": "^2.2.1",
				"tailwindcss-animate": "^1.0.7",
			},
			devDependencies: {
				"@types/node": "^20.11.24",
				"@types/react": "^18.2.61",
				"@types/react-dom": "^18.2.19",
				autoprefixer: "^10.4.18",
				postcss: "^8.4.35",
				react: "^18.2.0",
				"react-dom": "^18.2.0",
				tailwindcss: "^3.4.1",
				typescript: "^5.3.3",
			},
			peerDependencies: {
				react: "^18.2.0",
				"react-dom": "^18.2.0",
			},
		};

		await this.fileSystem.writeFile(
			path.join(libPath, "package.json"),
			JSON.stringify(packageJson, null, 2),
		);

		// Create TypeScript config for the library
		const tsConfig = {
			extends: "../../tsconfig.json",
			compilerOptions: {
				outDir: "./dist",
				declaration: true,
				declarationMap: true,
				baseUrl: ".",
				paths: {
					"@/*": ["./src/*"],
				},
			},
			include: ["src/**/*"],
			exclude: ["node_modules", "dist"],
		};

		await this.fileSystem.writeFile(
			path.join(libPath, "tsconfig.json"),
			JSON.stringify(tsConfig, null, 2),
		);

		logger.normal(`Created package.json for ${packageName}`);
	}

	/**
	 * Add UI library as dependency to an app
	 */
	async addUILibraryToApp(
		appPath: string,
		answers: ProjectAnswers,
	): Promise<void> {
		if (!answers.useShadcn) {
			return;
		}

		const packageName = `@${answers.projectName}/ui`;

		// Use workspace version for pnpm/yarn, regular version for npm
		const version = answers.packageManager === "npm" ? "*" : "workspace:*";

		await this.fileSystem.updatePackageJson(
			path.join(appPath, "package.json"),
			{
				dependencies: {
					[packageName]: version,
				},
			},
		);

		logger.normal(`Added ${packageName} to app dependencies`);
	}

	/**
	 * Create UI library specific .gitignore file
	 */
	private async createUILibraryGitignore(libPath: string): Promise<void> {
		const uiLibraryGitignore = `# Build output
dist/
build/

# Dependencies (handled by workspace root)
node_modules/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo

# Testing
coverage/
.nyc_output

# Cache
.eslintcache

# Tailwind CSS
*.css.map

# Storybook
storybook-static/
`;

		await this.fileSystem.writeFile(
			path.join(libPath, ".gitignore"),
			uiLibraryGitignore,
		);

		logger.normal("Created UI library specific .gitignore");
	}
}