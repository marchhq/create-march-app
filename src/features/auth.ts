import { execa } from "execa";
import path from "node:path";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();

/**
 * Setup authentication configuration
 */
export async function setupAuth(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  logger.step("Setting up authentication...");

  if (answers.authentication === "nextauth") {
    await setupNextAuth(projectPath, answers);
  }

  logger.success("Authentication setup completed");
}

/**
 * Setup NextAuth.js authentication
 */
async function setupNextAuth(
  projectPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  logger.step("Configuring NextAuth.js...");

  const appPath = fileSystemService.resolveAppPath(projectPath);

  try {
    // Install NextAuth dependencies
    const authDeps = ["next-auth"];

    // Add database adapter if database is configured
    if (answers.ormDatabase === "prisma") {
      authDeps.push("@auth/prisma-adapter");
    } else if (answers.ormDatabase === "drizzle") {
      authDeps.push("@auth/drizzle-adapter");
    }

    await execa(answers.packageManager, ["add", ...authDeps], {
      cwd: appPath,
      stdio: "inherit",
    });

    // Create NextAuth configuration
    await createNextAuthConfig(appPath, answers);

    // Create middleware for protected routes
    await createNextAuthMiddleware(appPath, answers);

    // Create API route handlers
    await createNextAuthRoutes(appPath, answers);

    // Create example auth components
    await createNextAuthComponents(appPath, answers);

    // Update environment template
    await updateEnvironmentWithNextAuth(appPath);

    logger.success("NextAuth.js configuration completed");
  } catch (error) {
    throw new Error(
      `Failed to setup NextAuth.js: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Create NextAuth configuration
 */
async function createNextAuthConfig(
  appPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  const _isAppRouter = answers.frontend === "nextjs-app";

  // Create database adapter import if applicable
  let adapterImport = "";
  let adapterConfig = "";

  if (answers.ormDatabase === "prisma") {
    adapterImport = `import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";`;
    adapterConfig = "  adapter: PrismaAdapter(prisma),";
  } else if (answers.ormDatabase === "drizzle") {
    adapterImport = `import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "../db";`;
    adapterConfig = "  adapter: DrizzleAdapter(db),";
  }

  const authConfig = `import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
${adapterImport}

export const authConfig: NextAuthConfig = {
${adapterConfig}
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Add your own credential validation logic here
        if (credentials?.email === "demo@example.com" && credentials?.password === "demo") {
          return {
            id: "1",
            email: "demo@example.com",
            name: "Demo User",
          };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
    error: "/auth/error",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      
      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
`;

  await fileSystemService.ensureDirectory(path.join(appPath, "src/lib"));
  await fileSystemService.writeFile(
    path.join(appPath, "src/lib/auth.ts"),
    authConfig,
  );
}

/**
 * Create NextAuth middleware
 */
async function createNextAuthMiddleware(
  appPath: string,
  _answers: ProjectAnswers,
): Promise<void> {
  const middlewareConfig = `import { auth } from "./src/lib/auth";

export default auth((req) => {
  // Add custom middleware logic here
  // This runs on every request that matches the matcher
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
`;

  await fileSystemService.writeFile(
    path.join(appPath, "middleware.ts"),
    middlewareConfig,
  );
}

/**
 * Create NextAuth API route handlers
 */
async function createNextAuthRoutes(
  appPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  const isAppRouter = answers.frontend === "nextjs-app";

  if (isAppRouter) {
    // App Router: Create route.ts in app/api/auth/[...nextauth]/
    const routeHandler = `import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
`;

    await fileSystemService.ensureDirectory(
      path.join(appPath, "src/app/api/auth/[...nextauth]"),
    );
    await fileSystemService.writeFile(
      path.join(appPath, "src/app/api/auth/[...nextauth]/route.ts"),
      routeHandler,
    );
  } else {
    // Pages Router: Create [...nextauth].ts in pages/api/auth/
    const apiHandler = `import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth";

export default NextAuth(authConfig);
`;

    await fileSystemService.ensureDirectory(
      path.join(appPath, "src/pages/api/auth"),
    );
    await fileSystemService.writeFile(
      path.join(appPath, "src/pages/api/auth/[...nextauth].ts"),
      apiHandler,
    );
  }
}

/**
 * Create NextAuth example components
 */
async function createNextAuthComponents(
  appPath: string,
  answers: ProjectAnswers,
): Promise<void> {
  const isAppRouter = answers.frontend === "nextjs-app";

  // Create sign-in button component
  const signInButton = `"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function SignInButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="px-4 py-2 text-gray-500">Loading...</div>;
  }

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">
          Signed in as {session.user?.email}
        </span>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn()}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Sign In
    </button>
  );
}
`;

  // Create custom sign-in page
  const signInPage = `"use client";

import { signIn, getProviders, getSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Provider {
  id: string;
  name: string;
  type: string;
}

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const res = await getProviders();
      setProviders(res);
    })();
  }, []);

  const handleSignIn = async (providerId: string) => {
    const result = await signIn(providerId, { 
      callbackUrl: "/dashboard",
      redirect: false 
    });
    
    if (result?.ok) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8 space-y-6">
          {providers &&
            Object.values(providers).map((provider) => (
              <div key={provider.name}>
                <button
                  onClick={() => handleSignIn(provider.id)}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Sign in with {provider.name}
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
`;

  await fileSystemService.ensureDirectory(
    path.join(appPath, "src/components/auth"),
  );
  await fileSystemService.writeFile(
    path.join(appPath, "src/components/auth/SignInButton.tsx"),
    signInButton,
  );

  // Create sign-in page based on router type
  if (isAppRouter) {
    await fileSystemService.ensureDirectory(
      path.join(appPath, "src/app/auth/signin"),
    );
    await fileSystemService.writeFile(
      path.join(appPath, "src/app/auth/signin/page.tsx"),
      signInPage,
    );
  } else {
    await fileSystemService.ensureDirectory(
      path.join(appPath, "src/pages/auth"),
    );
    await fileSystemService.writeFile(
      path.join(appPath, "src/pages/auth/signin.tsx"),
      signInPage,
    );
  }
}

/**
 * Update environment template with NextAuth variables
 */
async function updateEnvironmentWithNextAuth(appPath: string): Promise<void> {
  const envExamplePath = path.join(appPath, ".env.example");

  const nextAuthEnv = `
# NextAuth.js Configuration
# Generate a secret: openssl rand -base64 32
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Provider Keys
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
`;

  try {
    // Check if file exists first to avoid ENOENT errors
    const fileExists = await fileSystemService.fileExists(envExamplePath);

    if (fileExists) {
      // File exists, append to it
      const existingEnv = await fileSystemService.readFile(envExamplePath);
      await fileSystemService.writeFile(
        envExamplePath,
        existingEnv + nextAuthEnv,
      );
    } else {
      // File doesn't exist, create it
      await fileSystemService.writeFile(envExamplePath, nextAuthEnv);
    }

    logger.info("Updated .env.example with NextAuth.js configuration");
  } catch (_error) {
    // Fallback: create the file with just NextAuth config
    logger.warn("Could not update existing .env.example, creating new one");
    await fileSystemService.writeFile(envExamplePath, nextAuthEnv);
    logger.info("Created .env.example with NextAuth.js configuration");
  }
}