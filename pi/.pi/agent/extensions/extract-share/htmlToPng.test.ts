import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock Playwright before importing the module under test
const mockPage = {
  setContent: mock(() => Promise.resolve()),
  screenshot: mock(() => Promise.resolve(Buffer.from("fake-png-data"))),
  setDefaultTimeout: mock(() => {}),
};

const mockBrowser = {
  newPage: mock(() => Promise.resolve(mockPage)),
  close: mock(() => Promise.resolve()),
};

const mockChromium = {
  launch: mock(() => Promise.resolve(mockBrowser)),
};

mock.module("playwright", () => ({
  chromium: mockChromium,
}));

import { htmlToPng } from "./htmlToPng";

describe("htmlToPng", () => {
  beforeEach(() => {
    mockChromium.launch.mockClear();
    mockBrowser.newPage.mockClear();
    mockPage.setContent.mockClear();
    mockPage.screenshot.mockClear();
    mockPage.setDefaultTimeout.mockClear();
    mockBrowser.close.mockClear();
  });

  it("launches a headless browser", async () => {
    await htmlToPng("<html><body>Test</body></html>");
    expect(mockChromium.launch).toHaveBeenCalled();
  });

  it("creates a page with ~800px viewport width", async () => {
    await htmlToPng("<html><body>Test</body></html>");
    expect(mockBrowser.newPage).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: expect.objectContaining({ width: 800 }),
      }),
    );
  });

  it("sets the HTML content on the page", async () => {
    const html = "<html><body>Hello World</body></html>";
    await htmlToPng(html);
    expect(mockPage.setContent).toHaveBeenCalledWith(
      html,
      expect.objectContaining({ waitUntil: expect.any(String) }),
    );
  });

  it("takes a full-page PNG screenshot", async () => {
    await htmlToPng("<html><body>Test</body></html>");
    expect(mockPage.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ type: "png", fullPage: true }),
    );
  });

  it("throws a helpful message when Playwright Chromium is not installed", async () => {
    mockChromium.launch.mockImplementationOnce(() => {
      throw new Error("Executable doesn't exist");
    });
    await expect(htmlToPng("<html><body>Test</body></html>")).rejects.toThrow(
      "Playwright Chromium not found. Install it with: npx playwright install chromium",
    );
  });

  it("closes the browser after screenshot", async () => {
    await htmlToPng("<html><body>Test</body></html>");
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("returns a Buffer containing the PNG data", async () => {
    const result = await htmlToPng("<html><body>Test</body></html>");
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe("fake-png-data");
  });

  it("closes the browser even if screenshot fails", async () => {
    mockPage.screenshot.mockImplementationOnce(() => {
      throw new Error("screenshot failed");
    });
    await expect(htmlToPng("<html><body>Test</body></html>")).rejects.toThrow("screenshot failed");
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
