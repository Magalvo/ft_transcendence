
import fastify from 'fastify'

const app = fastify();





import proxy from '@fastify/http-proxy';






app.register(proxy, {
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
  .then(() => console.log('Server running on http://localhost:333'))