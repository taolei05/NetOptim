import {
    Flex,
    Text,
    TextField,
    Button,
    Card,
    Heading,
    ScrollArea,
    IconButton,
    Badge,
    Switch,
    Select,
    Dialog,
    HoverCard,
    Box,
} from "@radix-ui/themes";
import {
    SunIcon,
    MoonIcon,
    DesktopIcon,
    ClockIcon,
    DownloadIcon,
    PlusIcon,
    EyeOpenIcon,
    CounterClockwiseClockIcon,
    TrashIcon,
    CrossCircledIcon,
    FileTextIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { AppSettings, SchedulerConfig, HostsBackup, Blacklist } from "../types";

// ACCENT_COLORS is defined in App.tsx, need to be passed in or redefined
const ACCENT_COLORS = [
    "gray", "gold", "bronze", "brown", "yellow", "amber", "orange", "tomato", "red", "ruby", "crimson", "pink",
    "plum", "purple", "violet", "iris", "indigo", "blue", "cyan", "teal", "jade", "green", "grass", "lime", "mint", "sky"
] as const;

interface SettingsPageProps {
    settings: AppSettings;
    saveSettings: (settings: AppSettings) => void;
    mode: "light" | "dark" | "system";
    setMode: (mode: "light" | "dark" | "system") => void;
    accentColor: typeof ACCENT_COLORS[number];
    setAccentColor: (color: typeof ACCENT_COLORS[number]) => void;
    schedulerConfig: SchedulerConfig;
    saveSchedulerConfig: (config: SchedulerConfig) => void;
    backupDialogOpen: boolean;
    setBackupDialogOpen: (open: boolean) => void;
    backupDescription: string;
    setBackupDescription: (desc: string) => void;
    handleCreateBackup: () => void;
    backups: HostsBackup[];
    handleViewBackupContent: (id: string) => void;
    handleRestoreBackup: (id: string) => void;
    handleDeleteBackup: (id: string) => void;
    blacklist: Blacklist;
    handleRemoveFromBlacklist: (ip: string) => void;
    handleLoadLogs: () => void;
    handleClearLogs: () => void;
    viewBackupContent: string | null;
    setViewBackupContent: (content: string | null) => void;
    logsDialogOpen: boolean;
    setLogsDialogOpen: (open: boolean) => void;
    logFiles: [string, number][];
    logs: string[];
}

export function SettingsPage({
    settings,
    saveSettings,
    mode,
    setMode,
    accentColor,
    setAccentColor,
    schedulerConfig,
    saveSchedulerConfig,
    backupDialogOpen,
    setBackupDialogOpen,
    backupDescription,
    setBackupDescription,
    handleCreateBackup,
    backups,
    handleViewBackupContent,
    handleRestoreBackup,
    handleDeleteBackup,
    blacklist,
    handleRemoveFromBlacklist,
    handleLoadLogs,
    handleClearLogs,
    viewBackupContent,
    setViewBackupContent,
    logsDialogOpen,
    setLogsDialogOpen,
    logFiles,
    logs,
}: SettingsPageProps) {
    const { t } = useTranslation();

    return (
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
                                            <HoverCard.Root>
                                                <HoverCard.Trigger>
                                                    <IconButton size="1" variant="ghost" onClick={() => handleViewBackupContent(backup.id)}>
                                                        <EyeOpenIcon />
                                                    </IconButton>
                                                </HoverCard.Trigger>
                                                <HoverCard.Content size="1">
                                                    <Text size="1">{t("view_content")}</Text>
                                                </HoverCard.Content>
                                            </HoverCard.Root>
                                            <HoverCard.Root>
                                                <HoverCard.Trigger>
                                                    <IconButton size="1" variant="ghost" onClick={() => handleRestoreBackup(backup.id)}>
                                                        <CounterClockwiseClockIcon />
                                                    </IconButton>
                                                </HoverCard.Trigger>
                                                <HoverCard.Content size="1">
                                                    <Text size="1">{t("restore")}</Text>
                                                </HoverCard.Content>
                                            </HoverCard.Root>
                                            <HoverCard.Root>
                                                <HoverCard.Trigger>
                                                    <IconButton size="1" variant="ghost" color="red" onClick={() => handleDeleteBackup(backup.id)}>
                                                        <TrashIcon />
                                                    </IconButton>
                                                </HoverCard.Trigger>
                                                <HoverCard.Content size="1">
                                                    <Text size="1">{t("delete")}</Text>
                                                </HoverCard.Content>
                                            </HoverCard.Root>
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

        </Flex>
    );
}
