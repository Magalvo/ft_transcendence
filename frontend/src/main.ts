import { MainConfig } from "./decorators/main";
import { AppRoutes } from "./routes";
import './style.css'

@MainConfig({
    rootElement: 'app',
    routes: AppRoutes
})

class Main{}