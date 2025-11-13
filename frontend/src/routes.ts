import { Route } from "./interfaces/routeConf";
import { LoginPage } from "./pages/LoginPage"
import { HomePage } from "./pages/HomePage";

export const AppRoutes:Route[] = [
    {
        path: "/",
        pageComponent: HomePage
    },
    {
        path: "/login",
        pageComponent: LoginPage
    }
]