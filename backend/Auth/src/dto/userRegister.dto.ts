import { IsEmail, IsString, MinLength, MaxLength, IsBoolean, Equals } from "class-validator";

/**
 * DTO for user registration input validation
 * Represents data sent by frontend to /register endpoint
 */
class UserRegisterDTO {

    @IsString()
    @MinLength(3, { message: 'Username must be at least 3 characters' })
    @MaxLength(20, { message: 'Username must not exceed 20 characters' })
    username!: string;

    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password!: string;

    @IsEmail({}, { message: 'Email must be valid' })
    email!: string;

    @IsBoolean({ message: 'Accepting terms must be true or false' })
    @Equals(true, { message: 'You must accept the terms and conditions' })
    acceptTerms!: boolean;

}

export default UserRegisterDTO;