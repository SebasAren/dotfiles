import { describe, it, expect, mock, beforeEach } from "bun:test";
import { htmlToPng } from "./htmlToPng.ts?bypass-mock";

const mockPage = {
  setContent: mock(() => Promise.resolve()),
  screenshot: mock(() => Promise.resolve(Buffer.from("fake-png-data"))),
  setDefaultTimeout: mock(() => {}),
};

const mockBrowser = {
  newPage: mock(() => Promise.resolve(mockPage)),
  close: mock(() => Promise.resolve()),
};

const mockLaunch = mock(() => Promise.resolve(mockBrowser));

describe("htmlToPng", () => {
  beforeEach(() => {
    mockLaunch.mockClear();
    mockBrowser.newPage.mockClear();
    mockPage.setContent.mockClear();
    mockPage.screenshot.mockClear();
    mockPage.setDefaultTimeout.mockClear();
    mockBrowser.close.mockClear();
  });

  it("launches a headless browser", async () => {
    await htmlToPng("<html><body>Test</body></html>", mockLaunch);
    expect(mockLaunch).toHaveBeenCalled();
  });

  it("creates a page with ~800px viewport width", async () => {
    await htmlToPng("<html><body>Test</body></html>", mockLaunch);
    expect(mockBrowser.newPage).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: expect.objectContaining({ width: 800 }),
      }),
    );
  });

  it("sets the HTML content on the page", async () => {
    const html = "<html><body>Hello World</body></html>";
    await htmlToPng(html, mockLaunch);
    expect(mockPage.setContent).toHaveBeenCalledWith(
      html,
      expect.objectContaining({ waitUntil: expect.any(String) }),
    );
  });

  it("takes a full-page PNG screenshot", async () => {
    await htmlToPng("<html><body>Test</body></html>", mockLaunch);
    expect(mockPage.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ type: "png", fullPage: true }),
    );
  });

  it("throws a helpful message when Playwright Chromium is not installed", async () => {
    mockLaunch.mockImplementationOnce(() => {
      throw new Error("Executable doesn't exist");
    });
    await expect(htmlToPng("<html><body>Test</body></html>", mockLaunch)).rejects.toThrow(
      "Playwright Chromium not found. Install it with: npx playwright install chromium",
    );
  });

  it("closes the browser after screenshot", async () => {
    await htmlToPng("<html><body>Test</body></html>", mockLaunch);
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("returns a Buffer containing the PNG data", async () => {
    const result = await htmlToPng("<html><body>Test</body></html>", mockLaunch);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString()).toBe("fake-png-data");
  });

  it("closes the browser even if screenshot fails", async () => {
    mockPage.screenshot.mockImplementationOnce(() => {
      throw new Error("screenshot failed");
    });
    await expect(htmlToPng("<html><body>Test</body></html>", mockLaunch)).rejects.toThrow(
      "screenshot failed",
    );
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
