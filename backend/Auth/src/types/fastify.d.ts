import type { Server as SocketIOServer } from "socket.io";

type RealtimeMetrics = {
  timestamp: number;
  connectedSockets: number;
  socketToUserEntries: number;
  authenticatedUsers: number;
  userSocketBindings: number;
  activeLobbyBindings: number;
  publicLobbies: number;
  privateInviteLobbies: number;
  pendingTournamentMatches: number;
  pendingTournamentSlots: number;
  pendingLocalTournamentMatches: number;
  pendingLocalTournamentSlots: number;
  activeLocalTournamentGames: number;
};

declare module "fastify" {
  interface FastifyInstance {
    googleOAuth2: unknown;
    hasMultipart: boolean;
    io?: SocketIOServer;
    getRealtimeMetrics?: () => RealtimeMetrics;
  }
}
