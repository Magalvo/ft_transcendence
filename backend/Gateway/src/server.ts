import fastify from 'fastify'
import cors from '@fastify/cors'
import proxy from '@fastify/http-proxy'

const app = fastify()

app.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
})

const upstream = process.env.AUTH_UPSTREAM || 'http://127.0.0.1:3000';

app.register(proxy, {
  upstream,
  prefix: '/api/health',
  rewritePrefix: '/api/health',
  http2: false,
})

app.register(proxy, {
  upstream,
  // Frontend calls /api/auth/*, rewrite to /api/* on Auth service
  prefix: '/api/auth',
  rewritePrefix: '/api',
  http2: false,
})

app.register(proxy, {
  upstream,
  // Compatibility alias for OAuth redirects/callbacks that use /api/google/*
  prefix: '/api/google',
  rewritePrefix: '/api/google',
  http2: false,
})


app.register(proxy, {
  upstream,
  prefix: '/avatars',
  rewritePrefix: '/avatars',
  http2: false,
})

app.get('/', async () => {
  return { ok: true, service: 'gateway' };
})

app.get('/health', async () => {
  return { ok: true, service: 'gateway' };
})

app.ready(() => {
  console.log(app.printRoutes())
})

app
  .listen({ port: 3333, host: '0.0.0.0' })
  .then(() => console.log('Server running on http://localhost:3333'))
