import path from "node:path";
import { execa } from "execa";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();

/**
 * Setup realtime collaboration features
 */
export async function setupRealtimeCollaboration(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up realtime collaboration...");

	if (answers.realtimeCollaboration === "liveblocks") {
		await setupLiveblocks(projectPath, answers);
	}

	logger.success("Realtime collaboration setup completed");
}

/**
 * Setup Liveblocks for realtime collaboration
 */
async function setupLiveblocks(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Configuring Liveblocks...");

	const appPath = fileSystemService.resolveAppPath(projectPath);

	try {
		// Install Liveblocks dependencies
		const liveblocksPackages = ["@liveblocks/client", "@liveblocks/react"];

		// Add Next.js specific packages if using Next.js
		if (
			answers.frontend === "nextjs-app" ||
			answers.frontend === "nextjs-pages"
		) {
			liveblocksPackages.push("@liveblocks/nextjs");
		}

		await execa(answers.packageManager, ["add", ...liveblocksPackages], {
			cwd: appPath,
			stdio: "inherit",
		});

		// Create Liveblocks configuration
		await createLiveblocksConfig(appPath, answers);

		// Create example collaboration components
		await createLiveblocksExamples(appPath, answers);

		// Update environment template
		await updateEnvironmentWithLiveblocks(appPath);

		logger.success("Liveblocks configuration completed");
	} catch (error) {
		throw new Error(
			`Failed to setup Liveblocks: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Create Liveblocks configuration files
 */
async function createLiveblocksConfig(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	// Create Liveblocks client configuration
	const liveblocksClient = `import { createClient } from "@liveblocks/client";

const client = createClient({
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!,
});

export { client };
`;

	// Create Liveblocks React configuration for Next.js
	if (
		answers.frontend === "nextjs-app" ||
		answers.frontend === "nextjs-pages"
	) {
		const liveblocksNextConfig = `import { createRoomContext } from "@liveblocks/react";
import { client } from "./client";

export const {
  RoomProvider,
  useMyPresence,
  useOthers,
  useBroadcastEvent,
  useEventListener,
  useHistory,
  useUndo,
  useRedo,
  useStorage,
  useMutation,
  useObject,
  useList,
  useMap,
} = createRoomContext(client);
`;

		await fileSystemService.ensureDirectory(
			path.join(appPath, "src/liveblocks"),
		);
		await fileSystemService.writeFile(
			path.join(appPath, "src/liveblocks/client.ts"),
			liveblocksClient,
		);
		await fileSystemService.writeFile(
			path.join(appPath, "src/liveblocks/index.ts"),
			liveblocksNextConfig,
		);
	}

	// Create base Liveblocks config for Vite
	if (answers.frontend === "vite") {
		const liveblocksViteConfig = `import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY!,
});

export const {
  RoomProvider,
  useMyPresence,
  useOthers,
  useBroadcastEvent,
  useEventListener,
  useHistory,
  useUndo,
  useRedo,
  useStorage,
  useMutation,
  useObject,
  useList,
  useMap,
} = createRoomContext(client);

export { client };
`;

		await fileSystemService.ensureDirectory(
			path.join(appPath, "src/liveblocks"),
		);
		await fileSystemService.writeFile(
			path.join(appPath, "src/liveblocks/index.ts"),
			liveblocksViteConfig,
		);
	}
}

/**
 * Create Liveblocks example components
 */
async function createLiveblocksExamples(
	appPath: string,
	_answers: ProjectAnswers,
): Promise<void> {
	// Create example collaborative cursor component
	const collaborativeCursor = `"use client";

import { useOthers, useMyPresence } from "../liveblocks";
import { useState, useCallback, useEffect } from "react";

export function CollaborativeCursor() {
  const [{ cursor }, updateMyPresence] = useMyPresence();
  const others = useOthers();

  const updateCursor = useCallback((event: React.PointerEvent) => {
    updateMyPresence({
      cursor: {
        x: Math.round(event.clientX),
        y: Math.round(event.clientY),
      },
    });
  }, [updateMyPresence]);

  const hideCursor = useCallback(() => {
    updateMyPresence({ cursor: null });
  }, [updateMyPresence]);

  return (
    <div
      onPointerMove={updateCursor}
      onPointerLeave={hideCursor}
      className="relative h-screen w-full"
    >
      {/* Render other users' cursors */}
      {others.map(({ connectionId, presence }) => {
        if (presence.cursor == null) {
          return null;
        }

        return (
          <div
            key={connectionId}
            className="absolute pointer-events-none"
            style={{
              left: presence.cursor.x,
              top: presence.cursor.y,
            }}
          >
            <div className="w-4 h-4 bg-blue-500 rounded-full" />
            <div className="ml-2 mt-1 px-2 py-1 bg-blue-500 text-white text-xs rounded">
              User {connectionId}
            </div>
          </div>
        );
      })}
      
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Collaborative Cursors</h1>
        <p>Move your mouse around to see cursors from other users!</p>
      </div>
    </div>
  );
}
`;

	// Create example shared counter
	const sharedCounter = `"use client";

import { useStorage, useMutation } from "../liveblocks";

export function SharedCounter() {
  const count = useStorage((root) => root.count);
  
  const increment = useMutation(({ storage }) => {
    const currentCount = storage.get("count") || 0;
    storage.set("count", currentCount + 1);
  }, []);

  const decrement = useMutation(({ storage }) => {
    const currentCount = storage.get("count") || 0;
    storage.set("count", currentCount - 1);
  }, []);

  return (
    <div className="p-8">
      <h2 className="text-xl font-bold mb-4">Shared Counter</h2>
      <div className="flex items-center gap-4">
        <button
          onClick={decrement}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          -
        </button>
        <span className="text-2xl font-bold">{count || 0}</span>
        <button
          onClick={increment}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          +
        </button>
      </div>
    </div>
  );
}
`;

	await fileSystemService.ensureDirectory(
		path.join(appPath, "src/components/liveblocks"),
	);
	await fileSystemService.writeFile(
		path.join(appPath, "src/components/liveblocks/CollaborativeCursor.tsx"),
		collaborativeCursor,
	);
	await fileSystemService.writeFile(
		path.join(appPath, "src/components/liveblocks/SharedCounter.tsx"),
		sharedCounter,
	);
}

/**
 * Update environment template with Liveblocks variables
 */
async function updateEnvironmentWithLiveblocks(appPath: string): Promise<void> {
	const envExamplePath = path.join(appPath, ".env.example");

	const liveblocksEnv = `
# Liveblocks Configuration
# Get your keys from: https://liveblocks.io/dashboard/apikeys
NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY="pk_dev_..."
LIVEBLOCKS_SECRET_KEY="sk_dev_..."
`;

	try {
		// Check if file exists first to avoid ENOENT errors
		const fileExists = await fileSystemService.fileExists(envExamplePath);

		if (fileExists) {
			// File exists, append to it
			const existingEnv = await fileSystemService.readFile(envExamplePath);
			await fileSystemService.writeFile(
				envExamplePath,
				existingEnv + liveblocksEnv,
			);
		} else {
			// File doesn't exist, create it
			await fileSystemService.writeFile(envExamplePath, liveblocksEnv);
		}

		logger.info("Updated .env.example with Liveblocks configuration");
	} catch (_error) {
		// Fallback: create the file with just Liveblocks config
		logger.warn("Could not update existing .env.example, creating new one");
		await fileSystemService.writeFile(envExamplePath, liveblocksEnv);
		logger.info("Created .env.example with Liveblocks configuration");
	}
}