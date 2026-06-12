// Canonical "is this a web service" classification, shared by the nmap parser
// (which uses it to attach web-specific findings) and the dashboard "Web
// services" metric. Single-sourcing it keeps the count in sync with how the
// rest of the app classifies services — a service is web-facing if it's on a
// known web port or its detected service name mentions http.
export const WEB_PORTS = new Set([80, 443, 8080, 8443, 8500, 8888, 8000]);

export function isWebService(service: {
  port: number;
  serviceName?: string | null;
}): boolean {
  return (
    WEB_PORTS.has(service.port) ||
    (service.serviceName ?? "").toLowerCase().includes("http")
  );
}
