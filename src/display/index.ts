import boxen from "boxen";
import chalk from "chalk";
import gradient from "gradient-string";
import type { ProjectAnswers } from "../utils/types/index.js";

/**
 * Display ASCII art and welcome message
 */
export function displayWelcomeMessage(): void {
	const asciiCat = `                                                                                              
          ================================================================================          
          ================================================================================          
          ========================+####%%%%%%%%%%%%%%==============+#%%%%%%%+=============          
          =======================#%%%%%%%%%%%%%%%%%%%=============%@@@@@@@@%+=============          
          =====================*%%%%%%%%%%%%%%%%%%%@%===========#@@@@@@@@@@%+=============          
          ===================+%%%%%%%%%%%%%%%%%%%@@@%=========+@@@@@@@@@@@@%+=============          
          =================+#%%%%%%%%%%%%%%%%%%%@@@@%=======+%@@@@@@@@@@@@@%+=============          
          ================#%%%%%%%%%%%%%%%%%%%%@@@@@%======#@@@@@@@@@@@@@@@%+=============          
          ==============*%%%%%%%%%%%%%%%%%%%%%@@@@@@@%%%%@@@@@@@@@@@@@@@%%%@%%%%%%%%%%====          
          ============+#%%%%%%%%%%%%#====+%%@@@@@@@@@@@@@@@@@@@@@@@@@%+===+@@@@@@@@@@@====          
          ===========#%%%%%%%%%%%%%+=====+%%@@@@@@@@@@@@@@@@@@@@@@@@+=====+@@@@@@@@@@@====          
          =========*%%%%%%%%%%%%%*=======+@@@@@@@@@@@@@@@@@@@@@@@@#=======+@@@@@@@@@@@====          
          =======+#%%%%%%%%%%%%#=========+@@@@@@@@@@@@@@@@@@@@@@%=========+@@@@@@@@@@@====          
          ======#%%%%%%%%%%%%%+==========+@@@@@@@@@@@@@@@@@@@@@+==========+@@@@@@@@@@%====          
          ====+#############*============+%%%%%%%%%%%%%%%%%%#+============+%%%%%%%%#+=====          
          ================================================================================          
          ================================================================================                                                                                                                                                                                                       
  `
	const titleArt = `
    ╔═╗┬─┐┌─┐┌─┐┌┬┐┌─┐  ┌┬┐┌─┐┬─┐┌─┐┬ ┬  ┌─┐┌─┐┌─┐
    ║  ├┬┘├┤ ├─┤ │ ├┤   │││├─┤├┬┘│  ├─┤  ├─┤├─┘├─┘
    ╚═╝┴└─└─┘┴ ┴ ┴ └─┘  ┴ ┴┴ ┴┴└─└─┘┴ ┴  ┴ ┴┴  ┴  
    
    🚀 A powerful CLI to jumpstart modern SaaS projects the right way.
    
    ✨ Features: Turborepo/Nx/NPM • Next.js/Vite • shadcn/ui
       TypeScript • tRPC • Neon/Supabase • Auth • Stripe
       Docker • CI/CD • Testing • Storybook • PWA & more
    
                                       💜 made with love by Aasim Bhat
    `;

	console.log(gradient("cyan", "magenta")(asciiCat));
	console.log(gradient("magenta", "cyan")(titleArt));
}

/**
 * Display success message with project information
 */
export function displaySuccessMessage(
	projectName: string,
	answers: ProjectAnswers,
): void {
	const packageManager = answers.packageManager || "npm";

	const devCmd =
		packageManager === "npm"
			? "npm run dev"
			: packageManager === "yarn"
				? "yarn dev"
				: packageManager === "pnpm"
					? "pnpm dev"
					: "bun dev";

	console.log("\n");
	console.log(
		boxen(
			gradient.pastel(
				`
✨ ${projectName} is ready! ✨

Start coding:
  ${`cd ${projectName}`}
  ${devCmd}

  Happy coding! 💫
      `.trim(),
			),
			{
				padding: 1,
				margin: 1,
				borderStyle: "single",
				borderColor: "cyan",
			},
		),
	);
}

/**
 * Display warning message
 */
export function displayWarning(message: string): void {
	console.log(chalk.yellow(`⚠️  ${message}`));
}

/**
 * Display error message
 */
export function displayError(message: string): void {
	console.log(chalk.red(`❌ ${message}`));
}

/**
 * Display info message
 */
export function displayInfo(message: string): void {
	console.log(chalk.blue(`ℹ️  ${message}`));
}