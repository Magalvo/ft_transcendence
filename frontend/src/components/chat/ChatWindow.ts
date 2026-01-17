import { AbstractComponent } from '../../core/Component';
import { MessageBubble, ChatMessage } from './MessageBubble';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export class ChatWindow extends AbstractComponent {
  private messagesContainer: HTMLElement;
  private currentMessages: ChatMessage[] = [];

  constructor(username: string) {
    super('div', 'flex-1 flex flex-col h-[calc(100vh-64px)] bg-gray-900');

    
    const header = document.createElement('div');
    header.className = 'p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800';
    header.innerHTML = `<h3 class="font-bold text-lg">Chat with ${username}</h3>`;

    const actions = document.createElement('div');
    actions.className = 'flex gap-2';
    
    
    const inviteBtn = new Button('Invite to Pong', () => this.sendInvite(), 'primary');
    
    const blockBtn = new Button('Block', () => console.log('Block user'), 'danger');
    
    
    inviteBtn.render();
    blockBtn.render();
    
    
    actions.appendChild(inviteBtn.getElement());
    actions.appendChild(blockBtn.getElement());
    header.appendChild(actions);

    
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.className = 'flex-1 overflow-y-auto p-4 space-y-2';

    
    const inputArea = document.createElement('div');
    inputArea.className = 'p-4 bg-gray-800 border-t border-gray-700 flex gap-2';
    
    const input = new Input('Type a message...', 'text');
    
    input.getElement().classList.remove('mb-4'); 
    input.getElement().className += ' flex-1';

    const sendBtn = new Button('Send', () => {
       const val = input.getValue();
       if(val) this.addMessage(val, true);
    });
    sendBtn.render();

    inputArea.appendChild(input.getElement());
    inputArea.appendChild(sendBtn.getElement());

    this.element.appendChild(header);
    this.element.appendChild(this.messagesContainer);
    this.element.appendChild(inputArea);
  }

  public addMessage(content: string, isMe: boolean, isInvite: boolean = false) {
    const msg: ChatMessage = {
      id: Date.now(),
      sender: isMe ? 'Me' : 'Them',
      content,
      timestamp: new Date().toLocaleTimeString(),
      isMe,
      isInvite
    };
    
    const bubble = new MessageBubble(msg, () => {
        console.log("Redirecting to Game...");
        window.location.hash = '/game';
    });
    bubble.render();
    this.messagesContainer.appendChild(bubble.getElement());
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private sendInvite() {
    this.addMessage("I challenged you to a match!", true, true);
  }

  public render(): void {}
}