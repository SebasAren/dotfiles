import { describe, it, expect, mock, beforeEach } from "bun:test";

// Mock pipeline functions — no mock.module() for local modules to avoid cross-contamination
const mockGetLastAssistantMessage = mock(() => "Hello from assistant");
const mockMarkdownToHtml = mock((text: string) => `<p>${text}</p>`);
const mockHtmlToPng = mock(async (_html: string) => Buffer.from("png-data"));
const mockCopyToClipboard = mock((_png: Buffer) => {});

import { createExtension } from "./index";

describe("extract-share extension", () => {
  beforeEach(() => {
    mockGetLastAssistantMessage.mockClear();
    mockMarkdownToHtml.mockClear();
    mockHtmlToPng.mockClear();
    mockCopyToClipboard.mockClear();
  });

  /** Build the extension with mocked pipeline deps */
  function buildExtension() {
    return createExtension({
      getLastAssistantMessage: mockGetLastAssistantMessage,
      htmlToPng: mockHtmlToPng,
      markdownToHtml: mockMarkdownToHtml,
      copyToClipboard: mockCopyToClipboard,
    });
  }

  describe("registration", () => {
    it("registers a command named 'extract'", () => {
      const registered: { name: string; description: string }[] = [];
      const mockApi = {
        registerCommand: (name: string, opts: any) =>
          registered.push({ name, description: opts.description }),
        registerShortcut: mock(() => {}),
      };

      buildExtension()(mockApi as any);

      expect(registered).toHaveLength(1);
      expect(registered[0].name).toBe("extract");
      expect(registered[0].description).toMatch(/screenshot/i);
    });

    it("registers a shortcut 'ctrl+shift+e'", () => {
      const registered: { shortcut: string; description: string }[] = [];
      const mockApi = {
        registerCommand: mock(() => {}),
        registerShortcut: (shortcut: string, opts: any) =>
          registered.push({ shortcut, description: opts.description }),
      };

      buildExtension()(mockApi as any);

      expect(registered).toHaveLength(1);
      expect(registered[0].shortcut).toBe("ctrl+shift+e");
      expect(registered[0].description).toMatch(/screenshot/i);
    });
  });

  describe("command handler pipeline", () => {
    it("calls getLastAssistantMessage → markdownToHtml → htmlToPng → copyToClipboard in order", async () => {
      let handler: Function = () => {};
      const notifyMock = mock(() => {});
      const mockApi = {
        registerCommand: (_name: string, opts: any) => {
          handler = opts.handler;
        },
        registerShortcut: mock(() => {}),
      };

      buildExtension()(mockApi as any);

      const mockCtx = {
        sessionManager: {
          getBranch: () => [],
        },
        hasUI: true,
        ui: {
          notify: notifyMock,
        },
      };

      await handler("", mockCtx as any);

      expect(mockGetLastAssistantMessage).toHaveBeenCalledTimes(1);
      expect(mockMarkdownToHtml).toHaveBeenCalledWith("Hello from assistant");
      expect(mockHtmlToPng).toHaveBeenCalledTimes(1);
      expect(mockCopyToClipboard).toHaveBeenCalledTimes(1);
      expect(notifyMock).toHaveBeenLastCalledWith("Message copied to clipboard", "info");
    });

    it("shows error notification when no assistant message found", async () => {
      mockGetLastAssistantMessage.mockImplementation(() => null);

      let handler: Function = () => {};
      const notifyMock = mock(() => {});
      const mockApi = {
        registerCommand: (_name: string, opts: any) => {
          handler = opts.handler;
        },
        registerShortcut: mock(() => {}),
      };

      buildExtension()(mockApi as any);

      const mockCtx = {
        sessionManager: {
          getBranch: () => [],
        },
        hasUI: true,
        ui: {
          notify: notifyMock,
        },
      };

      await handler("", mockCtx as any);

      expect(mockGetLastAssistantMessage).toHaveBeenCalledTimes(1);
      expect(mockMarkdownToHtml).not.toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalledWith("No assistant message found to extract", "error");
    });

    it("shows error when interactive mode is not available", async () => {
      mockGetLastAssistantMessage.mockImplementation(() => "Some text");

      let handler: Function = () => {};
      const notifyMock = mock(() => {});
      const mockApi = {
        registerCommand: (_name: string, opts: any) => {
          handler = opts.handler;
        },
        registerShortcut: mock(() => {}),
      };

      buildExtension()(mockApi as any);

      const mockCtx = {
        sessionManager: {
          getBranch: () => [],
        },
        hasUI: false,
        ui: {
          notify: notifyMock,
        },
      };

      await handler("", mockCtx as any);

      expect(notifyMock).toHaveBeenCalledWith("Extract requires interactive mode", "error");
      expect(mockMarkdownToHtml).not.toHaveBeenCalled();
    });

    it("shows error notification when pipeline throws", async () => {
      mockGetLastAssistantMessage.mockImplementation(() => "Some text");
      mockHtmlToPng.mockRejectedValue(new Error("Playwright not installed"));

      let handler: Function = () => {};
      const notifyMock = mock(() => {});
      const mockApi = {
        registerCommand: (_name: string, opts: any) => {
          handler = opts.handler;
        },
        registerShortcut: mock(() => {}),
      };

      buildExtension()(mockApi as any);

      const mockCtx = {
        sessionManager: {
          getBranch: () => [],
        },
        hasUI: true,
        ui: {
          notify: notifyMock,
        },
      };

      await handler("", mockCtx as any);

      expect(notifyMock).toHaveBeenCalledWith("Extract failed: Playwright not installed", "error");
    });
  });

  describe("shortcut handler pipeline", () => {
    it("runs pipeline when hasUI is true", async () => {
      mockGetLastAssistantMessage.mockImplementation(() => "Hello from shortcut");
      mockMarkdownToHtml.mockImplementation((text: string) => `<p>${text}</p>`);
      mockHtmlToPng.mockImplementation(async () => Buffer.from("png-data"));
      mockCopyToClipboard.mockImplementation(() => {});

      let handler: Function = () => {};
      const notifyMock = mock(() => {});
      const mockApi = {
        registerCommand: mock(() => {}),
        registerShortcut: (_shortcut: string, opts: any) => {
          handler = opts.handler;
        },
      };

      buildExtension()(mockApi as any);

      const mockCtx = {
        sessionManager: {
          getBranch: () => [],
        },
        hasUI: true,
        ui: {
          notify: notifyMock,
        },
      };

      await handler(mockCtx as any);

      expect(mockGetLastAssistantMessage).toHaveBeenCalled();
      expect(mockMarkdownToHtml).toHaveBeenCalled();
      expect(mockHtmlToPng).toHaveBeenCalled();
      expect(mockCopyToClipboard).toHaveBeenCalled();
    });

    it("silently returns when hasUI is false (no notify)", async () => {
      mockGetLastAssistantMessage.mockImplementation(() => "Some text");

      let handler: Function = () => {};
      const notifyMock = mock(() => {});
      const mockApi = {
        registerCommand: mock(() => {}),
        registerShortcut: (_shortcut: string, opts: any) => {
          handler = opts.handler;
        },
      };

      buildExtension()(mockApi as any);

      const mockCtx = {
        sessionManager: {
          getBranch: () => [],
        },
        hasUI: false,
        ui: {
          notify: notifyMock,
        },
      };

      await handler(mockCtx as any);

      expect(notifyMock).not.toHaveBeenCalled();
      expect(mockMarkdownToHtml).not.toHaveBeenCalled();
      expect(mockHtmlToPng).not.toHaveBeenCalled();
    });
  });
});
