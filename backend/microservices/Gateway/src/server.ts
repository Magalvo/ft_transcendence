import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from "fastify-type-provider-zod";
import z from "zod";




const app = fastify();

// Adicionar o validator e o serializer compiler
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'API de Exemplo',
      description: 'Documentação da API de exemplo utilizando Fastify',
      version: '1.0.0',
    },
  },
  // Importante adicionar para fazer o parse do schema
  transform: jsonSchemaTransform
})

app.register(fastifySwaggerUi, {
  routePrefix: '/api'
})

// Definição de um endpoint de exemplo
app.after(() => {
  app.withTypeProvider<ZodTypeProvider>().get('/hello', {
    schema: {
      response: {
        200: z.object({
          message: z.string(),
        }),
      },
    },
  }, async (request, reply) => {
    console.log(request.params) // Tipado!
    return reply.send({ message: 'Hello world!' })
  });
})

app
  .listen({ port: 3333 })
  .then(() => console.log('Server running on http://localhost:3333'))