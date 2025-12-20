import {
    Flex,
    Text,
    TextField,
    Button,
    Card,
    Badge,
    ScrollArea,
    IconButton,
    Dialog,
    Table,
    HoverCard,
} from "@radix-ui/themes";
import {
    MagnifyingGlassIcon,
    RocketIcon,
    GlobeIcon,
    CheckIcon,
    ReloadIcon,
    TrashIcon,
    PlusIcon,
    DownloadIcon,
    UploadIcon,
    CrossCircledIcon,
    EyeOpenIcon,
    ActivityLogIcon,
    ExclamationTriangleIcon,
    MixerHorizontalIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { ResolveResult, ProxyCheckResult } from "../types";

// 定义组件 Props 接口
interface OptimizePageProps {
    presets: string[];
    domain: string;
    setDomain: (domain: string) => void;
    newPreset: string;
    setNewPreset: (preset: string) => void;
    dialogOpen: boolean;
    setDialogOpen: (open: boolean) => void;
    addPreset: () => void;
    removePreset: (preset: string) => void;
    handleExport: (type: "presets" | "hosts") => void;
    setImportType: (type: "presets" | "hosts") => void;
    setImportDialogOpen: (open: boolean) => void;
    isAdmin: boolean;
    loading: boolean;
    handleResolve: (targetDomain?: string) => void;
    batchLoading: boolean;
    handleBatchOptimize: () => void;
    status: string;
    results: ResolveResult["results"];
    selectedIp: string | null;
    setSelectedIp: (ip: string | null) => void;
    currentDomain: string;
    handleAddToBlacklist: (ip: string, domain?: string, reason?: string) => void;
    handleGetIpDetails: (ip: string) => void;
    handleTestConnectivity: () => void;
    handleCheckProxy: (domain: string) => void;
    handleFlushDns: () => void;
    handleAddToMonitor: (domain: string, ip: string, latency: number | null) => void;
    handleWriteHosts: () => void;
    proxyCheckResult: ProxyCheckResult | null;
}

export function OptimizePage({
    presets,
    domain,
    setDomain,
    newPreset,
    setNewPreset,
    dialogOpen,
    setDialogOpen,
    addPreset,
    removePreset,
    handleExport,
    setImportType,
    setImportDialogOpen,
    isAdmin,
    loading,
    handleResolve,
    batchLoading,
    handleBatchOptimize,
    status,
    results,
    selectedIp,
    setSelectedIp,
    currentDomain,
    handleAddToBlacklist,
    handleGetIpDetails,
    handleTestConnectivity,
    handleCheckProxy,
    handleFlushDns,
    handleAddToMonitor,
    handleWriteHosts,
    proxyCheckResult,
}: OptimizePageProps) {
    const { t } = useTranslation();

    return (
        <Flex gap="4" style={{ flex: 1, minHeight: 0 }} pt="1" pb="4">
            {/* Left sidebar - Presets */}
            <Card style={{ width: 220, display: "flex", flexDirection: "column" }}>
                <Flex justify="between" align="center" mb="2">
                    <Flex align="center" gap="1">
                        <GlobeIcon />
                        <Text size="2" weight="bold">{t("presets")}</Text>
                    </Flex>
                    <Flex gap="2" align="center">
                        <HoverCard.Root>
                            <HoverCard.Trigger>
                                <IconButton size="1" variant="ghost" onClick={() => handleExport("presets")}>
                                    <DownloadIcon />
                                </IconButton>
                            </HoverCard.Trigger>
                            <HoverCard.Content size="1">
                                <Text size="1">{t("export")}</Text>
                            </HoverCard.Content>
                        </HoverCard.Root>
                        <HoverCard.Root>
                            <HoverCard.Trigger>
                                <IconButton size="1" variant="ghost" onClick={() => { setImportType("presets"); setImportDialogOpen(true); }}>
                                    <UploadIcon />
                                </IconButton>
                            </HoverCard.Trigger>
                            <HoverCard.Content size="1">
                                <Text size="1">{t("import")}</Text>
                            </HoverCard.Content>
                        </HoverCard.Root>
                        <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
                            <Dialog.Trigger>
                                <IconButton size="1" variant="soft" title={t("add_preset")}>
                                    <PlusIcon />
                                </IconButton>
                            </Dialog.Trigger>
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
                    <ScrollArea style={{ flex: 1 }}>
                        <Table.Root>
                            <Table.Header>
                                <Table.Row>
                                    <Table.ColumnHeaderCell>{t("ip_address")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ textAlign: "center" }}>{t("latency")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("location")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell style={{ textAlign: "center" }}>{t("cdn")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {results.map((r) => (
                                    <Table.Row
                                        key={r.ip}
                                        style={{
                                            cursor: "pointer",
                                            background: selectedIp === r.ip ? "var(--accent-4)" : undefined,
                                        }}
                                        onClick={() => setSelectedIp(r.ip)}
                                    >
                                        <Table.Cell>
                                            <Text style={{ fontFamily: "monospace" }}>{r.ip}</Text>
                                        </Table.Cell>
                                        <Table.Cell style={{ textAlign: "center" }}>
                                            {r.latency !== null ? (
                                                <Badge color={r.latency < 100 ? "green" : r.latency < 300 ? "yellow" : "red"}>
                                                    {r.latency} ms
                                                </Badge>
                                            ) : (
                                                <Badge color="gray">{t("timeout")}</Badge>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Text size="1" color="gray">{r.location || "-"}</Text>
                                        </Table.Cell>
                                        <Table.Cell style={{ textAlign: "center" }}>
                                            {r.is_cdn && <Badge color="blue">CDN</Badge>}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Flex gap="2">
                                                <HoverCard.Root>
                                                    <HoverCard.Trigger>
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
                                                    </HoverCard.Trigger>
                                                    <HoverCard.Content size="1">
                                                        <Text size="1">{t("add_to_blacklist")}</Text>
                                                    </HoverCard.Content>
                                                </HoverCard.Root>
                                                <HoverCard.Root>
                                                    <HoverCard.Trigger>
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
                                                    </HoverCard.Trigger>
                                                    <HoverCard.Content size="1">
                                                        <Text size="1">{t("ip_details")}</Text>
                                                    </HoverCard.Content>
                                                </HoverCard.Root>
                                            </Flex>
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table.Root>
                        {results.length === 0 && !loading && (
                            <Text size="2" color="gray" align="center" style={{ padding: "var(--space-4)" }}>{t("no_results")}</Text>
                        )}
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
}
