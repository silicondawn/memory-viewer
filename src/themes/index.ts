import { themeRegistry, useMarkdownTheme } from "./registry";
import { defaultTheme } from "./builtin/default";
import { mediumTheme } from "./builtin/medium";

themeRegistry.register(defaultTheme);
themeRegistry.register(mediumTheme);

export { themeRegistry, useMarkdownTheme };
export type { MarkdownTheme } from "./types";
