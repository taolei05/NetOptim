export interface IpResult {
  ip: string;
  latency: number | null;
  location?: string;
  is_cdn: boolean;
}

export interface ResolveResult {
  domain: string;
  results: IpResult[];
}

export interface BatchResult {
  domain: string;
  best_ip: string | null;
  latency: number | null;
  success: boolean;
  error: string | null;
}

export interface HostEntry {
  ip: string;
  domain: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  domain: string;
  ip: string;
  latency: number | null;
  action: string;
}

export interface SchedulerConfig {
  enabled: boolean;
  interval_minutes: number;
  auto_update: boolean;
  notify: boolean;
}

export interface AppSettings {
  language: "zh-CN" | "en-US";
  minimize_to_tray: boolean;
  start_minimized: boolean;
  check_updates: boolean;
}

export interface ConnectivityResult {
  reachable: boolean;
  latency: number | null;
  error: string | null;
}

export interface ProxyCheckResult {
  needs_proxy: boolean;
  message: string;
}

export type TabType = "optimize" | "hosts" | "history" | "settings" | "monitor" | "diagnostic" | "rules";

// ==================== 黑名单 ====================

export interface BlacklistEntry {
  ip: string;
  domain?: string;
  reason?: string;
  added_at: string;
}

export interface Blacklist {
  entries: BlacklistEntry[];
}

// ==================== 网络监控 ====================

export type MonitorStatus = "Good" | "Warning" | "Critical" | "Timeout";

export interface MonitorRecord {
  timestamp: string;
  latency: number | null;
  status: MonitorStatus;
}

export interface DomainMonitor {
  domain: string;
  current_ip: string;
  baseline_latency: number | null;
  records: MonitorRecord[];
  last_check: string | null;
  alert_triggered: boolean;
}

export interface MonitorConfig {
  enabled: boolean;
  check_interval_seconds: number;
  warning_threshold_percent: number;
  critical_threshold_ms: number;
  auto_reoptimize: boolean;
  max_records: number;
}

export interface MonitorState {
  domains: Record<string, DomainMonitor>;
  config: MonitorConfig;
}

// ==================== 备份恢复 ====================

export interface HostsBackup {
  id: string;
  timestamp: string;
  content: string;
  description?: string;
}

export interface BackupList {
  backups: HostsBackup[];
}

// ==================== 网络诊断 ====================

export interface TracerouteHop {
  hop: number;
  ip?: string;
  hostname?: string;
  latency_ms?: number;
}

export interface TracerouteResult {
  target: string;
  hops: TracerouteHop[];
  completed: boolean;
}

export interface DnsRecord {
  record_type: string;
  value: string;
  ttl?: number;
}

export interface DnsQueryResult {
  domain: string;
  dns_server?: string;
  records: DnsRecord[];
  query_time_ms?: number;
}

export interface PingDiagResult {
  packets_sent: number;
  packets_received: number;
  packet_loss_percent: number;
  min_latency_ms?: number;
  avg_latency_ms?: number;
  max_latency_ms?: number;
}

export interface HttpDiagResult {
  url: string;
  status_code?: number;
  response_time_ms: number;
  error?: string;
}

export interface NetworkDiagnostic {
  target: string;
  ping_result?: PingDiagResult;
  dns_result?: DnsQueryResult;
  traceroute_result?: TracerouteResult;
  http_result?: HttpDiagResult;
}

// ==================== 规则管理 ====================

export interface RuleSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_updated?: string;
  entry_count: number;
}

export interface RuleConfig {
  sources: RuleSource[];
  auto_update: boolean;
  update_interval_hours: number;
}

export interface ParsedRule {
  ip: string;
  domain: string;
  source: string;
}
