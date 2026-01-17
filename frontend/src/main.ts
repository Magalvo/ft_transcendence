import './style.css';
import { Router } from './core/Router';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { Navbar } from './components/layout/Navbar'; 

const router = new Router('#app');


router.addRoute('/login', LoginPage);
router.addRoute('/', DashboardPage);

if (window.location.pathname === '/') {
    // window.history.replaceState({}, '', '/login');
}

router.init();

export { router };