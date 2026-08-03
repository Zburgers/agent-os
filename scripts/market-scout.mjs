#!/usr/bin/env node
import { runRevenueMarketScout } from '../src/revenue-market-scout.ts';

console.log(JSON.stringify(await runRevenueMarketScout(), null, 2));
