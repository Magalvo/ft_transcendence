"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const app = (0, fastify_1.default)();
const http_proxy_1 = __importDefault(require("@fastify/http-proxy"));
app.register(http_proxy_1.default, {
    upstream: 'http://192.168.1.4:3000',
    prefix: '/auth', // Prefixo no Gateway que vai dispaarar esse proxy
    // Opcional: Se o microsserviço espera '/api/register' mas o gateway recebeu '/auth/register',
    // usamos o rewritePrefix para ajustar.
    rewritePrefix: '/api',
    http2: false
});
app.ready(() => {
    console.log('OPa');
    console.log(app.printRoutes());
});
app
    .listen({ port: 3333 })
    .then(() => console.log('Server running on http://localhost:333'));
