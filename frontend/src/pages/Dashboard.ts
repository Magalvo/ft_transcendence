import { AbstractComponent } from "../core/Component";
import { Navbar } from "../components/layout/Navbar";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { UserService, UserProfile } from "../services/UserService";
import { HyperspeedWrapper } from '../components/ui/HyperspeedWrapper';
import { hyperspeedPresets } from '../components/react/HyperspeedPresets';

export class DashboardPage extends AbstractComponent {
  constructor() {
    super("div", "min-h-screen relative overflow-hidden text-white");
  }

  public async render(): Promise<void> {
    this.element.innerHTML = "";

    const bg = new HyperspeedWrapper(hyperspeedPresets.two);
    bg.render();
    this.element.appendChild(bg.getElement());

    const navbar = new Navbar();
    navbar.render();
    this.element.appendChild(navbar.getElement());

    const container = document.createElement("div");
    container.className =
      "container mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6 mt-16";

    const user = await UserService.getProfile();

    const profileCard = this.buildProfileCard(user);
    const statsCard = this.buildStatsCard(user);
    const historyCard = this.buildHistoryCard(user);
    const friendsCard = this.buildFriendsCard(user);

    const leftColumn = document.createElement("div");
    leftColumn.className = "space-y-6";
    leftColumn.appendChild(profileCard.getElement());
    leftColumn.appendChild(friendsCard.getElement());

    const rightColumn = document.createElement("div");
    rightColumn.className = "md:col-span-2 space-y-6";
    rightColumn.appendChild(statsCard.getElement());
    rightColumn.appendChild(historyCard.getElement());

    container.appendChild(leftColumn);
    container.appendChild(rightColumn);
    this.element.appendChild(container);
  }

  // --- Sub-Component Builders ---

  private buildProfileCard(user: UserProfile): Card {
    const card = new Card("flex flex-col items-center text-center space-y-4");

    const img = document.createElement("img");
    img.src = user.avatarUrl;
    img.className =
      "w-32 h-32 rounded-full border-4 border-blue-500 object-cover";

    const name = document.createElement("h2");
    name.className = "text-2xl font-bold";
    name.textContent = user.username;

    const status = document.createElement("span");
    status.className =
      "px-3 py-1 rounded-full text-sm bg-green-900 text-green-300";
    status.textContent = `• ${user.status.toUpperCase()}`;

    const editBtn = new Button(
      "Edit Profile",
      () => console.log("Open Edit Modal"),
      "secondary",
    );

    card.getElement().appendChild(img);
    card.getElement().appendChild(name);
    card.getElement().appendChild(status);
    card.addChildren(editBtn);

    return card;
  }

  private buildStatsCard(user: UserProfile): Card {
    const card = new Card("flex justify-around items-center py-8");

    const createStat = (label: string, value: number, color: string) => {
      const div = document.createElement("div");
      div.className = "text-center";
      div.innerHTML = `
            <div class="text-4xl font-bold ${color}">${value}</div>
            <div class="text-gray-400 text-sm uppercase tracking-wide">${label}</div>
        `;
      return div;
    };

    card
      .getElement()
      .appendChild(createStat("Wins", user.wins, "text-green-500"));
    card
      .getElement()
      .appendChild(createStat("Losses", user.losses, "text-red-500"));

    const total = user.wins + user.losses;
    const ratio = total === 0 ? 0 : Math.round((user.wins / total) * 100);
    card
      .getElement()
      .appendChild(createStat("Win Rate", ratio, "text-blue-500")).innerHTML +=
      '<span class="text-xl">%</span>';

    return card;
  }

  private buildHistoryCard(user: UserProfile): Card {
    const card = new Card();
    const title = document.createElement("h3");
    title.className = "text-xl font-bold mb-4 border-b border-gray-700 pb-2";
    title.textContent = "Match History";
    card.getElement().appendChild(title);

    if (user.matches.length === 0) {
      card.getElement().innerHTML +=
        '<div class="text-gray-500">No matches played yet.</div>';
      return card;
    }

    const list = document.createElement("ul");
    list.className = "space-y-3";

    user.matches.forEach((match) => {
      const li = document.createElement("li");
      li.className =
        "flex justify-between items-center bg-gray-800 p-3 rounded hover:bg-gray-700 transition";
      const isWin = match.result === "WIN";

      li.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full ${isWin ? "bg-green-500" : "bg-red-500"}"></div>
                <span class="font-bold">${match.opponent}</span>
            </div>
            <div class="flex items-center gap-4">
                <span class="text-sm text-gray-400">${match.date}</span>
                <span class="font-mono font-bold ${isWin ? "text-green-400" : "text-red-400"}">
                    ${match.score}
                </span>
            </div>
        `;
      list.appendChild(li);
    });

    card.getElement().appendChild(list);
    return card;
  }

  private buildFriendsCard(user: UserProfile): Card {
    const card = new Card();
    card.getElement().innerHTML =
      '<h3 class="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Friends</h3>';

    const list = document.createElement("ul");
    list.className = "space-y-2";

    user.friends.forEach((friend) => {
      const li = document.createElement("li");
      li.className = "flex justify-between items-center text-sm";
      const isOnline = friend.status === "online";

      li.innerHTML = `
            <span>${friend.username}</span>
            <span class="w-3 h-3 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-500"}" 
                  title="${friend.status}"></span>
        `;
      list.appendChild(li);
    });

    card.getElement().appendChild(list);
    return card;
  }
}
