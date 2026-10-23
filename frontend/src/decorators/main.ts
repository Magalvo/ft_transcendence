import { MainConf } from "../interfaces/mainconf";
import {AppGlobals} from '../common/app'
import { RouteHandler } from '../common/route.handler'

export function MainConfig(config:MainConf){
    let global = AppGlobals.getInstance();


    global.routes = config.routes;

    global.rootElement = document.getElementById(config.rootElement);

    return function(_target : any){

        let router = new RouteHandler();
        router.initialize();
        router.changeData(window.location.pathname);

    }
    
}
