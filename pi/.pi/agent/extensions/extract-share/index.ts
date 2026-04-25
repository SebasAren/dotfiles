import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getLastAssistantMessage } from "./getLastAssistantMessage";
import { htmlToPng } from "./htmlToPng";
import { markdownToHtml } from "./markdownToHtml";
import { copyToClipboard } from "./copyToClipboard";

interface HandlerContext {
  sessionManager: { getBranch: () => any[] };
  hasUI: boolean;
  ui: { notify: (message: string, level: "error" | "warning" | "info") => void };
}

async function runExtract(ctx: HandlerContext, notifyNoUI: boolean): Promise<void> {
  const entries = ctx.sessionManager.getBranch();
  const text = getLastAssistantMessage(entries);

  if (!text) {
    ctx.ui.notify("No assistant message found to extract", "error");
    return;
  }

  if (!ctx.hasUI) {
    if (notifyNoUI) {
      ctx.ui.notify("Extract requires interactive mode", "error");
    }
    return;
  }

  ctx.ui.notify("Extracting last assistant message...", "info");

  try {
    const html = markdownToHtml(text);
    const png = await htmlToPng(html);
    copyToClipboard(png);
    ctx.ui.notify("Message copied to clipboard", "info");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.ui.notify(`Extract failed: ${message}`, "error");
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("extract", {
    description: "Take a screenshot of the last assistant message and copy to clipboard",
    handler: async (_args, ctx) => runExtract(ctx as HandlerContext, true),
  });

  pi.registerShortcut("ctrl+shift+e", {
    description: "Take a screenshot of the last assistant message and copy to clipboard",
    handler: async (ctx) => runExtract(ctx as HandlerContext, false),
  });
}
