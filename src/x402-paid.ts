export type ReliabilityPaymentConfig = {
  accepts: [{
    scheme: 'exact';
    price: '$0.25';
    network: 'eip155:8453';
    payTo: string;
  }];
  description: string;
  mimeType: 'application/json';
};

export function createReliabilityPaymentConfig(payTo: string): ReliabilityPaymentConfig {
  if (!/^0x[0-9a-fA-F]{40}$/.test(payTo)) throw new Error('invalid_pay_to');
  return {
    accepts: [{ scheme: 'exact', price: '$0.25', network: 'eip155:8453', payTo }],
    description: 'Bounded automation endpoint reliability report',
    mimeType: 'application/json',
  };
}

export function createReliabilityDiscoveryManifest(baseUrl: string) {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') throw new Error('invalid_discovery_base_url');
  const origin = parsed.origin;
  return {
    version: '2',
    name: 'Goofy Automation Reliability Check',
    description: 'Bounded public HTTPS endpoint reliability report for agents',
    services: [{
      url: `${origin}/v1/check`,
      method: 'POST',
      input_schema: { type: 'object', required: ['target'], properties: { target: { type: 'string', format: 'uri' } } },
      price: '$0.25',
      network: 'eip155:8453',
      asset: 'USDC',
    }],
  };
}
