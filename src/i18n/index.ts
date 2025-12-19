import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  "zh-CN": {
    translation: {
      // 通用
      app_title: "NetOptim",
      confirm: "确认",
      cancel: "取消",
      save: "保存",
      delete: "删除",
      add: "添加",
      edit: "编辑",
      export: "导出",
      import: "导入",
      clear: "清空",
      refresh: "刷新",
      close: "关闭",
      success: "成功",
      error: "错误",
      warning: "警告",
      loading: "加载中...",

      // 导航
      nav_optimize: "IP 优选",
      nav_hosts: "Hosts 管理",
      nav_history: "历史记录",
      nav_settings: "设置",

      // 预设
      presets: "常用域名",
      add_preset: "添加常用域名",
      preset_placeholder: "example.com",
      preset_exists: "该域名已在列表中",
      no_presets: "暂无预设域名",

      // 优选
      domain_input_placeholder: "输入域名，如 github.com",
      query: "查询",
      querying: "解析中...",
      batch_optimize: "一键优化",
      batch_optimizing: "批量优化中...",
      write_hosts: "写入 Hosts",
      flush_dns: "刷新 DNS",
      test_connectivity: "测试连通性",

      // 结果
      ip_address: "IP 地址",
      latency: "延迟",
      latency_ms: "延迟 (ms)",
      location: "位置",
      cdn: "CDN",
      timeout: "超时",
      no_results: "暂无结果，请输入域名查询",
      found_ips: "找到 {{count}} 个 IP（按延迟排序）",
      best_ip: "最优 IP",

      // Hosts 管理
      hosts_entries: "Hosts 条目",
      no_hosts_entries: "暂无 Hosts 条目",
      remove_entry: "删除条目",
      confirm_remove: "确定要删除这条记录吗？",

      // 历史记录
      history: "历史记录",
      no_history: "暂无历史记录",
      clear_history: "清空历史",
      rollback: "回滚",
      action_write: "写入",
      action_rollback: "回滚",

      // 设置
      settings: "设置",
      language: "语言",
      theme: "主题",
      theme_light: "浅色",
      theme_dark: "深色",
      theme_system: "跟随系统",
      accent_color: "主题色",
      color_blue: "蓝色",
      color_indigo: "靛蓝",
      color_violet: "紫罗兰",
      color_purple: "紫色",
      color_plum: "梅红",
      color_pink: "粉色",
      color_crimson: "绯红",
      color_red: "红色",
      color_tomato: "番茄红",
      color_orange: "橙色",
      color_amber: "琥珀",
      color_yellow: "黄色",
      color_lime: "青柠",
      color_green: "绿色",
      color_grass: "草绿",
      color_teal: "青色",
      color_cyan: "青蓝",
      color_sky: "天蓝",
      color_mint: "薄荷",
      color_jade: "翡翠",
      minimize_to_tray: "关闭时最小化到托盘",
      auto_start: "开机自启",
      scheduler: "定时任务",
      scheduler_enabled: "启用定时检测",
      scheduler_interval: "检测间隔（分钟）",
      scheduler_auto_update: "自动更新 Hosts",
      scheduler_notify: "发现更优 IP 时通知",

      // 状态
      status_ready: "请输入域名或从左侧选择常用域名",
      status_resolving: "正在解析 {{domain}} ...",
      status_written: "已写入: {{ip}} -> {{domain}}",
      status_dns_flushed: "DNS 缓存已刷新",
      status_connectivity_ok: "连接成功，延迟 {{latency}}ms",
      status_connectivity_fail: "连接失败: {{error}}",
      status_no_admin: "未以管理员身份运行，无法修改 hosts 文件",
      status_proxy_needed: "可能需要代理访问",
      status_direct_access: "可直接访问",
      error_with_msg: "错误: {{msg}}",
      batch_result: "批量优化: {{success}}/{{total}} 成功",

      // 提示
      tip_main: "点击左侧常用域名快速查询，选择延迟最低的 IP 写入 hosts 文件",
      tip_batch: "一键优化将对所有预设域名进行解析并写入最优 IP",
    },
  },
  "en-US": {
    translation: {
      // Common
      app_title: "NetOptim",
      confirm: "Confirm",
      cancel: "Cancel",
      save: "Save",
      delete: "Delete",
      add: "Add",
      edit: "Edit",
      export: "Export",
      import: "Import",
      clear: "Clear",
      refresh: "Refresh",
      close: "Close",
      success: "Success",
      error: "Error",
      warning: "Warning",
      loading: "Loading...",

      // Navigation
      nav_optimize: "IP Optimize",
      nav_hosts: "Hosts Manager",
      nav_history: "History",
      nav_settings: "Settings",

      // Presets
      presets: "Presets",
      add_preset: "Add Preset Domain",
      preset_placeholder: "example.com",
      preset_exists: "Domain already exists",
      no_presets: "No preset domains",

      // Optimize
      domain_input_placeholder: "Enter domain, e.g. github.com",
      query: "Query",
      querying: "Resolving...",
      batch_optimize: "Batch Optimize",
      batch_optimizing: "Optimizing...",
      write_hosts: "Write to Hosts",
      flush_dns: "Flush DNS",
      test_connectivity: "Test Connectivity",

      // Results
      ip_address: "IP Address",
      latency: "Latency",
      latency_ms: "Latency (ms)",
      location: "Location",
      cdn: "CDN",
      timeout: "Timeout",
      no_results: "No results, please enter a domain to query",
      found_ips: "Found {{count}} IPs (sorted by latency)",
      best_ip: "Best IP",

      // Hosts Management
      hosts_entries: "Hosts Entries",
      no_hosts_entries: "No hosts entries",
      remove_entry: "Remove Entry",
      confirm_remove: "Are you sure you want to remove this entry?",

      // History
      history: "History",
      no_history: "No history",
      clear_history: "Clear History",
      rollback: "Rollback",
      action_write: "Write",
      action_rollback: "Rollback",

      // Settings
      settings: "Settings",
      language: "Language",
      theme: "Theme",
      theme_light: "Light",
      theme_dark: "Dark",
      theme_system: "System",
      accent_color: "Accent Color",
      color_blue: "Blue",
      color_indigo: "Indigo",
      color_violet: "Violet",
      color_purple: "Purple",
      color_plum: "Plum",
      color_pink: "Pink",
      color_crimson: "Crimson",
      color_red: "Red",
      color_tomato: "Tomato",
      color_orange: "Orange",
      color_amber: "Amber",
      color_yellow: "Yellow",
      color_lime: "Lime",
      color_green: "Green",
      color_grass: "Grass",
      color_teal: "Teal",
      color_cyan: "Cyan",
      color_sky: "Sky",
      color_mint: "Mint",
      color_jade: "Jade",
      minimize_to_tray: "Minimize to tray on close",
      auto_start: "Start on boot",
      scheduler: "Scheduler",
      scheduler_enabled: "Enable scheduled check",
      scheduler_interval: "Check interval (minutes)",
      scheduler_auto_update: "Auto update Hosts",
      scheduler_notify: "Notify when better IP found",

      // Status
      status_ready: "Enter a domain or select from presets",
      status_resolving: "Resolving {{domain}} ...",
      status_written: "Written: {{ip}} -> {{domain}}",
      status_dns_flushed: "DNS cache flushed",
      status_connectivity_ok: "Connected, latency {{latency}}ms",
      status_connectivity_fail: "Connection failed: {{error}}",
      status_no_admin: "Not running as admin, cannot modify hosts file",
      status_proxy_needed: "Proxy may be required",
      status_direct_access: "Direct access available",
      error_with_msg: "Error: {{msg}}",
      batch_result: "Batch optimize: {{success}}/{{total}} succeeded",

      // Tips
      tip_main:
        "Click preset domains to query, select the lowest latency IP to write to hosts",
      tip_batch: "Batch optimize will resolve all preset domains and write the best IPs",
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "zh-CN",
  fallbackLng: "zh-CN",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
