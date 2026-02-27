import { Length } from "class-validator";


class userDTO {

    @Length(5)
    username: string;
    
    @Length(8)
    password: string;

    twoFactorCode?:string;
}


export default userDTO;