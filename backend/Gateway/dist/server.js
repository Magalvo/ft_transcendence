"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const http_proxy_1 = __importDefault(require("@fastify/http-proxy"));
const app = (0, fastify_1.default)();
app.register(cors_1.default, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});
const upstream = process.env.AUTH_UPSTREAM || 'http://127.0.0.1:3000';
app.register(http_proxy_1.default, {
    upstream,
    prefix: '/api/health',
    rewritePrefix: '/api/health',
    http2: false,
});
app.register(http_proxy_1.default, {
    upstream,
    // Frontend calls /api/auth/*, rewrite to /api/* on Auth service
    prefix: '/api/auth',
    rewritePrefix: '/api',
    http2: false,
});
app.register(http_proxy_1.default, {
    upstream,
    // Compatibility alias for OAuth redirects/callbacks that use /api/google/*
    prefix: '/api/google',
    rewritePrefix: '/api/google',
    http2: false,
});
app.register(http_proxy_1.default, {
    upstream,
    prefix: '/avatars',
    rewritePrefix: '/avatars',
    http2: false,
});
app.get('/', async () => {
    return { ok: true, service: 'gateway' };
});
app.get('/health', async () => {
    return { ok: true, service: 'gateway' };
});
app.ready(() => {
    console.log(app.printRoutes());
});
app
    .listen({ port: 3333, host: '0.0.0.0' })
    .then(() => console.log('Server running on http://localhost:3333'));
