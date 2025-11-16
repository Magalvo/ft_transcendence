
import { Length } from "class-validator";


class userResetPassDTO {

    userId: string;

    @Length(8)
    newPassword: string;
}

export default userResetPassDTO;