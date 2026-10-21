import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const sourcePath = new URL(
  "../apps/client/public/pwa-icon.svg",
  import.meta.url,
);
const outputDirectory = new URL("../apps/client/public/", import.meta.url);
const svg = await readFile(sourcePath, "utf8");
const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const icons = [
  [192, "pwa-192x192.png"],
  [512, "pwa-512x512.png"],
  [180, "apple-touch-icon.png"],
];

const browser = await chromium.launch();
try {
  for (const [size, name] of icons) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}img{display:block;width:100%;height:100%}</style><img src="${source}" alt="">`,
    );
    await page
      .locator("img")
      .screenshot({ path: new URL(name, outputDirectory).pathname.slice(1) });
    await page.close();
  }
} finally {
  await browser.close();
}
