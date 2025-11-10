export default async function healthRoutes(app) {
    app.get('/api/health', async () => {
        return { ok: true, time: new Date().toISOString() };
    });
}
//# sourceMappingURL=health.js.map