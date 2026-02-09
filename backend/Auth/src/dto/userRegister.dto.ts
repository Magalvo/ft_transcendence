import { IsEmail, Length } from "class-validator";



class UserRegisterDTO {


    userId : string;
    @Length(5)
    username: string;

    @Length(8)
    password: string;

    @IsEmail()
    email: string;

}

export default UserRegisterDTO;