import { AbstractComponent } from '../../core/Component';

export interface ChatMessage {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
  isMe: boolean;
  isInvite?: boolean; 
}

export class MessageBubble extends AbstractComponent {
  constructor(message: ChatMessage, onAcceptInvite?: () => void) {
    super('div', 'flex w-full mb-4');

    
    const alignment = message.isMe ? 'justify-end' : 'justify-start';
    this.element.classList.add(alignment);

    
    const bubble = document.createElement('div');
    const color = message.isMe 
      ? 'bg-blue-600 text-white rounded-br-none' 
      : 'bg-gray-700 text-gray-200 rounded-bl-none';
    
    bubble.className = `max-w-[70%] px-4 py-2 rounded-2xl shadow-md ${color}`;

    
    const text = document.createElement('p');
    text.textContent = message.content;
    bubble.appendChild(text);

    
    if (message.isInvite && !message.isMe) {
      const inviteBtn = document.createElement('button');
      inviteBtn.className = 'mt-2 w-full bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-1 px-2 rounded';
      inviteBtn.textContent = 'ACCEPT GAME';
      inviteBtn.onclick = () => onAcceptInvite?.();
      bubble.appendChild(inviteBtn);
    }

    
    const time = document.createElement('span');
    time.className = 'text-[10px] opacity-70 block text-right mt-1';
    time.textContent = message.timestamp;
    bubble.appendChild(time);

    this.element.appendChild(bubble);
  }

  public render(): void {}
}