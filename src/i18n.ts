export type Locale = "en" | "zh";

const dict: Record<string, Record<Locale, string>> = {
  // Sidebar
  "sidebar.agentConfig": { en: "Agent Config", zh: "智能体配置" },
  "sidebar.files": { en: "Files", zh: "文件" },
  "sidebar.search": { en: "Search…", zh: "搜索…" },
  "sidebar.footer": { en: "Silicon Dawn · Memory Viewer", zh: "Silicon Dawn · 记忆查看器" },
  "sidebar.showSensitive": { en: "Show sensitive content", zh: "显示敏感内容" },
  "sidebar.hideSensitive": { en: "Hide sensitive content", zh: "隐藏敏感内容" },
  "sidebar.lightMode": { en: "Switch to light mode", zh: "切换到浅色模式" },
  "sidebar.darkMode": { en: "Switch to dark mode", zh: "切换到深色模式" },

  // Dashboard
  "dashboard.title": { en: "Dashboard", zh: "仪表盘" },
  "dashboard.uptime": { en: "Uptime", zh: "运行时间" },
  "dashboard.memory": { en: "Memory", zh: "内存" },
  "dashboard.load": { en: "Load", zh: "负载" },
  "dashboard.files": { en: "Files", zh: "文件" },
  "dashboard.mdTracked": { en: ".md files tracked", zh: "个 .md 文件" },
  "dashboard.todayMemory": { en: "Today's Memory", zh: "今日记忆" },
  "dashboard.viewFull": { en: "View full →", zh: "查看全部 →" },
  "dashboard.noMemoryToday": { en: "No memory entries for today yet.", zh: "今天还没有记忆条目。" },
  "dashboard.recentlyModified": { en: "Recently Modified", zh: "最近修改" },
  "dashboard.memoryByMonth": { en: "Memory by Month", zh: "月度记忆" },
  "dashboard.quickAccess": { en: "Quick Access", zh: "快速访问" },
  "dashboard.loading": { en: "Loading…", zh: "加载中…" },
  "dashboard.noFiles": { en: "No files found.", zh: "未找到文件。" },
  "dashboard.noMemoryFiles": { en: "No memory files found.", zh: "未找到记忆文件。" },
  "dashboard.characters": { en: "characters", zh: "个字符" },
  "dashboard.justNow": { en: "just now", zh: "刚刚" },
  "dashboard.minAgo": { en: "min ago", zh: "分钟前" },
  "dashboard.hAgo": { en: "h ago", zh: "小时前" },
  "dashboard.dAgo": { en: "d ago", zh: "天前" },

  // FileViewer
  "file.edit": { en: "Edit", zh: "编辑" },
  "file.save": { en: "Save", zh: "保存" },
  "file.cancel": { en: "Cancel", zh: "取消" },
  "file.saved": { en: "Saved", zh: "已保存" },
  "file.failedToLoad": { en: "Failed to load", zh: "加载失败" },
  "file.saveFailed": { en: "Save failed", zh: "保存失败" },
  "file.words": { en: "words", zh: "词" },
  "file.discardChanges": { en: "Discard unsaved changes?", zh: "放弃未保存的更改？" },
  "file.loading": { en: "Loading…", zh: "加载中…" },
  "file.backToTop": { en: "Back to top", zh: "返回顶部" },
  "file.copy": { en: "Copy", zh: "复制" },

  // Search
  "search.placeholder": { en: "Search all memory files…", zh: "搜索所有记忆文件…" },
  "search.noResults": { en: "No results found for", zh: "未找到相关结果：" },
  "search.files": { en: "files", zh: "个文件" },
  "search.matches": { en: "matches", zh: "个匹配" },

  // Connections
  "connections.title": { en: "Connections", zh: "连接管理" },
  "connections.add": { en: "Add", zh: "添加" },
  "connections.addNew": { en: "Add Connection", zh: "添加连接" },
  "connections.edit": { en: "Edit Connection", zh: "编辑连接" },
  "connections.save": { en: "Save", zh: "保存" },
  "connections.cancel": { en: "Cancel", zh: "取消" },
  "connections.refresh": { en: "Refresh", zh: "刷新" },
  "connections.active": { en: "Active", zh: "当前连接" },
  "connections.namePlaceholder": { en: "Name (e.g. Bot 01)", zh: "名称（如 Bot 01）" },
  "connections.urlPlaceholder": { en: "URL (e.g. http://host:8901)", zh: "URL（如 http://host:8901）" },
  "connections.tokenPlaceholder": { en: "Token (optional)", zh: "Token（可选）" },
  "connections.switchBot": { en: "Switch Bot", zh: "切换 Bot" },
  "connections.manage": { en: "Manage", zh: "管理" },

  // Months
  "month.01": { en: "Jan", zh: "1月" },
  "month.02": { en: "Feb", zh: "2月" },
  "month.03": { en: "Mar", zh: "3月" },
  "month.04": { en: "Apr", zh: "4月" },
  "month.05": { en: "May", zh: "5月" },
  "month.06": { en: "Jun", zh: "6月" },
  "month.07": { en: "Jul", zh: "7月" },
  "month.08": { en: "Aug", zh: "8月" },
  "month.09": { en: "Sep", zh: "9月" },
  "month.10": { en: "Oct", zh: "10月" },
  "month.11": { en: "Nov", zh: "11月" },
  "month.12": { en: "Dec", zh: "12月" },
};

export function translate(key: string, locale: Locale): string {
  return dict[key]?.[locale] ?? key;
}
