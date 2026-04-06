import {
  Component,
  matchesKey,
  Key,
  truncateToWidth,
} from "@mariozechner/pi-tui";

export interface CheckboxItem {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
}

export class CheckboxList implements Component {
  private items: CheckboxItem[];
  private selectedIndex = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];

  public onChange?: (items: CheckboxItem[]) => void;
  public onSubmit?: (items: CheckboxItem[]) => void;
  public onCancel?: () => void;

  constructor(items: CheckboxItem[]) {
    this.items = items;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.invalidate();
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(
        this.items.length - 1,
        this.selectedIndex + 1,
      );
      this.invalidate();
    } else if (matchesKey(data, Key.space)) {
      this.items[this.selectedIndex].checked =
        !this.items[this.selectedIndex].checked;
      this.onChange?.(this.items);
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      this.onSubmit?.(this.items.filter((i) => i.checked));
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
    } else if (matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
    }
  }

  getSelected(): CheckboxItem[] {
    return this.items.filter((i) => i.checked);
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    this.cachedLines = this.items.map((item, index) => {
      const isSelected = index === this.selectedIndex;
      const prefix = isSelected ? "❯ " : "  ";
      const checkbox = item.checked ? "◉ " : "○ ";
      const label = isSelected ? `\x1b[1m${item.label}\x1b[0m` : item.label;
      const desc = item.description ? ` \x1b[2m${item.description}\x1b[0m` : "";
      return truncateToWidth(prefix + checkbox + label + desc, width);
    });

    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
