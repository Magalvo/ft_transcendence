import { Route } from "../interfaces/routeConf";
import { AppGlobals } from "./app";

export class RouteHandler{

     initialize(){
       
        window.addEventListener('popstate', () => {
            this.changeData(window.location.pathname);
        });
    }

    routerHandler(event:any) {
        event.preventDefault();
        let eventTag = (event.target.tagName as String).toLowerCase();
        let href = event.target.getAttribute("data-router");
        if(eventTag == "a" && !href){
            href = event.target.href;
        } 
        if(href != null){
            this.changeData(href);
        }
   }

   changeData(href : string){
    let global = AppGlobals.getInstance();
    history.pushState({}, 'newUrl', href);


    let route: Route | undefined = global.routes.find(
         route => route.path.replace(/^,/, '') ==  window.location.pathname.replace(/^,/, '')
    ); 
    
    if(route){
        let componentName = (route.pageComponent as any).name;
        if(global.rootElement != null){
            global.currentRoute = {
                path : route.path,
                pageComponent: route.pageComponent,
                template: global.templates[componentName],
                eventListeners: [],
                props:[]
            }

            const componentInstance  = new (route.pageComponent as any)() ;

            global.rootElement.innerHTML = global.currentRoute.template;

            if(typeof componentInstance.afterRender === 'function') {
                 componentInstance.afterRender();
             }

            this.changeAnchorListeners();
        }
    }
    


   }
    changeAnchorListeners(){
            let routerElms = document.querySelectorAll("[data-router]");
            routerElms.forEach((elm) => {
            elm.addEventListener("click", (e) => {
                this.routerHandler(e);
            });
            
        });
    }


}