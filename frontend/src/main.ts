import './style.css';


import { setAppRouter } from './core/AppRouter';
import { Router } from './core/Router';

import { TokenManager } from './services/TokenManager';
import AuthService from './services/AuthService';
import { i18n } from './services/I18nService';

i18n.init();

//? Initialize Router
const router = new Router('#app');
setAppRouter(router);

i18n.subscribe(() => {
  router.refresh();
});

//? Define Routes
router.addLazyRoute('/', async () => (await import('./pages/Home')).HomePage);
router.addLazyRoute('/profile', async () => (await import('./pages/Profile')).ProfilePage);
router.addLazyRoute('/login', async () => (await import('./pages/Login')).LoginPage);
router.addLazyRoute('/dashboard', async () => (await import('./pages/Dashboard')).DashboardPage);
router.addLazyRoute('/game', async () => (await import('./pages/Game')).GamePage);
router.addLazyRoute('/lobby', async () => (await import('./pages/Lobby')).LobbyPage);
router.addLazyRoute('/chat', async () => (await import('./pages/Chat')).ChatPage);
router.addLazyRoute('/find-game', async () => (await import('./pages/FindGame')).FindGamePage);
router.addLazyRoute('/tournament', async () => (await import('./pages/Tournament')).TournamentPage);
router.addLazyRoute('/spacedout', async () => (await import('./pages/SpacedOut')).SpacedOutPage);
router.addLazyRoute('/terms', async () => (await import('./pages/Terms')).TermsPage);
router.addLazyRoute('/privacy', async () => (await import('./pages/Privacy')).PrivacyPage);

const searchParams = new URLSearchParams(window.location.search);
const hasOAuthToken = Boolean(searchParams.get('token'));

if (hasOAuthToken) {
  void AuthService.handleGoogleCallback()
    .then((ok) => {
      if (ok) {
        window.history.replaceState({}, '', '/');
        router.navigate('/');
      }
    })
    .catch((error) => {
      console.error('Google OAuth bootstrap failed:', error);
      window.history.replaceState({}, '', '/login');
      router.navigate('/login');
    });
}

const publicRoutes = ['/login', '/404', '/terms', '/privacy'];

if (!TokenManager.isAuthenticated() && !publicRoutes.includes(window.location.pathname)) {
  // If we want to enforce login immediately:
  window.history.replaceState({}, '', '/login');
}

// 5. Start the App
router.init();
