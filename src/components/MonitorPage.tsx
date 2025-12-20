import {
    Flex,
    Text,
    Button,
    Card,
    Heading,
    ScrollArea,
    IconButton,
    Table,
    Badge,
    Switch,
    Select,
} from "@radix-ui/themes";
import {
    ReloadIcon,
    TrashIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { MonitorConfig, MonitorState } from "../types";

// 需要定义 MonitorRecord 中的 MonitorStatus 字符串字面量类型，如果 types 中是 enum 可能需要转换
// 这里假设 types 中 MonitorState 和 MonitorConfig 已正确导出

interface MonitorPageProps {
    monitorConfig: MonitorConfig;
    monitorState: MonitorState | null;
    handleCheckAllDomains: () => void;
    handleSaveMonitorConfig: (config: MonitorConfig) => void;
    handleCheckDomain: (domain: string) => void;
    handleRemoveFromMonitor: (domain: string) => void;
}

export function MonitorPage({
    monitorConfig,
    monitorState,
    handleCheckAllDomains,
    handleSaveMonitorConfig,
    handleCheckDomain,
    handleRemoveFromMonitor,
}: MonitorPageProps) {
    const { t } = useTranslation();

    return (
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
                                    <Table.ColumnHeaderCell>{t("domain")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("ip_address")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("baseline_latency")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("current_latency")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("last_check")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
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
                                                <Flex gap="2">
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
}
