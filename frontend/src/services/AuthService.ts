export class AuthService {
  
  public static async login(username: string, password: string): Promise<boolean> {
    console.log(`Attempting login for: ${username}`);
    
    await new Promise(r => setTimeout(r, 500)); 
    
    
    return password === '42'; 
  }

  public static loginWithGoogle(): void {
    
    
    window.location.href = 'http://localhost:3000/auth/google';
  }
}