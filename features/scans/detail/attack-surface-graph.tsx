"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTheme } from "next-themes";
import {
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Globe2, MousePointer2, ShieldCheck } from "lucide-react";

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
import { formatRole, severityOrder } from "@/features/scans/shared/utils";

type AttackSurfaceGraphProps = {
  hosts: Host[];
};

type HostNodeData = {
  host: Host;
} & Record<string, unknown>;

type ServiceNodeData = {
  service: Service;
  host: Host;
  size: number;
} & Record<string, unknown>;

type HostGraphNode = Node<HostNodeData, "host">;
type ServiceGraphNode = Node<ServiceNodeData, "service">;
type AttackGraphNode = HostGraphNode | ServiceGraphNode;

type RadialEdgeData = {
  sourceR: number;
  targetR: number;
  severity: Severity;
} & Record<string, unknown>;

type ForceNode = SimulationNodeDatum & {
  id: string;
  size: number;
  isHost: boolean;
  riskLevel?: Severity;
};

type ForceLink = SimulationLinkDatum<ForceNode>;

type SelectedNode =
  | { kind: "host"; host: Host; riskLevel: Severity }
  | { kind: "service"; host: Host; service: Service };

// Risk read by hue — these vivid tones sit legibly on both the light and dark
// canvas, so they stay fixed while everything else follows the theme tokens.
const severityColor: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#94a3b8",
};

// Node diameter carries severity as a second, pre-attentive channel: the more
// dangerous a service, the bigger its orb.
const RISK_DIAMETER: Record<Severity, number> = {
  critical: 82,
  high: 72,
  medium: 62,
  low: 54,
  info: 46,
};

// Collision/charge footprint the sim treats the host chip as (a circle roughly
// enclosing the auto-sized chip), keeping services clear of it.
const HOST_SIM_SIZE = 190;

// d3-force link length by severity: the more dangerous a service, the closer it
// pulls to the host, so the eye lands on the inner, high-risk orbs first.
const LINK_DISTANCE: Record<Severity, number> = {
  critical: 165,
  high: 195,
  medium: 235,
  low: 275,
  info: 300,
};

const nodeTypes = {
  host: HostNode,
  service: ServiceNode,
} satisfies NodeTypes;

const edgeTypes = {
  arc: ArcEdge,
};

export function AttackSurfaceGraph({ hosts }: AttackSurfaceGraphProps) {
  const { resolvedTheme } = useTheme();
  // resolvedTheme is only known on the client, so defer reading it until after
  // mount — otherwise React Flow's color-mode class mismatches the SSR markup.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const [selectedHostId, setSelectedHostId] = useState(hosts[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    hosts[0]?.id ? `host-${hosts[0].id}` : null,
  );
  const [activeSeverity, setActiveSeverity] = useState<Severity | null>(null);

  const activeHost = useMemo(
    () => hosts.find((host) => host.id === selectedHostId) ?? hosts[0],
    [selectedHostId, hosts],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<AttackGraphNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const simulationRef = useRef<Simulation<ForceNode, ForceLink> | null>(null);
  const simNodesRef = useRef<Map<string, ForceNode>>(new Map());

  // Run a live d3-force simulation and stream its positions into React Flow. The
  // host is pinned at the origin; services repel each other and settle at a
  // link distance set by their severity. Seeded from the ring layout so it
  // starts spread out and cools quickly.
  useEffect(() => {
    if (!activeHost) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { rfNodes, rfEdges, simNodes, simLinks } = buildGraph(activeHost);
    setNodes(rfNodes);
    setEdges(rfEdges);

    const byId = new Map(simNodes.map((node) => [node.id, node]));
    simNodesRef.current = byId;

    const simulation = forceSimulation<ForceNode>(simNodes)
      .force(
        "link",
        forceLink<ForceNode, ForceLink>(simLinks)
          .id((node) => node.id)
          .distance(
            (link) =>
              LINK_DISTANCE[(link.target as ForceNode).riskLevel ?? "info"],
          )
          .strength(0.35),
      )
      .force(
        "charge",
        forceManyBody<ForceNode>().strength((node) =>
          node.isHost ? -1400 : -260,
        ),
      )
      .force(
        "collide",
        forceCollide<ForceNode>().radius((node) => node.size / 2 + 18),
      )
      .force("x", forceX<ForceNode>(0).strength(0.06))
      .force("y", forceY<ForceNode>(0).strength(0.06));

    simulation.on("tick", () => {
      setNodes((current) =>
        current.map((node) => {
          const sim = byId.get(node.id);
          if (!sim || sim.x == null || sim.y == null) return node;
          return { ...node, position: { x: sim.x, y: sim.y } };
        }),
      );
    });

    simulationRef.current = simulation;
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [activeHost, setNodes, setEdges]);

  // While dragging, pin the node under the cursor so the sim leaves it be and
  // lets its neighbours flow around it; release non-host nodes on drop.
  const pinToPointer = useCallback((node: AttackGraphNode) => {
    const sim = simNodesRef.current.get(node.id);
    if (!sim) return;
    sim.fx = node.position.x;
    sim.fy = node.position.y;
  }, []);

  const onNodeDragStart = useCallback(
    (_: unknown, node: AttackGraphNode) => {
      simulationRef.current?.alphaTarget(0.3).restart();
      pinToPointer(node);
    },
    [pinToPointer],
  );

  const onNodeDrag = useCallback(
    (_: unknown, node: AttackGraphNode) => pinToPointer(node),
    [pinToPointer],
  );

  const onNodeDragStop = useCallback((_: unknown, node: AttackGraphNode) => {
    simulationRef.current?.alphaTarget(0);
    const sim = simNodesRef.current.get(node.id);
    if (sim && !sim.isHost) {
      sim.fx = null;
      sim.fy = null;
    }
  }, []);

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
      ? ({ kind: "service", host: activeHost, service } satisfies SelectedNode)
      : null;
  }, [activeHost, selectedNodeId]);

  // Counts feed the risk-distribution panel; clicking a severity there sets
  // activeSeverity, which dims every node and edge that doesn't match.
  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    activeHost?.services.forEach((service) => {
      counts[service.riskLevel] += 1;
    });
    return counts;
  }, [activeHost]);

  const displayNodes = useMemo(() => {
    if (!activeSeverity) return nodes;
    return nodes.map((node) =>
      node.type === "service"
        ? {
            ...node,
            style: {
              ...node.style,
              opacity:
                node.data.service.riskLevel === activeSeverity ? 1 : 0.12,
              transition: "opacity 150ms ease",
            },
          }
        : node,
    );
  }, [nodes, activeSeverity]);

  const displayEdges = useMemo(() => {
    if (!activeSeverity) return edges;
    return edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity: edge.data?.severity === activeSeverity ? 1 : 0.06,
        transition: "opacity 150ms ease",
      },
    }));
  }, [edges, activeSeverity]);

  if (!activeHost) {
    return (
      <div className="flex min-h-[430px] items-center justify-center rounded-md border bg-card text-sm text-muted-foreground shadow-sm">
        No live hosts found in this scan.
      </div>
    );
  }

  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Attack surface graph</CardTitle>
          <CardDescription className="mt-1">
            Exposed services around the host, sized and colored by risk
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
            {severityOrder.map((severity) => (
              <span key={severity} className="inline-flex items-center gap-1">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: severityColor[severity] }}
                />
                {severity}
              </span>
            ))}
          </div>
          {hosts.length > 1 ? (
            <Select
              value={activeHost.id}
              onValueChange={(value) => {
                setSelectedHostId(value);
                setSelectedNodeId(`host-${value}`);
                setActiveSeverity(null);
              }}
            >
              <SelectTrigger
                aria-label="Select host"
                className="h-9 min-h-9 w-full rounded-md bg-background text-sm font-medium data-[size=default]:h-9 sm:w-[260px]"
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
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="grid gap-0 p-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div
          className="relative h-[520px] min-w-0 bg-background sm:h-[620px] lg:h-[calc(100dvh-17rem)] lg:min-h-[620px] lg:max-h-[880px]"
          style={{
            backgroundImage:
              "radial-gradient(var(--border) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        >
          {activeHost.services.length === 0 ? (
            <div className="absolute left-4 top-4 z-10 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
              This host has no exposed services in the scan.
            </div>
          ) : null}
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodeOrigin={[0.5, 0.5]}
            colorMode={mounted && resolvedTheme === "dark" ? "dark" : "light"}
            nodesDraggable
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(`host-${activeHost.id}`)}
          >
            <Controls
              position="bottom-left"
              className="overflow-hidden rounded-md border bg-card shadow-sm"
            />
          </ReactFlow>
        </div>
        <div className="flex min-h-0 flex-col border-t bg-muted/40 xl:border-l xl:border-t-0">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GraphDetailPanel selection={selectedNode} />
          </div>
          <RiskFilterPanel
            counts={severityCounts}
            active={activeSeverity}
            onToggle={(severity) =>
              setActiveSeverity((prev) => (prev === severity ? null : severity))
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Place services in concentric rings around the host. A single ring blows out
 * for large scans (30+ services get tiny and clip at the edges), so each ring
 * only holds as many orbs as fit at a minimum arc spacing; the rest spill to
 * the next ring out. Most-severe services take the inner rings where they read
 * largest and clearest.
 */
function layoutServices(services: Service[]): {
  service: Service;
  cx: number;
  cy: number;
}[] {
  const count = services.length;
  if (count === 0) return [];

  const ordered = [...services].sort(
    (a, b) =>
      severityOrder.indexOf(a.riskLevel) - severityOrder.indexOf(b.riskLevel),
  );

  const BASE_RADIUS = 210;
  const RING_GAP = 155;
  const MIN_ARC = 128;

  // Greedily size each ring by how many orbs fit around its circumference.
  const ringSizes: number[] = [];
  let remaining = count;
  let ring = 0;
  while (remaining > 0) {
    const r = BASE_RADIUS + ring * RING_GAP;
    const capacity = Math.max(1, Math.floor((2 * Math.PI * r) / MIN_ARC));
    const take = Math.min(capacity, remaining);
    ringSizes.push(take);
    remaining -= take;
    ring += 1;
  }

  const placed: { service: Service; cx: number; cy: number }[] = [];
  let index = 0;
  ringSizes.forEach((take, ringIndex) => {
    const r = BASE_RADIUS + ringIndex * RING_GAP;
    // Rotate alternate rings half a step so spokes don't line up and overlap.
    const rotation = ringIndex % 2 === 0 ? 0 : Math.PI / take;
    for (let i = 0; i < take; i += 1) {
      const angle = (i / take) * 2 * Math.PI - Math.PI / 2 + rotation;
      placed.push({
        service: ordered[index],
        cx: r * Math.cos(angle),
        cy: r * Math.sin(angle),
      });
      index += 1;
    }
  });

  return placed;
}

function buildGraph(host: Host) {
  const hostId = `host-${host.id}`;

  // With nodeOrigin [0.5, 0.5], a node's position is its center — so we place
  // each node directly at its computed point, no half-size offset needed.
  const rfNodes: AttackGraphNode[] = [
    {
      id: hostId,
      type: "host",
      position: { x: 0, y: 0 },
      data: { host },
    },
  ];

  // The simulation runs on its own node objects (mutated in place each tick)
  // and maps back to React Flow nodes by id. Host is pinned at the origin.
  const simNodes: ForceNode[] = [
    { id: hostId, size: HOST_SIM_SIZE, isHost: true, x: 0, y: 0, fx: 0, fy: 0 },
  ];

  const rfEdges: Edge[] = [];
  const simLinks: ForceLink[] = [];

  // Seed service positions from the ring layout so the sim starts spread out
  // rather than stacked at the origin, and settles in a few frames.
  layoutServices(host.services).forEach(({ service, cx, cy }) => {
    const size = RISK_DIAMETER[service.riskLevel];
    const nodeId = `service-${service.id}`;
    const color = severityColor[service.riskLevel];

    rfNodes.push({
      id: nodeId,
      type: "service",
      position: { x: cx, y: cy },
      data: { host, service, size },
    });

    simNodes.push({
      id: nodeId,
      size,
      isHost: false,
      riskLevel: service.riskLevel,
      x: cx,
      y: cy,
    });

    rfEdges.push({
      id: `edge-${host.id}-${service.id}`,
      source: hostId,
      target: nodeId,
      type: "arc",
      data: {
        sourceR: 0,
        targetR: size / 2,
        severity: service.riskLevel,
      } satisfies RadialEdgeData,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 13, height: 13 },
      style: { stroke: color, strokeOpacity: 0.4, strokeWidth: 1.5 },
    });

    simLinks.push({ source: hostId, target: nodeId });
  });

  return { rfNodes, rfEdges, simNodes, simLinks };
}

/**
 * A curved arc edge from host to service. Handles are pinned to node centers,
 * so this shortens both endpoints by the node radii (the line leaves the host's
 * edge and its arrowhead lands just off the service's circle), then bends the
 * span into a gentle SVG arc. A large arc radius keeps the curve subtle and a
 * fixed sweep flag bends every edge the same rotational way, giving the whole
 * graph the mockup's cohesive swirl.
 */
function ArcEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const { sourceR = 0, targetR = 0 } = (data ?? {}) as Partial<RadialEdgeData>;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;

  const sx = sourceX + ux * sourceR;
  const sy = sourceY + uy * sourceR;
  const ex = targetX - ux * (targetR + 7);
  const ey = targetY - uy * (targetR + 7);

  const dr = dist * 2.6;
  const path = `M${sx},${sy}A${dr},${dr} 0 0,1 ${ex},${ey}`;

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}

/** A handle pinned to the node's center so radial spokes emanate from the middle. */
function CenterHandle({ type }: { type: "source" | "target" }) {
  return (
    <Handle
      type={type}
      position={Position.Top}
      isConnectable={false}
      className="!size-1 !border-0 !bg-transparent"
      style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
    />
  );
}

function HostNode({ data, selected }: NodeProps<HostGraphNode>) {
  const { host } = data;
  const serviceCount = host.services.length;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-center gap-1 whitespace-nowrap rounded-xl border bg-card px-3.5 py-2 shadow-lg transition",
        selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <CenterHandle type="source" />
      <div className="flex items-center gap-2">
        <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
          Host
        </span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {host.hostname ?? host.ipAddress}
        </span>
      </div>
      <p className="text-[0.6875rem] text-muted-foreground">
        {formatRole(host.role)} · {serviceCount}{" "}
        {serviceCount === 1 ? "service" : "services"}
      </p>
    </div>
  );
}

function ServiceNode({ data, selected }: NodeProps<ServiceGraphNode>) {
  const { service, size } = data;
  const color = severityColor[service.riskLevel];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <CenterHandle type="target" />
      {/* Soft halo ring — the mockup's faint glow around each core. */}
      <div
        className="absolute -inset-1.5 rounded-full"
        style={{ backgroundColor: color, opacity: 0.18 }}
      />
      {/* Solid risk-colored core. */}
      <div
        className={cn(
          "relative h-full w-full rounded-full transition",
          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        )}
        style={{
          backgroundColor: color,
          boxShadow: selected
            ? `0 0 26px -2px ${color}`
            : `0 0 16px -5px ${color}`,
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-center">
        <p className="font-mono text-[0.6875rem] font-semibold text-foreground">
          {service.port}/{service.protocol}
        </p>
        <p className="text-[0.625rem] text-muted-foreground">
          {service.serviceName}
        </p>
      </div>
    </div>
  );
}

function GraphDetailPanel({ selection }: { selection: SelectedNode | null }) {
  if (!selection) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center p-6 text-center">
        <MousePointer2 className="size-5 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Select a node
        </p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Click the host or a service to inspect its scan details.
        </p>
      </div>
    );
  }

  if (selection.kind === "host") {
    const { host, riskLevel } = selection;

    return (
      <div className="p-4">
        <DetailHeader
          eyebrow="Host"
          title={host.hostname ?? host.ipAddress}
          subtitle={host.ipAddress}
          subtitleMono
          severity={riskLevel}
        />

        <Separator className="my-4" />

        <div className="space-y-3 text-sm">
          <DetailRow label="Operating system" value={host.operatingSystem} />
          <DetailRow label="Role" value={formatRole(host.role)} />
          <DetailRow
            label="Exposure"
            value={
              host.internetExposed ? (
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                  <Globe2 className="size-4" />
                  internet
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <ShieldCheck className="size-4" />
                  internal
                </span>
              )
            }
          />
          <DetailRow
            label="Services"
            value={
              <span className="font-mono">{host.services.length}</span>
            }
          />
        </div>
      </div>
    );
  }

  const { host, service } = selection;
  const product = [service.product, service.version].filter(Boolean).join(" ");

  return (
    <div className="p-4">
      <DetailHeader
        eyebrow="Service"
        title={`${service.port}/${service.protocol}`}
        titleMono
        subtitle={host.hostname ?? host.ipAddress}
        severity={service.riskLevel}
      />

      <Separator className="my-4" />

      <div className="space-y-3 text-sm">
        <DetailRow label="Service name" value={service.serviceName} />
        <DetailRow label="Product" value={product || "No product fingerprint"} />
        <DetailRow
          label="Port"
          value={<span className="font-mono">{service.port}</span>}
        />
        <DetailRow label="Protocol" value={service.protocol} />
        {service.extrainfo ? (
          <DetailRow label="Extra info" value={service.extrainfo} />
        ) : null}
      </div>
    </div>
  );
}

function DetailHeader({
  eyebrow,
  title,
  subtitle,
  severity,
  titleMono = false,
  subtitleMono = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  severity: Severity;
  titleMono?: boolean;
  subtitleMono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: severityColor[severity] }}
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
        </div>
        <h3
          className={cn(
            "mt-1.5 truncate text-base font-semibold text-foreground",
            titleMono && "font-mono",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "truncate text-sm text-muted-foreground",
            subtitleMono && "font-mono",
          )}
        >
          {subtitle}
        </p>
      </div>
      <SeverityBadge severity={severity} />
    </div>
  );
}

/**
 * Docked severity breakdown that doubles as a filter: clicking a row dims every
 * node and edge that isn't that severity (handled by the parent), so a dense
 * graph can be read one risk band at a time.
 */
function RiskFilterPanel({
  counts,
  active,
  onToggle,
}: {
  counts: Record<Severity, number>;
  active: Severity | null;
  onToggle: (severity: Severity) => void;
}) {
  const max = Math.max(1, ...severityOrder.map((severity) => counts[severity]));

  return (
    <div className="shrink-0 border-t p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Risk distribution
        </p>
        {active ? (
          <button
            type="button"
            onClick={() => onToggle(active)}
            className="text-[0.6875rem] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Clear filter
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-1">
        {severityOrder.map((severity) => {
          const count = counts[severity];
          const isActive = active === severity;
          const dimmed = active !== null && !isActive;

          return (
            <button
              key={severity}
              type="button"
              onClick={() => onToggle(severity)}
              aria-pressed={isActive}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-background",
                isActive && "bg-background",
                dimmed && "opacity-40",
              )}
            >
              <span className="w-14 shrink-0 text-xs font-medium capitalize text-foreground">
                {severity}
              </span>
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${(count / max) * 100}%`,
                    backgroundColor: severityColor[severity],
                  }}
                />
              </span>
              <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
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
