

import { CurrentPath, Route} from '../interfaces/routeConf'

export class AppGlobals {
    private static instance:AppGlobals;
    private constructor(){}

    static getInstance(){
        if(!AppGlobals.instance){
            this.instance = new AppGlobals();
        }
        return AppGlobals.instance;
    }


    rootElement: HTMLElement| null = null;
    routes : Route[] = [];
    currentRoute : CurrentPath | null = null;

    templates: any = {};

}