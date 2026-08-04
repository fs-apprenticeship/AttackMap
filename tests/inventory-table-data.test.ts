import { describe, expect, it } from "vitest";

import {
  defaultHostSort,
  defaultServiceSort,
  sortHosts,
  sortServices,
  toggleSort,
} from "@/features/scans/detail/inventory-table-data";
import { serializeHostInventoryCsv } from "@/lib/scans/export";
import type {
  HostWithScan,
  ServiceWithHost,
} from "@/lib/scans/metrics";

function host(overrides: Partial<HostWithScan> = {}): HostWithScan {
  return {
    id: "host-1",
    ipAddress: "10.0.0.10",
    hostname: "alpha",
    operatingSystem: "Linux",
    role: "web_server",
    internetExposed: false,
    services: [],
    scanFilename: "scan.xml",
    ...overrides,
  };
}

function service(overrides: Partial<ServiceWithHost> = {}): ServiceWithHost {
  return {
    id: "service-1",
    port: 443,
    protocol: "tcp",
    serviceName: "https",
    cpe: [],
    riskLevel: "info",
    host: host(),
    ...overrides,
  };
}

describe("inventory table sorting", () => {
  it("starts hosts with the highest risk and deterministically breaks ties", () => {
    const hosts = [
      host({ id: "host-z", hostname: "zulu" }),
      host({
        id: "host-b",
        hostname: "bravo",
        services: [service({ riskLevel: "high" })],
      }),
      host({
        id: "host-a",
        hostname: "alpha",
        services: [service({ riskLevel: "high" })],
      }),
      host({
        id: "host-c",
        hostname: "charlie",
        services: [service({ riskLevel: "critical" })],
      }),
    ];

    expect(sortHosts(hosts, defaultHostSort).map((item) => item.id)).toEqual([
      "host-c",
      "host-a",
      "host-b",
      "host-z",
    ]);
  });

  it("sorts host numeric and boolean columns in either direction", () => {
    const hosts = [
      host({ id: "host-2", services: [service(), service()] }),
      host({ id: "host-1", internetExposed: true }),
    ];

    expect(
      sortHosts(hosts, { column: "services", direction: "asc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["host-1", "host-2"]);
    expect(
      sortHosts(hosts, { column: "exposure", direction: "desc" }).map(
        (item) => item.id,
      ),
    ).toEqual(["host-1", "host-2"]);
  });

  it("starts services with the highest risk and sorts ports numerically", () => {
    const services = [
      service({ id: "service-low", port: 100, riskLevel: "low" }),
      service({ id: "service-critical", port: 22, riskLevel: "critical" }),
      service({ id: "service-https", port: 443, riskLevel: "high" }),
    ];

    expect(sortServices(services, defaultServiceSort).map((item) => item.id)).toEqual([
      "service-critical",
      "service-https",
      "service-low",
    ]);
    expect(
      sortServices(services, { column: "port", direction: "asc" }).map(
        (item) => item.port,
      ),
    ).toEqual([22, 100, 443]);
  });

  it("toggles the active column and begins new columns ascending", () => {
    expect(toggleSort(defaultHostSort, "risk")).toEqual({
      column: "risk",
      direction: "asc",
    });
    expect(toggleSort(defaultHostSort, "host")).toEqual({
      column: "host",
      direction: "asc",
    });
  });

  it("serializes hosts in the order currently displayed", () => {
    const sorted = sortHosts(
      [host({ hostname: "zulu" }), host({ id: "host-2", hostname: "alpha" })],
      { column: "host", direction: "asc" },
    );

    expect(serializeHostInventoryCsv(sorted).split("\r\n")[1]).toMatch(
      /^alpha,10\.0\.0\.10/,
    );
  });
});
