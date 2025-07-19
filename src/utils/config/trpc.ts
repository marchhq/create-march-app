/** biome-ignore-all lint/complexity/noThisInStatic: <explanation> */
/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation> */
import type { Frontend } from "../types/index.js";

export class TRPCConfigGenerator {
	static generateTRPCConfig(framework: Frontend): string {
		switch (framework) {
			case "nextjs-app":
				return this.generateNextJsConfig();
			case "vite":
				return this.generateViteConfig();
			case "astro":
				return this.generateAstroConfig();
			default:
				return this.generateBaseConfig();
		}
	}

	private static generateBaseConfig(): string {
		return `import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  // Add your procedures here
});

export type AppRouter = typeof appRouter;`;
	}

	private static generateNextJsConfig(): string {
		return `import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';

export const createTRPCContext = async (opts: { headers: Headers }) => {
  return {
    headers: opts.headers,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;`;
	}

	private static generateViteConfig(): string {
		return this.generateBaseConfig();
	}

	private static generateAstroConfig(): string {
		return `import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  // Add your procedures here
});

export type AppRouter = typeof appRouter;`;
	}

	static generateRootRouter(framework: Frontend): string {
		switch (framework) {
			case "nextjs-app":
				return `import { createTRPCRouter } from '~/server/api/trpc';

export const appRouter = createTRPCRouter({
  // Add your routers here
});

export type AppRouter = typeof appRouter;`;
			case "vite":
				return `import { router } from './trpc';

export const appRouter = router({
  // Add your routers here
});

export type AppRouter = typeof appRouter;`;
			case "astro":
				return `import { router } from './trpc';

export const appRouter = router({
  // Add your routers here
});

export type AppRouter = typeof appRouter;`;
			default:
				return "";
		}
	}

	static getFilePaths(framework: Frontend) {
		switch (framework) {
			case "nextjs-app":
				return {
					trpcConfig: "src/server/api/trpc.ts",
					rootRouter: "src/server/api/root.ts",
				};
			case "vite":
				return {
					trpcConfig: "src/server/trpc.ts",
					rootRouter: "src/server/root.ts",
				};
			case "astro":
				return {
					trpcConfig: "src/server/trpc.ts",
					rootRouter: "src/server/root.ts",
				};
			default:
				return {
					trpcConfig: "src/trpc.ts",
					rootRouter: "src/router.ts",
				};
		}
	}

	static getDependencies(): string[] {
		return [
			"@trpc/server",
			"@trpc/client",
			"@trpc/react-query",
			"@tanstack/react-query",
			"superjson",
			"zod",
		];
	}

	static generateClientConfig(framework: Frontend): string {
		switch (framework) {
			case "nextjs-app":
				return `import { createTRPCNext } from '@trpc/next';
import { httpBatchLink } from '@trpc/client';
import { type AppRouter } from '~/server/api/root';
import superjson from 'superjson';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return \`https://\${process.env.VERCEL_URL}\`; // SSR should use vercel url
  return \`http://localhost:\${process.env.PORT ?? 3000}\`; // dev SSR should use localhost
};

export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        httpBatchLink({
          url: \`\${getBaseUrl()}/api/trpc\`,
        }),
      ],
    };
  },
  ssr: false,
});`;
			case "vite":
				return `import { createTRPCReact } from '@trpc/react-query';
import { type AppRouter } from './server/root';

export const api = createTRPCReact<AppRouter>();`;
			case "astro":
				return `import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { type AppRouter } from './server/root';
import superjson from 'superjson';

export const api = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: '/api/trpc',
    }),
  ],
});`;
			default:
				return "";
		}
	}

	static generateProviderConfig(framework: Frontend): string {
		switch (framework) {
			case "vite":
				return `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { api } from './api';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url: 'http://localhost:3000/api/trpc',
        }),
      ],
    })
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}`;
			default:
				return "";
		}
	}
}