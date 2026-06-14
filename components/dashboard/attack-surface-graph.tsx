"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  Activity,
  Globe2,
  MousePointer2,
  Server,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Host, Service, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SeverityBadge } from "./severity-badge";
import { formatRole, nodeClass, severityOrder } from "./utils";

type AttackSurfaceGraphProps = {
  hosts: Host[];
};

type HostNodeData = {
  host: Host;
  riskLevel: Severity;
  serviceCount: number;
} & Record<string, unknown>;

type ServiceNodeData = {
  service: Service;
  host: Host;
} & Record<string, unknown>;

type HostGraphNode = Node<HostNodeData, "host">;
type ServiceGraphNode = Node<ServiceNodeData, "service">;
type AttackGraphNode = HostGraphNode | ServiceGraphNode;

type SelectedNode =
  | { kind: "host"; host: Host; riskLevel: Severity }
  | { kind: "service"; host: Host; service: Service };

const severityColor: Record<Severity, string> = {
  critical: "#dc2626",
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
  info: "#0ea5e9",
};

const nodeTypes = {
  host: HostNode,
  service: ServiceNode,
} satisfies NodeTypes;

export function AttackSurfaceGraph({ hosts }: AttackSurfaceGraphProps) {
  const [selectedHostId, setSelectedHostId] = useState(hosts[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    hosts[0]?.id ? `host-${hosts[0].id}` : null,
  );

  const activeHost = useMemo(
    () => hosts.find((host) => host.id === selectedHostId) ?? hosts[0],
    [selectedHostId, hosts],
  );

  const graph = useMemo(() => {
    if (!activeHost) {
      return { nodes: [] as AttackGraphNode[], edges: [] as Edge[] };
    }

    return buildGraph(activeHost);
  }, [activeHost]);

  const selectedNode = useMemo(() => {
    if (!activeHost || !selectedNodeId) return null;

    if (selectedNodeId === `host-${activeHost.id}`) {
      return {
        kind: "host",
        host: activeHost,
        riskLevel: getHostRisk(activeHost),
      } satisfies SelectedNode;
    }

    const service = activeHost.services.find(
      (item) => `service-${item.id}` === selectedNodeId,
    );

    return service
      ? ({
          kind: "service",
          host: activeHost,
          service,
        } satisfies SelectedNode)
      : null;
  }, [activeHost, selectedNodeId]);

  if (!activeHost) {
    return (
      <div className="flex min-h-[430px] items-center justify-center rounded-md border bg-white text-sm text-zinc-500 shadow-sm">
        No live hosts found in this scan.
      </div>
    );
  }

  return (
    <Card className="rounded-md border bg-white py-0 shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Attack surface graph</CardTitle>
          <CardDescription className="mt-1">
            Click nodes to inspect exposed services and host context
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-red-500" />
              high
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-500" />
              medium
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-emerald-500" />
              low
            </span>
          </div>
          <Select
            value={activeHost.id}
            onValueChange={(value) => {
              setSelectedHostId(value);
              setSelectedNodeId(`host-${value}`);
            }}
          >
            <SelectTrigger
              aria-label="Select host"
              className="h-9 min-h-9 w-full rounded-md border-zinc-200 bg-zinc-50 text-sm font-medium shadow-none sm:w-[260px] data-[size=default]:h-9"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {hosts.map((host) => (
                <SelectItem key={host.id} value={host.id}>
                  {host.hostname ?? host.ipAddress}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="grid min-h-[540px] gap-0 p-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[540px] min-w-0 bg-[linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)] bg-[size:28px_28px]">
          {activeHost.services.length === 0 ? (
            <div className="absolute left-4 top-4 z-10 rounded-md border bg-white px-3 py-2 text-xs text-zinc-500 shadow-sm">
              This host has no exposed services in the scan.
            </div>
          ) : null}
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.35}
            maxZoom={1.45}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(`host-${activeHost.id}`)}
          >
            <Background color="#d4d4d8" gap={28} />
            <Controls
              position="bottom-left"
              className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm"
            />
          </ReactFlow>
        </div>
        <GraphDetailPanel selection={selectedNode} />
      </CardContent>
    </Card>
  );
}

function buildGraph(host: Host) {
  const hostRisk = getHostRisk(host);
  const serviceCount = host.services.length;
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(serviceCount))));
  const rows = Math.max(1, Math.ceil(serviceCount / columns));
  const hostY = Math.max(120, rows * 82 - 32);

  const nodes: AttackGraphNode[] = [
    {
      id: `host-${host.id}`,
      type: "host",
      position: { x: 40, y: hostY },
      data: {
        host,
        riskLevel: hostRisk,
        serviceCount,
      },
    },
  ];

  const edges: Edge[] = [];

  host.services.forEach((service, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const nodeId = `service-${service.id}`;

    nodes.push({
      id: nodeId,
      type: "service",
      position: {
        x: 360 + column * 230,
        y: 40 + row * 150,
      },
      data: {
        host,
        service,
      },
    });

    edges.push({
      id: `edge-${host.id}-${service.id}`,
      source: `host-${host.id}`,
      target: nodeId,
      type: "smoothstep",
      animated:
        service.riskLevel === "critical" || service.riskLevel === "high",
      style: {
        stroke: severityColor[service.riskLevel],
        strokeWidth: 2,
      },
    });
  });

  return { nodes, edges };
}

function HostNode({ data, selected }: NodeProps<HostGraphNode>) {
  const { host, riskLevel, serviceCount } = data;

  return (
    <div
      className={cn(
        "w-[260px] rounded-md border-2 border-zinc-900 bg-zinc-950 p-4 text-white shadow-sm transition",
        selected && "ring-4 ring-zinc-950/20",
      )}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border-white !bg-zinc-950"
      />
      <div className="flex items-start justify-between gap-3">
        <Server className="size-6 shrink-0" />
        <SeverityBadge severity={riskLevel} />
      </div>
      <p className="mt-5 truncate text-lg font-semibold">
        {host.hostname ?? host.ipAddress}
      </p>
      <p className="mt-1 text-sm text-zinc-300">{host.ipAddress}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
          {formatRole(host.role)}
        </span>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs">
          {serviceCount} {serviceCount === 1 ? "service" : "services"}
        </span>
      </div>
    </div>
  );
}

function ServiceNode({ data, selected }: NodeProps<ServiceGraphNode>) {
  const { service } = data;

  return (
    <div
      className={cn(
        "w-[190px] rounded-md border p-3 shadow-sm transition",
        nodeClass[service.riskLevel],
        selected && "ring-4 ring-zinc-950/15",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border-white"
        style={{ background: severityColor[service.riskLevel] }}
      />
      <div className="flex items-start justify-between gap-2">
        <TerminalSquare className="mt-0.5 size-4 shrink-0" />
        <SeverityBadge severity={service.riskLevel} />
      </div>
      <p className="mt-3 text-sm font-semibold">
        {service.port}/{service.protocol}
      </p>
      <p className="mt-1 truncate text-sm">{service.serviceName}</p>
      <p className="mt-2 line-clamp-2 text-xs opacity-75">
        {[service.product, service.version].filter(Boolean).join(" ") ||
          "No product fingerprint"}
      </p>
    </div>
  );
}

function GraphDetailPanel({ selection }: { selection: SelectedNode | null }) {
  if (!selection) {
    return (
      <aside className="flex min-h-[240px] flex-col justify-center border-t bg-zinc-50 p-4 text-center xl:border-l xl:border-t-0">
        <MousePointer2 className="mx-auto size-5 text-zinc-400" />
        <p className="mt-2 text-sm font-medium text-zinc-700">Select a node</p>
        <p className="mt-1 text-sm leading-6 text-zinc-500">
          Click a host or service to inspect its scan details.
        </p>
      </aside>
    );
  }

  if (selection.kind === "host") {
    const { host, riskLevel } = selection;

    return (
      <aside className="border-t bg-zinc-50 p-4 xl:border-l xl:border-t-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Host
            </p>
            <h3 className="mt-1 truncate text-base font-semibold text-zinc-950">
              {host.hostname ?? host.ipAddress}
            </h3>
            <p className="text-sm text-zinc-500">{host.ipAddress}</p>
          </div>
          <SeverityBadge severity={riskLevel} />
        </div>

        <Separator className="my-4" />

        <div className="space-y-3 text-sm">
          <DetailRow label="Operating system" value={host.operatingSystem} />
          <DetailRow label="Role" value={formatRole(host.role)} />
          <DetailRow
            label="Exposure"
            value={
              host.internetExposed ? (
                <span className="inline-flex items-center gap-1 text-red-700">
                  <Globe2 className="size-4" />
                  internet
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-zinc-700">
                  <ShieldCheck className="size-4" />
                  internal
                </span>
              )
            }
          />
          <DetailRow label="Services" value={String(host.services.length)} />
        </div>

        <Separator className="my-4" />

        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Severity mix
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {severityOrder.map((severity) => {
              const count = host.services.filter(
                (service) => service.riskLevel === severity,
              ).length;

              return (
                <div
                  key={severity}
                  className="rounded-md border bg-white p-2 text-sm"
                >
                  <SeverityBadge severity={severity} />
                  <p className="mt-2 text-lg font-semibold text-zinc-950">
                    {count}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    );
  }

  const { host, service } = selection;
  const product = [service.product, service.version].filter(Boolean).join(" ");

  return (
    <aside className="border-t bg-zinc-50 p-4 xl:border-l xl:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Service
          </p>
          <h3 className="mt-1 text-base font-semibold text-zinc-950">
            {service.port}/{service.protocol}
          </h3>
          <p className="truncate text-sm text-zinc-500">
            {host.hostname ?? host.ipAddress}
          </p>
        </div>
        <SeverityBadge severity={service.riskLevel} />
      </div>

      <Separator className="my-4" />

      <div className="space-y-3 text-sm">
        <DetailRow label="Service name" value={service.serviceName} />
        <DetailRow
          label="Product"
          value={product || "No product fingerprint"}
        />
        <DetailRow label="Port" value={String(service.port)} />
        <DetailRow label="Protocol" value={service.protocol} />
        {service.extrainfo ? (
          <DetailRow label="Extra info" value={service.extrainfo} />
        ) : null}
      </div>

      <Separator className="my-4" />

      <div className="rounded-md border bg-white p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-950">
          <Activity className="size-4 text-zinc-500" />
          Exposure path
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {host.ipAddress} exposes {service.serviceName} on port {service.port}.
          Prioritize this service when its severity is high and the host is
          internet-facing.
        </p>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-zinc-500">
        {label}
      </span>
      <span className="min-w-0 break-words text-zinc-800">{value}</span>
    </div>
  );
}

function getHostRisk(host: Host): Severity {
  return (
    severityOrder.find((severity) =>
      host.services.some((service) => service.riskLevel === severity),
    ) ?? "info"
  );
}
