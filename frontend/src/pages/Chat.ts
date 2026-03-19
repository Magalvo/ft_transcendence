import { AbstractComponent } from "../core/Component";
import { Navbar } from "../components/layout/Navbar";
import {
  ChatService,
  type ChatListUser,
  type ChatGroup,
  type ChatMessage,
  type ChatUser,
  type GroupMember,
  type GroupVisibility,
} from "../services/ChatService";
import { navigateTo } from "../core/AppRouter";
import { io, type Socket } from "socket.io-client";
import { formatTime, t } from "../services/I18nService";
import { TokenManager } from "../services/TokenManager";
import { WS_URL } from "../services/RuntimeConfig";

export class ChatPage extends AbstractComponent {
  private static readonly PONG_INVITE_PREFIX = "__PONG_INVITE__|";
  private currentUser: ChatUser | null = null;
  private groups: ChatGroup[] = [];
  private users: ChatListUser[] = [];
  private currentGroupId: number | null = null;
  private currentPrivateChatId: number | null = null;
  private currentDmTargetId: string | null = null;
  private currentRole: "owner" | "admin" | "member" | null = null;
  private members: GroupMember[] = [];
  private messages: ChatMessage[] = [];
  private blockedUserIds = new Set<string>();

  private groupsEl: HTMLElement | null = null;
  private usersEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private listEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private sendBtnEl: HTMLButtonElement | null = null;
  private inviteBtnEl: HTMLButtonElement | null = null;
  private dmBlockBtnEl: HTMLButtonElement | null = null;
  private membersEl: HTMLElement | null = null;
  private adminPanelEl: HTMLElement | null = null;
  private roleEl: HTMLElement | null = null;
  private createNameEl: HTMLInputElement | null = null;
  private createVisibilityEl: HTMLSelectElement | null = null;
  private createPasswordEl: HTMLInputElement | null = null;
  private createBtnEl: HTMLButtonElement | null = null;
  private inviteMemberEl: HTMLInputElement | null = null;
  private inviteMemberBtnEl: HTMLButtonElement | null = null;
  private inviteMemberSectionEl: HTMLElement | null = null;
  private settingsVisibilityEl: HTMLSelectElement | null = null;
  private settingsPasswordEl: HTMLInputElement | null = null;
  private settingsBtnEl: HTMLButtonElement | null = null;

  private chatSocket: Socket | null = null;
  private realtimeReady = false;
  private refreshTimer: number | null = null;

  constructor() {
    super("div", "h-screen overflow-hidden bg-neutral-950 text-white");
  }

  public render(): void {
    this.element.innerHTML = "";

    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

    const shell = document.createElement("div");
    shell.className = "mx-auto flex h-[calc(100vh-5rem)] w-full max-w-[1500px] gap-4 px-4 py-4";
    shell.innerHTML = `
      <aside class="flex min-h-0 w-72 flex-col rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div class="flex min-h-0 flex-1 flex-col">
            <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">${t("chat.users")}</h2>
            <div id="chat-users" class="min-h-0 flex flex-1 flex-col gap-2 overflow-auto pb-2"></div>
          </div>
          <div class="flex min-h-0 flex-1 flex-col">
            <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">${t("chat.channels")}</h2>
            <div id="chat-groups" class="min-h-0 flex flex-1 flex-col gap-2 overflow-auto pb-2"></div>
          </div>
        </div>
        <div class="mt-3 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">${t("chat.createChannel")}</h3>
          <input id="create-name" type="text" placeholder="${t("chat.channelNamePlaceholder")}" class="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm" />
          <select id="create-visibility" class="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm">
            <option value="public">${t("chat.visibility.public")}</option>
            <option value="private">${t("chat.visibility.private")}</option>
            <option value="protected">${t("chat.visibility.protected")}</option>
          </select>
          <input id="create-password" type="password" placeholder="${t("chat.passwordProtectedPlaceholder")}" class="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm" />
          <button id="create-channel-btn" type="button" class="w-full rounded bg-blue-700 px-2 py-1 text-sm font-medium hover:bg-blue-600">${t("chat.create")}</button>
        </div>
      </aside>

      <section class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
        <header class="shrink-0 flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 id="chat-title" class="text-lg font-semibold">${t("chat.title")}</h2>
          <div class="flex items-center gap-2">
            <button id="chat-dm-block" type="button" class="hidden rounded-md bg-rose-700 px-3 py-1 text-sm font-medium hover:bg-rose-600">${t("chat.block")}</button>
            <button id="chat-invite" type="button" class="rounded-md bg-emerald-700 px-3 py-1 text-sm font-medium hover:bg-emerald-600">${t("chat.invitePong")}</button>
          </div>
        </header>
        <ol id="chat-messages" class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-6"></ol>
        <form id="chat-form" class="shrink-0 flex gap-2 border-t border-neutral-800 p-3">
          <input id="chat-input" type="text" placeholder="${t("chat.messagePlaceholder")}" class="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 outline-none focus:border-blue-500" />
          <button id="chat-send" type="submit" class="rounded-md bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500">${t("chat.send")}</button>
        </form>
      </section>

      <aside id="chat-admin-panel" class="flex min-h-0 w-80 flex-col rounded-xl border border-neutral-800 bg-neutral-900 p-3">
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">${t("chat.channelAdmin")}</h2>
        <div id="chat-role" class="mb-3 text-sm text-neutral-300">${t("chat.role", { role: t("chat.role.none") })}</div>
        <div id="invite-member-section" class="mb-3 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
          <div class="mb-2 text-xs text-neutral-400">${t("chat.inviteMember")}</div>
          <div class="flex gap-2">
            <input id="invite-member-input" type="text" placeholder="${t("chat.inviteMemberPlaceholder")}" class="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm" />
            <button id="invite-member-btn" type="button" class="rounded bg-neutral-700 px-2 py-1 text-sm hover:bg-neutral-600">${t("chat.invite")}</button>
          </div>
        </div>
        <div class="mb-3 shrink-0 rounded-lg border border-neutral-800 bg-neutral-950 p-2">
          <div class="mb-2 text-xs text-neutral-400">${t("chat.channelSettings")}</div>
          <select id="settings-visibility" class="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm">
            <option value="public">${t("chat.visibility.public")}</option>
            <option value="private">${t("chat.visibility.private")}</option>
            <option value="protected">${t("chat.visibility.protected")}</option>
          </select>
          <input id="settings-password" type="password" placeholder="${t("chat.settingsPasswordPlaceholder")}" class="mb-2 w-full rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-sm" />
          <button id="settings-save-btn" type="button" class="w-full rounded bg-neutral-700 px-2 py-1 text-sm hover:bg-neutral-600">${t("chat.apply")}</button>
        </div>
        <div class="mb-2 shrink-0 text-xs text-neutral-400">${t("chat.members")}</div>
        <div id="chat-members" class="min-h-0 flex flex-1 flex-col gap-2 overflow-auto pb-2"></div>
      </aside>
    `;
    this.element.appendChild(shell);

    this.groupsEl = shell.querySelector("#chat-groups");
    this.usersEl = shell.querySelector("#chat-users");
    this.titleEl = shell.querySelector("#chat-title");
    this.listEl = shell.querySelector("#chat-messages");
    this.inputEl = shell.querySelector("#chat-input");
    this.sendBtnEl = shell.querySelector("#chat-send");
    this.inviteBtnEl = shell.querySelector("#chat-invite");
    this.dmBlockBtnEl = shell.querySelector("#chat-dm-block");
    this.membersEl = shell.querySelector("#chat-members");
    this.adminPanelEl = shell.querySelector("#chat-admin-panel");
    this.roleEl = shell.querySelector("#chat-role");
    this.createNameEl = shell.querySelector("#create-name");
    this.createVisibilityEl = shell.querySelector("#create-visibility");
    this.createPasswordEl = shell.querySelector("#create-password");
    this.createBtnEl = shell.querySelector("#create-channel-btn");
    this.inviteMemberEl = shell.querySelector("#invite-member-input");
    this.inviteMemberBtnEl = shell.querySelector("#invite-member-btn");
    this.inviteMemberSectionEl = shell.querySelector("#invite-member-section");
    this.settingsVisibilityEl = shell.querySelector("#settings-visibility");
    this.settingsPasswordEl = shell.querySelector("#settings-password");
    this.settingsBtnEl = shell.querySelector("#settings-save-btn");

    const form = shell.querySelector<HTMLFormElement>("#chat-form");
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      void this.handleSend();
    });

    this.inviteBtnEl?.addEventListener("click", () => {
      const targetId = this.currentDmTargetId;
      if (!targetId || !this.currentUser) {
        window.alert(t("chat.error.inviteContext"));
        return;
      }

      const inviteSession = `chat_${Date.now()}`;
      const inviteUrl = this.buildLobbyInviteUrl(inviteSession);
      const inviteMessage = this.buildInviteMessage(inviteUrl, inviteSession);

      if (this.chatSocket?.connected && this.realtimeReady) {
        this.chatSocket.emit("chat_invite_game", {
          targetId,
          url: inviteUrl,
          id_session: inviteSession,
        });
        this.openInviteLobby(inviteUrl);
        return;
      }

      if (this.currentPrivateChatId === null) {
        window.alert(t("chat.error.inviteContext"));
        return;
      }

      void (async () => {
        try {
          const created = await ChatService.sendPrivateMessage(this.currentPrivateChatId!, inviteMessage);
          this.messages.push({ ...created, sender_name: created.sender_name || this.currentUser!.username });
          this.renderMessages();
          this.openInviteLobby(inviteUrl);
        } catch (e: any) {
          window.alert(e?.response?.data?.error || e?.message || t("chat.error.sendGameInvite"));
        }
      })();
    });
    this.dmBlockBtnEl?.addEventListener("click", () => void this.handleToggleDmBlock());

    this.createBtnEl?.addEventListener("click", () => void this.handleCreateChannel());
    this.inviteMemberBtnEl?.addEventListener("click", () => void this.handleInviteMember());
    this.settingsBtnEl?.addEventListener("click", () => void this.handleChannelSettings());

    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    try {
      this.currentUser = await ChatService.getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }
    await this.refreshBlockedUsers();
    this.initRealtime();
    this.users = await ChatService.getUsers();
    this.groups = await ChatService.getGroups();
    this.currentGroupId = this.groups[0]?.id_group ?? null;
    this.renderUsers();
    this.renderGroups();

    if (this.currentGroupId !== null) {
      await this.selectGroup(this.currentGroupId);
    } else {
      this.renderMessages();
      this.renderMembers();
    }
    this.startAutoRefresh();
  }

  private startAutoRefresh(): void {
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer);
    this.refreshTimer = window.setInterval(() => {
      void this.refreshChatData();
    }, 12000);
  }

  private async refreshChatData(): Promise<void> {
    try {
      const [users, groups] = await Promise.all([ChatService.getUsers(), ChatService.getGroups()]);
      this.users = users;
      this.groups = groups;
      this.renderUsers();
      this.renderGroups();

      // Realtime socket already delivers fresh chat data; fallback poll only if realtime is not ready.
      if (this.currentGroupId !== null && (!this.chatSocket?.connected || !this.realtimeReady)) {
        const next = await ChatService.getGroupMessages(this.currentGroupId);
        await this.refreshGroupMeta();
        if (JSON.stringify(next.map((m) => m.id_message)) !== JSON.stringify(this.messages.map((m) => m.id_message))) {
          this.messages = next;
          this.renderMessages();
        }
      } else if (this.currentPrivateChatId !== null && (!this.chatSocket?.connected || !this.realtimeReady)) {
        const next = await ChatService.getPrivateMessages(this.currentPrivateChatId);
        if (JSON.stringify(next.map((m) => m.id_message)) !== JSON.stringify(this.messages.map((m) => m.id_message))) {
          this.messages = next;
          this.renderMessages();
        }
      }
    } catch {
      // Keep current UI on transient errors.
    }
  }

  private renderGroups(): void {
    if (!this.groupsEl) return;
    this.groupsEl.innerHTML = "";

    this.groups.forEach((group) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const active = group.id_group === this.currentGroupId;
      btn.className = `w-full rounded-md px-3 py-2 text-left text-sm transition ${
        active ? "bg-blue-700 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
      }`;
      const groupName = group.name || t("chat.groupFallback", { id: group.id_group });
      const visibilityLabel = group.visibility ? this.getVisibilityLabel(group.visibility) : "";
      btn.textContent = visibilityLabel ? `${groupName} (${visibilityLabel})` : groupName;
      btn.addEventListener("click", () => void this.selectGroup(group.id_group));
      this.groupsEl?.appendChild(btn);
    });
  }

  private renderUsers(): void {
    if (!this.usersEl) return;
    this.usersEl.innerHTML = "";
    if (!this.users.length) {
      const empty = document.createElement("div");
      empty.className = "text-xs text-neutral-500";
      empty.textContent = t("chat.noUsers");
      this.usersEl.appendChild(empty);
      return;
    }

    this.users.forEach((user) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const active = this.currentDmTargetId === user.id;
      btn.className = `flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition ${
        active ? "bg-blue-700 text-white" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
      }`;
      btn.innerHTML = `
        <span class="truncate">${user.username}</span>
        <span class="ml-2 inline-flex items-center gap-1 text-[11px] ${user.online ? "text-emerald-400" : "text-neutral-500"}">
          <span class="inline-block h-2 w-2 rounded-full ${user.online ? "bg-emerald-400" : "bg-neutral-600"}"></span>
          ${this.getUserStatusLabel(user.online)}
        </span>
      `;
      btn.addEventListener("click", () => void this.openPrivateChat(user.id, user.username));
      this.usersEl?.appendChild(btn);
    });
  }

  private async selectGroup(groupId: number): Promise<void> {
    this.currentPrivateChatId = null;
    this.currentDmTargetId = null;
    this.updateDmBlockButton();
    this.renderUsers();
    this.currentGroupId = groupId;
    this.renderGroups();

    try {
      await ChatService.joinGroup(groupId);
    } catch (e: any) {
      const errorText = String(e?.response?.data?.error || e?.message || "");
      if (errorText.toLowerCase().includes("password")) {
        const pass = window.prompt(t("chat.prompt.channelPassword"));
        if (pass) {
          await ChatService.joinGroup(groupId, pass);
        } else {
          return;
        }
      } else {
        window.alert(errorText || t("chat.error.joinChannel"));
        return;
      }
    }

    const selected = this.groups.find((g) => g.id_group === groupId);
    if (this.titleEl) this.titleEl.textContent = selected ? `# ${selected.name}` : t("chat.title");
    this.inviteBtnEl?.classList.add("hidden");
    if (this.settingsVisibilityEl) this.settingsVisibilityEl.value = selected?.visibility || "public";
    this.chatSocket?.emit("chat_join_group", { groupId });

    try {
      this.messages = await ChatService.getGroupMessages(groupId);
      await this.refreshGroupMeta();
      this.renderMessages();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.loadChannelMessages"));
    }
  }

  private async openPrivateChat(targetId: string, username: string): Promise<void> {
    this.currentGroupId = null;
    this.currentDmTargetId = targetId;
    this.currentRole = null;
    this.members = [];
    this.renderGroups();
    this.renderUsers();
    if (this.titleEl) this.titleEl.textContent = `@ ${username}`;
    this.inviteBtnEl?.classList.remove("hidden");

    try {
      await this.refreshBlockedUsers();
      this.updateDmBlockButton();
      const chat = await ChatService.getOrCreatePrivateChat(targetId);
      this.currentPrivateChatId = chat.id_privatechat;
      this.messages = await ChatService.getPrivateMessages(chat.id_privatechat);
      this.renderMembers();
      this.renderMessages();
    } catch (e: any) {
      this.currentPrivateChatId = null;
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.openPrivateChat"));
    }
  }

  private async refreshGroupMeta(): Promise<void> {
    if (this.currentGroupId === null) return;
    try {
      this.currentRole = await ChatService.getGroupRole(this.currentGroupId);
      this.members = await ChatService.getGroupMembers(this.currentGroupId);
    } catch {
      this.currentRole = null;
      this.members = [];
    }
    this.renderMembers();
  }

  private initRealtime(): void {
    if (!this.currentUser) return;
    this.chatSocket = io(WS_URL, {
      auth: { token: TokenManager.getAccessToken() || undefined },
      withCredentials: true,
    });
    this.chatSocket.on("connect", () => {
      this.realtimeReady = false;
      this.chatSocket?.emit("chat_auth", { token: TokenManager.getAccessToken() || undefined });
      if (this.currentGroupId) this.chatSocket?.emit("chat_join_group", { groupId: this.currentGroupId });
    });

    this.chatSocket.on("chat_auth_ok", () => {
      this.realtimeReady = true;
      if (this.currentGroupId) this.chatSocket?.emit("chat_join_group", { groupId: this.currentGroupId });
    });

    this.chatSocket.on("chat_error", (err: any) => {
      this.realtimeReady = false;
      const msg = err?.message || t("chat.error.realtime");
      if (msg) window.alert(msg);
    });

    this.chatSocket.on("chat_group_message", (msg: any) => {
      if (!this.currentGroupId || this.currentPrivateChatId !== null) return;
      if (Number(msg.id_group) !== this.currentGroupId) return;
      if (this.messages.some((m) => String(m.id_message) === String(msg.id_message))) return;
      this.messages.push({
        id_message: msg.id_message,
        id_usersender: String(msg.id_usersender),
        sender_name: msg.sender_name,
        messagem: msg.messagem,
        timestamp: Number(msg.timestamp),
      });
      this.renderMessages();
    });

    this.chatSocket.on("chat_private_message", async (msg: any) => {
      const senderId = String(msg.id_usersender);
      if (this.currentDmTargetId && senderId !== this.currentDmTargetId && senderId !== this.currentUser?.id) return;

      if (this.currentPrivateChatId && Number(msg.id_privatechat) !== this.currentPrivateChatId) return;

      if (!this.currentPrivateChatId && this.currentDmTargetId && senderId === this.currentDmTargetId) {
        const chat = await ChatService.getOrCreatePrivateChat(this.currentDmTargetId);
        this.currentPrivateChatId = chat.id_privatechat;
      }

      if (this.messages.some((m) => String(m.id_message) === String(msg.id_message))) return;
      this.messages.push({
        id_message: msg.id_message,
        id_usersender: String(msg.id_usersender),
        sender_name: msg.sender_name,
        messagem: msg.messagem,
        timestamp: Number(msg.timestamp),
      });
      this.renderMessages();
    });

  }

  private renderMessages(): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = "";

    if (!this.messages.length) {
      const empty = document.createElement("li");
      empty.className = "text-sm text-neutral-400";
      empty.textContent = t("chat.messages.empty");
      this.listEl.appendChild(empty);
      return;
    }

    this.messages.forEach((msg) => {
      const isMe = this.currentUser?.id === msg.id_usersender;
      const li = document.createElement("li");
      li.className = `flex ${isMe ? "justify-end" : "justify-start"}`;

      const bubble = document.createElement("div");
      bubble.className = `max-w-[75%] rounded-2xl px-3 py-2 ${
        isMe ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-100"
      }`;

      const sender = document.createElement("button");
      sender.type = "button";
      sender.className = "mb-1 text-xs opacity-70 underline-offset-2 hover:underline";
      sender.textContent = msg.sender_name || t("chat.userFallback", { id: msg.id_usersender });
      sender.addEventListener("click", async () => {
        try {
          const profile = await ChatService.getUserProfile(msg.id_usersender);
          window.alert(
            t("chat.profileModal", {
              username: profile.username,
              email: profile.email ?? "-",
              online: profile.online ? t("chat.profileOnline.yes") : t("chat.profileOnline.no"),
            })
          );
        } catch {
          window.alert(t("chat.error.loadProfile"));
        }
      });

      const inviteData = this.parsePongInvite(msg.messagem);
      const text = document.createElement("div");
      text.className = "break-words text-sm";
      text.textContent = inviteData
        ? (isMe ? t("chat.invite.sent") : t("chat.invite.received"))
        : msg.messagem;

      const time = document.createElement("div");
      time.className = "mt-1 text-right text-[10px] opacity-60";
      time.textContent = formatTime(msg.timestamp);

      bubble.append(sender, text);
      if (inviteData && isMe) {
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "mt-2 rounded bg-blue-700 px-3 py-1 text-xs font-medium hover:bg-blue-600";
        openBtn.textContent = t("chat.invite.openLobby");
        openBtn.addEventListener("click", () => {
          this.navigateToInvite(this.buildInviteUrl(inviteData.url, inviteData.sessionId));
        });
        bubble.appendChild(openBtn);
      }
      if ((msg.is_game_invite || inviteData) && !isMe) {
        const acceptBtn = document.createElement("button");
        acceptBtn.type = "button";
        acceptBtn.className = "mt-2 rounded bg-emerald-700 px-3 py-1 text-xs font-medium hover:bg-emerald-600";
        acceptBtn.textContent = t("chat.invite.accept");
        acceptBtn.addEventListener("click", () => {
          this.navigateToInvite(this.buildInviteUrl(
            inviteData?.url || msg.invite_url,
            inviteData?.sessionId || msg.invite_session
          ));
        });
        bubble.appendChild(acceptBtn);
      }
      bubble.append(time);
      li.appendChild(bubble);
      this.listEl?.appendChild(li);
    });

    this.listEl.scrollTop = this.listEl.scrollHeight;
  }

  private buildInviteUrl(rawUrl?: string, sessionId?: string | null): string {
    try {
      const url = new URL(rawUrl || "/game", window.location.origin);
      if (sessionId) url.searchParams.set("inviteSession", sessionId);
      return url.toString();
    } catch {
      return "/game";
    }
  }

  private buildInviteMessage(url: string, sessionId: string): string {
    return `${ChatPage.PONG_INVITE_PREFIX}${encodeURIComponent(url)}|${encodeURIComponent(sessionId)}`;
  }

  private buildLobbyInviteUrl(sessionId: string): string {
    const url = new URL("/lobby", window.location.origin);
    url.searchParams.set("inviteSession", sessionId);
    if (this.currentUser?.id) url.searchParams.set("invitedBy", this.currentUser.id);
    if (this.currentUser?.username) url.searchParams.set("invitedByName", this.currentUser.username);
    if (this.currentDmTargetId) url.searchParams.set("invitedUser", this.currentDmTargetId);
    return url.toString();
  }

  private openInviteLobby(inviteUrl: string): void {
    window.setTimeout(() => {
      this.navigateToInvite(inviteUrl);
    }, 80);
  }

  private navigateToInvite(rawUrl: string): void {
    try {
      const url = new URL(rawUrl, window.location.origin);
      navigateTo(`${url.pathname}${url.search}`);
    } catch {
      navigateTo('/game');
    }
  }

  private parsePongInvite(raw: string): { url: string; sessionId: string | null } | null {
    if (!raw || !raw.startsWith(ChatPage.PONG_INVITE_PREFIX)) return null;
    const payload = raw.slice(ChatPage.PONG_INVITE_PREFIX.length);
    const [encodedUrl, encodedSession = ""] = payload.split("|");
    try {
      return {
        url: decodeURIComponent(encodedUrl || "/game"),
        sessionId: encodedSession ? decodeURIComponent(encodedSession) : null,
      };
    } catch {
      return { url: "/game", sessionId: null };
    }
  }

  private renderMembers(): void {
    if (!this.membersEl) return;
    this.membersEl.innerHTML = "";

    if (this.roleEl) {
      this.roleEl.textContent = t("chat.role", { role: this.getRoleLabel(this.currentRole) });
    }
    if (!this.currentGroupId) {
      if (this.roleEl) this.roleEl.textContent = t("chat.role.dm");
    }

    const canModerate = this.currentGroupId !== null && (this.currentRole === "owner" || this.currentRole === "admin");
    const ownerOnly = this.currentRole === "owner";
    const showAdminPanel = this.currentGroupId !== null && canModerate;
    const selectedGroup = this.currentGroupId !== null
      ? this.groups.find((g) => g.id_group === this.currentGroupId)
      : null;
    const canInviteById = selectedGroup?.visibility === "private";
    this.adminPanelEl?.classList.toggle("hidden", !showAdminPanel);
    this.inviteMemberSectionEl?.classList.toggle("hidden", !canInviteById);

    if (this.settingsBtnEl) this.settingsBtnEl.disabled = !ownerOnly;
    if (this.settingsVisibilityEl) this.settingsVisibilityEl.disabled = !ownerOnly;
    if (this.settingsPasswordEl) this.settingsPasswordEl.disabled = !ownerOnly;
    if (this.inviteMemberBtnEl) this.inviteMemberBtnEl.disabled = !canModerate || !canInviteById;
    if (this.inviteMemberEl) this.inviteMemberEl.disabled = !canModerate || !canInviteById;

    if (!this.currentGroupId) {
      const info = document.createElement("div");
      info.className = "text-sm text-neutral-500";
      info.textContent = t("chat.dmInfo");
      this.membersEl.appendChild(info);
      return;
    }

    if (!this.members.length) {
      const empty = document.createElement("div");
      empty.className = "text-sm text-neutral-500";
      empty.textContent = t("chat.noMembers");
      this.membersEl.appendChild(empty);
      return;
    }

    this.members.forEach((member) => {
      const row = document.createElement("div");
      row.className = "rounded border border-neutral-800 bg-neutral-950 p-2";
      const isBanned = !!member.is_banned;
      const isMuted = !!member.muted_until && Number(member.muted_until) > Date.now();

      const top = document.createElement("div");
      top.className = "mb-2 flex items-center justify-between gap-2";
      top.innerHTML = `
        <span class="inline-flex items-center gap-2 text-sm">
          <span class="inline-block h-2 w-2 rounded-full ${member.online ? "bg-emerald-400" : "bg-neutral-600"}"></span>
          ${member.username}
        </span>
        <span class="text-xs text-neutral-400">${isBanned ? t("chat.memberStatus.banned") : this.getRoleLabel(member.role)}</span>
      `;

      const actions = document.createElement("div");
      actions.className = "flex flex-wrap gap-1";

      const isSelf = member.id === this.currentUser?.id;
      const targetIsOwner = member.role === "owner";

      const addAction = (label: string, cb: () => void, disabled = false) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rounded bg-neutral-700 px-2 py-1 text-[11px] hover:bg-neutral-600 disabled:opacity-40";
        b.textContent = label;
        b.disabled = disabled;
        b.addEventListener("click", cb);
        actions.appendChild(b);
      };

      if (ownerOnly) {
        addAction(
          member.role === "admin" ? t("chat.action.demote") : t("chat.action.promote"),
          () => void this.handleSetAdmin(member.id, member.role !== "admin"),
          isSelf || targetIsOwner || isBanned
        );
      }
      addAction(t("chat.action.profile"), () => void this.handleProfile(member.id));

      if (canModerate) {
        if (isBanned) {
          addAction(t("chat.action.unban"), () => void this.handleUnban(member.id), isSelf);
        } else {
          addAction(t("chat.action.kick"), () => void this.handleKick(member.id), isSelf || targetIsOwner);
          addAction(t("chat.action.ban"), () => void this.handleBan(member.id), isSelf || targetIsOwner);
          if (isMuted) {
            addAction(t("chat.action.unmute"), () => void this.handleUnmute(member.id), isSelf);
          } else {
            addAction(t("chat.action.mute60"), () => void this.handleMute(member.id, 60), isSelf || targetIsOwner);
          }
        }
      }

      row.append(top, actions);
      this.membersEl?.appendChild(row);
    });
  }

  private async handleCreateChannel(): Promise<void> {
    if (!this.createNameEl || !this.createVisibilityEl || !this.createBtnEl) return;
    const name = this.createNameEl.value.trim();
    const visibility = this.createVisibilityEl.value as GroupVisibility;
    const password = this.createPasswordEl?.value || undefined;
    if (!name) return;

    this.createBtnEl.disabled = true;
    try {
      await ChatService.createGroup(name, visibility, password);
      this.groups = await ChatService.getGroups();
      this.currentGroupId = this.groups.find((g) => g.name === name)?.id_group ?? this.groups[0]?.id_group ?? null;
      this.renderGroups();
      if (this.currentGroupId !== null) await this.selectGroup(this.currentGroupId);
      this.createNameEl.value = "";
      if (this.createPasswordEl) this.createPasswordEl.value = "";
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.createChannel"));
    } finally {
      this.createBtnEl.disabled = false;
    }
  }

  private async handleInviteMember(): Promise<void> {
    if (!this.inviteMemberEl || this.currentGroupId === null) return;
    const username = this.inviteMemberEl.value.trim();
    if (!username) return;
    try {
      await ChatService.inviteMember(this.currentGroupId, username);
      this.inviteMemberEl.value = "";
      await this.refreshGroupMeta();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.inviteMember"));
    }
  }

  private async handleChannelSettings(): Promise<void> {
    if (!this.settingsVisibilityEl || this.currentGroupId === null) return;
    try {
      await ChatService.updateChannelSettings(
        this.currentGroupId,
        this.settingsVisibilityEl.value as GroupVisibility,
        this.settingsPasswordEl?.value || undefined
      );
      this.groups = await ChatService.getGroups();
      this.renderGroups();
      if (this.settingsPasswordEl) this.settingsPasswordEl.value = "";
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.updateSettings"));
    }
  }

  private async handleSetAdmin(targetId: string, enabled: boolean): Promise<void> {
    if (this.currentGroupId === null) return;
    try {
      await ChatService.setAdmin(this.currentGroupId, targetId, enabled);
      await this.refreshGroupMeta();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.changeAdmin"));
    }
  }

  private async handleKick(targetId: string): Promise<void> {
    if (this.currentGroupId === null) return;
    try {
      await ChatService.kick(this.currentGroupId, targetId);
      await this.refreshGroupMeta();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.kick"));
    }
  }

  private async handleBan(targetId: string): Promise<void> {
    if (this.currentGroupId === null) return;
    try {
      await ChatService.ban(this.currentGroupId, targetId);
      await this.refreshGroupMeta();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.ban"));
    }
  }

  private async handleUnban(targetId: string): Promise<void> {
    if (this.currentGroupId === null) return;
    try {
      await ChatService.unban(this.currentGroupId, targetId);
      await this.refreshGroupMeta();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.unban"));
    }
  }

  private async handleMute(targetId: string, seconds: number): Promise<void> {
    if (this.currentGroupId === null) return;
    try {
      await ChatService.mute(this.currentGroupId, targetId, seconds);
      await this.refreshGroupMeta();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.mute"));
    }
  }

  private async handleUnmute(targetId: string): Promise<void> {
    if (this.currentGroupId === null) return;
    try {
      await ChatService.unmute(this.currentGroupId, targetId);
      await this.refreshGroupMeta();
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.unmute"));
    }
  }

  private async handleProfile(userId: string): Promise<void> {
    try {
      const profile = await ChatService.getUserProfile(userId);
      window.alert(
        t("chat.profileModal", {
          username: profile.username,
          email: profile.email ?? "-",
          online: profile.online ? t("chat.profileOnline.yes") : t("chat.profileOnline.no"),
        })
      );
    } catch {
      window.alert(t("chat.error.loadProfile"));
    }
  }

  private async handleBlock(targetId: string): Promise<void> {
    try {
      await ChatService.blockUser(targetId);
      this.blockedUserIds.add(targetId);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.block"));
    }
  }

  private async handleUnblock(targetId: string): Promise<void> {
    try {
      await ChatService.unblockUser(targetId);
      this.blockedUserIds.delete(targetId);
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.unblock"));
    }
  }

  private async refreshBlockedUsers(): Promise<void> {
    try {
      const blocked = await ChatService.getBlockedUsers();
      this.blockedUserIds = new Set(blocked.map((u) => u.id));
    } catch {
      // Keep previous block state on transient errors.
    }
  }

  private updateDmBlockButton(): void {
    if (!this.dmBlockBtnEl) return;
    const dmTargetId = this.currentDmTargetId;
    const inDm = this.currentGroupId === null && !!dmTargetId;
    this.dmBlockBtnEl.classList.toggle("hidden", !inDm);
    if (!inDm || !dmTargetId) return;

    const isBlocked = this.blockedUserIds.has(dmTargetId);
    this.dmBlockBtnEl.textContent = isBlocked ? t("chat.unblock") : t("chat.block");
    this.dmBlockBtnEl.classList.toggle("bg-rose-700", !isBlocked);
    this.dmBlockBtnEl.classList.toggle("hover:bg-rose-600", !isBlocked);
    this.dmBlockBtnEl.classList.toggle("bg-amber-700", isBlocked);
    this.dmBlockBtnEl.classList.toggle("hover:bg-amber-600", isBlocked);
  }

  private async handleToggleDmBlock(): Promise<void> {
    if (!this.currentDmTargetId) return;
    const targetId = this.currentDmTargetId;
    if (this.blockedUserIds.has(targetId)) {
      await this.handleUnblock(targetId);
    } else {
      await this.handleBlock(targetId);
    }
    this.updateDmBlockButton();
    if (this.currentPrivateChatId !== null) {
      try {
        this.messages = await ChatService.getPrivateMessages(this.currentPrivateChatId);
        this.renderMessages();
      } catch {
        // Ignore refresh errors after block toggle.
      }
    }
  }

  private async handleSend(): Promise<void> {
    if (!this.inputEl || !this.sendBtnEl || !this.currentUser) return;
    const content = this.inputEl.value.trim();
    if (!content) return;

    this.sendBtnEl.disabled = true;
    try {
      if (this.currentPrivateChatId !== null && this.currentDmTargetId) {
        if (this.chatSocket?.connected && this.realtimeReady) {
          this.chatSocket.emit("chat_send_dm", { targetId: this.currentDmTargetId, messagem: content });
        } else {
          const created = await ChatService.sendPrivateMessage(this.currentPrivateChatId, content);
          this.messages.push({ ...created, sender_name: created.sender_name || this.currentUser.username });
          this.renderMessages();
        }
      } else if (this.currentGroupId !== null && this.chatSocket?.connected && this.realtimeReady) {
        this.chatSocket.emit("chat_send_group", { groupId: this.currentGroupId, messagem: content });
      } else if (this.currentGroupId !== null) {
        const created = await ChatService.sendGroupMessage(this.currentGroupId, this.currentUser.id, content);
        this.messages.push({ ...created, sender_name: created.sender_name || this.currentUser.username });
        this.renderMessages();
      }
      this.inputEl.value = "";
    } catch (e: any) {
      window.alert(e?.response?.data?.error || e?.message || t("chat.error.sendMessage"));
    } finally {
      this.sendBtnEl.disabled = false;
    }
  }

  private getVisibilityLabel(visibility?: GroupVisibility | null): string {
    switch (visibility) {
      case "private":
        return t("chat.visibility.private");
      case "protected":
        return t("chat.visibility.protected");
      case "public":
      default:
        return t("chat.visibility.public");
    }
  }

  private getRoleLabel(role: "owner" | "admin" | "member" | null): string {
    switch (role) {
      case "owner":
        return t("chat.role.owner");
      case "admin":
        return t("chat.role.admin");
      case "member":
        return t("chat.role.member");
      default:
        return t("chat.role.none");
    }
  }

  private getUserStatusLabel(isOnline: boolean): string {
    return isOnline ? t("chat.userStatus.online") : t("chat.userStatus.offline");
  }

  public onDestroy(): void {
    if (this.refreshTimer !== null) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.chatSocket?.disconnect();
    this.chatSocket = null;
  }
}
