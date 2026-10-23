import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import healthRoutes, {
  getProcessHealthSnapshot,
} from '../src/routes/health.ts';

test('getProcessHealthSnapshot exposes stable process metrics', () => {
  const snapshot = getProcessHealthSnapshot();

  assert.equal(snapshot.pid, process.pid);
  assert.equal(snapshot.nodeVersion, process.version);
  assert.ok(snapshot.uptimeSeconds >= 0);
  assert.ok(snapshot.memory.rss > 0);
  assert.ok(snapshot.memory.heapTotal >= snapshot.memory.heapUsed);
});

test('GET /api/health omits runtime metrics by default', async () => {
  const app = Fastify();
  await app.register(healthRoutes);

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.ok, true);
    assert.equal(typeof payload.time, 'string');
    assert.equal(typeof payload.uptimeSeconds, 'number');
    assert.equal('metrics' in payload, false);
    assert.equal('process' in payload, false);
  } finally {
    await app.close();
  }
});

test('GET /api/health?metrics=true includes runtime metrics and process details', async () => {
  const app = Fastify() as Fastify.FastifyInstance & {
    getRealtimeMetrics?: () => Record<string, number>;
  };
  app.getRealtimeMetrics = () => ({
    connectedSockets: 3,
    pendingTournamentMatches: 1,
  });
  await app.register(healthRoutes);

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health?metrics=true',
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.metrics, {
      connectedSockets: 3,
      pendingTournamentMatches: 1,
    });
    assert.equal(payload.process.pid, process.pid);
    assert.ok(payload.process.uptimeSeconds >= 0);
  } finally {
    await app.close();
  }
});

test('GET /api/health/runtime always exposes runtime metrics envelope', async () => {
  const app = Fastify() as Fastify.FastifyInstance & {
    getRealtimeMetrics?: () => Record<string, number>;
  };
  app.getRealtimeMetrics = () => ({
    authenticatedUsers: 2,
    activeLobbyBindings: 4,
  });
  await app.register(healthRoutes);

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health/runtime',
    });

    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.ok, true);
    assert.deepEqual(payload.metrics, {
      authenticatedUsers: 2,
      activeLobbyBindings: 4,
    });
    assert.equal(payload.process.pid, process.pid);
    assert.ok(payload.process.memory.rss > 0);
  } finally {
    await app.close();
  }
});
