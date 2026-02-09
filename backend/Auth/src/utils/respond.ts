import type { FastifyReply } from "fastify";

export const sendSuccess = (reply: FastifyReply, data: any, statusCode = 200) => {
  reply.status(statusCode).send({ success: true, data, error: null });
};

export const sendError = (reply: FastifyReply, message: string, statusCode = 400) => {
  reply.status(statusCode).send({ success: false, data: null, error: message });
};
