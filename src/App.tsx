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
  TextField,
  Button,
  Card,
  Heading,
  Box,
  Badge,
  ScrollArea,
  IconButton,
  Dialog,
  Separator,
  DropdownMenu,
  Tabs,
  Switch,
  Select,
  Table,
  AlertDialog,
  Tooltip,
} from "@radix-ui/themes";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  ReloadIcon,
  ExclamationTriangleIcon,
  SunIcon,
  MoonIcon,
  DesktopIcon,
  GearIcon,
  RocketIcon,
  ClockIcon,
  DownloadIcon,
  UploadIcon,
  CounterClockwiseClockIcon,
  GlobeIcon,
  ActivityLogIcon,
  MixerHorizontalIcon,
  FileTextIcon,
  CrossCircledIcon,
  EyeOpenIcon,
  PlayIcon,
  DotsHorizontalIcon,
} from "@radix-ui/react-icons";
import { useTheme, ACCENT_COLORS } from "./ThemeContext";
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
} from "./types";

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
  const [diagResult, setDiagResult] = useState<{
    ping?: PingDiagResult;
    dns?: DnsQueryResult;
    traceroute?: TracerouteResult;
    http?: HttpDiagResult;
  } | null>(null);

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
      handleBatchOptimize();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
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

  async function handleResolve(targetDomain?: string) {
    const d = targetDomain || domain;
    if (!d.trim()) {
      setStatusMsg({ key: "status_ready" });
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
        setDiagResult({ ping: result });
      } else if (diagType === "dns") {
        const result = await invoke<DnsQueryResult>("run_dns_query", { domain: diagTarget });
        setDiagResult({ dns: result });
      } else if (diagType === "traceroute") {
        const result = await invoke<TracerouteResult>("run_traceroute", { target: diagTarget });
        setDiagResult({ traceroute: result });
      } else if (diagType === "http") {
        const url = diagTarget.startsWith("http") ? diagTarget : `https://${diagTarget}`;
        const result = await invoke<HttpDiagResult>("run_http_diagnostic", { url });
        setDiagResult({ http: result });
      } else if (diagType === "full") {
        const result = await invoke<{
          ping_result?: PingDiagResult;
          dns_result?: DnsQueryResult;
          traceroute_result?: TracerouteResult;
          http_result?: HttpDiagResult;
        }>("run_full_diagnostic", { target: diagTarget });
        setDiagResult({
          ping: result.ping_result,
          dns: result.dns_result,
          traceroute: result.traceroute_result,
          http: result.http_result,
        });
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

  // Render optimize tab
  const renderOptimizeTab = () => (
    <Flex gap="4" style={{ flex: 1, minHeight: 0 }} pt="1" pb="4">
      {/* Left sidebar - Presets */}
      <Card style={{ width: 220, display: "flex", flexDirection: "column" }}>
        <Flex justify="between" align="center" mb="2">
          <Flex align="center" gap="1">
            <GlobeIcon />
            <Text size="2" weight="bold">{t("presets")}</Text>
          </Flex>
          <Flex gap="2" align="center">
            <Tooltip content={t("export")}>
              <IconButton size="1" variant="ghost" onClick={() => handleExport("presets")}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip content={t("import")}>
              <IconButton size="1" variant="ghost" onClick={() => { setImportType("presets"); setImportDialogOpen(true); }}>
                <UploadIcon />
              </IconButton>
            </Tooltip>
            <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
              <Tooltip content={t("add_preset")}>
                <Dialog.Trigger>
                  <IconButton size="1" variant="soft">
                    <PlusIcon />
                  </IconButton>
                </Dialog.Trigger>
              </Tooltip>
              <Dialog.Content maxWidth="400px">
                <Dialog.Title>{t("add_preset")}</Dialog.Title>
                <Flex direction="column" gap="3" mt="3">
                  <TextField.Root
                    placeholder={t("preset_placeholder")}
                    value={newPreset}
                    onChange={(e) => setNewPreset(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPreset()}
                  />
                  <Flex gap="3" justify="end">
                    <Dialog.Close>
                      <Button variant="soft" color="gray">{t("cancel")}</Button>
                    </Dialog.Close>
                    <Button onClick={addPreset}>{t("add")}</Button>
                  </Flex>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </Flex>
        </Flex>
        <ScrollArea style={{ flex: 1 }}>
          <Flex direction="column" gap="1">
            {presets.length === 0 ? (
              <Text size="1" color="gray" align="center" mt="4">{t("no_presets")}</Text>
            ) : (
              presets.map((p) => (
                <Flex
                  key={p}
                  align="center"
                  justify="between"
                  p="2"
                  style={{
                    borderRadius: "var(--radius-2)",
                    cursor: "pointer",
                    background: domain === p ? "var(--accent-3)" : undefined,
                  }}
                  onClick={() => { setDomain(p); handleResolve(p); }}
                >
                  <Text size="1" style={{ wordBreak: "break-all" }}>{p}</Text>
                  <IconButton
                    size="1"
                    variant="ghost"
                    color="red"
                    onClick={(e) => { e.stopPropagation(); removePreset(p); }}
                  >
                    <TrashIcon />
                  </IconButton>
                </Flex>
              ))
            )}
          </Flex>
        </ScrollArea>
      </Card>

      {/* Main content */}
      <Flex direction="column" gap="3" style={{ flex: 1 }}>
        {!isAdmin && (
          <Flex align="center" gap="2">
            <ExclamationTriangleIcon color="orange" />
            <Text size="1" color="orange">{t("status_no_admin")}</Text>
          </Flex>
        )}

        {/* Input area */}
        <Flex gap="2">
          <TextField.Root
            style={{ flex: 1 }}
            placeholder={t("domain_input_placeholder")}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleResolve()}
          />
          <Button onClick={() => handleResolve()} disabled={loading}>
            <MagnifyingGlassIcon />
            {loading ? t("querying") : t("query")}
          </Button>
          <Button variant="soft" onClick={handleBatchOptimize} disabled={batchLoading || presets.length === 0}>
            <RocketIcon />
            {batchLoading ? t("batch_optimizing") : t("batch_optimize")}
          </Button>
        </Flex>

        {/* Status */}
        <Text size="2" color="gray">{status}</Text>

        {/* Results table */}
        <Card style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Flex mb="2" gap="4">
            <Text size="2" weight="bold" style={{ flex: 2 }}>{t("ip_address")}</Text>
            <Text size="2" weight="bold" style={{ width: 80, textAlign: "center" }}>{t("latency")}</Text>
            <Text size="2" weight="bold" style={{ flex: 1 }}>{t("location")}</Text>
            <Text size="2" weight="bold" style={{ width: 60, textAlign: "center" }}>{t("cdn")}</Text>
          </Flex>
          <Separator size="4" mb="2" />
          <ScrollArea style={{ flex: 1 }}>
            <Flex direction="column" gap="1">
              {results.map((r) => (
                <Flex
                  key={r.ip}
                  align="center"
                  p="2"
                  gap="2"
                  style={{
                    borderRadius: "var(--radius-2)",
                    cursor: "pointer",
                    background: selectedIp === r.ip ? "var(--accent-4)" : undefined,
                  }}
                  onClick={() => setSelectedIp(r.ip)}
                >
                  <Text size="2" style={{ flex: 2, fontFamily: "monospace" }}>{r.ip}</Text>
                  <Box style={{ width: 80, textAlign: "center" }}>
                    {r.latency !== null ? (
                      <Badge color={r.latency < 100 ? "green" : r.latency < 300 ? "yellow" : "red"}>
                        {r.latency} ms
                      </Badge>
                    ) : (
                      <Badge color="gray">{t("timeout")}</Badge>
                    )}
                  </Box>
                  <Text size="1" color="gray" style={{ flex: 1 }}>{r.location || "-"}</Text>
                  <Box style={{ width: 60, textAlign: "center" }}>
                    {r.is_cdn && <Badge color="blue">CDN</Badge>}
                  </Box>
                  <Tooltip content={t("add_to_blacklist")}>
                    <IconButton
                      size="1"
                      variant="ghost"
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToBlacklist(r.ip, currentDomain, r.latency === null ? "timeout" : undefined);
                      }}
                    >
                      <CrossCircledIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content={t("ip_details")}>
                    <IconButton
                      size="1"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGetIpDetails(r.ip);
                      }}
                    >
                      <EyeOpenIcon />
                    </IconButton>
                  </Tooltip>
                </Flex>
              ))}
              {results.length === 0 && !loading && (
                <Text size="2" color="gray" align="center" mt="4">{t("no_results")}</Text>
              )}
            </Flex>
          </ScrollArea>
        </Card>

        {/* Action buttons */}
        <Flex gap="2" justify="end">
          <Button variant="soft" onClick={handleTestConnectivity} disabled={!currentDomain}>
            <GlobeIcon />
            {t("test_connectivity")}
          </Button>
          <Button variant="soft" onClick={() => currentDomain && handleCheckProxy(currentDomain)} disabled={!currentDomain}>
            <MixerHorizontalIcon />
            {t("check_proxy")}
          </Button>
          <Button variant="soft" onClick={handleFlushDns}>
            <ReloadIcon />
            {t("flush_dns")}
          </Button>
          <Button 
            variant="soft" 
            disabled={!selectedIp || !currentDomain} 
            onClick={() => {
              const selected = results.find(r => r.ip === selectedIp);
              if (selected && currentDomain) {
                handleAddToMonitor(currentDomain, selected.ip, selected.latency);
              }
            }}
          >
            <ActivityLogIcon />
            {t("add_to_monitor")}
          </Button>
          <Button disabled={!selectedIp || !isAdmin} onClick={handleWriteHosts}>
            <CheckIcon />
            {t("write_hosts")}
          </Button>
        </Flex>

        {/* Proxy check result */}
        {proxyCheckResult && (
          <Flex align="center" gap="2">
            <Badge color={proxyCheckResult.needs_proxy ? "orange" : "green"}>
              {proxyCheckResult.needs_proxy ? t("proxy_needed") : t("proxy_not_needed")}
            </Badge>
            <Text size="1" color="gray">{proxyCheckResult.message}</Text>
          </Flex>
        )}
      </Flex>
    </Flex>
  );

  // Render hosts management tab
  const renderHostsTab = () => (
    <Flex direction="column" gap="4" style={{ flex: 1 }} pt="1" pb="4">
      <Flex justify="between" align="center" style={{ minHeight: 32 }}>
        <Heading size="5">{t("hosts_entries")}</Heading>
        <Flex gap="2">
          <Button variant="soft" onClick={() => handleExport("hosts")}>
            <DownloadIcon />
            {t("export")}
          </Button>
          <Button variant="soft" onClick={() => { setImportType("hosts"); setImportDialogOpen(true); }}>
            <UploadIcon />
            {t("import")}
          </Button>
          <Button variant="soft" onClick={loadHostsEntries}>
            <ReloadIcon />
            {t("refresh")}
          </Button>
        </Flex>
      </Flex>

      <Card style={{ flex: 1 }}>
        <ScrollArea style={{ height: "100%" }}>
          {hostsLoading ? (
            <Text align="center" color="gray">{t("loading")}</Text>
          ) : hostsEntries.length === 0 ? (
            <Text align="center" color="gray" mt="4">{t("no_hosts_entries")}</Text>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>{t("ip_address")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Domain</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="80px"></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {hostsEntries.map((entry, idx) => (
                  <Table.Row key={`${entry.ip}-${entry.domain}-${idx}`}>
                    <Table.Cell>
                      <Text style={{ fontFamily: "monospace" }}>{entry.ip}</Text>
                    </Table.Cell>
                    <Table.Cell>{entry.domain}</Table.Cell>
                    <Table.Cell>
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>
                          <IconButton size="1" variant="ghost" color="red">
                            <TrashIcon />
                          </IconButton>
                        </AlertDialog.Trigger>
                        <AlertDialog.Content maxWidth="400px">
                          <AlertDialog.Title>{t("remove_entry")}</AlertDialog.Title>
                          <AlertDialog.Description>{t("confirm_remove")}</AlertDialog.Description>
                          <Flex gap="3" mt="4" justify="end">
                            <AlertDialog.Cancel>
                              <Button variant="soft" color="gray">{t("cancel")}</Button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action>
                              <Button color="red" onClick={() => handleRemoveHostsEntry(entry.domain)}>
                                {t("delete")}
                              </Button>
                            </AlertDialog.Action>
                          </Flex>
                        </AlertDialog.Content>
                      </AlertDialog.Root>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </ScrollArea>
      </Card>
    </Flex>
  );

  // Render history tab
  const renderHistoryTab = () => (
    <Flex direction="column" gap="4" style={{ flex: 1 }} pt="1" pb="4">
      <Flex justify="between" align="center" style={{ minHeight: 32 }}>
        <Heading size="5">{t("history")}</Heading>
        <Button variant="soft" color="red" onClick={handleClearHistory} disabled={history.length === 0}>
          <TrashIcon />
          {t("clear_history")}
        </Button>
      </Flex>

      <Card style={{ flex: 1 }}>
        <ScrollArea style={{ height: "100%" }}>
          {history.length === 0 ? (
            <Text align="center" color="gray" mt="4">{t("no_history")}</Text>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Time</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Domain</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("ip_address")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("latency")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="80px"></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {history.map((entry) => (
                  <Table.Row key={entry.id}>
                    <Table.Cell>
                      <Text size="1">{new Date(entry.timestamp).toLocaleString()}</Text>
                    </Table.Cell>
                    <Table.Cell>{entry.domain}</Table.Cell>
                    <Table.Cell>
                      <Text style={{ fontFamily: "monospace" }}>{entry.ip}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      {entry.latency !== null ? (
                        <Badge color="green">{entry.latency} ms</Badge>
                      ) : (
                        <Badge color="gray">-</Badge>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge color={entry.action === "write" ? "blue" : "orange"}>
                        {entry.action === "write" ? t("action_write") : t("action_rollback")}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Tooltip content={t("rollback")}>
                        <IconButton size="1" variant="ghost" onClick={() => handleRollback(entry.id)}>
                          <CounterClockwiseClockIcon />
                        </IconButton>
                      </Tooltip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </ScrollArea>
      </Card>
    </Flex>
  );

  // Render settings tab
  const renderSettingsTab = () => (
    <Flex direction="column" gap="4" style={{ maxWidth: 600 }} pt="1" pb="4">
      <Flex justify="between" align="center" style={{ minHeight: 32 }}>
        <Heading size="5">{t("settings")}</Heading>
      </Flex>

      <Card>
        <Flex direction="column" gap="4" p="2">
          {/* Language */}
          <Flex justify="between" align="center">
            <Text weight="medium">{t("language")}</Text>
            <Select.Root
              value={settings.language}
              onValueChange={(value: "zh-CN" | "en-US") => saveSettings({ ...settings, language: value })}
            >
              <Select.Trigger style={{ width: 150 }} />
              <Select.Content position="popper">
                <Select.Item value="zh-CN">中文</Select.Item>
                <Select.Item value="en-US">English</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          {/* Theme */}
          <Flex justify="between" align="center">
            <Text weight="medium">{t("theme")}</Text>
            <Select.Root value={mode} onValueChange={(value: "light" | "dark" | "system") => setMode(value)}>
              <Select.Trigger style={{ width: 150 }} />
              <Select.Content position="popper">
                <Select.Item value="light">
                  <Flex align="center" gap="2"><SunIcon /> {t("theme_light")}</Flex>
                </Select.Item>
                <Select.Item value="dark">
                  <Flex align="center" gap="2"><MoonIcon /> {t("theme_dark")}</Flex>
                </Select.Item>
                <Select.Item value="system">
                  <Flex align="center" gap="2"><DesktopIcon /> {t("theme_system")}</Flex>
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          {/* Accent Color */}
          {/* Accent Color */}
          <Flex justify="between" align="center">
            <Text weight="medium">{t("accent_color")}</Text>
            <Select.Root
              value={accentColor}
              onValueChange={(value) => setAccentColor(value as typeof accentColor)}
            >
              <Select.Trigger style={{ width: 150 }} />
              <Select.Content position="popper">
                {ACCENT_COLORS.map((color) => (
                  <Select.Item key={color} value={color}>
                    <Flex align="center" gap="2">
                      <Box
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          backgroundColor: `var(--${color}-9)`,
                        }}
                      />
                      {t(`color_${color}`)}
                    </Flex>
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>

          {/* Minimize to tray */}
          <Flex justify="between" align="center">
            <Text weight="medium">{t("minimize_to_tray")}</Text>
            <Switch
              checked={settings.minimize_to_tray}
              onCheckedChange={(checked) => saveSettings({ ...settings, minimize_to_tray: checked })}
            />
          </Flex>
        </Flex>
      </Card>

      {/* Scheduler */}
      <Card>
        <Flex direction="column" gap="4" p="2">
          <Flex align="center" gap="2">
            <ClockIcon />
            <Text weight="bold">{t("scheduler")}</Text>
          </Flex>

          <Flex justify="between" align="center">
            <Text weight="medium">{t("scheduler_enabled")}</Text>
            <Switch
              checked={schedulerConfig.enabled}
              onCheckedChange={(checked) => saveSchedulerConfig({ ...schedulerConfig, enabled: checked })}
            />
          </Flex>

          <Flex justify="between" align="center">
            <Text weight="medium">{t("scheduler_interval")}</Text>
            <Select.Root
              value={String(schedulerConfig.interval_minutes)}
              onValueChange={(value) => saveSchedulerConfig({ ...schedulerConfig, interval_minutes: parseInt(value) })}
              disabled={!schedulerConfig.enabled}
            >
              <Select.Trigger style={{ width: 150 }} />
              <Select.Content position="popper">
                <Select.Item value="30">30</Select.Item>
                <Select.Item value="60">60</Select.Item>
                <Select.Item value="120">120</Select.Item>
                <Select.Item value="360">360</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>

          <Flex justify="between" align="center">
            <Text weight="medium">{t("scheduler_auto_update")}</Text>
            <Switch
              checked={schedulerConfig.auto_update}
              onCheckedChange={(checked) => saveSchedulerConfig({ ...schedulerConfig, auto_update: checked })}
              disabled={!schedulerConfig.enabled}
            />
          </Flex>

          <Flex justify="between" align="center">
            <Text weight="medium">{t("scheduler_notify")}</Text>
            <Switch
              checked={schedulerConfig.notify}
              onCheckedChange={(checked) => saveSchedulerConfig({ ...schedulerConfig, notify: checked })}
              disabled={!schedulerConfig.enabled}
            />
          </Flex>
        </Flex>
      </Card>

      {/* Backup */}
      <Card>
        <Flex direction="column" gap="4" p="2">
          <Flex align="center" justify="between">
            <Flex align="center" gap="2">
              <DownloadIcon />
              <Text weight="bold">{t("backup")}</Text>
            </Flex>
            <Dialog.Root open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
              <Dialog.Trigger>
                <Button size="1" variant="soft">
                  <PlusIcon />
                  {t("create_backup")}
                </Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth="400px">
                <Dialog.Title>{t("create_backup")}</Dialog.Title>
                <Flex direction="column" gap="3" mt="3">
                  <TextField.Root
                    placeholder={t("backup_description")}
                    value={backupDescription}
                    onChange={(e) => setBackupDescription(e.target.value)}
                  />
                  <Flex gap="3" justify="end">
                    <Dialog.Close>
                      <Button variant="soft" color="gray">{t("cancel")}</Button>
                    </Dialog.Close>
                    <Button onClick={handleCreateBackup}>{t("create_backup")}</Button>
                  </Flex>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          </Flex>

          <ScrollArea style={{ maxHeight: 200 }}>
            {backups.length === 0 ? (
              <Text size="2" color="gray">{t("no_backups")}</Text>
            ) : (
              <Flex direction="column" gap="2">
                {backups.map((backup) => (
                  <Flex key={backup.id} justify="between" align="center" p="2" style={{ background: "var(--gray-2)", borderRadius: "var(--radius-2)" }}>
                    <Flex direction="column" gap="1">
                      <Text size="2">{backup.description || new Date(backup.timestamp).toLocaleString()}</Text>
                      <Text size="1" color="gray">{new Date(backup.timestamp).toLocaleString()}</Text>
                    </Flex>
                    <Flex gap="1">
                      <Tooltip content={t("view_content")}>
                        <IconButton size="1" variant="ghost" onClick={() => handleViewBackupContent(backup.id)}>
                          <EyeOpenIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip content={t("restore")}>
                        <IconButton size="1" variant="ghost" onClick={() => handleRestoreBackup(backup.id)}>
                          <CounterClockwiseClockIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip content={t("delete")}>
                        <IconButton size="1" variant="ghost" color="red" onClick={() => handleDeleteBackup(backup.id)}>
                          <TrashIcon />
                        </IconButton>
                      </Tooltip>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            )}
          </ScrollArea>
        </Flex>
      </Card>

      {/* Blacklist */}
      <Card>
        <Flex direction="column" gap="4" p="2">
          <Flex align="center" gap="2">
            <CrossCircledIcon />
            <Text weight="bold">{t("blacklist")}</Text>
          </Flex>

          <ScrollArea style={{ maxHeight: 200 }}>
            {blacklist.entries.length === 0 ? (
              <Text size="2" color="gray">{t("no_blacklist")}</Text>
            ) : (
              <Flex direction="column" gap="2">
                {blacklist.entries.map((entry) => (
                  <Flex key={entry.ip} justify="between" align="center" p="2" style={{ background: "var(--gray-2)", borderRadius: "var(--radius-2)" }}>
                    <Flex direction="column" gap="1">
                      <Text size="2" style={{ fontFamily: "monospace" }}>{entry.ip}</Text>
                      {entry.reason && <Text size="1" color="gray">{entry.reason}</Text>}
                    </Flex>
                    <IconButton size="1" variant="ghost" color="red" onClick={() => handleRemoveFromBlacklist(entry.ip)}>
                      <TrashIcon />
                    </IconButton>
                  </Flex>
                ))}
              </Flex>
            )}
          </ScrollArea>
        </Flex>
      </Card>

      {/* Logs */}
      <Card>
        <Flex direction="column" gap="4" p="2">
          <Flex align="center" justify="between">
            <Flex align="center" gap="2">
              <FileTextIcon />
              <Text weight="bold">{t("logs")}</Text>
            </Flex>
            <Flex gap="2">
              <Button size="1" variant="soft" onClick={handleLoadLogs}>
                <EyeOpenIcon />
                {t("view_logs")}
              </Button>
              <Button size="1" variant="soft" color="red" onClick={handleClearLogs}>
                <TrashIcon />
                {t("clear_logs")}
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Card>

      {/* View Backup Content Dialog */}
      <Dialog.Root open={!!viewBackupContent} onOpenChange={() => setViewBackupContent(null)}>
        <Dialog.Content maxWidth="600px">
          <Dialog.Title>{t("view_content")}</Dialog.Title>
          <ScrollArea style={{ maxHeight: 400 }}>
            <pre style={{ fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
              {viewBackupContent}
            </pre>
          </ScrollArea>
          <Flex justify="end" mt="3">
            <Dialog.Close>
              <Button variant="soft">{t("close")}</Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      {/* View Logs Dialog */}
      <Dialog.Root open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <Dialog.Content maxWidth="800px">
          <Dialog.Title>{t("logs")}</Dialog.Title>
          
          {/* Log Files */}
          {logFiles.length > 0 && (
            <Flex gap="2" mb="3" wrap="wrap">
              <Text size="2" weight="medium">{t("log_files")}:</Text>
              {logFiles.map(([name, size]) => (
                <Badge key={name} variant="soft">
                  {name} ({(size / 1024).toFixed(1)} KB)
                </Badge>
              ))}
            </Flex>
          )}
          
          <ScrollArea style={{ maxHeight: 500 }}>
            {logs.length === 0 ? (
              <Text color="gray">{t("no_logs")}</Text>
            ) : (
              <Flex direction="column" gap="1">
                {logs.map((line, idx) => (
                  <Text key={idx} size="1" style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                    {line}
                  </Text>
                ))}
              </Flex>
            )}
          </ScrollArea>
          <Flex justify="end" mt="3" gap="2">
            <Button variant="soft" color="red" onClick={handleClearLogs}>
              <TrashIcon />
              {t("clear_logs")}
            </Button>
            <Dialog.Close>
              <Button variant="soft">{t("close")}</Button>
            </Dialog.Close>
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
    </Flex>
  );

  // Render monitor tab
  const renderMonitorTab = () => (
    <Flex direction="column" gap="4" style={{ flex: 1 }} pt="1" pb="4">
      <Flex justify="between" align="center" style={{ minHeight: 32 }}>
        <Heading size="5">{t("monitor")}</Heading>
        <Flex gap="2">
          <Button variant="soft" onClick={handleCheckAllDomains}>
            <ReloadIcon />
            {t("check_all")}
          </Button>
        </Flex>
      </Flex>

      <Card>
        <Flex direction="column" gap="3" p="2">
          <Flex justify="between" align="center">
            <Text weight="medium">{t("monitor_enabled")}</Text>
            <Switch
              checked={monitorConfig.enabled}
              onCheckedChange={(checked) => handleSaveMonitorConfig({ ...monitorConfig, enabled: checked })}
            />
          </Flex>
          <Flex justify="between" align="center">
            <Text weight="medium">{t("monitor_interval")}</Text>
            <Select.Root
              value={String(monitorConfig.check_interval_seconds)}
              onValueChange={(v) => handleSaveMonitorConfig({ ...monitorConfig, check_interval_seconds: parseInt(v) })}
            >
              <Select.Trigger style={{ width: 120 }} />
              <Select.Content>
                <Select.Item value="30">30</Select.Item>
                <Select.Item value="60">60</Select.Item>
                <Select.Item value="120">120</Select.Item>
                <Select.Item value="300">300</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
          <Flex justify="between" align="center">
            <Text weight="medium">{t("monitor_auto_reoptimize")}</Text>
            <Switch
              checked={monitorConfig.auto_reoptimize}
              onCheckedChange={(checked) => handleSaveMonitorConfig({ ...monitorConfig, auto_reoptimize: checked })}
            />
          </Flex>
        </Flex>
      </Card>

      <Card style={{ flex: 1 }}>
        <ScrollArea style={{ height: "100%" }}>
          {!monitorState || Object.keys(monitorState.domains).length === 0 ? (
            <Text align="center" color="gray" mt="4">{t("no_monitored_domains")}</Text>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Domain</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("ip_address")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("baseline_latency")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("current_latency")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("last_check")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="100px"></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {Object.entries(monitorState.domains).map(([domain, monitor]) => {
                  const lastRecord = monitor.records[monitor.records.length - 1];
                  return (
                    <Table.Row key={domain}>
                      <Table.Cell>{domain}</Table.Cell>
                      <Table.Cell><Text style={{ fontFamily: "monospace" }}>{monitor.current_ip}</Text></Table.Cell>
                      <Table.Cell>
                        {monitor.baseline_latency ? <Badge color="blue">{monitor.baseline_latency} ms</Badge> : "-"}
                      </Table.Cell>
                      <Table.Cell>
                        {lastRecord?.latency ? (
                          <Badge color={lastRecord.status === "Good" ? "green" : lastRecord.status === "Warning" ? "yellow" : "red"}>
                            {lastRecord.latency} ms
                          </Badge>
                        ) : "-"}
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="1">{monitor.last_check ? new Date(monitor.last_check).toLocaleString() : "-"}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Flex gap="1">
                          <IconButton size="1" variant="ghost" onClick={() => handleCheckDomain(domain)}>
                            <ReloadIcon />
                          </IconButton>
                          <IconButton size="1" variant="ghost" color="red" onClick={() => handleRemoveFromMonitor(domain)}>
                            <TrashIcon />
                          </IconButton>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </ScrollArea>
      </Card>
    </Flex>
  );

  // Render diagnostic tab
  const renderDiagnosticTab = () => (
    <Flex direction="column" gap="4" style={{ flex: 1 }} pt="1" pb="4">
      <Flex justify="between" align="center" style={{ minHeight: 32 }}>
        <Heading size="5">{t("diagnostic")}</Heading>
      </Flex>

      <Flex gap="2" align="center">
        <TextField.Root
          style={{ flex: 1 }}
          placeholder={t("target_input")}
          value={diagTarget}
          onChange={(e) => setDiagTarget(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRunDiagnostic()}
        />
        <Select.Root value={diagType} onValueChange={(v) => setDiagType(v as typeof diagType)}>
          <Select.Trigger style={{ width: 150 }} />
          <Select.Content>
            <Select.Item value="ping">{t("ping_test")}</Select.Item>
            <Select.Item value="dns">{t("dns_query")}</Select.Item>
            <Select.Item value="traceroute">{t("traceroute")}</Select.Item>
            <Select.Item value="http">{t("http_test")}</Select.Item>
            <Select.Item value="full">{t("full_diagnostic")}</Select.Item>
          </Select.Content>
        </Select.Root>
        <Button onClick={handleRunDiagnostic} disabled={diagLoading || !diagTarget.trim()}>
          <PlayIcon />
          {diagLoading ? t("loading") : t("run_diagnostic")}
        </Button>
      </Flex>

      <Card style={{ flex: 1 }}>
        <ScrollArea style={{ height: "100%" }}>
          {diagResult ? (
            <Flex direction="column" gap="3" p="2">
              {diagResult.ping && (
                <Box>
                  <Text weight="bold" mb="2">{t("ping_test")}</Text>
                  <Flex gap="4" wrap="wrap">
                    <Text size="2">{t("packets_sent")}: {diagResult.ping.packets_sent}</Text>
                    <Text size="2">{t("packets_received")}: {diagResult.ping.packets_received}</Text>
                    <Text size="2">{t("packet_loss")}: {diagResult.ping.packet_loss_percent}%</Text>
                    {diagResult.ping.avg_latency_ms && (
                      <Text size="2">{t("avg_latency")}: {diagResult.ping.avg_latency_ms} ms</Text>
                    )}
                  </Flex>
                </Box>
              )}
              {diagResult.dns && (
                <Box>
                  <Text weight="bold" mb="2">{t("dns_query")}</Text>
                  {diagResult.dns.records.map((r, i) => (
                    <Text key={i} size="2" style={{ fontFamily: "monospace" }}>
                      {r.record_type}: {r.value} {r.ttl && `(TTL: ${r.ttl})`}
                    </Text>
                  ))}
                </Box>
              )}
              {diagResult.traceroute && (
                <Box>
                  <Text weight="bold" mb="2">{t("traceroute")}</Text>
                  {diagResult.traceroute.hops.map((hop) => (
                    <Text key={hop.hop} size="2" style={{ fontFamily: "monospace" }}>
                      {hop.hop}. {hop.ip || "*"} {hop.hostname && `(${hop.hostname})`} {hop.latency_ms && `${hop.latency_ms} ms`}
                    </Text>
                  ))}
                </Box>
              )}
              {diagResult.http && (
                <Box>
                  <Text weight="bold" mb="2">{t("http_test")}</Text>
                  <Flex gap="4">
                    {diagResult.http.status_code && <Text size="2">{t("status_code")}: {diagResult.http.status_code}</Text>}
                    <Text size="2">{t("response_time")}: {diagResult.http.response_time_ms} ms</Text>
                    {diagResult.http.error && <Text size="2" color="red">{diagResult.http.error}</Text>}
                  </Flex>
                </Box>
              )}
            </Flex>
          ) : (
            <Text align="center" color="gray" mt="4">{t("no_results")}</Text>
          )}
        </ScrollArea>
      </Card>
    </Flex>
  );

  // Render rules tab
  const renderRulesTab = () => (
    <Flex direction="column" gap="4" style={{ flex: 1 }} pt="1" pb="4">
      <Flex justify="between" align="center" style={{ minHeight: 32 }}>
        <Heading size="5">{t("rules")}</Heading>
        <Flex gap="2">
          <Button variant="soft" onClick={handleUpdateAllRules}>
            <ReloadIcon />
            {t("update_all_rules")}
          </Button>
          <Dialog.Root open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
            <Dialog.Trigger>
              <Button>
                <PlusIcon />
                {t("add_rule_source")}
              </Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="400px">
              <Dialog.Title>{t("add_rule_source")}</Dialog.Title>
              <Flex direction="column" gap="3" mt="3">
                <TextField.Root
                  placeholder={t("rule_name")}
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                />
                <TextField.Root
                  placeholder={t("rule_url")}
                  value={newRuleUrl}
                  onChange={(e) => setNewRuleUrl(e.target.value)}
                />
                <Flex gap="3" justify="end">
                  <Dialog.Close>
                    <Button variant="soft" color="gray">{t("cancel")}</Button>
                  </Dialog.Close>
                  <Button onClick={handleAddRuleSource}>{t("add")}</Button>
                </Flex>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
      </Flex>

      {/* Rule Config */}
      <Card>
        <Flex direction="column" gap="3" p="2">
          <Flex justify="between" align="center">
            <Text weight="medium">{t("auto_update_rules")}</Text>
            <Switch
              checked={ruleConfig.auto_update}
              onCheckedChange={(checked) => handleSaveRuleConfig({ ...ruleConfig, auto_update: checked })}
            />
          </Flex>
          <Flex justify="between" align="center">
            <Text weight="medium">{t("update_interval")}</Text>
            <Select.Root
              value={String(ruleConfig.update_interval_hours)}
              onValueChange={(v) => handleSaveRuleConfig({ ...ruleConfig, update_interval_hours: parseInt(v) })}
              disabled={!ruleConfig.auto_update}
            >
              <Select.Trigger style={{ width: 120 }} />
              <Select.Content>
                <Select.Item value="6">6</Select.Item>
                <Select.Item value="12">12</Select.Item>
                <Select.Item value="24">24</Select.Item>
                <Select.Item value="48">48</Select.Item>
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>
      </Card>

      <Card style={{ flex: 1 }}>
        <ScrollArea style={{ height: "100%" }}>
          {ruleConfig.sources.length === 0 ? (
            <Text align="center" color="gray" mt="4">{t("no_rule_sources")}</Text>
          ) : (
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>{t("rule_name")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("rule_url")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("entry_count")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>{t("last_updated")}</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="120px"></Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {ruleConfig.sources.map((source) => (
                  <Table.Row key={source.id}>
                    <Table.Cell>
                      <Flex align="center" gap="2">
                        <Switch
                          size="1"
                          checked={source.enabled}
                          onCheckedChange={(checked) => handleToggleRuleSource(source.id, checked)}
                        />
                        <Text>{source.name}</Text>
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="1" style={{ wordBreak: "break-all" }}>{source.url}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge>{source.entry_count}</Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="1">{source.last_updated ? new Date(source.last_updated).toLocaleString() : "-"}</Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Flex gap="1">
                        <IconButton size="1" variant="ghost" onClick={() => handleUpdateRuleSource(source.id)}>
                          <ReloadIcon />
                        </IconButton>
                        <IconButton size="1" variant="ghost" color="red" onClick={() => handleRemoveRuleSource(source.id)}>
                          <TrashIcon />
                        </IconButton>
                      </Flex>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </ScrollArea>
      </Card>
    </Flex>
  );

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
          {activeTab === "optimize" && renderOptimizeTab()}
          {activeTab === "hosts" && renderHostsTab()}
          {activeTab === "monitor" && renderMonitorTab()}
          {activeTab === "diagnostic" && renderDiagnosticTab()}
          {activeTab === "rules" && renderRulesTab()}
          {activeTab === "history" && renderHistoryTab()}
          {activeTab === "settings" && renderSettingsTab()}
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
    </Box>
  );
}

export default App;
