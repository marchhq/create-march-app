import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import { PackageManagerService } from "../utils/core/package-manager.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();
const packageManagerService = new PackageManagerService();

/**
 * Install Storybook dependencies based on framework
 */
async function installStorybookDependencies(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Installing Storybook dependencies...");

	// Base Storybook dependencies
	const baseDependencies = [
		"@storybook/addon-essentials",
		"@storybook/addon-interactions",
		"@storybook/addon-a11y",
		"@storybook/addon-viewport",
		"@storybook/blocks",
		"@storybook/test",
		"storybook",
	];

	// Framework-specific dependencies
	let frameworkDependencies: string[] = [];

	if (
		answers.frontend === "nextjs-app" ||
		answers.frontend === "nextjs-pages"
	) {
		frameworkDependencies = ["@storybook/nextjs"];
	} else if (answers.frontend === "vite") {
		frameworkDependencies = ["@storybook/react-vite", "@storybook/react"];
	} else {
		// Default React setup
		frameworkDependencies = ["@storybook/react", "@storybook/react-webpack5"];
	}

	// Add Tailwind addon if using Tailwind
	if (answers.useTailwind) {
		if (
			answers.frontend === "nextjs-app" ||
			answers.frontend === "nextjs-pages"
		) {
			baseDependencies.push("@storybook/addon-styling-webpack");
		} else {
			baseDependencies.push("@storybook/addon-styling");
		}
	}

	// Install all dependencies
	const allDependencies = [...baseDependencies, ...frameworkDependencies];

	await packageManagerService.installPackages(
		allDependencies,
		answers.packageManager,
		{ cwd: appPath, dev: true },
	);

	logger.success("Storybook dependencies installed");
}

/**
 * Setup Storybook for component library development
 */
export async function setupStorybook(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up Storybook...");

	const appPath = fileSystemService.resolveAppPath(projectPath);

	try {
		// Install Storybook dependencies manually
		await installStorybookDependencies(appPath, answers);

		// Create Storybook directory structure
		await fileSystemService.ensureDirectory(path.join(appPath, ".storybook"));

		// Configure Storybook based on frontend framework
		await configureStorybookForFramework(appPath, answers);

		// Create example stories
		await createExampleStories(appPath, answers);

		// Update Storybook configuration
		await updateStorybookConfig(appPath, answers);

		// Add Storybook scripts to package.json
		await updatePackageJsonWithStorybookScripts(appPath, answers);

		logger.success("Storybook setup completed");
		logger.info(
			"Run 'npm run storybook' to start the Storybook development server",
		);
	} catch (error) {
		throw new Error(
			`Failed to setup Storybook: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Configure Storybook for specific frontend framework
 */
async function configureStorybookForFramework(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const storybookConfigPath = path.join(appPath, ".storybook", "main.ts");

	let storybookConfig = "";

	if (
		answers.frontend === "nextjs-app" ||
		answers.frontend === "nextjs-pages"
	) {
		storybookConfig = `import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
    ${answers.useTailwind ? "'@storybook/addon-styling-webpack'," : ""}
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
  staticDirs: ['../public'],
};

export default config;
`;
	} else if (answers.frontend === "vite") {
		storybookConfig = `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
    ${answers.useTailwind ? "'@storybook/addon-styling'," : ""}
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
};

export default config;
`;
	}

	if (storybookConfig) {
		await fileSystemService.writeFile(storybookConfigPath, storybookConfig);
	}

	// Configure Storybook preview for Tailwind if used
	if (answers.useTailwind) {
		await configureStorybookTailwind(appPath, answers);
	}
}

/**
 * Configure Storybook with Tailwind CSS
 */
async function configureStorybookTailwind(
	appPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	const previewPath = path.join(appPath, ".storybook", "preview.ts");

	const previewConfig = `import type { Preview } from '@storybook/react';
import '../src/app/globals.css'; // Import your Tailwind CSS

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#000000',
        },
      ],
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
`;

	await fileSystemService.writeFile(previewPath, previewConfig);
}

/**
 * Create example stories for the project
 */
async function createExampleStories(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	// Create stories directory
	await fileSystemService.ensureDirectory(path.join(appPath, "src/stories"));

	// Create Button component story if using shadcn
	if (answers.useShadcn) {
		const buttonStory = `import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/ui/button';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: { type: 'select' },
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};
`;

		await fileSystemService.writeFile(
			path.join(appPath, "src/stories/Button.stories.ts"),
			buttonStory,
		);
	}

	// Create a generic component story
	const exampleStory = `import type { Meta, StoryObj } from '@storybook/react';

// Example component
interface ExampleProps {
  title: string;
  description?: string;
  primary?: boolean;
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

const Example = ({ title, description, primary = false, size = 'medium', ...props }: ExampleProps) => {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const sizeClasses = {
    small: 'text-sm px-3 py-1',
    medium: 'text-base px-4 py-2',
    large: 'text-lg px-6 py-3',
  };
  const variantClasses = primary
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

  return (
    <div className="max-w-md p-6 bg-white rounded-lg shadow-lg">
      <button
        type="button"
        className={\`\${baseClasses} \${sizeClasses[size]} \${variantClasses}\`}
        {...props}
      >
        {title}
      </button>
      {description && (
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      )}
    </div>
  );
};

const meta = {
  title: 'Example/ExampleComponent',
  component: Example,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    primary: true,
    title: 'Primary Button',
    description: 'This is a primary button example',
  },
};

export const Secondary: Story = {
  args: {
    title: 'Secondary Button',
    description: 'This is a secondary button example',
  },
};

export const Large: Story = {
  args: {
    size: 'large',
    title: 'Large Button',
  },
};

export const Small: Story = {
  args: {
    size: 'small',
    title: 'Small Button',
  },
};
`;

	await fileSystemService.writeFile(
		path.join(appPath, "src/stories/Example.stories.tsx"),
		exampleStory,
	);
}

/**
 * Update Storybook configuration with custom settings
 */
async function updateStorybookConfig(
	appPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	// Create manager.js for custom configuration
	const managerConfig = `import { addons } from '@storybook/manager-api';
import { themes } from '@storybook/theming';

addons.setConfig({
  theme: themes.light,
  panelPosition: 'bottom',
  showNav: true,
  showPanel: true,
  sidebarAnimations: true,
});
`;

	await fileSystemService.writeFile(
		path.join(appPath, ".storybook", "manager.js"),
		managerConfig,
	);
}

/**
 * Add Storybook scripts to package.json
 */
async function updatePackageJsonWithStorybookScripts(
	appPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	const packageJsonPath = path.join(appPath, "package.json");

	try {
		const packageJsonContent =
			await fileSystemService.readFile(packageJsonPath);
		const packageJson = JSON.parse(packageJsonContent);

		if (!packageJson.scripts) {
			packageJson.scripts = {};
		}

		// Add Storybook scripts
		packageJson.scripts.storybook = "storybook dev -p 6006";
		packageJson.scripts["build-storybook"] = "storybook build";
		packageJson.scripts["storybook:test"] = "test-storybook";

		await fileSystemService.writeFile(
			packageJsonPath,
			JSON.stringify(packageJson, null, 2),
		);

		logger.info("Updated package.json with Storybook scripts");
	} catch (error) {
		logger.warn("Failed to update package.json scripts:", error);
	}
}