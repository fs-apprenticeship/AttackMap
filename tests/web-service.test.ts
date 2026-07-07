import { describe, expect, it } from "vitest";

import { isWebService } from "@/lib/nmap/web-service";

describe("isWebService", () => {
  it("classifies services named http (incl. https/http-proxy) as web", () => {
    expect(isWebService({ port: 80, serviceName: "http" })).toBe(true);
    expect(isWebService({ port: 443, serviceName: "https" })).toBe(true);
    expect(isWebService({ port: 3128, serviceName: "http-proxy" })).toBe(true);
  });

  it("classifies a known web port as web even when the name isn't http", () => {
    // 8500 fingerprinted as "fmtp" (e.g. Consul's HTTP API mislabeled): it's a
    // web port, so it must still count — this is the case the old name-only
    // metric silently dropped.
    expect(isWebService({ port: 8500, serviceName: "fmtp" })).toBe(true);
    expect(isWebService({ port: 8080, serviceName: "unknown" })).toBe(true);
  });

  it("does not classify non-web services as web", () => {
    expect(isWebService({ port: 21, serviceName: "ftp" })).toBe(false);
    expect(isWebService({ port: 22, serviceName: "ssh" })).toBe(false);
  });

  it("handles a missing or empty service name without throwing", () => {
    expect(isWebService({ port: 8888 })).toBe(true); // web port
    expect(isWebService({ port: 9999, serviceName: null })).toBe(false);
    expect(isWebService({ port: 9999, serviceName: "" })).toBe(false);
  });

  it("matches the four-web-service example scan (80, 8080, 8500, 8888)", () => {
    const services = [
      { port: 21, serviceName: "ftp" },
      { port: 22, serviceName: "ssh" },
      { port: 80, serviceName: "http" },
      { port: 8080, serviceName: "http" },
      { port: 8500, serviceName: "fmtp" },
      { port: 8888, serviceName: "http" },
    ];
    expect(services.filter(isWebService)).toHaveLength(4);
  });
});
