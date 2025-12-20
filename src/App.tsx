import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";

// 状态消息类型，支持动态翻译
interface StatusMessage {
  key: string;
  params?: Record<string, string | number>;
}
import {
  Flex,
  Text,
  Button,
  Heading,
  Box,
  IconButton,
  Dialog,
  DropdownMenu,
  Tabs,
} from "@radix-ui/themes";
import {
  CheckIcon,
  ExclamationTriangleIcon,
  SunIcon,
  MoonIcon,
  DesktopIcon,
  RocketIcon,
  GlobeIcon,
  ActivityLogIcon,
  MixerHorizontalIcon,
  FileTextIcon,
  ClockIcon,
  GearIcon,
  DotsHorizontalIcon,
} from "@radix-ui/react-icons";
import { useTheme } from "./ThemeContext";
import "./i18n";
import "./App.css";
import type {
  IpResult,
  ResolveResult,
  BatchResult,
  HostEntry,
  HistoryEntry,
  SchedulerConfig,
  AppSettings,
  TabType,
  Blacklist,
  MonitorConfig,
  MonitorState,
  MonitorRecord,
  HostsBackup,
  TracerouteResult,
  DnsQueryResult,
  PingDiagResult,
  HttpDiagResult,
  RuleConfig,
  RuleSource,
  NetworkDiagnostic,
} from "./types";
import { OptimizePage } from "./components/OptimizePage";
import { HostsPage } from "./components/HostsPage";
import { MonitorPage } from "./components/MonitorPage";
import { DiagnosticPage } from "./components/DiagnosticPage";
import { RulesPage } from "./components/RulesPage";
import { HistoryPage } from "./components/HistoryPage";
import { SettingsPage } from "./components/SettingsPage";

function App() {
  const { t, i18n } = useTranslation();
  const { mode, setMode, appearance, accentColor, setAccentColor } = useTheme();

  // State
  const [activeTab, setActiveTab] = useState<TabType>("optimize");
  const [domain, setDomain] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [results, setResults] = useState<IpResult[]>([]);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [currentDomain, setCurrentDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage>({ key: "status_ready" });
  const [isAdmin, setIsAdmin] = useState(false);

  // 动态翻译状态消息
  const status = useMemo(() => t(statusMsg.key, statusMsg.params), [t, statusMsg]);
  const [newPreset, setNewPreset] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Hosts management
  const [hostsEntries, setHostsEntries] = useState<HostEntry[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Settings
  const [settings, setSettings] = useState<AppSettings>({
    language: "zh-CN",
    minimize_to_tray: true,
    start_minimized: false,
    check_updates: true,
  });
  const [schedulerConfig, setSchedulerConfig] = useState<SchedulerConfig>({
    enabled: false,
    interval_minutes: 60,
    auto_update: false,
    notify: true,
  });

  // Import/Export dialogs
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<"presets" | "hosts">("presets");
  const [importJson, setImportJson] = useState("");

  // Monitor state
  const [monitorState, setMonitorState] = useState<MonitorState | null>(null);
  const [monitorConfig, setMonitorConfig] = useState<MonitorConfig>({
    enabled: false,
    check_interval_seconds: 60,
    warning_threshold_percent: 50,
    critical_threshold_ms: 500,
    auto_reoptimize: false,
    max_records: 100,
  });

  // Backup state
  const [backups, setBackups] = useState<HostsBackup[]>([]);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupDescription, setBackupDescription] = useState("");
  const [viewBackupContent, setViewBackupContent] = useState<string | null>(null);

  // Diagnostic state
  const [diagTarget, setDiagTarget] = useState("");
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagType, setDiagType] = useState<"ping" | "dns" | "traceroute" | "http" | "full">("ping");
  const [diagResult, setDiagResult] = useState<NetworkDiagnostic | null>(null);

  // Rules state
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>({
    sources: [],
    auto_update: false,
    update_interval_hours: 24,
  });
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleUrl, setNewRuleUrl] = useState("");

  // Blacklist state
  const [blacklist, setBlacklist] = useState<Blacklist>({ entries: [] });

  // Logs state
  const [logs, setLogs] = useState<string[]>([]);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logFiles, setLogFiles] = useState<[string, number][]>([]);

  // Proxy check state
  const [proxyCheckResult, setProxyCheckResult] = useState<{ needs_proxy: boolean; message: string } | null>(null);

  // IP details state
  const [ipDetailsDialogOpen, setIpDetailsDialogOpen] = useState(false);
  const [selectedIpDetails, setSelectedIpDetails] = useState<{ ip: string; location?: string; cdn?: string } | null>(null);

  // Ref for batch optimize to avoid useEffect dependency issues
  const handleBatchOptimizeRef = useRef<() => void>(() => { });

  // Responsive tabs
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [visibleTabCount, setVisibleTabCount] = useState(7);

  const allTabs: { value: TabType; icon: React.ReactNode; label: string }[] = useMemo(() => [
    { value: "optimize", icon: <RocketIcon />, label: t("nav_optimize") },
    { value: "hosts", icon: <GlobeIcon />, label: t("nav_hosts") },
    { value: "monitor", icon: <ActivityLogIcon />, label: t("nav_monitor") },
    { value: "diagnostic", icon: <MixerHorizontalIcon />, label: t("nav_diagnostic") },
    { value: "rules", icon: <FileTextIcon />, label: t("nav_rules") },
    { value: "history", icon: <ClockIcon />, label: t("nav_history") },
    { value: "settings", icon: <GearIcon />, label: t("nav_settings") },
  ], [t]);

  const visibleTabs = allTabs.slice(0, visibleTabCount);
  const overflowTabs = allTabs.slice(visibleTabCount);

  const updateVisibleTabs = useCallback(() => {
    if (!tabsContainerRef.current) return;
    const containerWidth = tabsContainerRef.current.offsetWidth;
    // 估算每个标签约 120px，更多按钮约 50px
    const tabWidth = 120;
    const moreButtonWidth = 50;
    const availableWidth = containerWidth - moreButtonWidth - 20;
    const count = Math.max(2, Math.min(7, Math.floor(availableWidth / tabWidth)));
    setVisibleTabCount(count);
  }, []);

  useEffect(() => {
    updateVisibleTabs();
    window.addEventListener("resize", updateVisibleTabs);
    return () => window.removeEventListener("resize", updateVisibleTabs);
  }, [updateVisibleTabs]);

  useEffect(() => {
    // macOS/Linux 会在需要时请求权限，所以默认设为 true
    // Windows 需要检查是否以管理员身份运行
    checkAdmin();
    loadPresets();
    loadSettings();
    loadSchedulerConfig();
    setStatusMsg({ key: "status_ready" });

    // Listen for batch optimize trigger from tray
    const unlisten = listen("trigger-batch-optimize", () => {
      // 使用 ref 来避免依赖问题
      handleBatchOptimizeRef.current();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "hosts") {
      loadHostsEntries();
    } else if (activeTab === "history") {
      loadHistory();
    } else if (activeTab === "monitor") {
      loadMonitorState();
    } else if (activeTab === "rules") {
      loadRuleConfig();
    } else if (activeTab === "settings") {
      loadBackups();
      loadBlacklist();
    }
  }, [activeTab]);

  async function loadPresets() {
    try {
      const data = await invoke<string[]>("get_presets");
      setPresets(data);
    } catch (e) {
      console.error("加载预设失败:", e);
    }
  }

  async function checkAdmin() {
    try {
      const admin = await invoke<boolean>("check_admin");
      setIsAdmin(admin);
    } catch (e) {
      console.error("检查权限失败:", e);
    }
  }

  async function loadSettings() {
    try {
      const s = await invoke<AppSettings>("get_settings");
      setSettings(s);
      i18n.changeLanguage(s.language);
    } catch (e) {
      console.error("加载设置失败:", e);
    }
  }

  async function loadSchedulerConfig() {
    try {
      const config = await invoke<SchedulerConfig>("get_scheduler_config");
      setSchedulerConfig(config);
    } catch (e) {
      console.error("加载定时任务配置失败:", e);
    }
  }

  async function loadHostsEntries() {
    setHostsLoading(true);
    try {
      const entries = await invoke<HostEntry[]>("get_hosts_entries");
      setHostsEntries(entries);
    } catch (e) {
      console.error("加载 hosts 条目失败:", e);
    } finally {
      setHostsLoading(false);
    }
  }

  async function loadHistory() {
    try {
      const h = await invoke<HistoryEntry[]>("get_history");
      setHistory(h);
    } catch (e) {
      console.error("加载历史记录失败:", e);
    }
  }

  async function loadMonitorState() {
    try {
      const state = await invoke<MonitorState>("get_monitor_state");
      setMonitorState(state);
      setMonitorConfig(state.config);
    } catch (e) {
      console.error("加载监控状态失败:", e);
    }
  }

  async function loadBackups() {
    try {
      const list = await invoke<{ backups: HostsBackup[] }>("get_backups");
      setBackups(list.backups);
    } catch (e) {
      console.error("加载备份列表失败:", e);
    }
  }

  async function loadRuleConfig() {
    try {
      const config = await invoke<RuleConfig>("get_rule_config");
      setRuleConfig(config);
    } catch (e) {
      console.error("加载规则配置失败:", e);
    }
  }

  async function loadBlacklist() {
    try {
      const bl = await invoke<Blacklist>("get_blacklist");
      setBlacklist(bl);
    } catch (e) {
      console.error("加载黑名单失败:", e);
    }
  }

  // 验证域名格式
  function isValidDomain(domain: string): boolean {
    // 域名必须包含至少一个点，且不能以点开头或结尾
    // 每个部分只能包含字母、数字和连字符，且不能以连字符开头或结尾
    const domainRegex = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
    return domainRegex.test(domain);
  }

  async function handleResolve(targetDomain?: string) {
    const d = targetDomain || domain;
    if (!d.trim()) {
      setStatusMsg({ key: "status_ready" });
      return;
    }

    // 验证域名格式
    if (!isValidDomain(d.trim())) {
      setStatusMsg({ key: "invalid_domain_format" });
      return;
    }

    setLoading(true);
    setResults([]);
    setSelectedIp(null);
    setCurrentDomain(d);
    setStatusMsg({ key: "status_resolving", params: { domain: d } });

    try {
      const result = await invoke<ResolveResult>("resolve_and_ping", { domain: d, lang: i18n.language });
      setResults(result.results);
      setStatusMsg({ key: "found_ips", params: { count: result.results.length } });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchOptimize() {
    if (presets.length === 0) {
      setStatusMsg({ key: "no_presets" });
      return;
    }

    setBatchLoading(true);
    setStatusMsg({ key: "batch_optimizing" });

    try {
      const results = await invoke<BatchResult[]>("batch_optimize", { autoWrite: true, lang: i18n.language });
      const successCount = results.filter((r) => r.success).length;
      setStatusMsg({ key: "batch_result", params: { success: successCount, total: results.length } });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    } finally {
      setBatchLoading(false);
    }
  }

  // Update ref when handleBatchOptimize changes
  useEffect(() => {
    handleBatchOptimizeRef.current = handleBatchOptimize;
  });

  async function handleWriteHosts() {
    if (!selectedIp || !currentDomain) return;

    try {
      const selectedResult = results.find((r) => r.ip === selectedIp);
      const result = await invoke<{ ip: string; domain: string }>("write_to_hosts", {
        domain: currentDomain,
        ip: selectedIp,
        latency: selectedResult?.latency,
      });
      setStatusMsg({ key: "status_written", params: { ip: result.ip, domain: result.domain } });
      await invoke("flush_dns");
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleFlushDns() {
    try {
      await invoke("flush_dns");
      setStatusMsg({ key: "status_dns_flushed" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleTestConnectivity() {
    if (!currentDomain) return;

    try {
      const result = await invoke<{ reachable: boolean; latency: number | null; error: string | null }>(
        "test_connectivity",
        { domain: currentDomain }
      );
      if (result.reachable) {
        setStatusMsg({ key: "status_connectivity_ok", params: { latency: result.latency ?? 0 } });
      } else {
        setStatusMsg({ key: "status_connectivity_fail", params: { error: result.error ?? "Unknown" } });
      }
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function addPreset() {
    if (!newPreset.trim()) return;
    const d = newPreset.trim().toLowerCase();

    // 验证域名格式
    if (!isValidDomain(d)) {
      setStatusMsg({ key: "invalid_domain_format" });
      return;
    }

    if (presets.includes(d)) {
      setStatusMsg({ key: "preset_exists" });
      return;
    }
    const newList = [...presets, d];
    try {
      await invoke("save_presets", { domains: newList });
      setPresets(newList);
      setNewPreset("");
      setDialogOpen(false);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function removePreset(d: string) {
    const newList = presets.filter((p) => p !== d);
    try {
      await invoke("save_presets", { domains: newList });
      setPresets(newList);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleExport(type: "presets" | "hosts") {
    try {
      const json = await invoke<string>(type === "presets" ? "export_presets" : "export_hosts");
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleImport() {
    if (!importJson.trim()) return;
    try {
      if (importType === "presets") {
        const newPresets = await invoke<string[]>("import_presets", { json: importJson, merge: true });
        setPresets(newPresets);
      } else {
        await invoke("import_hosts", { json: importJson });
        loadHostsEntries();
      }
      setImportDialogOpen(false);
      setImportJson("");
      setStatusMsg({ key: "success" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleRemoveHostsEntry(domain: string) {
    try {
      await invoke("remove_hosts_entry", { domain });
      loadHostsEntries();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleClearHistory() {
    try {
      await invoke("clear_history");
      setHistory([]);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleRollback(entryId: string) {
    try {
      await invoke("rollback_history", { entryId });
      loadHistory();
      setStatusMsg({ key: "success" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function saveSettings(newSettings: AppSettings) {
    try {
      await invoke("save_settings", { settings: newSettings });
      const languageChanged = newSettings.language !== settings.language;
      setSettings(newSettings);
      i18n.changeLanguage(newSettings.language);

      // 如果语言改变且有当前查询结果，重新查询以更新位置信息
      if (languageChanged && currentDomain && results.length > 0) {
        setLoading(true);
        setStatusMsg({ key: "status_resolving", params: { domain: currentDomain } });
        try {
          const result = await invoke<ResolveResult>("resolve_and_ping", {
            domain: currentDomain,
            lang: newSettings.language
          });
          setResults(result.results);
          setStatusMsg({ key: "found_ips", params: { count: result.results.length } });
        } catch (e) {
          setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
        } finally {
          setLoading(false);
        }
      }
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function saveSchedulerConfig(config: SchedulerConfig) {
    try {
      await invoke("save_scheduler_config", { config });
      setSchedulerConfig(config);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  // Monitor functions
  async function handleCheckDomain(domain: string) {
    try {
      await invoke<MonitorRecord>("check_monitored_domain", { domain });
      loadMonitorState();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleCheckAllDomains() {
    try {
      await invoke("check_all_monitored_domains");
      loadMonitorState();
      setStatusMsg({ key: "success" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleRemoveFromMonitor(domain: string) {
    try {
      await invoke("remove_from_monitor", { domain });
      loadMonitorState();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleSaveMonitorConfig(config: MonitorConfig) {
    try {
      await invoke("save_monitor_config", { config });
      setMonitorConfig(config);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleAddToMonitor(domain: string, ip: string, latency: number | null) {
    try {
      await invoke("add_to_monitor", { domain, ip, baselineLatency: latency });
      setStatusMsg({ key: "success" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  // Backup functions
  async function handleCreateBackup() {
    try {
      await invoke<HostsBackup>("create_backup", { description: backupDescription || null });
      setBackupDialogOpen(false);
      setBackupDescription("");
      loadBackups();
      setStatusMsg({ key: "backup_created" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleRestoreBackup(backupId: string) {
    try {
      await invoke("restore_backup", { backupId });
      setStatusMsg({ key: "backup_restored" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleDeleteBackup(backupId: string) {
    try {
      await invoke("delete_backup", { backupId });
      loadBackups();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleViewBackupContent(backupId: string) {
    try {
      const content = await invoke<string>("get_backup_content", { backupId });
      setViewBackupContent(content);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  // Diagnostic functions
  async function handleRunDiagnostic() {
    if (!diagTarget.trim()) return;
    setDiagLoading(true);
    setDiagResult(null);
    try {
      if (diagType === "ping") {
        const result = await invoke<PingDiagResult>("run_ping_diagnostic", { target: diagTarget });
        setDiagResult({ target: diagTarget, ping_result: result });
      } else if (diagType === "dns") {
        const result = await invoke<DnsQueryResult>("run_dns_query", { domain: diagTarget });
        setDiagResult({ target: diagTarget, dns_result: result });
      } else if (diagType === "traceroute") {
        const result = await invoke<TracerouteResult>("run_traceroute", { target: diagTarget });
        setDiagResult({ target: diagTarget, traceroute_result: result });
      } else if (diagType === "http") {
        const url = diagTarget.startsWith("http") ? diagTarget : `https://${diagTarget}`;
        const result = await invoke<HttpDiagResult>("run_http_diagnostic", { url });
        setDiagResult({ target: diagTarget, http_result: result });
      } else if (diagType === "full") {
        const result = await invoke<NetworkDiagnostic>("run_full_diagnostic", { target: diagTarget });
        setDiagResult(result);
      }
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    } finally {
      setDiagLoading(false);
    }
  }

  // Rules functions
  async function handleAddRuleSource() {
    if (!newRuleName.trim() || !newRuleUrl.trim()) return;
    try {
      await invoke<RuleSource>("add_rule_source", { name: newRuleName, url: newRuleUrl });
      setRuleDialogOpen(false);
      setNewRuleName("");
      setNewRuleUrl("");
      loadRuleConfig();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleRemoveRuleSource(id: string) {
    try {
      await invoke("remove_rule_source", { id });
      loadRuleConfig();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleToggleRuleSource(id: string, enabled: boolean) {
    try {
      await invoke("toggle_rule_source", { id, enabled });
      loadRuleConfig();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleUpdateRuleSource(id: string) {
    try {
      const count = await invoke<number>("update_rule_source", { id });
      loadRuleConfig();
      setStatusMsg({ key: "rules_updated", params: { count } });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleUpdateAllRules() {
    try {
      await invoke("update_all_rules");
      loadRuleConfig();
      setStatusMsg({ key: "rules_updated" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleSaveRuleConfig(config: RuleConfig) {
    try {
      await invoke("save_rule_config", { config });
      setRuleConfig(config);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleAddToBlacklist(ip: string, domain?: string, reason?: string) {
    try {
      await invoke("add_to_blacklist", { ip, domain, reason });
      loadBlacklist();
      setStatusMsg({ key: "blacklist_added" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleRemoveFromBlacklist(ip: string) {
    try {
      await invoke("remove_from_blacklist", { ip });
      loadBlacklist();
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  // Logs functions
  async function handleLoadLogs() {
    try {
      const [logLines, files] = await Promise.all([
        invoke<string[]>("get_logs", { lines: 200 }),
        invoke<[string, number][]>("get_log_files"),
      ]);
      setLogs(logLines);
      setLogFiles(files);
      setLogsDialogOpen(true);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleClearLogs() {
    try {
      await invoke("clear_logs");
      setLogs([]);
      setStatusMsg({ key: "success" });
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleCheckProxy(domain: string) {
    try {
      const result = await invoke<{ needs_proxy: boolean; message: string }>("check_proxy_needed", { domain });
      setProxyCheckResult(result);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }

  async function handleGetIpDetails(ip: string) {
    try {
      const [location, cdn] = await Promise.all([
        invoke<string | null>("get_ip_location", { ip }),
        invoke<string | null>("detect_cdn", { ip }),
      ]);
      setSelectedIpDetails({ ip, location: location || undefined, cdn: cdn || undefined });
      setIpDetailsDialogOpen(true);
    } catch (e) {
      setStatusMsg({ key: "error_with_msg", params: { msg: String(e) } });
    }
  }


  return (
    <Box p="4" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Flex justify="between" align="center" mb="3">
        <Flex align="center" gap="2">
          <RocketIcon width="24" height="24" />
          <Heading size="6">{t("app_title")}</Heading>
        </Flex>
        <Flex gap="2" align="center">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton variant="soft" size="2">
                <GlobeIcon />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={() => saveSettings({ ...settings, language: "zh-CN" })}>
                中文
                {settings.language === "zh-CN" && <CheckIcon style={{ marginLeft: "auto" }} />}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => saveSettings({ ...settings, language: "en-US" })}>
                English
                {settings.language === "en-US" && <CheckIcon style={{ marginLeft: "auto" }} />}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <IconButton variant="soft" size="2">
                {appearance === "dark" ? <MoonIcon /> : <SunIcon />}
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item onClick={() => setMode("light")}>
                <SunIcon /> {t("theme_light")}
                {mode === "light" && <CheckIcon style={{ marginLeft: "auto" }} />}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setMode("dark")}>
                <MoonIcon /> {t("theme_dark")}
                {mode === "dark" && <CheckIcon style={{ marginLeft: "auto" }} />}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setMode("system")}>
                <DesktopIcon /> {t("theme_system")}
                {mode === "system" && <CheckIcon style={{ marginLeft: "auto" }} />}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Flex>
      </Flex>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <Flex ref={tabsContainerRef} align="center" mb="3">
          <Tabs.List style={{ flex: 1 }}>
            {visibleTabs.map((tab) => (
              <Tabs.Trigger key={tab.value} value={tab.value}>
                <Flex align="center" gap="2">
                  {tab.icon}
                  <span>{tab.label}</span>
                </Flex>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {overflowTabs.length > 0 && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton variant="ghost" size="2" style={{ marginLeft: 4 }}>
                  <DotsHorizontalIcon />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content>
                {overflowTabs.map((tab) => (
                  <DropdownMenu.Item
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                  >
                    <Flex align="center" gap="2">
                      {tab.icon}
                      {tab.label}
                      {activeTab === tab.value && <CheckIcon style={{ marginLeft: "auto" }} />}
                    </Flex>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </Flex>

        <Box style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {activeTab === "optimize" && (
            <OptimizePage
              presets={presets}
              domain={domain}
              setDomain={setDomain}
              newPreset={newPreset}
              setNewPreset={setNewPreset}
              dialogOpen={dialogOpen}
              setDialogOpen={setDialogOpen}
              addPreset={addPreset}
              removePreset={removePreset}
              handleExport={handleExport}
              setImportType={setImportType}
              setImportDialogOpen={setImportDialogOpen}
              isAdmin={isAdmin}
              loading={loading}
              handleResolve={handleResolve}
              batchLoading={batchLoading}
              handleBatchOptimize={handleBatchOptimize}
              status={status}
              results={results}
              selectedIp={selectedIp}
              setSelectedIp={setSelectedIp}
              currentDomain={currentDomain}
              handleAddToBlacklist={handleAddToBlacklist}
              handleGetIpDetails={handleGetIpDetails}
              handleTestConnectivity={handleTestConnectivity}
              handleCheckProxy={handleCheckProxy}
              handleFlushDns={handleFlushDns}
              handleAddToMonitor={handleAddToMonitor}
              handleWriteHosts={handleWriteHosts}
              proxyCheckResult={proxyCheckResult}
            />
          )}
          {activeTab === "hosts" && (
            <HostsPage
              hostsLoading={hostsLoading}
              hostsEntries={hostsEntries}
              loadHostsEntries={loadHostsEntries}
              handleRemoveHostsEntry={handleRemoveHostsEntry}
              handleExport={handleExport}
              setImportType={setImportType}
              setImportDialogOpen={setImportDialogOpen}
            />
          )}
          {activeTab === "monitor" && (
            <MonitorPage
              monitorConfig={monitorConfig}
              monitorState={monitorState}
              handleCheckAllDomains={handleCheckAllDomains}
              handleSaveMonitorConfig={handleSaveMonitorConfig}
              handleCheckDomain={handleCheckDomain}
              handleRemoveFromMonitor={handleRemoveFromMonitor}
            />
          )}
          {activeTab === "diagnostic" && (
            <DiagnosticPage
              diagTarget={diagTarget}
              setDiagTarget={setDiagTarget}
              diagType={diagType}
              setDiagType={setDiagType}
              diagLoading={diagLoading}
              handleRunDiagnostic={handleRunDiagnostic}
              diagResult={diagResult}
            />
          )}
          {activeTab === "rules" && (
            <RulesPage
              ruleConfig={ruleConfig}
              handleUpdateAllRules={handleUpdateAllRules}
              ruleDialogOpen={ruleDialogOpen}
              setRuleDialogOpen={setRuleDialogOpen}
              newRuleName={newRuleName}
              setNewRuleName={setNewRuleName}
              newRuleUrl={newRuleUrl}
              setNewRuleUrl={setNewRuleUrl}
              handleAddRuleSource={handleAddRuleSource}
              handleSaveRuleConfig={handleSaveRuleConfig}
              handleToggleRuleSource={handleToggleRuleSource}
              handleUpdateRuleSource={handleUpdateRuleSource}
              handleRemoveRuleSource={handleRemoveRuleSource}
            />
          )}
          {activeTab === "history" && (
            <HistoryPage
              history={history}
              handleClearHistory={handleClearHistory}
              handleRollback={handleRollback}
            />
          )}
          {activeTab === "settings" && (
            <SettingsPage
              settings={settings}
              saveSettings={saveSettings}
              mode={mode}
              setMode={setMode}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              schedulerConfig={schedulerConfig}
              saveSchedulerConfig={saveSchedulerConfig}
              backupDialogOpen={backupDialogOpen}
              setBackupDialogOpen={setBackupDialogOpen}
              backupDescription={backupDescription}
              setBackupDescription={setBackupDescription}
              handleCreateBackup={handleCreateBackup}
              backups={backups}
              handleViewBackupContent={handleViewBackupContent}
              handleRestoreBackup={handleRestoreBackup}
              handleDeleteBackup={handleDeleteBackup}
              blacklist={blacklist}
              handleRemoveFromBlacklist={handleRemoveFromBlacklist}
              handleLoadLogs={handleLoadLogs}
              handleClearLogs={handleClearLogs}
              viewBackupContent={viewBackupContent}
              setViewBackupContent={setViewBackupContent}
              logsDialogOpen={logsDialogOpen}
              setLogsDialogOpen={setLogsDialogOpen}
              logFiles={logFiles}
              logs={logs}
            />
          )}
        </Box>
      </Tabs.Root>

      {/* Footer tip */}
      {activeTab === "optimize" && (
        <Flex align="center" gap="1" mt="2">
          <ExclamationTriangleIcon color="gray" />
          <Text size="1" color="gray">{t("tip_main")}</Text>
        </Flex>
      )}

      {/* Import Dialog */}
      <Dialog.Root open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <Dialog.Content maxWidth="500px">
          <Dialog.Title>{t("import")} {importType === "presets" ? t("presets") : "Hosts"}</Dialog.Title>
          <Flex direction="column" gap="3" mt="3">
            <textarea
              style={{
                width: "100%",
                height: 200,
                padding: 8,
                borderRadius: 4,
                border: "1px solid var(--gray-6)",
                background: "var(--gray-2)",
                color: "var(--gray-12)",
                fontFamily: "monospace",
                fontSize: 12,
              }}
              placeholder="Paste JSON here..."
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <Flex gap="3" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">{t("cancel")}</Button>
              </Dialog.Close>
              <Button onClick={handleImport}>{t("import")}</Button>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* IP Details Dialog */}
      <Dialog.Root open={ipDetailsDialogOpen} onOpenChange={setIpDetailsDialogOpen}>
        <Dialog.Content maxWidth="400px">
          <Dialog.Title>{t("ip_details")}</Dialog.Title>
          {selectedIpDetails && (
            <Flex direction="column" gap="3" mt="3">
              <Flex justify="between">
                <Text weight="medium">{t("ip_address")}</Text>
                <Text style={{ fontFamily: "monospace" }}>{selectedIpDetails.ip}</Text>
              </Flex>
              <Flex justify="between">
                <Text weight="medium">{t("location")}</Text>
                <Text>{selectedIpDetails.location || "-"}</Text>
              </Flex>
              <Flex justify="between">
                <Text weight="medium">{t("cdn_provider")}</Text>
                <Text>{selectedIpDetails.cdn || "-"}</Text>
              </Flex>
            </Flex>
          )}
          <Flex justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft">{t("close")}</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

export default App;
