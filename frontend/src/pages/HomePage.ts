import { PageComponent } from "../decorators/page";


@PageComponent({
    template: `
        <div class="bg-blue-300 w-screen h-screen">
                <h1>Teste</h1>
            <button class="bg-red-500 mt-2  w-24 h-10 rounded-md cursor-pointer" data-router="/login">Teste</button>
        </div>
    `


})

export class HomePage{
    afterRender(){
        console.log('Home Page Renderizada adicionando eventos');

    }

}