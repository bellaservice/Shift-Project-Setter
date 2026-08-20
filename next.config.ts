import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages.
 *
 * The site is served from https://bellaservice.github.io/Shift-Project-Setter/,
 * a project page, so every asset and route sits under a `/Shift-Project-Setter`
 * prefix. That prefix must NOT apply during local `next dev`, which serves from
 * the root, so it comes from an env var the Pages workflow sets and nothing else
 * does.
 *
 * `trailingSlash` makes the export emit `about/index.html` rather than
 * `about.html`. GitHub Pages resolves directory URLs to `index.html`, but does
 * not map an extensionless `/about` onto `about.html`, so without this every
 * route but `/` 404s.
 */
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: true,

  // Pages has no image optimizer; the default loader would emit /_next/image
  // URLs that resolve to nothing.
  images: { unoptimized: true },
};

export default nextConfig;
