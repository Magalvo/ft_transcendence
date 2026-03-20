import './style.css';


import { setAppRouter } from './core/AppRouter';
import { Router } from './core/Router';

import { TokenManager } from './services/TokenManager';
import AuthService from './services/AuthService';
import { i18n } from './services/I18nService';
import { initTournamentInviteNotifier } from './services/TournamentInviteNotifier';

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
router.addLazyRoute('/reset-password', async () => (await import('./pages/PasswordResetPage')).PasswordResetPage);

const searchParams = new URLSearchParams(window.location.search);
const hasOAuthToken =
  searchParams.get('provider') === 'google' &&
  Boolean(searchParams.get('token')) &&
  Boolean(searchParams.get('refreshToken'));

const publicRoutes = ['/login', '/404', '/terms', '/privacy', '/reset-password'];

async function bootstrapApp(): Promise<void> {
  let postAuthRoute: string | null = null;

  if (hasOAuthToken) {
    try {
      const callbackResult = await AuthService.handleGoogleCallback();
      if (callbackResult.ok) {
        postAuthRoute = '/';
      }
    } catch (error) {
      console.error('Google OAuth bootstrap failed:', error);
      postAuthRoute = '/login';
    }
  }

  if (postAuthRoute) {
    window.history.replaceState({}, '', postAuthRoute);
  }

  if (!TokenManager.isAuthenticated() && !publicRoutes.includes(window.location.pathname)) {
    window.history.replaceState({}, '', '/login');
  }

  if (TokenManager.isAuthenticated()) {
    initTournamentInviteNotifier();
  }

  router.init();

  if (postAuthRoute) {
    router.navigate(postAuthRoute);
  }
}

void bootstrapApp();
