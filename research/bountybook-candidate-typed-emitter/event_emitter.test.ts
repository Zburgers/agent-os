import assert from 'node:assert/strict';
import test from 'node:test';
import { TypedEmitter } from './event_emitter.ts';

type MyEvents = { click: { x: number; y: number }; close: void };

test('TypedEmitter supports on, off, once, emit, and listenerCount', () => {
  const emitter = new TypedEmitter<MyEvents>();
  const calls: number[] = [];
  const handler = (data: { x: number; y: number }) => calls.push(data.x);

  emitter.on('click', handler);
  assert.equal(emitter.emit('click', { x: 10, y: 20 }), true);
  assert.deepEqual(calls, [10]);
  assert.equal(emitter.emit('close', undefined), false);

  emitter.off('click', handler);
  assert.equal(emitter.listenerCount('click'), 0);
  emitter.emit('click', { x: 99, y: 0 });
  assert.deepEqual(calls, [10]);

  const onceCalls: number[] = [];
  emitter.once('click', (data) => onceCalls.push(data.x));
  assert.equal(emitter.listenerCount('click'), 1);
  emitter.emit('click', { x: 1, y: 0 });
  emitter.emit('click', { x: 2, y: 0 });
  assert.deepEqual(onceCalls, [1]);
  assert.equal(emitter.listenerCount('click'), 0);
});
