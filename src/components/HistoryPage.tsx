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
    HoverCard,
} from "@radix-ui/themes";
import {
    TrashIcon,
    CounterClockwiseClockIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { HistoryEntry } from "../types";

interface HistoryPageProps {
    history: HistoryEntry[];
    handleClearHistory: () => void;
    handleRollback: (entryId: string) => void;
}

export function HistoryPage({
    history,
    handleClearHistory,
    handleRollback,
}: HistoryPageProps) {
    const { t } = useTranslation();

    return (
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
                                    <Table.ColumnHeaderCell>{t("time")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("domain")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("ip_address")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("latency")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell>{t("action")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
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
                                            <HoverCard.Root>
                                                <HoverCard.Trigger>
                                                    <IconButton size="1" variant="ghost" onClick={() => handleRollback(entry.id)}>
                                                        <CounterClockwiseClockIcon />
                                                    </IconButton>
                                                </HoverCard.Trigger>
                                                <HoverCard.Content size="1">
                                                    <Text size="1">{t("rollback")}</Text>
                                                </HoverCard.Content>
                                            </HoverCard.Root>
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
}
