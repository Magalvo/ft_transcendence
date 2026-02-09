import axios from "axios"
import userRegister from '../interfaces/userRegister'

export class AuthService {

    private apiUrl = "http://localhost:3333";


    async login(username : string, password : string) {
        try {
            const response = await axios.post(`${this.apiUrl}/auth/login`, {
                username: username,
                password: password
            });

            if (response.status === 200) {
                return response.data.data; 
            }
        } catch (error : any) {
            throw error; 
        }
    }


    async register({username, email, password} : userRegister) {
          try {
            const response = await axios.post(`${this.apiUrl}/auth/register`, {
                username: username,
                password: password,
                email: email
            });

            if (response.status === 201) {
                return response.data.data; 
            }
        } catch (error : any) {
            throw error; 
        }
    
 
    }

    redirectToHomePage(token : string,refreshToken : string){
         
        cookieStore.set('token', token);
        cookieStore.set('refreshToken', refreshToken);
        const button = document.getElementById('login') as HTMLButtonElement;
        button.textContent = 'Redirecting...'
       
        setTimeout(() => {
            button.textContent = 'Sign In';
            window.location.href = '/';
        }, 1000);     
    }


    parseEmail(email : string) : boolean{
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);

    }
}

export default AuthService;