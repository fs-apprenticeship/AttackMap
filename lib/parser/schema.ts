import { z } from "zod";

export const ServiceSchema = z.object({
  id: z.string(),
  host_id: z.string(),
  port: z.number(),
  protocol: z.string(),
  service_name: z.string(),
  product: z.string().optional(),
  version: z.string().optional(),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
});

export const HostSchema = z.object({
  id: z.string(),
  scan_id: z.string(),
  ip_address: z.string(),
  hostname: z.string().optional(),
  operating_system: z.string().optional(),
  role: z.string().optional(),
  internet_exposed: z.boolean(),
  services: z.array(ServiceSchema),
});

export const FindingSchema = z.object({
  id: z.string(),
  scan_id: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  title: z.string(),
  evidence: z.string(),
  remediation: z.string(),
});

export const ParsedScanSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  filename: z.string(),
  uploaded_at: z.string(),
  parsed_at: z.string(),
  summary: z.object({
    total_hosts: z.number(),
    open_ports: z.number(),
    risky_services: z.number(),
    findings: z.number(),
  }),
  hosts: z.array(HostSchema),
  findings: z.array(FindingSchema),
});

export type Service = z.infer<typeof ServiceSchema>;
export type Host = z.infer<typeof HostSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type ParsedScan = z.infer<typeof ParsedScanSchema>;
