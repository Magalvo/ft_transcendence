import type { FastifyInstance } from 'fastify';

type ProcessHealthSnapshot = {
  pid: number;
  nodeVersion: string;
  uptimeSeconds: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
};

export function getProcessHealthSnapshot(): ProcessHealthSnapshot {
  const memoryUsage = process.memoryUsage();

  return {
    pid: process.pid,
    nodeVersion: process.version,
    uptimeSeconds: Number(process.uptime().toFixed(3)),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
    },
  };
}

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async (req) => {
    const query = req.query as { metrics?: string | number | boolean };
    const includeMetrics =
      query.metrics === true ||
      query.metrics === '1' ||
      query.metrics === 'true' ||
      query.metrics === 1;

    return {
      ok: true,
      time: new Date().toISOString(),
      uptimeSeconds: getProcessHealthSnapshot().uptimeSeconds,
      ...(includeMetrics
        ? {
            process: getProcessHealthSnapshot(),
            metrics: app.getRealtimeMetrics?.() ?? null,
          }
        : {}),
    };
  });

  app.get('/api/health/runtime', async () => {
    return {
      ok: true,
      time: new Date().toISOString(),
      process: getProcessHealthSnapshot(),
      metrics: app.getRealtimeMetrics?.() ?? null,
    };
  });
}
