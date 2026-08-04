import type {
  HostWithScan,
  ServiceWithHost,
} from "@/lib/scans/metrics";
import { getHostHighestRisk } from "@/lib/scans/metrics";
import { severityOrder } from "@/lib/scans/severity";

export type SortDirection = "asc" | "desc";

export type HostSortColumn =
  | "host"
  | "operatingSystem"
  | "role"
  | "exposure"
  | "services"
  | "risk"
  | "source";

export type ServiceSortColumn =
  | "host"
  | "port"
  | "protocol"
  | "service"
  | "product"
  | "extraInfo"
  | "risk";

export type SortState<Column extends string> = {
  column: Column;
  direction: SortDirection;
};

export const defaultHostSort: SortState<HostSortColumn> = {
  column: "risk",
  direction: "desc",
};

export const defaultServiceSort: SortState<ServiceSortColumn> = {
  column: "risk",
  direction: "desc",
};

const textCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function compareText(left: string | undefined, right: string | undefined) {
  return textCollator.compare(left ?? "", right ?? "");
}

function compareNumber(left: number, right: number) {
  return left - right;
}

function riskValue(risk: string) {
  return severityOrder.length - severityOrder.indexOf(risk as (typeof severityOrder)[number]);
}

function applyDirection(value: number, direction: SortDirection) {
  return direction === "asc" ? value : -value;
}

function hostLabel(host: HostWithScan) {
  return host.hostname ?? host.ipAddress;
}

function productLabel(service: ServiceWithHost) {
  return [service.product, service.version].filter(Boolean).join(" ");
}

export function toggleSort<Column extends string>(
  current: SortState<Column>,
  column: Column,
): SortState<Column> {
  if (current.column === column) {
    return {
      column,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }

  return { column, direction: "asc" };
}

export function sortHosts(
  hosts: HostWithScan[],
  sort: SortState<HostSortColumn>,
) {
  return [...hosts].sort((left, right) => {
    let comparison: number;

    switch (sort.column) {
      case "host":
        comparison = compareText(hostLabel(left), hostLabel(right));
        break;
      case "operatingSystem":
        comparison = compareText(left.operatingSystem, right.operatingSystem);
        break;
      case "role":
        comparison = compareText(left.role, right.role);
        break;
      case "exposure":
        comparison = Number(left.internetExposed) - Number(right.internetExposed);
        break;
      case "services":
        comparison = compareNumber(left.services.length, right.services.length);
        break;
      case "risk":
        comparison = compareNumber(
          riskValue(getHostHighestRisk(left)),
          riskValue(getHostHighestRisk(right)),
        );
        break;
      case "source":
        comparison = compareText(left.scanFilename, right.scanFilename);
        break;
    }

    if (comparison !== 0) return applyDirection(comparison, sort.direction);

    return (
      compareText(hostLabel(left), hostLabel(right)) ||
      compareText(left.ipAddress, right.ipAddress) ||
      compareText(left.id, right.id)
    );
  });
}

export function sortServices(
  services: ServiceWithHost[],
  sort: SortState<ServiceSortColumn>,
) {
  return [...services].sort((left, right) => {
    let comparison: number;

    switch (sort.column) {
      case "host":
        comparison = compareText(hostLabel(left.host), hostLabel(right.host));
        break;
      case "port":
        comparison = compareNumber(left.port, right.port);
        break;
      case "protocol":
        comparison = compareText(left.protocol, right.protocol);
        break;
      case "service":
        comparison = compareText(left.serviceName, right.serviceName);
        break;
      case "product":
        comparison = compareText(productLabel(left), productLabel(right));
        break;
      case "extraInfo":
        comparison = compareText(left.extrainfo, right.extrainfo);
        break;
      case "risk":
        comparison = compareNumber(riskValue(left.riskLevel), riskValue(right.riskLevel));
        break;
    }

    if (comparison !== 0) return applyDirection(comparison, sort.direction);

    return (
      compareText(hostLabel(left.host), hostLabel(right.host)) ||
      compareNumber(left.port, right.port) ||
      compareText(left.protocol, right.protocol) ||
      compareText(left.id, right.id)
    );
  });
}
