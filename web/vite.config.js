import { defineConfig } from "vite";

// "./" keeps every asset URL relative, so the same build works on GitHub Pages
// (https://user.github.io/repo/), Vercel, or any other folder. The app uses #/ routes, so there
// are no server-side routes to configure.
export default defineConfig({
  base: "./",
});
