import { AbstractComponent } from "../core/Component";
import { Navbar } from "../components/layout/Navbar";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { UserService } from "../services/UserService";
import type { UserProfile } from "../core/UserStore";
import { HyperspeedWrapper } from "../components/ui/HyperspeedWrapper";
import { hyperspeedPresets } from "../components/react/HyperspeedPresets";
import { router } from "../main";

export class DashboardPage extends AbstractComponent {
  constructor() {
    super("div", "min-h-screen relative text-white");
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
    container.className = "container mx-auto p-6 mt-16 relative z-10";

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "flex gap-3 mb-6";

    const findGameBtn = new Button(
      "🔍 Find Game",
      () => {
        router.navigate("/find-game");
      },
      "primary",
    );

    const createLobbyBtn = new Button(
      "➕ Create Lobby",
      () => {
        router.navigate("/find-game");
      },
      "secondary",
    );

    actionsDiv.appendChild(findGameBtn.getElement());
    actionsDiv.appendChild(createLobbyBtn.getElement());
    container.appendChild(actionsDiv);

    const gridDiv = document.createElement("div");
    gridDiv.className = "grid grid-cols-1 md:grid-cols-3 gap-6";

    const user = await UserService.getProfile(true);

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

    gridDiv.appendChild(leftColumn);
    gridDiv.appendChild(rightColumn);
    container.appendChild(gridDiv);
    this.element.appendChild(container);
  }

  createActionCard = (
    title: string,
    desc: string,
    btnText: string,
    path: string,
    color: string,
  ) => {
    const card = new Card(
      "hover:transform hover:-translate-y-2 transition duration-300 border-t-4 " +
        color,
    );

    const content = document.createElement("div");
    content.className = "text-center p-4";
    content.innerHTML = `
            <h3 class="text-2xl font-bold mb-2">${title}</h3>
            <p class="text-gray-400 mb-6 h-12">${desc}</p>
        `;

    const btn = new Button(
      btnText,
      () => {
        router.navigate(path);
      },
      "primary",
    );
    btn.getElement().classList.add("w-full");

    card.getElement().appendChild(content);
    card.addChildren(btn);
    return card;
  };

  playCard = this.createActionCard(
    "Find Match",
    "Jump straight into a classic 1v1 pong game against AI or Local.",
    "PLAY NOW",
    "/find-game",
    "border-blue-500",
  );
  tournCard = this.createActionCard(
    "Create Match",
    "Create a bracket and challenge 3 friends to a championship.",
    "ORGANIZE",
    "/find-game",
    "border-purple-500",
  );

  // --- Sub-Component Builders ---

  private buildProfileCard(user: UserProfile): Card {
    const card = new Card("flex flex-col items-center text-center space-y-4");

    const img = document.createElement("img");
    img.src = user.avatarUrl || "https://via.placeholder.com/128";
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

    // Show last 5 matches (most recent first)
    const recentMatches = user.matches.slice().reverse().slice(0, 5);

    recentMatches.forEach((match) => {
      const li = document.createElement("li");
      li.className =
        "flex justify-between items-center bg-gray-800 p-3 rounded hover:bg-gray-700 transition";
      const isWin = match.result === "WIN";

      // Format date to be more readable
      const matchDate = new Date(match.date);
      const formattedDate = matchDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      li.innerHTML = `
            <div class="flex items-center gap-3 flex-1">
                <div class="w-2 h-2 rounded-full ${isWin ? "bg-green-500" : "bg-red-500"}"></div>
                <div class="flex flex-col">
                    <span class="font-bold">${match.opponent}</span>
                    <span class="text-xs text-gray-500">${formattedDate}</span>
                </div>
            </div>
            <span class="font-mono font-bold ${isWin ? "text-green-400" : "text-red-400"}">
                ${match.score}
            </span>
            <span class="ml-2 text-sm font-semibold ${isWin ? "text-green-400" : "text-red-400"}">
                ${isWin ? "W" : "L"}
            </span>
        `;
      list.appendChild(li);
    });

    card.getElement().appendChild(list);

    // Show info if there are more matches
    if (user.matches.length > 5) {
      const viewMore = document.createElement("div");
      viewMore.className = "mt-4 text-center";
      viewMore.innerHTML = `<span class="text-sm text-gray-400">Showing last 5 of ${user.matches.length} matches</span>`;
      card.getElement().appendChild(viewMore);
    }

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
