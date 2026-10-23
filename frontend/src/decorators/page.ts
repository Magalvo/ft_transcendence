import { AppGlobals } from "../common/app";
import { PageConf } from "../interfaces/pageconf";

export function PageComponent(config:PageConf){
    let global = AppGlobals.getInstance();
    return function(target:any){
        let componentName = target.name;
        global.templates[componentName] = config.template;
    }


}