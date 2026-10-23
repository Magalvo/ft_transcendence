import { AbstractComponent } from '../../core/Component';

import { escapeHtml } from '../../shared/utils';
interface ChatContact {
  id: number;
  username: string;
  avatar: string;
  status: 'online' | 'offline' | 'ingame';
  unread: number;
}

export class ChatList extends AbstractComponent {
  private onSelect: (contact: ChatContact) => void;

  constructor(contacts: ChatContact[], onSelect: (c: ChatContact) => void) {
    super('div', 'w-full md:w-1/3 bg-gray-800 border-r border-gray-700 flex flex-col h-[calc(100vh-64px)]'); 
    this.onSelect = onSelect;
    this.renderList(contacts);
  }

  private renderList(contacts: ChatContact[]) {
    const listContainer = document.createElement('div');
    listContainer.className = 'overflow-y-auto flex-1';

    contacts.forEach(contact => {
      const item = document.createElement('div');
      item.className = 'flex items-center p-4 cursor-pointer hover:bg-gray-700 transition border-b border-gray-700/50';
      
      
      item.innerHTML = `
        <div class="relative mr-4">
          <img src="${escapeHtml(contact.avatar)}" class="w-10 h-10 rounded-full object-cover">
          <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 
            ${contact.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}"></span>
        </div>
        <div class="flex-1">
          <h4 class="font-bold text-sm text-white">${escapeHtml(contact.username)}</h4>
          <p class="text-xs text-gray-400">Click to chat</p>
        </div>
        ${contact.unread > 0 ? `<span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">${contact.unread}</span>` : ''}
      `;

      item.onclick = () => {
        this.onSelect(contact);
        
      };

      listContainer.appendChild(item);
    });

    this.element.appendChild(listContainer);
  }

  public render(): void {}
}
