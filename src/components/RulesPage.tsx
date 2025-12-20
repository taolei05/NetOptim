import {
    Flex,
    Text,
    TextField,
    Button,
    Card,
    Heading,
    ScrollArea,
    IconButton,
    Table,
    Badge,
    Switch,
    Select,
    Dialog,
} from "@radix-ui/themes";
import {
    ReloadIcon,
    TrashIcon,
    PlusIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { RuleConfig } from "../types";

interface RulesPageProps {
    ruleConfig: RuleConfig;
    handleUpdateAllRules: () => void;
    ruleDialogOpen: boolean;
    setRuleDialogOpen: (open: boolean) => void;
    newRuleName: string;
    setNewRuleName: (name: string) => void;
    newRuleUrl: string;
    setNewRuleUrl: (url: string) => void;
    handleAddRuleSource: () => void;
    handleSaveRuleConfig: (config: RuleConfig) => void;
    handleToggleRuleSource: (id: string, enabled: boolean) => void;
    handleUpdateRuleSource: (id: string) => void;
    handleRemoveRuleSource: (id: string) => void;
}

export function RulesPage({
    ruleConfig,
    handleUpdateAllRules,
    ruleDialogOpen,
    setRuleDialogOpen,
    newRuleName,
    setNewRuleName,
    newRuleUrl,
    setNewRuleUrl,
    handleAddRuleSource,
    handleSaveRuleConfig,
    handleToggleRuleSource,
    handleUpdateRuleSource,
    handleRemoveRuleSource,
}: RulesPageProps) {
    const { t } = useTranslation();

    return (
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
                                    <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
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
                                            <Flex gap="2">
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
}
