import type { OAuth2Plugin } from '@fastify/oauth2';

declare module 'fastify' {
  // Add the Google OAuth plugin to FastifyInstance
  interface FastifyInstance {
    googleOAuth2: OAuth2Plugin;
  }
}
