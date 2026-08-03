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
