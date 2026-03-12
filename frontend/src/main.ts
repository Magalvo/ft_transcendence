import './style.css';


import { Router } from './core/Router';

import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { GamePage } from './pages/Game';
import { TournamentPage } from './pages/Tournament';
import { HomePage } from './pages/Home';
import { ProfilePage } from './pages/Profile';
import { LobbyPage } from './pages/Lobby';
import { ChatPage } from './pages/Chat';
import { TokenManager } from './services/TokenManager';
import { FindGamePage } from './pages/FindGame'
import { TermsPage } from './pages/Terms';
import { PrivacyPage } from './pages/Privacy';

//? Initialize Router
const router = new Router('#app');

//? Define Routes
router.addRoute('/', HomePage);
router.addRoute('/profile', ProfilePage);
router.addRoute('/login', LoginPage);
router.addRoute('/dashboard', DashboardPage);
router.addRoute('/game', GamePage);
router.addRoute('/lobby', LobbyPage);
router.addRoute('/chat', ChatPage);
router.addRoute('/find-game', FindGamePage);
router.addRoute('/tournament', TournamentPage);
router.addRoute('/terms', TermsPage);
router.addRoute('/privacy', PrivacyPage);

const publicRoutes = ['/login', '/404', '/terms', '/privacy'];

if (!TokenManager.isAuthenticated() && !publicRoutes.includes(window.location.pathname)) {
  // If we want to enforce login immediately:
  window.history.replaceState({}, '', '/login');
}

// 5. Start the App
router.init();

// Export for debugging purposes if needed
export { router };
