
import { Length, IsNotEmpty } from "class-validator";


class userResetPassDTO {

    @IsNotEmpty()
    resetToken: string;

    @Length(8)
    newPassword: string;
}

export default userResetPassDTO;