import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMemory } from '../src/memory.ts';

test('memory rejects secret canaries before a provider or database call', () => {
  assert.throws(() => validateMemory({
    ownerId: 'owner',
    scopeKey: 'venture:a',
    category: 'lesson',
    epistemicType: 'lesson',
    content: 'password=do-not-store-this',
  }), /secret_rejected/);
});

test('memory requires explicit owner and scope metadata', () => {
  assert.throws(() => validateMemory({
    ownerId: '',
    scopeKey: '',
    category: 'fact',
    epistemicType: 'fact',
    content: 'safe',
  }), /invalid_memory_metadata/);
});
