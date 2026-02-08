import { themeRegistry, useMarkdownTheme } from "./registry";
import { defaultTheme } from "./builtin/default";
import { mediumTheme } from "./builtin/medium";
import { classicTypoTheme } from "./builtin/classic-typo";
import { xiaoshengTheme } from "./builtin/xiaosheng";

themeRegistry.register(defaultTheme);
themeRegistry.register(mediumTheme);
themeRegistry.register(classicTypoTheme);
themeRegistry.register(xiaoshengTheme);

export { themeRegistry, useMarkdownTheme };
export type { MarkdownTheme } from "./types";
