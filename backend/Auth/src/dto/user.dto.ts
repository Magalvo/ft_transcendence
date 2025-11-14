import { IsEmail, Length } from "class-validator";



class UserDTO {

    @Length(5)
    username: string;

    @Length(8)
    password: string;

    @IsEmail()
    email: string;

}

export default UserDTO;