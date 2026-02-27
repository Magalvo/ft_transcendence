import fastify from 'fastify'
import cors from '@fastify/cors'
import proxy from '@fastify/http-proxy'

const app = fastify()

app.register(cors, {
  origin: true,
  credentials: true,
})

const upstream = process.env.AUTH_UPSTREAM || 'http://127.0.0.1:3000';

app.register(proxy, {
  upstream,
  // Frontend calls /api/auth/*, rewrite to /api/* on Auth service
  prefix: '/api/auth',
  rewritePrefix: '/api',
  http2: false,
})

app.get('/', async () => {
  return { ok: true, service: 'gateway' };
})

app.ready(() => {
  console.log(app.printRoutes())
})

app
  .listen({ port: 3333, host: '0.0.0.0' })
  .then(() => console.log('Server running on http://localhost:3333'))
