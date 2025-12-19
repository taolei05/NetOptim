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

export type TabType = "optimize" | "hosts" | "history" | "settings";
