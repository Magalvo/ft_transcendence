import { Route } from "./interfaces/routeConf";
import { LoginPage } from "./pages/LoginPage"
import { HomePage } from "./pages/HomePage";
import { GamePage } from "./pages/Game";
import { LobbyPage } from "./pages/Lobby";
import { ChatPage } from "./pages/Chat";
import { FindGamePage } from "./pages/FindGame";
import { DashboardPage } from "./pages/Dashboard"
import { TermsPage } from "./pages/Terms";

export const AppRoutes:Route[] = [
    {
        path: "/",
        pageComponent: HomePage
    },
    {
        path: "/login",
        pageComponent: LoginPage
    },
    {
        path: "/game",
        pageComponent: GamePage
    }

    ,{
        path: "/lobby",
        pageComponent: LobbyPage
    },
    {
        path: "/dashboard",
        pageComponent: DashboardPage
    },
    {
        path: "/find-game",
        pageComponent: FindGamePage
    },
    {
        path: "/chat",
        pageComponent: ChatPage
    },
    {
        path: "/terms",
        pageComponent: TermsPage
    }
]
