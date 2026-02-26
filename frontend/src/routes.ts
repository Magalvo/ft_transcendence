import { Route } from "./interfaces/routeConf";
import { LoginPage } from "./pages/LoginPage"
import { HomePage } from "./pages/HomePage";
import { GamePage } from "./pages/Game";
import { LobbyPage } from "./pages/Lobby";

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
    }
]