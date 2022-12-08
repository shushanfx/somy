import { networkInterfaces } from 'os';
import defaultGateway from 'default-gateway';
import ip from 'ipaddr.js';

function findIp(gateway: string): string| undefined {
  const gatewayIp = ip.parse(gateway);

  // Look for the matching interface in all local interfaces.
  for (const addresses of Object.values(networkInterfaces())) {
    if (addresses?.length) {
      for (const { cidr } of addresses) {
        if (!cidr) {
          continue;
        }
        const net = ip.parseCIDR(cidr);
        if (net[0] && net[0].kind() === gatewayIp.kind() && gatewayIp.match(net)) {
          return net[0].toString();
        }
      }
    }
  }
  return ;
}

async function async(family): Promise<string | undefined> {
  try {
    const { gateway } = await defaultGateway[family]();
    return findIp(gateway);
  // eslint-disable-next-line no-empty
  } catch {}
  return;
}

function sync(family): string | undefined {
  try {
    const { gateway } = defaultGateway[family].sync();
    return findIp(gateway);
  // eslint-disable-next-line no-empty
  } catch {}
  return;
}

export async function internalIpV6() {
  return async('v6');
}

export async function internalIpV4() {
  return async('v4');
}

export function internalIpV6Sync() {
  return sync('v6');
}

export function internalIpV4Sync() {
  return sync('v4');
}
