import { chromium, type Browser, type LaunchOptions } from "playwright";

/**
 * Render an HTML string to a PNG image buffer using headless Chromium.
 *
 * Launches Playwright with Chromium, creates a page at 800px viewport width,
 * sets the HTML content, and captures a full-page screenshot.
 *
 * @param html - Complete HTML document string
 * @param launchBrowser - Optional browser launcher for testing (defaults to Chromium)
 * @returns PNG image as a Buffer
 * @throws If Playwright Chromium is not installed
 */
export async function htmlToPng(
  html: string,
  launchBrowser: (options?: LaunchOptions) => Promise<Browser> = chromium.launch.bind(chromium) as (
    options?: LaunchOptions,
  ) => Promise<Browser>,
): Promise<Buffer> {
  let browser;
  try {
    browser = await launchBrowser({ headless: true, timeout: 15000 });
  } catch (cause) {
    throw new Error(
      "Playwright Chromium not found. " +
        "Install it with: npx playwright install chromium\nOriginal error: " +
        (cause instanceof Error ? cause.message : String(cause)),
      { cause },
    );
  }

  try {
    const page = await browser.newPage({
      viewport: { width: 800, height: 600 },
    });
    page.setDefaultTimeout(15000);

    await page.setContent(html, { waitUntil: "load", timeout: 15000 });

    return await page.screenshot({
      type: "png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
}
