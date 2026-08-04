import { describe, expect, it } from 'vitest';
import { parseNmapScan } from '../parse-nmap';

// Sparse/partial-but-valid Nmap XML shapes — the kind real scans produce
// (a host with no OS match, a port with no service block, etc.) rather than
// the full, well-formed fixtures covered by parse-nmap.test.ts.

function buildNmapXml(hostsXml: string, nmaprunAttrs = 'scanner="nmap" start="1700000000"'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nmaprun ${nmaprunAttrs}>
<scaninfo type="connect" protocol="tcp" numservices="1" services="22"/>
${hostsXml}
<runstats><finished time="2" timestr="today" summary="done" elapsed="1" exit="success"/><hosts up="1" down="0" total="1"/></runstats>
</nmaprun>`;
}

function openPort(portid: number, serviceXml = '<service name="unknown"/>', scriptXml = ''): string {
  return `<port protocol="tcp" portid="${portid}"><state state="open" reason="syn-ack" reason_ttl="0"/>${serviceXml}${scriptXml}</port>`;
}

function closedPort(portid: number): string {
  return `<port protocol="tcp" portid="${portid}"><state state="closed" reason="reset" reason_ttl="0"/><service name="unknown"/></port>`;
}

function host(opts: {
  ip?: string;
  addresses?: string;
  hostnamesXml?: string;
  osXml?: string;
  portsXml?: string;
}): string {
  const addresses = opts.addresses ?? `<address addr="${opts.ip ?? '10.0.0.1'}" addrtype="ipv4"/>`;
  const ports = opts.portsXml !== undefined ? `<ports>${opts.portsXml}</ports>` : '';
  return `<host starttime="1" endtime="2"><status state="up" reason="user-set" reason_ttl="0"/>${addresses}${opts.hostnamesXml ?? ''}${ports}${opts.osXml ?? ''}</host>`;
}

describe('hosts with no open ports', () => {
  it('handles a host whose ports are all closed', () => {
    const xml = buildNmapXml(host({ portsXml: closedPort(80) }));
    const scan = parseNmapScan(xml, 'closed.xml');

    expect(scan.hosts[0].services).toEqual([]);
    expect(scan.hosts[0].role).toBe('unknown');
  });

  it('handles a host with no <ports> element at all', () => {
    const xml = buildNmapXml(host({}));
    const scan = parseNmapScan(xml, 'no-ports.xml');

    expect(scan.hosts[0].services).toEqual([]);
  });

  it('still generates the limited-attack-surface finding without crashing', () => {
    const xml = buildNmapXml(host({}));
    const scan = parseNmapScan(xml, 'no-ports.xml');

    expect(scan.findings).toHaveLength(1);
    expect(scan.findings[0].title).toBe('Limited attack surface observed');
  });
});

describe('missing hostname/OS/service data', () => {
  it('leaves hostname undefined when <hostnames> is absent', () => {
    const xml = buildNmapXml(host({ portsXml: openPort(22, '<service name="ssh"/>') }));
    const scan = parseNmapScan(xml, 'no-hostname.xml');

    expect(scan.hosts[0].hostname).toBeUndefined();
    expect(scan.target).toBe(scan.hosts[0].ipAddress);
  });

  it('falls back to "Unknown" OS when there is no <os> block or ostype hint', () => {
    const xml = buildNmapXml(host({ portsXml: openPort(22, '<service name="ssh"/>') }));
    const scan = parseNmapScan(xml, 'no-os.xml');

    expect(scan.hosts[0].operatingSystem).toBe('Unknown');
  });

  it('defaults serviceName to "unknown" when the port has no <service> element', () => {
    const portXml = `<port protocol="tcp" portid="9999"><state state="open" reason="syn-ack" reason_ttl="0"/></port>`;
    const xml = buildNmapXml(host({ portsXml: portXml }));
    const scan = parseNmapScan(xml, 'no-service.xml');

    expect(scan.hosts[0].services[0].serviceName).toBe('unknown');
    expect(scan.hosts[0].services[0].cpe).toEqual([]);
  });

  it('produces the generic FTP finding, not the anonymous-login one, when the port has no <script>', () => {
    const xml = buildNmapXml(host({ portsXml: openPort(21, '<service name="ftp"/>') }));
    const scan = parseNmapScan(xml, 'ftp-no-script.xml');

    expect(scan.findings).toHaveLength(1);
    expect(scan.findings[0].title).toBe('FTP is exposed');
  });

  it('defaults cpe to an empty array when the service has no <cpe> element', () => {
    const xml = buildNmapXml(host({ portsXml: openPort(80, '<service name="http"/>') }));
    const scan = parseNmapScan(xml, 'no-cpe.xml');

    expect(scan.hosts[0].services[0].cpe).toEqual([]);
  });
});

describe('nmaprun attributes', () => {
  it('leaves scannedAt undefined when <nmaprun> has no start attribute', () => {
    const xml = buildNmapXml(host({ portsXml: openPort(22, '<service name="ssh"/>') }), 'scanner="nmap"');
    const scan = parseNmapScan(xml, 'no-start.xml');

    expect(scan.scannedAt).toBeUndefined();
  });
});

describe('address selection', () => {
  it('picks the first ipv4 address when a host reports more than one', () => {
    const addresses =
      '<address addr="AA:BB:CC:DD:EE:FF" addrtype="mac"/>' +
      '<address addr="10.0.0.5" addrtype="ipv4"/>' +
      '<address addr="10.0.0.9" addrtype="ipv4"/>';
    const xml = buildNmapXml(host({ addresses, portsXml: openPort(22, '<service name="ssh"/>') }));
    const scan = parseNmapScan(xml, 'multi-address.xml');

    expect(scan.hosts[0].ipAddress).toBe('10.0.0.5');
  });
});

describe('empty findings', () => {
  it('falls back to the default remediation step when no findings are generated', () => {
    // Three services, none of which trip any specific finding rule (not web,
    // ftp, rdp, smb, telnet, ssh, or a domain-controller combo), and >2
    // services so "limited attack surface" doesn't fire either.
    const ports = [
      openPort(53, '<service name="domain"/>'),
      openPort(636, '<service name="ldapssl"/>'),
      openPort(3269, '<service name="globalcatalogssl"/>'),
    ].join('');
    const xml = buildNmapXml(host({ portsXml: ports }));
    const scan = parseNmapScan(xml, 'no-findings.xml');

    expect(scan.findings).toEqual([]);
    expect(scan.remediationPlan.steps).toHaveLength(1);
    expect(scan.remediationPlan.steps[0].title).toBe('Maintain least exposure');
  });
});
