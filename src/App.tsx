import { useState, useEffect, useMemo } from "react";
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

  // Render optimize tab
  const renderOptimizeTab = () => (
    <Flex gap="4" style={{ flex: 1, minHeight: 0 }}>
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
          <Button variant="soft" onClick={handleFlushDns}>
            <ReloadIcon />
            {t("flush_dns")}
          </Button>
          <Button disabled={!selectedIp || !isAdmin} onClick={handleWriteHosts}>
            <CheckIcon />
            {t("write_hosts")}
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );

  // Render hosts management tab
  const renderHostsTab = () => (
    <Flex direction="column" gap="3" style={{ flex: 1 }}>
      <Flex justify="between" align="center">
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
    <Flex direction="column" gap="3" style={{ flex: 1 }}>
      <Flex justify="between" align="center">
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
    <Flex direction="column" gap="4" style={{ maxWidth: 600 }}>
      <Heading size="5">{t("settings")}</Heading>

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
        <Tabs.List mb="3">
          <Tabs.Trigger value="optimize">
            <Flex align="center" gap="2">
              <RocketIcon />
              <span>{t("nav_optimize")}</span>
            </Flex>
          </Tabs.Trigger>
          <Tabs.Trigger value="hosts">
            <Flex align="center" gap="2">
              <GlobeIcon />
              <span>{t("nav_hosts")}</span>
            </Flex>
          </Tabs.Trigger>
          <Tabs.Trigger value="history">
            <Flex align="center" gap="2">
              <ClockIcon />
              <span>{t("nav_history")}</span>
            </Flex>
          </Tabs.Trigger>
          <Tabs.Trigger value="settings">
            <Flex align="center" gap="2">
              <GearIcon />
              <span>{t("nav_settings")}</span>
            </Flex>
          </Tabs.Trigger>
        </Tabs.List>

        <Box style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {activeTab === "optimize" && renderOptimizeTab()}
          {activeTab === "hosts" && renderHostsTab()}
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
