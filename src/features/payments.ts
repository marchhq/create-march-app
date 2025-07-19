import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();

/**
 * Setup Stripe integration
 */
export async function setupStripe(
	projectPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up Stripe integration...");

	// Create Stripe configuration
	const stripeConfig = `import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export const formatAmountForDisplay = (
  amount: number,
  currency: string
): string => {
  const numberFormat = new Intl.NumberFormat(["en-US"], {
    style: "currency",
    currency: currency,
    currencyDisplay: "symbol",
  });
  return numberFormat.format(amount / 100);
};

export const formatAmountForStripe = (
  amount: number,
  currency: string
): number => {
  const numberFormat = new Intl.NumberFormat(["en-US"], {
    style: "currency",
    currency: currency,
    currencyDisplay: "symbol",
  });
  const parts = numberFormat.formatToParts(amount);
  let zeroDecimalCurrency = true;
  for (const part of parts) {
    if (part.type === "decimal") {
      zeroDecimalCurrency = false;
    }
  }
  return zeroDecimalCurrency ? amount : Math.round(amount * 100);
};
`;

	const appPath = fileSystemService.resolveAppPath(projectPath);
	await fileSystemService.ensureDirectory(path.join(appPath, "src/lib"));
	await fileSystemService.writeFile(
		path.join(appPath, "src/lib/stripe.ts"),
		stripeConfig,
	);

	logger.success("Stripe integration setup completed");
}