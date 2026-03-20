import { socketService } from "../client/SocketService";
import { navigateTo, refreshCurrentRoute } from "../core/AppRouter";
import { TournamentManager, type Tournament } from "../core/TournamentManager";
import { TokenManager } from "./TokenManager";
import {
  TournamentInviteState,
  type TournamentInviteInvalidatedPayload,
} from "./TournamentInviteState";

interface TournamentInvitePayload {
  tournamentId: string;
  matchId: string;
  inviteToken: string;
  inviteUrl: string;
  expiresAt: number;
  player1_name?: string;
  player2_name?: string;
}

interface LocalTournamentStatePayload {
  tournamentId: string;
  tournament_snapshot: Tournament;
}

const TOAST_CONTAINER_ID = "global-toast-container";

class TournamentInviteNotifier {
  private static seenInviteTokens = new Set<string>();
  private static toastByInviteToken = new Map<string, HTMLElement>();

  public static init(): void {
    if (!TokenManager.isAuthenticated()) return;

    const userId = TokenManager.getUser()?.id as string | undefined;
    const socket = socketService.getSocket() ?? socketService.init(undefined, userId);

    socket.off("tournamentInvite", this.handleInvite);
    socket.on("tournamentInvite", this.handleInvite);
    socket.off("tournamentInviteInvalidated", this.handleInviteInvalidated);
    socket.on("tournamentInviteInvalidated", this.handleInviteInvalidated);
    socket.off("localTournamentStateUpdated", this.handleLocalTournamentStateUpdated);
    socket.on("localTournamentStateUpdated", this.handleLocalTournamentStateUpdated);
  }

  private static handleInvite = (payload: TournamentInvitePayload): void => {
    if (!payload?.inviteToken || !payload?.inviteUrl) return;
    if (TournamentInviteState.isTokenInvalidated(payload.inviteToken)) return;
    if (this.seenInviteTokens.has(payload.inviteToken)) return;

    this.seenInviteTokens.add(payload.inviteToken);
    this.showInviteToast(payload);
  };

  private static handleInviteInvalidated = (
    payload: TournamentInviteInvalidatedPayload,
  ): void => {
    if (!payload?.invalidatedToken) return;

    TournamentInviteState.markInvalidated(payload);

    const staleToast = this.toastByInviteToken.get(payload.invalidatedToken);
    if (staleToast) {
      staleToast.remove();
      this.toastByInviteToken.delete(payload.invalidatedToken);
    }
  };

  private static handleLocalTournamentStateUpdated = (
    payload: LocalTournamentStatePayload
  ): void => {
    const snapshot = payload?.tournament_snapshot;
    const tournamentId = payload?.tournamentId;
    if (!snapshot || !tournamentId) return;
    if (snapshot.id !== tournamentId) return;
    if (!tournamentId.startsWith("local-")) return;

    const manager = TournamentManager.getInstance();
    manager.setCurrentTournament(snapshot);

    if (window.location.pathname === "/tournament") {
      refreshCurrentRoute();
    }
  };

  private static ensureContainer(): HTMLElement {
    let container = document.getElementById(TOAST_CONTAINER_ID);
    if (container) return container;

    container = document.createElement("div");
    container.id = TOAST_CONTAINER_ID;
    container.className = "fixed top-4 right-4 z-[1200] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2";
    document.body.appendChild(container);
    return container;
  }

  private static showInviteToast(payload: TournamentInvitePayload): void {
    const container = this.ensureContainer();

    const toast = document.createElement("div");
    toast.className =
      "rounded-lg border border-sky-700 bg-slate-900/95 p-3 text-slate-100 shadow-xl backdrop-blur";

    const names =
      payload.player1_name && payload.player2_name
        ? `${payload.player1_name} vs ${payload.player2_name}`
        : "Tournament match";

    const title = document.createElement("div");
    title.className = "text-sm font-semibold text-sky-300";
    title.textContent = "Tournament Invite";

    const subtitle = document.createElement("div");
    subtitle.className = "mt-1 text-xs text-slate-300";
    subtitle.textContent = names;

    const actions = document.createElement("div");
    actions.className = "mt-3 flex items-center gap-2";

    const joinBtn = document.createElement("button");
    joinBtn.className = "rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500";
    joinBtn.textContent = "Join";
    joinBtn.onclick = () => {
      this.navigateToInvite(payload.inviteUrl);
      toast.remove();
    };

    const dismissBtn = document.createElement("button");
    dismissBtn.className = "rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800";
    dismissBtn.textContent = "Dismiss";
    dismissBtn.onclick = () => toast.remove();

    actions.appendChild(joinBtn);
    actions.appendChild(dismissBtn);
    toast.appendChild(title);
    toast.appendChild(subtitle);
    toast.appendChild(actions);
    container.appendChild(toast);
    this.toastByInviteToken.set(payload.inviteToken, toast);

    window.setTimeout(() => {
      toast.remove();
      this.toastByInviteToken.delete(payload.inviteToken);
    }, 12000);
  }

  private static navigateToInvite(rawUrl: string): void {
    try {
      const url = new URL(rawUrl, window.location.origin);
      const path = `${url.pathname}${url.search}`;
      navigateTo(path);
    } catch {
      navigateTo("/tournament");
    }
  }
}

export function initTournamentInviteNotifier(): void {
  TournamentInviteNotifier.init();
}
