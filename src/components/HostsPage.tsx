import {
    Flex,
    Text,
    Button,
    Card,
    Heading,
    ScrollArea,
    IconButton,
    Table,
    AlertDialog,
} from "@radix-ui/themes";
import {
    ReloadIcon,
    TrashIcon,
    DownloadIcon,
    UploadIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { HostEntry } from "../types";

interface HostsPageProps {
    hostsLoading: boolean;
    hostsEntries: HostEntry[];
    loadHostsEntries: () => void;
    handleRemoveHostsEntry: (domain: string) => void;
    handleExport: (type: "presets" | "hosts") => void;
    setImportType: (type: "presets" | "hosts") => void;
    setImportDialogOpen: (open: boolean) => void;
}

export function HostsPage({
    hostsLoading,
    hostsEntries,
    loadHostsEntries,
    handleRemoveHostsEntry,
    handleExport,
    setImportType,
    setImportDialogOpen,
}: HostsPageProps) {
    const { t } = useTranslation();

    return (
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
                                    <Table.ColumnHeaderCell>{t("domain")}</Table.ColumnHeaderCell>
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
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
}
