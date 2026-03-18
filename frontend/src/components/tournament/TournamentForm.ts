import { AbstractComponent } from '../../core/Component';
import { Button } from '../ui/Button';
import { UserStore } from '../../core/UserStore';

export interface TournamentParticipant {
  id: string;
  username: string;
  isAI: boolean;
}

export class TournamentForm extends AbstractComponent {
  private selectedPlayers: TournamentParticipant[] = [];
  private playerSlots: Map<number, TournamentParticipant | null> = new Map();
  private onSubmit: (participants: TournamentParticipant[]) => void;
  private friendsDropdown: HTMLSelectElement | null = null;

  constructor(onSubmit: (participants: TournamentParticipant[]) => void) {
    super('div', 'bg-gray-800 p-8 rounded-xl shadow-2xl max-w-2xl w-full mx-auto');
    this.onSubmit = onSubmit;
    for (let i = 0; i < 4; i++) {
      this.playerSlots.set(i, null);
    }

    // Auto-add current user as participant if available
    const currentUser = UserStore.getUser();
    if (currentUser) {
      const selfParticipant: TournamentParticipant = {
        id: currentUser.id,
        username: currentUser.username,
        isAI: false,
      };
      this.selectedPlayers.push(selfParticipant);
      this.playerSlots.set(0, selfParticipant);
    }
  }

  public render(): void {
    this.element.innerHTML = ''; 

    
    const title = document.createElement('h2');
    title.className = 'text-3xl font-bold text-center mb-2 text-blue-400 tracking-wider';
    title.textContent = 'TOURNAMENT REGISTRATION';
    this.element.appendChild(title);

    
    const subtitle = document.createElement('p');
    subtitle.className = 'text-gray-400 text-center mb-8 text-sm';
    subtitle.textContent = 'Invite friends or add AI opponents to create a 4-player tournament.';
    this.element.appendChild(subtitle);

    // Friend selection
    const friendsSection = document.createElement('div');
    friendsSection.className = 'mb-8';
    
    const friendsLabel = document.createElement('label');
    friendsLabel.className = 'block text-sm font-semibold text-gray-300 mb-3';
    friendsLabel.textContent = 'Select Friends:';
    friendsSection.appendChild(friendsLabel);

    const currentUser = UserStore.getUser();
    const friends = currentUser?.friends || [];
    
    this.friendsDropdown = document.createElement('select');
    this.friendsDropdown.className = 'w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white mb-3';
    this.friendsDropdown.innerHTML = '<option value="">-- Select a Friend --</option>';
    
    friends.forEach(friend => {
      const option = document.createElement('option');
      option.value = friend.id;
      option.textContent = `${friend.username} (${friend.status})`;
      this.friendsDropdown!.appendChild(option);
    });

    friendsSection.appendChild(this.friendsDropdown);

    // Add self button
    const addSelfBtn = new Button('ADD MYSELF', () => this.addSelf(), 'secondary');
    addSelfBtn.getElement().classList.add('w-full', 'py-2', 'text-sm', 'mb-4');
    addSelfBtn.render();
    friendsSection.appendChild(addSelfBtn.getElement());

    // Add friend button
    const addFriendBtn = new Button('ADD FRIEND', () => this.addFriend(), 'primary');
    addFriendBtn.getElement().classList.add('w-full', 'py-2', 'text-sm', 'mb-4');
    addFriendBtn.render();
    friendsSection.appendChild(addFriendBtn.getElement());

    // Add AI button
    const addAIBtn = new Button('ADD AI OPPONENT', () => this.addAI(), 'secondary');
    addAIBtn.getElement().classList.add('w-full', 'py-2', 'text-sm');
    addAIBtn.render();
    friendsSection.appendChild(addAIBtn.getElement());

    this.element.appendChild(friendsSection);

    // Selected players display
    const selectedSection = document.createElement('div');
    selectedSection.className = 'mb-8';
    
    const selectedLabel = document.createElement('label');
    selectedLabel.className = 'block text-sm font-semibold text-gray-300 mb-3';
    selectedLabel.textContent = `Tournament Participants (${this.selectedPlayers.length}/4):`;
    selectedSection.appendChild(selectedLabel);

    const playersList = document.createElement('div');
    playersList.className = 'space-y-2 mb-4 bg-gray-700 p-4 rounded min-h-32';
    
    this.playerSlots.forEach((player, index) => {
      const playerItem = document.createElement('div');
      playerItem.className = 'flex justify-between items-center bg-gray-600 p-3 rounded';
      
      const nameSpan = document.createElement('span');
      if (player) {
        nameSpan.textContent = `${index + 1}. ${player.username}${player.isAI ? ' (AI)' : ''}`;
        nameSpan.className = 'text-white';
      } else {
        nameSpan.textContent = `${index + 1}. Empty Slot`;
        nameSpan.className = 'text-gray-400';
      }
      playerItem.appendChild(nameSpan);

      if (player) {
        const currentUser = UserStore.getUser();
        const isSelf = currentUser && player.id === currentUser.id;
        if (!isSelf) {
          const removeBtn = document.createElement('button');
          removeBtn.textContent = '×';
          removeBtn.className = 'text-red-400 hover:text-red-200 font-bold text-lg';
          removeBtn.onclick = () => {
            this.playerSlots.set(index, null);
            this.selectedPlayers = this.selectedPlayers.filter(p => p.id !== player.id);
            this.render();
          };
          playerItem.appendChild(removeBtn);
        }
      }
      
      playersList.appendChild(playerItem);
    });
    
    selectedSection.appendChild(playersList);
    this.element.appendChild(selectedSection);

    
    const startBtn = new Button('GENERATE BRACKET', () => this.handleStart(), 'primary');
    startBtn.getElement().classList.add('w-full', 'py-3', 'text-lg'); 
    startBtn.render();
    
    if (this.selectedPlayers.length < 4) {
      (startBtn.getElement() as HTMLButtonElement).disabled = true;
      startBtn.getElement().classList.add('opacity-50', 'cursor-not-allowed');
    }
    
    this.element.appendChild(startBtn.getElement());

    // Add info text
    const infoText = document.createElement('p');
    infoText.className = 'text-gray-500 text-xs text-center mt-4';
    infoText.textContent = 'You must select exactly 4 participants to start a tournament.';
    this.element.appendChild(infoText);
  }

  private addFriend(): void {
    if (!this.friendsDropdown?.value) {
      alert('Please select a friend');
      return;
    }

    const friends = UserStore.getUser()?.friends || [];
    const selectedFriend = friends.find(f => f.id === this.friendsDropdown!.value);
    
    if (!selectedFriend) return;

    // Check if already added
    if (this.selectedPlayers.some(p => p.id === selectedFriend.id)) {
      alert('This friend is already in the tournament');
      return;
    }

    if (this.selectedPlayers.length >= 4) {
      alert('Tournament is full (4 players max)');
      return;
    }

    this.selectedPlayers.push({
      id: selectedFriend.id,
      username: selectedFriend.username,
      isAI: false
    });

    // Find first empty slot and add player
    for (let i = 0; i < 4; i++) {
      if (!this.playerSlots.get(i)) {
        this.playerSlots.set(i, this.selectedPlayers[this.selectedPlayers.length - 1]);
        break;
      }
    }

    this.friendsDropdown!.value = '';
    this.render();
  }

  private addSelf(): void {
    const currentUser = UserStore.getUser();
    if (!currentUser) {
      alert('No user is currently logged in');
      return;
    }

    if (this.selectedPlayers.some(p => p.id === currentUser.id)) {
      alert('You are already added to the tournament');
      return;
    }

    if (this.selectedPlayers.length >= 4) {
      alert('Tournament is full (4 players max)');
      return;
    }

    const selfParticipant: TournamentParticipant = {
      id: currentUser.id,
      username: currentUser.username,
      isAI: false,
    };

    this.selectedPlayers.push(selfParticipant);

    // Find first empty slot and add player
    for (let i = 0; i < 4; i++) {
      if (!this.playerSlots.get(i)) {
        this.playerSlots.set(i, selfParticipant);
        break;
      }
    }

    this.render();
  }

  private addAI(): void {
    if (this.selectedPlayers.length >= 4) {
      alert('Tournament is full (4 players max)');
      return;
    }

    const aiPlayer: TournamentParticipant = {
      id: `ai-${Math.random().toString(36).substr(2, 9)}`,
      username: `AI Bot ${this.selectedPlayers.filter(p => p.isAI).length + 1}`,
      isAI: true
    };

    this.selectedPlayers.push(aiPlayer);

    // Find first empty slot and add player
    for (let i = 0; i < 4; i++) {
      if (!this.playerSlots.get(i)) {
        this.playerSlots.set(i, aiPlayer);
        break;
      }
    }

    this.render();
  }

  private handleStart(): void {
    if (this.selectedPlayers.length !== 4) {
      alert('You must select exactly 4 players');
      return;
    }

    this.onSubmit(this.selectedPlayers);
  }
}