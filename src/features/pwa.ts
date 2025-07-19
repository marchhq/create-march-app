import path from "node:path";
import { execa } from "execa";
import { FileSystemService } from "../utils/core/file-system.js";
import { logger } from "../utils/core/logger.js";
import type { ProjectAnswers } from "../utils/types/index.js";

const fileSystemService = new FileSystemService();

/**
 * Setup Progressive Web App (PWA) configuration
 */
export async function setupPWA(
	projectPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Setting up Progressive Web App (PWA)...");

	const appPath = fileSystemService.resolveAppPath(projectPath);

	try {
		await installPWADependencies(appPath, answers);
		await createWebAppManifest(appPath, answers);
		await setupServiceWorker(appPath, answers);
		await createPWAIcons(appPath);
		await configurePWAForFramework(appPath, answers);
		await createPWADocumentation(appPath);

		logger.success("Progressive Web App setup completed");
		logger.info(
			"📱 Your app is now PWA-ready! Generate icons and add them to public/icons/",
		);
		logger.info(
			"🔍 Test your PWA with Chrome DevTools > Application > Manifest",
		);
	} catch (error) {
		throw new Error(
			`Failed to setup PWA: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function installPWADependencies(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	logger.step("Installing PWA dependencies...");

	if (
		answers.frontend === "nextjs-app" ||
		answers.frontend === "nextjs-pages"
	) {
		await execa(answers.packageManager, ["add", "next-pwa"], {
			cwd: appPath,
			stdio: "inherit",
		});
	} else if (answers.frontend === "vite") {
		await execa(answers.packageManager, ["add", "-D", "vite-plugin-pwa"], {
			cwd: appPath,
			stdio: "inherit",
		});
	}
}

async function createWebAppManifest(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const manifest = {
		name: answers.projectName,
		short_name: answers.projectName,
		description: `${answers.projectName} - A modern SaaS application`,
		start_url: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#000000",
		orientation: "portrait-primary",
		scope: "/",
		lang: "en",
		categories: ["business", "productivity"],
		icons: [
			{
				src: "/icons/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any maskable",
			},
			{
				src: "/icons/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any maskable",
			},
		],
		screenshots: [
			{
				src: "/screenshots/desktop.png",
				sizes: "1280x720",
				type: "image/png",
				form_factor: "wide",
				label: "Desktop view",
			},
			{
				src: "/screenshots/mobile.png",
				sizes: "390x844",
				type: "image/png",
				form_factor: "narrow",
				label: "Mobile view",
			},
		],
		shortcuts: [
			{
				name: "Dashboard",
				short_name: "Dashboard",
				description: "Go to dashboard",
				url: "/dashboard",
				icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
			},
		],
	};

	const publicDir = path.join(appPath, "public");
	await fileSystemService.ensureDirectory(publicDir);
	await fileSystemService.writeFile(
		path.join(publicDir, "manifest.json"),
		JSON.stringify(manifest, null, 2),
	);
}

async function setupServiceWorker(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	// For Next.js with next-pwa, service worker is handled automatically
	if (
		answers.frontend === "nextjs-app" ||
		answers.frontend === "nextjs-pages"
	) {
		logger.info("Service worker will be generated automatically by next-pwa");
		return;
	}

	// For Vite, create a basic service worker (vite-plugin-pwa will enhance it)
	const serviceWorker = `const CACHE_NAME = '${answers.projectName}-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
`;

	const publicDir = path.join(appPath, "public");
	await fileSystemService.writeFile(
		path.join(publicDir, "sw.js"),
		serviceWorker,
	);
}

async function createPWAIcons(appPath: string): Promise<void> {
	const iconsDir = path.join(appPath, "public/icons");
	await fileSystemService.ensureDirectory(iconsDir);

	// Create a simple placeholder icon
	const placeholderSVG = `<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#4F46E5"/>
  <circle cx="256" cy="200" r="80" fill="white"/>
  <path d="M256 320c70.7 0 128 57.3 128 128H128c0-70.7 57.3-128 128-128z" fill="white"/>
</svg>`;

	await fileSystemService.writeFile(
		path.join(iconsDir, "icon.svg"),
		placeholderSVG,
	);

	const iconReadme = `# PWA Icons

This directory contains the icons for your Progressive Web App.

## Required Sizes
- 192x192 (Android home screen)
- 512x512 (Android splash screen)

## Quick Setup

1. Replace \`icon.svg\` with your app's icon
2. Generate PNG icons:

\`\`\`bash
# Using pwa-asset-generator (recommended)
npx pwa-asset-generator icon.svg ./public/icons --manifest ./public/manifest.json

# Or manually convert with any tool:
# - https://pwa-asset-generator.netlify.app/
# - https://appicon.co/
\`\`\`

## Generated Files
After running the generator, you should have:
- icon-192x192.png
- icon-512x512.png
- apple-touch-icon.png (for iOS)

## Testing
Test your PWA installation:
1. Open your app in Chrome
2. DevTools > Application > Manifest
3. Check for any manifest errors
`;

	await fileSystemService.writeFile(
		path.join(iconsDir, "README.md"),
		iconReadme,
	);

	// Create screenshots directory
	const screenshotsDir = path.join(appPath, "public/screenshots");
	await fileSystemService.ensureDirectory(screenshotsDir);

	const screenshotsReadme = `# PWA Screenshots

Add screenshots here to enhance your PWA's app store listing.

## Required Screenshots
- desktop.png (1280x720) - Desktop view
- mobile.png (390x844) - Mobile view

Screenshots help users understand your app before installing it.
`;

	await fileSystemService.writeFile(
		path.join(screenshotsDir, "README.md"),
		screenshotsReadme,
	);
}

async function configurePWAForFramework(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	if (
		answers.frontend === "nextjs-app" ||
		answers.frontend === "nextjs-pages"
	) {
		await configureNextJsPWA(appPath, answers);
	} else if (answers.frontend === "vite") {
		await configureVitePWA(appPath, answers);
	}
}

async function configureNextJsPWA(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const nextConfig = `const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\\.json$/],
  publicExcludes: ['!robots.txt', '!sitemap.xml'],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing Next.js config goes here
};

module.exports = withPWA(nextConfig);`;

	await fileSystemService.writeFile(
		path.join(appPath, "next.config.js"),
		nextConfig,
	);

	// Add PWA meta tags to the appropriate layout file
	if (answers.frontend === "nextjs-app") {
		await addPWAMetaToLayout(appPath);
	} else {
		await addPWAMetaToDocument(appPath);
	}
}

async function addPWAMetaToLayout(appPath: string): Promise<void> {
	const layoutPath = path.join(appPath, "src/app/layout.tsx");

	try {
		let layoutContent = await fileSystemService.readFile(layoutPath);

		// Check if metadata export already exists
		if (layoutContent.includes("export const metadata")) {
			// Add PWA metadata to existing metadata object
			const metadataRegex = /(export const metadata[^}]+)}/;
			layoutContent = layoutContent.replace(
				metadataRegex,
				`$1,
  manifest: '/manifest.json',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Your App',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
}`,
			);
		} else {
			// Add complete metadata export
			const metadataExport = `
export const metadata = {
  title: 'Your App',
  description: 'A modern SaaS application',
  manifest: '/manifest.json',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Your App',
  },
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

`;
			// Insert before the default export
			layoutContent = layoutContent.replace(
				/(export default function)/,
				`${metadataExport}$1`,
			);
		}

		await fileSystemService.writeFile(layoutPath, layoutContent);
		logger.success("Added PWA meta tags to layout.tsx");
	} catch (_error) {
		logger.warn(
			"Could not update layout.tsx automatically. Please add PWA meta tags manually.",
		);
	}
}

async function addPWAMetaToDocument(appPath: string): Promise<void> {
	const documentPath = path.join(appPath, "src/pages/_document.tsx");

	const documentContent = `import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Your App" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}`;

	try {
		await fileSystemService.writeFile(documentPath, documentContent);
		logger.success("Created _document.tsx with PWA meta tags");
	} catch (_error) {
		logger.warn(
			"Could not create _document.tsx. PWA meta tags should be added manually.",
		);
	}
}

async function configureVitePWA(
	appPath: string,
	answers: ProjectAnswers,
): Promise<void> {
	const viteConfigPath = path.join(appPath, "vite.config.ts");

	try {
		let viteConfig = await fileSystemService.readFile(viteConfigPath);

		// Add VitePWA import
		viteConfig = viteConfig.replace(
			/import { defineConfig } from 'vite'/,
			`import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'`,
		);

		// Add PWA plugin configuration
		const pwaPlugin = `VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: '${answers.projectName}',
        short_name: '${answers.projectName}',
        description: 'A modern SaaS application',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\\/\\/api\\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              }
            }
          }
        ]
      }
    })`;

		// Add to plugins array
		if (viteConfig.includes("plugins: [")) {
			const pluginsRegex = /plugins: \[(.*?)\]/;
			viteConfig = viteConfig.replace(
				pluginsRegex,
				`plugins: [$1, ${pwaPlugin}]`,
			);
		} else {
			viteConfig = viteConfig.replace(
				/export default defineConfig\({/,
				`export default defineConfig({
  plugins: [${pwaPlugin}],`,
			);
		}

		await fileSystemService.writeFile(viteConfigPath, viteConfig);
		logger.success("Updated vite.config.ts with PWA plugin");
	} catch (_error) {
		logger.warn(
			"Could not update vite.config.ts automatically. Please add PWA plugin manually.",
		);
	}
}

async function createPWADocumentation(appPath: string): Promise<void> {
	const docsDir = path.join(appPath, "docs");
	await fileSystemService.ensureDirectory(docsDir);

	const pwaGuide = `# Progressive Web App (PWA) Guide

Your application is now configured as a Progressive Web App! 🎉

## What's Included

✅ **Web App Manifest** - Makes your app installable
✅ **Service Worker** - Enables offline functionality
✅ **PWA Icons** - Proper icon setup for all platforms
✅ **Framework Integration** - Configured for your chosen framework

## Quick Start

1. **Generate Icons**
   \`\`\`bash
   npx pwa-asset-generator public/icons/icon.svg ./public/icons
   \`\`\`

2. **Test PWA Features**
   - Open your app in Chrome
   - Press F12 → Application tab
   - Check "Manifest" and "Service Workers"

3. **Install Your App**
   - Look for install prompt in supported browsers
   - Chrome: Address bar install button
   - Mobile: "Add to Home Screen"

## File Structure

\`\`\`
public/
├── manifest.json          # App metadata
├── sw.js                 # Service worker (Vite only)
├── icons/                # PWA icons
│   ├── icon.svg         # Source icon
│   ├── icon-192x192.png # Required
│   └── icon-512x512.png # Required
└── screenshots/          # App store screenshots
\`\`\`

## Configuration

### Customizing Your App

Edit \`public/manifest.json\`:
- \`name\` - Full app name
- \`short_name\` - Home screen name
- \`theme_color\` - Browser UI color
- \`background_color\` - Splash screen color

### Testing Installation

1. **Desktop (Chrome)**
   - Install button in address bar
   - Settings → Install [App Name]

2. **Mobile**
   - Share menu → Add to Home Screen
   - Install banner (if eligible)

### PWA Audit

Use Lighthouse to check PWA compliance:
1. Chrome DevTools → Lighthouse
2. Select "Progressive Web App"
3. Generate report
4. Fix any issues found

## Deployment Requirements

⚠️ **HTTPS Required**: PWAs only work on HTTPS in production

Popular PWA-friendly hosts:
- Vercel (automatic HTTPS)
- Netlify (automatic HTTPS)
- Firebase Hosting
- GitHub Pages

## Advanced Features

### Push Notifications
Add push notification support by extending the service worker.

### Background Sync
Enable background data synchronization when online.

### App Store Distribution
- **Android**: Google Play Store via TWA
- **Windows**: Microsoft Store
- **iOS**: Safari Web Apps (limited)

## Troubleshooting

### Common Issues

1. **App not installable**
   - Check HTTPS requirement
   - Verify manifest.json is valid
   - Ensure icons exist

2. **Service worker not updating**
   - Clear browser cache
   - Use "Update on reload" in DevTools
   - Check service worker registration

3. **Icons not showing**
   - Verify file paths in manifest.json
   - Check icon file sizes and formats
   - Use PNG format for best compatibility

### Debug Tools

- **Chrome DevTools**: Application tab
- **PWA Builder**: https://www.pwabuilder.com/
- **Manifest Validator**: Online validation tools

## Resources

- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [PWA Asset Generator](https://github.com/pwa-builder/PWABuilder)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

Need help? Check the [PWA documentation](https://web.dev/progressive-web-apps/) or open an issue in your project repository.
`;

	await fileSystemService.writeFile(
		path.join(docsDir, "pwa-guide.md"),
		pwaGuide,
	);

	logger.success("Created comprehensive PWA documentation");
}