import { Length } from "class-validator";


class userDTO {

    @Length(5)
    username: string;
    
    @Length(8)
    password: string;

    @Length(8)
    twoFactorCode?:string;
}


export default userDTO;