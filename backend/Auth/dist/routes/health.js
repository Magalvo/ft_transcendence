export function getProcessHealthSnapshot() {
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
export default async function healthRoutes(app) {
    app.get('/api/health', async (req) => {
        const query = req.query;
        const includeMetrics = query.metrics === true ||
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
