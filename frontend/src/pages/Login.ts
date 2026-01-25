/* import { AbstractComponent } from '../core/Component';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AuthService } from '../services/AuthService';

export class LoginPage extends AbstractComponent {
  private isRegisterMode: boolean = false;
  
  
  private usernameInput: Input;
  private passwordInput: Input;
  
  constructor() {
    
    super('div', 'min-h-screen flex items-center justify-center bg-gray-900 p-4');

    
    this.usernameInput = new Input('Enter your username', 'text', 'Username');
    this.passwordInput = new Input('Enter your password', 'password', 'Password');
  }

  public render(): void {
    this.element.innerHTML = ''; 

    
    const card = new Card('w-full max-w-md space-y-6');

    
    const title = document.createElement('h2');
    title.className = 'text-3xl font-bold text-center text-white';
    title.innerText = this.isRegisterMode ? 'Create Account' : 'Welcome Back';

    
    const mainButton = new Button(
      this.isRegisterMode ? 'Sign Up' : 'Log In',
      () => this.handleSubmit()
    );

    const toggleButton = new Button(
      this.isRegisterMode ? 'Already have an account? Log In' : 'No account? Sign Up',
      () => this.toggleMode(),
      'secondary' 
    );

    
    const googleButton = new Button(
      'Continue with Google',
      () => AuthService.loginWithGoogle(),
      'danger' 
    );

    
    
    
    card.addChildren(
         
         
        
        this.usernameInput,
        this.passwordInput,
        mainButton,
        googleButton,
        toggleButton
    );
    
    
    card.getElement().prepend(title);

    
    this.element.appendChild(card.getElement());
  }

  private toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.render(); 
  }

  private async handleSubmit(): Promise<void> {
    const user = this.usernameInput.getValue();
    const pass = this.passwordInput.getValue();
    
     
    let isValid = true;

    if (!user) {
        this.usernameInput.setError(true);
        isValid = false;
    } else {
        this.usernameInput.setError(false);
    }

    if (!pass) {
        this.passwordInput.setError(true);
        isValid = false;
    } else {
        this.passwordInput.setError(false);
    }

    if (!isValid) return;

    
    try {
        const success = await AuthService.login(user, pass);
        if (success) {
            console.log("Login Successful!");
            
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
            alert("Invalid credentials (try password '42')");
            this.passwordInput.setError(true);
        }
    } catch (e) {
        console.error("Login error", e);
    }
  }
} */

  import { AbstractComponent } from '../core/Component';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AuthService } from '../services/AuthService';
import image  from "../assets/image.png";


export class LoginPage extends AbstractComponent {
  private isRegisterMode: boolean = false;
  private authService: AuthService;

  private usernameInput: Input;
  private passwordInput: Input;
  private emailInput: Input;

  constructor() {
    super('section', 'w-full h-screen bg-cover bg-center flex justify-center items-center');
    this.element.style.backgroundImage = `url('${image}')`;
    
    this.authService = new AuthService();

    this.usernameInput = new Input('Username', 'text', 'Username');
    this.passwordInput = new Input('Password', 'password', 'Password');
    this.emailInput = new Input('Email', 'email', 'Email Address');
  }

  public render(): void {
    this.element.innerHTML = ''; 

    const card = new Card('w-full max-w-md bg-white/95 backdrop-blur-sm');

    const header = document.createElement('div');
    header.className = 'text-center mb-8';
    header.innerHTML = `
      <h2 class="text-3xl font-bold text-gray-800">Pong Game</h2>
      <p class="text-gray-500 mt-2">
        ${this.isRegisterMode ? 'Create an account to join the arena' : 'Sign in to access the best ping-pong game'}
      </p>
    `;
    card.getElement().appendChild(header);

    this.usernameInput.render();
    this.passwordInput.render();
    card.getElement().appendChild(this.usernameInput.getElement());

    if (this.isRegisterMode) {
      this.emailInput.render();
      card.getElement().appendChild(this.emailInput.getElement());
    }

    card.getElement().appendChild(this.passwordInput.getElement());

    if (!this.isRegisterMode) {
      const forgotLink = document.createElement('div');
      forgotLink.className = 'flex justify-end mb-6';
      forgotLink.innerHTML = `<a href="#" class="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Forgot password?</a>`;
      card.getElement().appendChild(forgotLink);
    } else {
        const spacer = document.createElement('div');
        spacer.className = 'mb-6';
        card.getElement().appendChild(spacer);
    }

    // --- 5. Action Buttons ---
    const actionBtn = new Button(
      this.isRegisterMode ? 'Sign Up' : 'Sign In',
      (e) => this.handleSubmit(e),
      'primary'
    );
    actionBtn.getElement().classList.add('w-full', 'mb-4');
    
    card.addChildren(actionBtn);

    this.renderSocialLogin(card);

    const toggleDiv = document.createElement('div');
    toggleDiv.className = 'mt-6 text-center text-sm text-gray-600';
    toggleDiv.innerText = this.isRegisterMode ? "Already have an account? " : "Don't have an account? ";
    
    const toggleLink = document.createElement('span');
    toggleLink.className = 'text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer';
    toggleLink.innerText = this.isRegisterMode ? 'Sign in' : 'Sign up';
    toggleLink.onclick = () => this.toggleMode();

    toggleDiv.appendChild(toggleLink);
    card.getElement().appendChild(toggleDiv);

    this.element.appendChild(card.getElement());
  }


  private renderSocialLogin(card: Card): void {
    const divider = document.createElement('div');
    divider.className = 'relative mt-6 mb-6';
    divider.innerHTML = `
      <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-300"></div></div>
      <div class="relative flex justify-center text-sm"><span class="px-2 bg-white text-gray-500">Or continue with</span></div>
    `;
    card.getElement().appendChild(divider);

    const socialContainer = document.createElement('div');
    socialContainer.className = 'grid grid-cols-1 gap-3';
    
    const googleBtn = document.createElement('button');
    googleBtn.className = 'w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition';
    googleBtn.innerHTML = `
      <svg class="h-5 w-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Google
    `;
    googleBtn.onclick = (e) => {
        e.preventDefault();
        console.log("Google Auth Clicked");
    };

    socialContainer.appendChild(googleBtn);
    card.getElement().appendChild(socialContainer);
  }

  private toggleMode(): void {
    this.isRegisterMode = !this.isRegisterMode;
    this.render();
  }

/*   private async handleSubmit(e: Event): Promise<void> {
    if (e) e.preventDefault();

    const username = this.usernameInput.getValue();
    const password = this.passwordInput.getValue();
    
    let isValid = true;
    
    if (!username || username.length < 3) {
        this.usernameInput.setError(true);
        isValid = false;
    } else {
        this.usernameInput.setError(false);
    }

    if (!password || password.length < 3) {
        this.passwordInput.setError(true);
        isValid = false;
    } else {
        this.passwordInput.setError(false);
    }

    if (this.isRegisterMode) {
        const email = this.emailInput.getValue();
        if (!this.authService.parseEmail(email)) {
            this.emailInput.setError(true);
            isValid = false;
        } else {
            this.emailInput.setError(false);
        }
    }

    if (!isValid) return;

    try {
        if (this.isRegisterMode) {
             const email = this.emailInput.getValue();
             const { token, refreshToken } = await this.authService.register({ username, password, email });
             this.authService.redirectToHomePage(token, refreshToken);
        } else {
             const { token, refreshToken } = await this.authService.login(username, password);
             this.authService.redirectToHomePage(token, refreshToken);
        }
    } catch (error: any) {
        console.error("Auth Error", error);
        if (error.response?.status === 400 || error.response?.status === 401) {
            this.usernameInput.setError(true);
            this.passwordInput.setError(true);
        }
        alert("Authentication failed: " + (error.response?.data?.message || "Unknown error"));
    }
  } */

    private async handleSubmit(): Promise<void> {
    const user = this.usernameInput.getValue();
    const pass = this.passwordInput.getValue();
    
     
    let isValid = true;

    if (!user) {
        this.usernameInput.setError(true);
        isValid = false;
    } else {
        this.usernameInput.setError(false);
    }

    if (!pass) {
        this.passwordInput.setError(true);
        isValid = false;
    } else {
        this.passwordInput.setError(false);
    }

    if (!isValid) return;

    
    try {
        const success = await AuthService.login(user, pass);
        if (success) {
            console.log("Login Successful!");
            
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
            alert("Invalid credentials (try password '42')");
            this.passwordInput.setError(true);
        }
    } catch (e) {
        console.error("Login error", e);
    }
  }
}