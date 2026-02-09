"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const fastify_1 = __importDefault(require("fastify"));
const fastify_type_provider_zod_1 = require("fastify-type-provider-zod");
const zod_1 = __importDefault(require("zod"));
const app = (0, fastify_1.default)();
// Adicionar o validator e o serializer compiler
app.setValidatorCompiler(fastify_type_provider_zod_1.validatorCompiler);
app.setSerializerCompiler(fastify_type_provider_zod_1.serializerCompiler);
app.register(swagger_1.default, {
    openapi: {
        info: {
            title: 'API de Exemplo',
            description: 'Documentação da API de exemplo utilizando Fastify',
            version: '1.0.0',
        },
    },
    // Importante adicionar para fazer o parse do schema
    transform: fastify_type_provider_zod_1.jsonSchemaTransform
});
app.register(swagger_ui_1.default, {
    routePrefix: '/gateway'
});
// Definição de um endpoint de exemplo
app.after(() => {
    app.withTypeProvider().get('/hello', {
        schema: {
            response: {
                200: zod_1.default.object({
                    message: zod_1.default.string(),
                }),
            },
        },
    }, async (request, reply) => {
        console.log(request.params); // Tipado!
        return reply.send({ message: 'Hello world!' });
    });
});
const http_proxy_1 = __importDefault(require("@fastify/http-proxy"));
app.register(http_proxy_1.default, {
    upstream: 'http://192.168.1.4:3000',
    prefix: '/auth', // Prefixo no Gateway que vai dispaarar esse proxy
    // Opcional: Se o microsserviço espera '/api/register' mas o gateway recebeu '/auth/register',
    // usamos o rewritePrefix para ajustar.
    rewritePrefix: '/api',
    http2: false,
    replyOptions: {
        onError: (reply, error) => {
            console.log("ERRO NO PROXY:", error);
            reply.send(error);
        },
    },
});
app.ready(() => {
    console.log('OPa');
    console.log(app.printRoutes());
});
app
    .listen({ port: 3333 })
    .then(() => console.log('Server running on http://localhost:333'));
