
import { PageComponent } from "../decorators/page";
import bgTest from "../../assets/bg-test.png"
import axios from "axios";
import sectionLogin from "../components/sectionLogin";
import AuthService from "../services/AuthService";


@PageComponent({
   template: `
  <section class="w-full h-screen bg-cover bg-center flex justify-center items-center" style="background-image: url('${bgTest}')">
   <div class="w-full max-w-md relative">
            <div class="bg-white rounded-2xl shadow-2xl overflow-hidden " >
                <div class="p-8">
                    <div class="flex justify-center mb-6">
                    </div>
                    <div class="text-center mb-8">
                        <h2 class="text-3xl font-bold text-gray-800">
                            Pong Game
                        </h2>
                        <p class="text-gray-500 mt-2">
                            Sign in to access the best ping-pong game of your life
                        </p>
                    </div>
                    <form>
                       `
                       + sectionLogin + `
                        <div class="flex items-center justify-between mb-6">

                            <div id="forgotPass">
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
                    <div class="mt-8 text-center signin-form text-sm">
                        <span class="text-gray-600 text-sm" id="textSing">
                            Don't have an account?
                             </span>
                            <span class="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer" id="signup-span">
                                Sign up
                            </span>

                    </div>

                </div>
            </div>
        </div>

</section>
    `
})

export class LoginPage{

    // True Sing in  False Sign up
    private currentState : boolean = true;
    private authService = new AuthService();

      private erroLogin(element : HTMLElement) {

        const normalFocusClasses = ['focus:ring-indigo-500', 'focus:border-transparent'];

        const errorClasses = ['border-red-500', 'focus:ring-red-500', 'focus:border-red-500'];


        element.classList.remove(...normalFocusClasses);
        element.classList.add(...errorClasses);



        setTimeout(() => {
            element.classList.remove(...errorClasses);

            element.classList.add(...normalFocusClasses);
        }, 7000);

    }



    async register(event: MouseEvent){
        event.preventDefault();
        const button = event.target as HTMLButtonElement;
        button.disabled = true

        const usernameEl = document.getElementById('username') as HTMLInputElement;
        const passwordEl = document.getElementById('password') as HTMLInputElement;
        const emailEl = document.getElementById('email') as HTMLInputElement;

        const username = usernameEl?.value;
        const password = passwordEl?.value;
        const email = emailEl?.value;

        if(!username || username.length < 3 || username.length > 20) {
            this.erroLogin(usernameEl);
            button.disabled = false;
            return;
        }

        if(!password || password.length < 8) {
            this.erroLogin(passwordEl);
            button.disabled = false;
            return;
        }

        if(!this.authService.parseEmail(email)) {
            this.erroLogin(emailEl);
            button.disabled = false;
            return;
        }

        try{
            const { token, refreshToken } = await this.authService.register({username, password, email});
            console.log(token, refreshToken);
            console.log('Redirect to home');
            this.authService.redirectToHomePage(token, refreshToken);
        }  catch (error: any){
            if(error.response?.status === 400 || error.response?.status === 409){
                this.erroLogin(usernameEl);
                this.erroLogin(passwordEl);
                this.erroLogin(emailEl);
            }
        }finally{
            button.disabled = false;
        }



    }
    async auth(event: MouseEvent) {

        event.preventDefault();
        const button = event.target as HTMLButtonElement;
        button.disabled = true


        const usernameEl = document.getElementById('username') as HTMLInputElement;
        const passwordEl = document.getElementById('password') as HTMLInputElement;

        const username = usernameEl?.value;
        const password = passwordEl?.value;

        if(!username || username.length < 3 || username.length > 20)
            return this.erroLogin(usernameEl);

        if(!password || password.length < 3)
            return this.erroLogin(passwordEl);

        try{
                     const result = await this.authService.login(username, password);

                     if (result.twoFactorRequired) {
                         sessionStorage.setItem('temp_username', username);
                         sessionStorage.setItem('temp_password', password);
                         this.show2FAModal(username);
                     } else if (result.token && result.refreshToken) {
                         this.authService.redirectToHomePage(result.token, result.refreshToken);
                     }
                } catch (error: any) {
                    const errorMsg = error.message || 'Login failed';
                    if (errorMsg.includes('2FA')) {
                        sessionStorage.setItem('temp_username', username);
                        sessionStorage.setItem('temp_password', password);
                        this.show2FAModal(username);
                    } else if(error.response?.status === 401){
            this.erroLogin(usernameEl);
            this.erroLogin(passwordEl);
                    } else {
                        this.erroLogin(usernameEl);
                        this.erroLogin(passwordEl);
                    }
                } finally {
            button.disabled = false;
                }

    }

        private show2FAModal(username: string) {
            const modal = document.createElement('div');
            modal.id = '2fa-modal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-8 max-w-md w-full">
                    <h3 class="text-xl font-bold mb-4">Two-Factor Authentication</h3>
                    <p class="text-gray-600 mb-6">Enter the 6-digit code from your authenticator app</p>
                    <input type="text" id="2fa-code" placeholder="000000" maxlength="6" class="w-full border border-gray-300 rounded px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <div class="flex gap-2">
                        <button id="2fa-cancel" class="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400">Cancel</button>
                        <button id="2fa-submit" class="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">Verify</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const submitBtn = document.getElementById('2fa-submit') as HTMLButtonElement;
            const cancelBtn = document.getElementById('2fa-cancel') as HTMLButtonElement;
            const codeInput = document.getElementById('2fa-code') as HTMLInputElement;
            submitBtn.addEventListener('click', async () => {
                const code = codeInput.value;
                if (!code || code.length !== 6) {
                    alert('Please enter a valid 6-digit code');
                    return;
                }
                try {
                    const u = sessionStorage.getItem('temp_username') || '';
                    const p = sessionStorage.getItem('temp_password') || '';
                    const result = await this.authService.login(u, p, code);
                    if (result.token && result.refreshToken) {
                        sessionStorage.removeItem('temp_username');
                        sessionStorage.removeItem('temp_password');
                        modal.remove();
                        this.authService.redirectToHomePage(result.token, result.refreshToken);
                    }
                } catch (error: any) {
                    alert('Invalid code. Please try again.');
                }
            });
            cancelBtn.addEventListener('click', () => {
                sessionStorage.removeItem('temp_username');
                sessionStorage.removeItem('temp_password');
                modal.remove();
            });
        }

    afterRender(){

        const LoginButton = document.getElementById('login');
        const RegisterButton = document.getElementById('register');
        const signupSpan = document.getElementById('signup-span');

        LoginButton !== null ? LoginButton.addEventListener('click', this.auth.bind(this)) : ''
        RegisterButton !== null ? RegisterButton.addEventListener('click',this.register.bind(this)) : ''
        signupSpan !== null ? signupSpan.addEventListener('click', this.loginAction.bind(this)) : ''

    }

    private loginAction(event: MouseEvent){

        event.preventDefault();

        const LoginButton = document.getElementById('login');
        const RegisterButton = document.getElementById('register');
        const signupSpan = document.getElementById('signup-span') as HTMLSpanElement;
        const forgotPass = document.getElementById('forgotPass');
        const textSing = document.getElementById('textSing') as HTMLParagraphElement;
        const emailForm = document.getElementById('emailForm');

        if(this.currentState === true){
            this.setVisibilty('block',RegisterButton);
            this.setVisibilty('block',emailForm);
            this.setVisibilty('none',LoginButton);
            this.setVisibilty('none',forgotPass);
            signupSpan.textContent = 'Sign in';
            textSing.textContent = 'Already have an account?';
            this.setCurrentState(false);
         }else{
            this.setVisibilty('none',RegisterButton);
            this.setVisibilty('none',emailForm);
            this.setVisibilty('block',LoginButton);
            this.setVisibilty('block',forgotPass);
            signupSpan.textContent = 'Sign up';
            textSing.textContent = 'Don\'t have an account?';
            this.setCurrentState(true);
         }
    }

    private setCurrentState(state: boolean){
        this.currentState = state;

    }
    setVisibilty(display : string, element : HTMLElement | null){
        if(element)
            element.style.display = display;
    }
}
