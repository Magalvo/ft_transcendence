import './style.css';


import { Router } from './core/Router';

import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { GamePage } from './pages/Game';
import { TournamentPage } from './pages/Tournament';

//? Initialize Router
const router = new Router('#app');

//? Define Routes
router.addRoute('/login', LoginPage);
router.addRoute('/', DashboardPage);
router.addRoute('/game', GamePage);
router.addRoute('/tournament', TournamentPage);

const publicRoutes = ['/login', '/404'];
const token = localStorage.getItem('jwt_token'); // Or however you store your auth

if (!token && !publicRoutes.includes(window.location.pathname)) {
  // If we want to enforce login immediately:
  window.history.replaceState({}, '', '/login');
}

// 5. Start the App
router.init();

// Export for debugging purposes if needed
export { router };