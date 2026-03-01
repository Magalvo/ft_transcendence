import { IsString, IsOptional, MinLength } from "class-validator";

/**
 * DTO for user login input validation
 * Represents data sent by frontend to /login endpoint
 */
class UserLoginDTO {

    @IsString()
    @MinLength(3, { message: 'Username must be provided' })
    username!: string;
    
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters' })
    password!: string;

    @IsOptional()
    @IsString()
    twoFactorCode?: string;
}

export default UserLoginDTO;