import {
    Flex,
    Text,
    TextField,
    Button,
    Card,
    Heading,
    ScrollArea,
    Box,
    Select,
} from "@radix-ui/themes";
import {
    PlayIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import {
    NetworkDiagnostic,
} from "../types";

interface DiagnosticPageProps {
    diagTarget: string;
    setDiagTarget: (target: string) => void;
    diagType: "ping" | "dns" | "traceroute" | "http" | "full";
    setDiagType: (type: "ping" | "dns" | "traceroute" | "http" | "full") => void;
    diagLoading: boolean;
    handleRunDiagnostic: () => void;
    diagResult: NetworkDiagnostic | null;
}

export function DiagnosticPage({
    diagTarget,
    setDiagTarget,
    diagType,
    setDiagType,
    diagLoading,
    handleRunDiagnostic,
    diagResult,
}: DiagnosticPageProps) {
    const { t } = useTranslation();

    return (
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
                <Select.Root value={diagType} onValueChange={(v) => setDiagType(v as any)}>
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
                            {diagResult.ping_result && (
                                <Box>
                                    <Text weight="bold" mb="2">{t("ping_test")}</Text>
                                    <Flex gap="4" wrap="wrap">
                                        <Text size="2">{t("packets_sent")}: {diagResult.ping_result.packets_sent}</Text>
                                        <Text size="2">{t("packets_received")}: {diagResult.ping_result.packets_received}</Text>
                                        <Text size="2">{t("packet_loss")}: {diagResult.ping_result.packet_loss_percent}%</Text>
                                        {diagResult.ping_result.avg_latency_ms && (
                                            <Text size="2">{t("avg_latency")}: {diagResult.ping_result.avg_latency_ms} ms</Text>
                                        )}
                                    </Flex>
                                </Box>
                            )}
                            {diagResult.dns_result && (
                                <Box>
                                    <Text weight="bold" mb="2">{t("dns_query")}</Text>
                                    {diagResult.dns_result.records.map((r, i) => (
                                        <Text key={i} size="2" style={{ fontFamily: "monospace" }}>
                                            {r.record_type}: {r.value} {r.ttl && `(TTL: ${r.ttl})`}
                                        </Text>
                                    ))}
                                </Box>
                            )}
                            {diagResult.traceroute_result && (
                                <Box>
                                    <Text weight="bold" mb="2">{t("traceroute")}</Text>
                                    {diagResult.traceroute_result.hops.map((hop) => (
                                        <Text key={hop.hop} size="2" style={{ fontFamily: "monospace" }}>
                                            {hop.hop}. {hop.ip || "*"} {hop.hostname && `(${hop.hostname})`} {hop.latency_ms && `${hop.latency_ms} ms`}
                                        </Text>
                                    ))}
                                </Box>
                            )}
                            {diagResult.http_result && (
                                <Box>
                                    <Text weight="bold" mb="2">{t("http_test")}</Text>
                                    <Flex gap="4">
                                        {diagResult.http_result.status_code && <Text size="2">{t("status_code")}: {diagResult.http_result.status_code}</Text>}
                                        <Text size="2">{t("response_time")}: {diagResult.http_result.response_time_ms} ms</Text>
                                        {diagResult.http_result.error && <Text size="2" color="red">{diagResult.http_result.error}</Text>}
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
}
