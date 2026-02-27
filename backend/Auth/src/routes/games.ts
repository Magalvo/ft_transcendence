import type { FastifyInstance } from "fastify";
import createGame from "../services/createGame.js";
import auth from "../middleware/authenticate.js";
import getMyGames from "../services/getMyGames.js";

export default async function gameRoutes(app: FastifyInstance) {
    app.post("/games", async (req, reply) => {
        return await createGame(req, reply);
    });

  app.get(
    "/games/me",
    { preHandler: auth },
    async (req, reply) => {
      return await getMyGames(req, reply);
    }
  );}
