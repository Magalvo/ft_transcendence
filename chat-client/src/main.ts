import './styles/reset.css';
import './styles/tokens.css';
import './styles/index.scss';
import { apiClient } from './api';
import type { ChatMessage, User } from './types';

// Log mock mode
console.log('🧪 Mock API Mode Enabled');

// 1. State Management
const state = {
  currentUser: null as User | null,
  currentChatType: null as 'group' | 'private' | null,
  currentGroupId: null as number | null,
  currentPrivateChatId: null as number | null,
  groups: [] as any[], // Тут краще використати ваші типи з types.ts
  privateChats: [] as any[],
  ws: null as WebSocket | null,
};

// state is available in the DevTools console (only in DEV mode)
if (import.meta.env.DEV) {
  (window as any).state = state;
  console.log('DEBUG MODE: Enter “state” in the console to view the data.');
}

// 2. Global references to DOM elements (caching)
const elements = {
  get msgList() { return document.querySelector<HTMLOListElement>(".msg-list")! },
  get msgInput() { return document.getElementById("msg-content") as HTMLInputElement },
  get chatSelector() { return document.getElementById("chat-selector") as HTMLDivElement | null },
};

// --- RENDERING FUNCTIONS (Available everywhere) ---

function scrollToEnd() {
  elements.msgList.scrollTo(0, elements.msgList.scrollHeight);
}

function appendMsgNode(msg: ChatMessage) {
  // Перевірка на дублікати (якщо сервер поверне те ж повідомлення, що ми додали локально)
  if (document.getElementById(`msg-${msg.id_message}`)) return;

  const isMine = msg.sender_id === state.currentUser?.id;
  const prevSenderName = Array.from(elements.msgList.querySelectorAll(".msg__sender-name")).at(-1)?.textContent;

  const li = document.createElement("li");
  li.id = `msg-${msg.id_message}`;
  li.classList.add("msg");
  if (isMine) li.classList.add("mine");

  const msgContent = document.createElement("div");
  msgContent.classList.add("msg__content");
  if (isMine) msgContent.classList.add("mine");
  msgContent.textContent = msg.content;

  if (!prevSenderName || prevSenderName !== msg.sender_name) {
    const senderContainer = document.createElement("div");
    senderContainer.classList.add("msg__sender");

    const senderName = document.createElement("div");
    senderName.classList.add("msg__sender-name");
    senderName.textContent = msg.sender_name;

    const senderAvatar = document.createElement("img");
    senderAvatar.classList.add("msg__sender-avatar");
    senderAvatar.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${msg.sender_name}`;

    if (!isMine) senderContainer.appendChild(senderAvatar);
    senderContainer.appendChild(senderName);
    li.appendChild(senderContainer);
  }

  li.appendChild(msgContent);
  elements.msgList.appendChild(li);
}

function handleIncomingMessage(wsMessage: any) {
  // Creating a message object from WebSocket data
  const msg: ChatMessage = {
    id_message: wsMessage.id_message,
    sender_id: wsMessage.id_usersender,
    sender_name: wsMessage.sender_name,
    content: wsMessage.messagem,
    timestamp: wsMessage.timestamp || Date.now(),
    type: wsMessage.type === 'group_message' ? 'group' : 'private',
    group_id: wsMessage.id_group,
    private_chat_id: wsMessage.id_privatechat,
  };

  // Add to chat only if it is a currently open chat
  const isRelevant =
    (state.currentChatType === 'group' && msg.group_id === state.currentGroupId) ||
    (state.currentChatType === 'private' && msg.private_chat_id === state.currentPrivateChatId);

  if (isRelevant) {
    appendMsgNode(msg);
    scrollToEnd();
  }
}

// --- BASIC LOGIC ---

async function bootstrapChatClient(closePopover: () => void) {
  try {
    state.currentUser = await apiClient.getCurrentUser();

    // WebSocket initialization
    state.ws = new WebSocket("ws://localhost:5273");

    state.ws.onopen = () => {
      state.ws?.send(JSON.stringify({ type: "auth", userId: state.currentUser!.id }));
    };

    state.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "error") return console.error(data.error);
        handleIncomingMessage(data);
      } catch (e) { console.error(e); }
    };

    // Passing the close function on to the UI
    await loadChatUI(closePopover);
  } catch (error) {
    console.error("Bootstrap error:", error);
  }
}

async function loadChatUI(closePopover: () => void) {
  const formElm = document.getElementById("msg-form") as HTMLFormElement;
  const closeBtn = document.getElementById("close-btn") as HTMLButtonElement;

  // Loading chat lists
  state.groups = await apiClient.getGroups();
  state.privateChats = await apiClient.getPrivateChats();

  await renderChatSelector(elements.chatSelector);

  formElm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = elements.msgInput.value.trim();

    if (!content) {
      console.warn("Empty message");
      return;
    }

    if (!state.currentChatType) {
      alert("Please select a chat first!");
      console.warn("No chat selected");
      return;
    }

    try {
      let msg;
      if (state.currentChatType === 'group') {
        if (!state.currentGroupId) {
          alert("No group selected!");
          return;
        }
        msg = await apiClient.createGroupMessage(state.currentGroupId, state.currentUser!.id, content);
        console.log(`Message sent to group ${state.currentGroupId}`);
      } else {
        if (!state.currentPrivateChatId) {
          alert("No private chat selected!");
          return;
        }
        msg = await apiClient.createPrivateChatMessage(state.currentPrivateChatId, state.currentUser!.id, content);
        console.log(`Message sent to private chat ${state.currentPrivateChatId}`);
      }

      // Local display
      appendMsgNode({
        id_message: msg.id_message,
        sender_id: state.currentUser!.id,
        sender_name: state.currentUser!.username,
        content: content,
        timestamp: Date.now(),
        type: state.currentChatType
      });

      elements.msgInput.value = "";
      scrollToEnd();
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message");
    }
  });

  closeBtn.onclick = () => {
    state.ws?.close();
    closePopover();
  };
}

async function selectChat(type: 'group' | 'private', chatId: number) {
  state.currentChatType = type;
  state.currentGroupId = type === 'group' ? chatId : null;
  state.currentPrivateChatId = type === 'private' ? chatId : null;

  // Cleaning the list
  elements.msgList.innerHTML = '';

  try {
    // Loading history
    const messages = type === 'group'
      ? await apiClient.getGroupMessages(chatId)
      : await apiClient.getPrivateChatMessages(chatId);

    console.log(`Loaded ${messages.length} messages for ${type} chat ${chatId}`);

    messages.forEach((m: any) => {
      appendMsgNode({
        id_message: m.id_message,
        sender_id: m.id_usersender,
        sender_name: m.sender_name || `User ${m.id_usersender}`,
        content: m.messagem,
        timestamp: m.timestamp,
        type: type
      });
    });
    scrollToEnd();
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

// Rendering chat selection buttons
async function renderChatSelector(container: HTMLDivElement | null) {
  if (!container) {
    console.warn("Chat selector container not found");
    return;
  }

  container.innerHTML = '';
  console.log(`Rendering: ${state.groups.length} groups, ${state.privateChats.length} private chats`);

  // Groups
  if (state.groups.length > 0) {
    const groupsLabel = document.createElement("div");
    groupsLabel.style.cssText = "width: 100%; font-size: 11px; color: #666; font-weight: bold; margin-bottom: 5px;";
    groupsLabel.textContent = "Groups:";
    container.appendChild(groupsLabel);

    state.groups.forEach(g => {
      const b = document.createElement("button");
      b.style.cssText = "padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-size: 12px; background: #f0f0f0;";
      b.textContent = g.name;
      b.onclick = (e) => {
        e.preventDefault();
        selectChat('group', g.id_group);
        console.log(`Selected group: ${g.name} (${g.id_group})`);
      };
      container.appendChild(b);
    });
  }

  // Private chats
  if (state.privateChats.length > 0) {
    const privateLabel = document.createElement("div");
    privateLabel.style.cssText = "width: 100%; font-size: 11px; color: #666; font-weight: bold; margin-top: 8px; margin-bottom: 5px;";
    privateLabel.textContent = "Direct Messages:";
    container.appendChild(privateLabel);

    for (const chat of state.privateChats) {
      const otherUserId = chat.id_user1 === state.currentUser?.id ? chat.id_user2 : chat.id_user1;
      const otherUser = await apiClient.getUser(otherUserId);
      const b = document.createElement("button");
      b.style.cssText = "padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-size: 12px; background: #f0f0f0;";
      b.textContent = `${otherUser?.username || `User ${otherUserId}`}`;
      b.onclick = (e) => {
        e.preventDefault();
        selectChat('private', chat.id_privatechat);
        console.log(`Selected private chat: ${chat.id_privatechat}`);
      };
      container.appendChild(b);
    }
  } else {
    console.log("No private chats available");
  }

  console.log("Chat selector rendered");
}

// --- INITIALIZATION ---
function bootstrapPopover() {
  const trigger = document.getElementById("popover-trigger");
  const panel = document.getElementById("popover-panel");
  const container = document.getElementById("popover");

  if (!trigger || !panel || !container) {
    console.error("Popover elements not found!");
    return { close: () => {} };
  }

  const close = () => {
    container.removeAttribute("data-open");
    panel.removeAttribute("data-open");
    console.log("Popover closed");
  };

  const open = () => {
    container.setAttribute("data-open", "true");
    panel.setAttribute("data-open", "true");
    console.log("opover opened");
  };

  trigger.addEventListener("click", () => {
    const isOpen = container.getAttribute("data-open") === "true";
    if (isOpen) {
      close();
    } else {
      open();
    }
  });

  return { close };
}

const { close: closeFn } = bootstrapPopover();
bootstrapChatClient(closeFn);
