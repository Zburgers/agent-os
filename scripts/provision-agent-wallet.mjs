#!/usr/bin/env node
import { FileAgentWalletKeyStore } from '../src/agent-wallet.ts';

const store = new FileAgentWalletKeyStore();
const wallet = await store.provision();
console.log(`Dedicated Goofy wallet provisioned: ${wallet.address}`);
console.log(`Protected key location: ${store.path}`);
