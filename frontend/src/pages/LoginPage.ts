
import { PageComponent } from "../decorators/page";
import bgTest from "../../assets/bg-test.png"
import axios from "axios";


@PageComponent({
   template: `
  <section class="w-full h-screen bg-cover bg-center flex justify-center items-center" style="background-image: url('${bgTest}')">
    
   <div class="w-full max-w-md relative">
            <div class="bg-white rounded-2xl shadow-2xl overflow-hidden " >
                <div class="p-8">
                    <!-- Logo/Brand -->
                    <div class="flex justify-center mb-6">
                    </div>
                    
                    <!-- Header Section -->
                    <div class="text-center mb-8">
                        <h2 class="text-3xl font-bold text-gray-800">
                            Pong Game
                        </h2>
                        <p class="text-gray-500 mt-2">
                            Sign in to access the best ping-pong game of your life
                        </p>
                    </div>
                    <form>
                        <div class="mb-6 relative">
                            <label for="username" class="block text-sm font-medium text-gray-700 mb-1 pl-1">
                                Username
                            </label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <input 
                                    type="text" 
                                    id="username" 
                                    class="pl-10 w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-300"
                                    placeholder="42 Username"
                                >
                            </div>
                        </div>
                        
                        <div class="mb-6 relative hidden signup-form">
                            <label for="username" class="block text-sm font-medium text-gray-700 mb-1 pl-1">
                                Email
                            </label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                </div>
                                <input 
                                    type="email" 
                                    id="email" 
                                    class="pl-10 w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-300"
                                    placeholder="Email"
                                >
                            </div>
                        </div>
                        <!-- Password Input -->
                        <div class="mb-6 relative">
                            <label for="password" class="block text-sm font-medium text-gray-700 mb-1 pl-1">
                                Password
                            </label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input 
                                    type="password" 
                                    id="password" 
                                    class="pl-10 w-full px-4 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent hover:border-gray-300"
                                    placeholder="••••••••"
                                >
                            </div>
                        </div>
                        
                        <div class="flex items-center justify-between mb-6">
                           
                            <div>
                                <a href="#" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                                    Forgot password?
                                </a>
                            </div>
                        </div>
                        
                        <!-- Submit Button with Beautiful Styling -->
                        <button 
                            id="login"
                            class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium py-3 px-4 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            Sign In
                        </button>
                         <button 
                            id="register"
                            class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium py-3 px-4 rounded-lg shadow-md hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer hidden signup-form "
                        >
                            Sign Up
                        </button>
                        
                        <!-- Social Sign In -->
                        <div class="mt-8 signin-form">
                            <div class="relative">
                                <div class="absolute inset-0 flex items-center">
                                    <div class="w-full border-t border-gray-200"></div>
                                </div>
                                <div class="relative flex justify-center text-sm">
                                    <span class="px-2 bg-white text-gray-500">Or sign in with</span>
                                </div>
                            </div>
                            
                            <div class="mt-6 grid grid-cols-2 gap-3">
                                <div>
                                    <a href="#" class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                       <svg class="h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    </a>
                                </div>
                
                                <div>
                                    <a href="#" class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 137.6 96.6" fill="#fff" stroke="transparent" width="25" height="20"><path d="M229.2 443.9h50.7v25.4h25.3v-45.9h-50.6l50.6-50.7h-25.3l-50.7 50.7zM316.1 398.1l25.3-25.4h-25.3z" fill="#000" transform="translate(-229.2 -372.7)"></path><path d="m341.4 398.1-25.3 25.3v25.3h25.3v-25.3l25.4-25.3v-25.4h-25.4zM366.8 423.4l-25.4 25.3h25.4z" fill="#000" transform="translate(-229.2 -372.7)"></path></svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </form>
                    
                    <!-- Footer -->
                    <div class="mt-8 text-center signin-form">
                        <p class="text-gray-600 text-sm">
                            Don't have an account? 
                            <span class="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer" id="signup-span">
                                Sign up
                            </span>
                        </p>
                    </div>
                </div>
            </div>         
        </div>

</section>
    `
})

export class LoginPage{


    private currentState : string = 'SingUp';

    private setCurrentState(current){
        this.currentState = current;
    }
      private erroLogin() {
        const usernameInput = document.getElementById('username') as HTMLInputElement;
        const passwordInput = document.getElementById('password') as HTMLInputElement;

        if (!usernameInput || !passwordInput) return;

        const normalFocusClasses = ['focus:ring-indigo-500', 'focus:border-transparent'];
        
        const errorClasses = ['border-red-500', 'focus:ring-red-500', 'focus:border-red-500'];

        
        usernameInput.classList.remove(...normalFocusClasses);
        passwordInput.classList.remove(...normalFocusClasses);
        
      
        usernameInput.classList.add(...errorClasses);
        passwordInput.classList.add(...errorClasses);


        setTimeout(() => { 
        
            usernameInput.classList.remove(...errorClasses);
            passwordInput.classList.remove(...errorClasses);
            
            usernameInput.classList.add(...normalFocusClasses);
            passwordInput.classList.add(...normalFocusClasses);
        }, 7000);
        
    }

    private redirectToHomePage(token : string,refreshToken : string){
         
        cookieStore.set('token', token);
        cookieStore.set('refreshToken', refreshToken);
        const button = document.getElementById('login') as HTMLButtonElement;
        button.textContent = 'Redirecting...'
       
        setTimeout(() => {
            button.textContent = 'Sign In';
            window.location.href = '/';
        }, 1000);     
    }

     async auth(event: MouseEvent) {
      
        event.preventDefault(); 
        const button = event.target as HTMLButtonElement;
        button.disabled = true  
    
        
        const usernameEl = document.getElementById('username') as HTMLInputElement;
        const passwordEl = document.getElementById('password') as HTMLInputElement;

        const username = usernameEl?.value;
        const password = passwordEl?.value;

        if(!username || !password)
            return console.log('invalid');
            
        try{
        const response = await axios.post("http://localhost:3333/auth/login",{
           username:  username,
           password: password
        })
            if(response.status === 200){
            const {token, refreshToken} = response.data.data
            this.redirectToHomePage(token,refreshToken);
        }

       }catch (response: any){

          if(response.status === 401){
            this.erroLogin();
        }
       }finally{
            button.disabled = false;
       }
    
    }


    afterRender(){
        console.log('Login Page Renderizada adicionando eventos');

        const LoginButton = document.getElementById('login');
        const signupSpan = document.getElementById('signup-span');


        // 5. Adicionamos o 'listener' para o evento 'click'
        if(LoginButton){
           LoginButton.addEventListener('click', this.auth.bind(this))
        } else {
           console.error("O botão de login #login não foi encontrado.");
        }

    

        
    }

   


}