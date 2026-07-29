import test from 'node:test';
import assert from 'node:assert/strict';
import { Mem0CloudMemory, validateMemory } from '../src/memory.ts';

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

test('Mem0 Cloud sends scoped contextual writes and returns its event id', async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ event_id: 'evt_123' }), { status: 200 });
  };
  try {
    const memory = new Mem0CloudMemory('test-key', 'https://mem0.example');
    const id = await memory.add({ ownerId: 'owner-1', scopeKey: 'venture:1', category: 'lesson', epistemicType: 'lesson', content: 'Use the verified invoice source.' });
    assert.equal(id, 'evt_123');
    assert.equal(request?.headers.get('authorization'), 'Token test-key');
    assert.deepEqual(JSON.parse(await request!.text()), {
      messages: [{ role: 'user', content: 'Use the verified invoice source.' }], user_id: 'owner-1', agent_id: 'venture:1',
      metadata: { category: 'lesson', epistemic_type: 'lesson', sensitivity: 'internal' },
    });
  } finally { globalThis.fetch = originalFetch; }
});

test('Mem0 Cloud searches only within the requested owner and scope', async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ results: [{ id: 'mem_1', memory: 'Scoped note', metadata: { category: 'fact' } }] }), { status: 200 });
  };
  try {
    const result = await new Mem0CloudMemory('test-key', 'https://mem0.example').search('owner-1', 'venture:1', 'note');
    assert.deepEqual(result, [{ id: 'mem_1', content: 'Scoped note', category: 'fact' }]);
    assert.deepEqual(JSON.parse(await request!.text()), { query: 'note', filters: { user_id: 'owner-1', agent_id: 'venture:1' }, top_k: 20 });
  } finally { globalThis.fetch = originalFetch; }
});

test('Mem0 Cloud health uses a read-only scoped search probe', async () => {
  const originalFetch = globalThis.fetch;
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };
  try {
    assert.equal(await new Mem0CloudMemory('test-key', 'https://mem0.example').health(), 'ok');
    assert.equal(request?.url, 'https://mem0.example/v3/memories/search/');
    assert.deepEqual(JSON.parse(await request!.text()), { query: 'health check', filters: { user_id: 'goofy-healthcheck', agent_id: 'health' }, top_k: 1 });
  } finally { globalThis.fetch = originalFetch; }
});
