// src/routes/chat.ts
import { FastifyPluginAsync } from 'fastify';
import {
  getGroups,
  getGroupMessages,
  createGroupMessage,
} from '../services/chat.js';

const chatRoutes: FastifyPluginAsync = async (app) => {

  app.get('/groups', async () => {
    return await getGroups();
  });

  app.get('/groups/:groupId/messages', async (request) => {
    const { groupId } = request.params as { groupId: string };
    const limit = Number((request.query as any)?.limit ?? 50);

    return await getGroupMessages(Number(groupId), limit);
  });

  app.post('/groups/:groupId/messages', async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const { id_usersender, messagem } = request.body as any;

    const msg = await createGroupMessage(
      Number(groupId),
      id_usersender,
      messagem
    );

    reply.code(201);
    return msg;
  });
};

export default chatRoutes;
