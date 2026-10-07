import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { defineConfig } from "vite";

// SvelteKit as a static single-page app (specs/007-sveltekit-ui-migration, research R1 to R6):
//  - hash routing keeps the #/help address and the ?join= and ?watch= query links
//  - the app registers its own service worker, to keep the update-bar flow
//  - the base path is a build-time setting, set by scripts/build.mjs (BASE_PATH), empty for a root host
export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ pages: process.env.BUILD_DIR ?? "build" }),
      router: { type: "hash" },
      serviceWorker: { register: false },
      paths: { base: (process.env.BASE_PATH ?? "") as "" | `/${string}` },
    }),
  ],
});
