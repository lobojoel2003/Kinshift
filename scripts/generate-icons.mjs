// Renders the PWA icons, favicon and social preview from the SVG sources.
// Usage: npm run icons
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const icons = path.join(root, "public", "icons");
const app = path.join(root, "src", "app");

const icon = await fs.readFile(path.join(icons, "icon.svg"));
const maskable = await fs.readFile(path.join(icons, "icon-maskable.svg"));
const badge = await fs.readFile(path.join(icons, "badge.svg"));

const render = (svg, size, out) =>
  sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);

await render(icon, 192, path.join(icons, "icon-192.png"));
await render(icon, 512, path.join(icons, "icon-512.png"));
await render(maskable, 192, path.join(icons, "maskable-192.png"));
await render(maskable, 512, path.join(icons, "maskable-512.png"));
await render(badge, 96, path.join(icons, "badge-96.png"));
await render(maskable, 180, path.join(app, "apple-icon.png"));
await fs.copyFile(path.join(icons, "icon.svg"), path.join(app, "icon.svg"));

console.log("Icons written to public/icons and src/app");
