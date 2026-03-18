import { AbstractComponent } from '../core/Component';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { UserService } from '../services/UserService';
import AuthService from '../services/AuthService';
import type { UserProfile, Match, Friend } from '../core/UserStore';

export class ProfilePage extends AbstractComponent {
  constructor() {
    super('div', 'min-h-screen bg-gray-900 text-white');
  }

  public async render(): Promise<void> {
    this.element.innerHTML = '';


    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());


    const user = await UserService.getProfile(true);
    const incomingRequests = await UserService.getIncomingFriendRequests();


    const container = document.createElement('div');
    container.className = 'container mx-auto p-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8';


    const identityCard = this.buildIdentityCard(user);


    const contentColumn = document.createElement('div');
    contentColumn.className = 'lg:col-span-2 space-y-8';

    const statsCard = this.buildStatsCard(user);
    const friendsCard = this.buildFriendsCard(user.friends || [], incomingRequests);
    const securityCard = this.buildSecurityCard(user);
    const historyCard = this.buildHistoryCard(user.matches);

    contentColumn.appendChild(statsCard.getElement());
    contentColumn.appendChild(securityCard.getElement());
    contentColumn.appendChild(friendsCard.getElement());
    contentColumn.appendChild(historyCard.getElement());

    container.appendChild(identityCard.getElement());
    container.appendChild(contentColumn);

    this.element.appendChild(container);
  }

  // --- Sub-Components ---

  private buildIdentityCard(user: Omit<UserProfile, 'avatarUrl'> & { avatarUrl?: string }): Card {
    const card = new Card('flex flex-col items-center text-center p-8');


    const avatarWrapper = document.createElement('div');
    avatarWrapper.className = 'relative group w-32 h-32 mb-4 cursor-pointer';

    const img = document.createElement('img');
    img.src = user.avatarUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.username);
    img.className = 'w-full h-full rounded-full object-cover border-4 border-blue-500 shadow-lg';

    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200';
    overlay.innerHTML = '<span class="text-xs font-bold">CHANGE</span>';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'hidden';
    fileInput.onchange = async (e: any) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const newUrl = await UserService.updateAvatar(e.target.files[0]);
                img.src = newUrl;
                console.log('Avatar updated successfully');
            } catch (error) {
                console.error('Failed to update avatar:', error);
                alert('Failed to upload avatar');
            }
        }
    };

    avatarWrapper.onclick = () => fileInput.click();
    avatarWrapper.appendChild(img);
    avatarWrapper.appendChild(overlay);

    // User
    const nameContainer = document.createElement('div');
    nameContainer.className = 'flex items-center gap-2 justify-center mb-2';

    const name = document.createElement('h2');
    name.className = 'text-2xl font-bold';
    name.innerText = user.username;

    const editBtn = document.createElement('button');
    editBtn.className = 'text-gray-400 hover:text-blue-400 transition p-1';
    editBtn.innerHTML = '✏️';
    editBtn.click = () => this.showEditUsernameModal(user, name);
    editBtn.onclick = () => this.showEditUsernameModal(user, name);

    nameContainer.appendChild(name);
    nameContainer.appendChild(editBtn);

    const email = document.createElement('p');
    email.className = 'text-gray-400 text-sm mb-4';
    email.innerText = user.email;

    const statusBadge = document.createElement('div');
    const statusColor = user.status === 'online' ? 'bg-green-500' : user.status === 'ingame' ? 'bg-blue-500' : 'bg-gray-500';
    statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-opacity-20 text-white border ${statusColor} border-opacity-50 flex items-center gap-2`;
    statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full ${statusColor}"></span> ${user.status}`;

    card.getElement().appendChild(avatarWrapper);
    card.getElement().appendChild(nameContainer);
    card.getElement().appendChild(email);
    card.getElement().appendChild(statusBadge);
    card.getElement().appendChild(fileInput);

    return card;
  }

  private buildStatsCard(user: Omit<UserProfile, 'avatarUrl'> & { avatarUrl?: string }): Card {
    const card = new Card('grid grid-cols-3 gap-4 text-center py-6');

    const statItem = (label: string, value: string | number, colorClass: string) => `
        <div>
            <div class="text-3xl font-black ${colorClass}">${value}</div>
            <div class="text-xs text-gray-500 uppercase font-bold mt-1">${label}</div>
        </div>
    `;

    card.getElement().innerHTML = `
        ${statItem('Wins', user.stats.wins, 'text-green-400')}
        ${statItem('Losses', user.stats.losses, 'text-red-400')}
        ${statItem('Rank', user.stats.rank || 'Unranked', 'text-yellow-400')}
    `;
    return card;
  }

  private buildSecurityCard(user: UserProfile): Card {
    const card = new Card('p-0 overflow-hidden');

    const header = document.createElement('div');
    header.className = 'p-4 bg-gray-800 border-b border-gray-700 font-bold flex items-center justify-between';
    header.innerHTML = `
      <span>Security &amp; 2FA</span>
      <span class="text-xs px-2 py-1 rounded-full ${user.twoFactorEnabled ? 'bg-green-600 text-green-50' : 'bg-yellow-600 text-yellow-50'}">
        ${user.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}
      </span>
    `;

    const body = document.createElement('div');
    body.className = 'p-4 space-y-4';

    const description = document.createElement('p');
    description.className = 'text-sm text-gray-300';
    description.innerText = 'Protect your account by requiring a one-time code from an authenticator app when you sign in.';

    const statusText = document.createElement('p');
    statusText.className = 'text-sm';
    statusText.innerHTML = user.twoFactorEnabled
      ? '<span class="text-green-400 font-semibold">Two-Factor Authentication is currently enabled on your account.</span>'
      : '<span class="text-yellow-400 font-semibold">Two-Factor Authentication is not enabled yet.</span>';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'mt-2 flex flex-wrap gap-3 items-center';

    const enableBtn = document.createElement('button');
    enableBtn.className = 'inline-flex items-center px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';
    enableBtn.innerText = user.twoFactorEnabled ? 'Reconfigure 2FA' : 'Enable 2FA';

    const disableBtn = document.createElement('button');
    disableBtn.className = 'inline-flex items-center px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';
    disableBtn.innerText = 'Disable 2FA';
    disableBtn.disabled = !user.twoFactorEnabled;

    const qrContainer = document.createElement('div');
    qrContainer.className = 'mt-4 hidden flex-col items-center gap-3';

    const qrImage = document.createElement('img');
    qrImage.className = 'w-40 h-40 rounded-lg border border-gray-700 bg-gray-900 object-contain';

    const secretText = document.createElement('p');
    secretText.className = 'text-xs text-gray-400 break-all text-center';

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.maxLength = 6;
    codeInput.placeholder = 'Enter 6-digit code';
    codeInput.className = 'mt-2 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-white w-full max-w-xs text-center tracking-widest';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'mt-2 inline-flex items-center px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed';
    confirmBtn.innerText = 'Confirm & Enable';

    const errorText = document.createElement('p');
    errorText.className = 'mt-2 text-xs text-red-400 hidden';

    const infoText = document.createElement('p');
    infoText.className = 'text-xs text-gray-400 mt-2 text-center';
    infoText.innerText = 'Scan the QR code with Google Authenticator, Authy, or another TOTP app, then enter the 6-digit code to confirm.';

    let setupInProgress = false;

    disableBtn.onclick = async () => {
      if (!user.twoFactorEnabled) return;
      if (!confirm('Are you sure you want to disable Two-Factor Authentication?')) {
        return;
      }

      disableBtn.disabled = true;

      try {
        await AuthService.disable2FA();
        await UserService.refreshProfile();
        alert('Two-Factor Authentication has been disabled.');
        void this.render();
      } catch (err: any) {
        console.error('Failed to disable 2FA:', err);
        alert(err?.message || 'Failed to disable 2FA');
        disableBtn.disabled = false;
      }
    };

    enableBtn.onclick = async () => {
      if (setupInProgress) return;
      setupInProgress = true;
      enableBtn.disabled = true;
      enableBtn.innerText = 'Generating…';
      errorText.classList.add('hidden');

      try {
        const result = await AuthService.setup2FA();
        qrImage.src = result.qr;
        secretText.innerText = `Secret: ${result.secret}`;
        qrContainer.classList.remove('hidden');
        qrContainer.classList.add('flex');
        enableBtn.innerText = 'Regenerate QR';
      } catch (err: any) {
        const msg = err?.message || 'Failed to start 2FA setup';
        errorText.innerText = msg;
        errorText.classList.remove('hidden');
        enableBtn.disabled = false;
        enableBtn.innerText = user.twoFactorEnabled ? 'Reconfigure 2FA' : 'Enable 2FA';
        setupInProgress = false;
        return;
      }

      setupInProgress = false;
      enableBtn.disabled = false;
    };

    confirmBtn.onclick = async () => {
      const code = codeInput.value.trim();
      if (code.length !== 6) {
        errorText.innerText = 'Please enter the 6-digit code from your authenticator app.';
        errorText.classList.remove('hidden');
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Verifying…';
      errorText.classList.add('hidden');

      try {
        await AuthService.verify2FASetup(code);
      } catch (err: any) {
        const msg = err?.message || 'Invalid 2FA code';
        errorText.innerText = msg;
        errorText.classList.remove('hidden');
        confirmBtn.disabled = false;
        confirmBtn.innerText = 'Confirm & Enable';
        return;
      }

      // Refresh full profile to show updated state
      try {
        await UserService.refreshProfile();
        alert('Two-Factor Authentication enabled successfully!');
        void this.render();
      } catch (err: any) {
        console.error('Failed to refresh profile after enabling 2FA:', err);
      }
    };

    qrContainer.appendChild(qrImage);
    qrContainer.appendChild(secretText);
    qrContainer.appendChild(codeInput);
    qrContainer.appendChild(confirmBtn);
    qrContainer.appendChild(infoText);
    qrContainer.appendChild(errorText);

    buttonRow.appendChild(enableBtn);
    buttonRow.appendChild(disableBtn);

    body.appendChild(description);
    body.appendChild(statusText);
    body.appendChild(buttonRow);
    body.appendChild(qrContainer);

    card.getElement().appendChild(header);
    card.getElement().appendChild(body);

    return card;
  }

  private buildHistoryCard(matches: Match[]): Card {
    const card = new Card('p-0 overflow-hidden');

    const header = document.createElement('div');
    header.className = 'p-4 bg-gray-800 border-b border-gray-700 font-bold';
    header.innerText = 'Match History';

    const list = document.createElement('div');
    list.className = 'divide-y divide-gray-700';

    if (matches.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'p-8 text-center text-gray-500';
      emptyState.innerText = 'No matches played yet';
      list.appendChild(emptyState);
    } else {
      matches.forEach(match => {
        const row = document.createElement('div');
        row.className = 'p-4 flex justify-between items-center hover:bg-gray-800/50 transition';
        const isWin = match.result === 'WIN';

        row.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded bg-gray-700 flex items-center justify-center font-bold text-lg">
                    ${match.opponent.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div class="font-bold">${match.opponent}</div>
                    <div class="text-xs text-gray-500">${new Date(match.date).toLocaleDateString()}</div>
                </div>
            </div>
            <div class="text-right">
                <div class="font-mono font-bold text-lg ${isWin ? 'text-green-400' : 'text-red-400'}">
                    ${match.score}
                </div>
                <div class="text-[10px] uppercase font-bold tracking-wider ${isWin ? 'text-green-600' : 'text-red-600'}">
                    ${match.result}
                </div>
            </div>
        `;
        list.appendChild(row);
      });
    }

    card.getElement().appendChild(header);
    card.getElement().appendChild(list);
    return card;
  }

  private buildFriendsCard(
    friends: Friend[],
    incomingRequests: Array<{ id: number; requesterId: string; username: string; createdAt: number }>
  ): Card {
    const card = new Card('p-0 overflow-hidden');

    const header = document.createElement('div');
    header.className = 'p-4 bg-gray-800 border-b border-gray-700 font-bold';
    header.innerText = 'Friends';

    const controls = document.createElement('div');
    controls.className = 'p-4 border-b border-gray-700 flex gap-2';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add friend by username';
    input.className = 'flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none';

    const addBtn = document.createElement('button');
    addBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50';
    addBtn.innerText = 'Send';
    addBtn.onclick = async () => {
      const username = input.value.trim();
      if (!username) return;
      addBtn.disabled = true;
      addBtn.innerText = 'Sending...';
      try {
        await UserService.addFriend(username);
        input.value = '';
        alert('Friend request sent');
        await this.render();
      } catch (err: any) {
        alert(err?.message || 'Failed to add friend');
      } finally {
        addBtn.disabled = false;
        addBtn.innerText = 'Send';
      }
    };

    controls.appendChild(input);
    controls.appendChild(addBtn);

    const requestsSection = document.createElement('div');
    requestsSection.className = 'border-b border-gray-700';

    const requestsTitle = document.createElement('div');
    requestsTitle.className = 'px-4 py-3 text-sm font-semibold text-yellow-300 bg-gray-800/30';
    requestsTitle.innerText = 'Incoming Requests';
    requestsSection.appendChild(requestsTitle);

    const requestsList = document.createElement('div');
    requestsList.className = 'divide-y divide-gray-700';

    if (incomingRequests.length === 0) {
      const emptyReq = document.createElement('div');
      emptyReq.className = 'p-4 text-sm text-gray-500 text-center';
      emptyReq.innerText = 'No pending requests';
      requestsList.appendChild(emptyReq);
    } else {
      incomingRequests.forEach((request) => {
        const row = document.createElement('div');
        row.className = 'p-4 flex items-center justify-between gap-3';

        const left = document.createElement('span');
        left.className = 'font-semibold';
        left.innerText = request.username;

        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-2';

        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'px-3 py-1 bg-green-700 text-white rounded hover:bg-green-600 transition text-sm';
        acceptBtn.innerText = 'Confirm';
        acceptBtn.onclick = async () => {
          acceptBtn.disabled = true;
          try {
            await UserService.acceptFriendRequest(request.id);
            await this.render();
          } catch (err: any) {
            alert(err?.message || 'Failed to confirm request');
            acceptBtn.disabled = false;
          }
        };

        const declineBtn = document.createElement('button');
        declineBtn.className = 'px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition text-sm';
        declineBtn.innerText = 'Decline';
        declineBtn.onclick = async () => {
          declineBtn.disabled = true;
          try {
            await UserService.declineFriendRequest(request.id);
            await this.render();
          } catch (err: any) {
            alert(err?.message || 'Failed to decline request');
            declineBtn.disabled = false;
          }
        };

        actions.appendChild(acceptBtn);
        actions.appendChild(declineBtn);
        row.appendChild(left);
        row.appendChild(actions);
        requestsList.appendChild(row);
      });
    }

    requestsSection.appendChild(requestsList);

    const list = document.createElement('div');
    list.className = 'divide-y divide-gray-700';

    if (friends.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'p-6 text-center text-gray-500';
      emptyState.innerText = 'No friends yet';
      list.appendChild(emptyState);
    } else {
      friends.forEach((friend) => {
        const row = document.createElement('div');
        row.className = 'p-4 flex items-center justify-between hover:bg-gray-800/50 transition';
        const name = document.createElement('span');
        name.className = 'font-semibold';
        name.innerText = friend.username;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'px-3 py-1 bg-red-700 text-white rounded hover:bg-red-600 transition text-sm';
        removeBtn.innerText = 'Remove';
        removeBtn.onclick = async () => {
          removeBtn.disabled = true;
          try {
            await UserService.removeFriend(friend.id);
            await this.render();
          } catch (err: any) {
            alert(err?.message || 'Failed to remove friend');
            removeBtn.disabled = false;
          }
        };

        row.appendChild(name);
        row.appendChild(removeBtn);
        list.appendChild(row);
      });
    }

    card.getElement().appendChild(header);
    card.getElement().appendChild(controls);
    card.getElement().appendChild(requestsSection);
    card.getElement().appendChild(list);
    return card;
  }

  private showEditUsernameModal(user: any, nameElement: HTMLElement): void {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4 border border-gray-700';

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold mb-4 text-white';
    title.innerText = 'Edit Username';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none mb-4';
    input.placeholder = 'Enter new username';
    input.value = user.username;
    input.minLength = 3;
    input.maxLength = 20;

    const error = document.createElement('p');
    error.className = 'text-red-400 text-sm mb-4 hidden';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex gap-3 justify-end';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition';
    cancelBtn.innerText = 'Cancel';
    cancelBtn.onclick = () => modal.remove();

    const saveBtn = document.createElement('button');
    saveBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50';
    saveBtn.innerText = 'Save';
    saveBtn.onclick = async () => {
      const newUsername = input.value.trim();

      if (!newUsername) {
        error.innerText = 'Username cannot be empty';
        error.classList.remove('hidden');
        return;
      }

      if (newUsername.length < 3 || newUsername.length > 20) {
        error.innerText = 'Username must be between 3 and 20 characters';
        error.classList.remove('hidden');
        return;
      }

      if (newUsername === user.username) {
        modal.remove();
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerText = 'Saving...';

      try {
        const updated = await UserService.updateUsername(newUsername);
        nameElement.innerText = updated;
        modal.remove();
      } catch (err: any) {
        const errorMsg = err?.message || err?.toString?.() || 'Failed to update username';
        error.innerText = errorMsg;
        error.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save';
      }
    };

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(saveBtn);

    modalContent.appendChild(title);
    modalContent.appendChild(input);
    modalContent.appendChild(error);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    input.focus();
    input.select();
  }
}
