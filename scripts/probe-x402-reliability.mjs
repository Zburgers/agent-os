#!/usr/bin/env node
import { probeReliabilityTarget } from '../src/x402-reliability.ts';

const target = process.argv[2];
if (!target) {
  console.error('usage: probe-x402-reliability.mjs https://public.example/path');
  process.exitCode = 2;
} else {
  try {
    console.log(JSON.stringify(await probeReliabilityTarget(target), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'probe_failed');
    process.exitCode = 1;
  }
}
