import { AbstractComponent } from '../core/Component';
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
}