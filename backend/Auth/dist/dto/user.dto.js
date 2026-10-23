var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { IsString, IsOptional, MinLength, MaxLength } from "class-validator";
/**
 * DTO for user login input validation
 * Represents data sent by frontend to /login endpoint
 */
class UserLoginDTO {
    username;
    password;
    twoFactorCode;
}
__decorate([
    IsString(),
    MinLength(3, { message: 'Username must be provided' }),
    MaxLength(20, { message: 'Username must not exceed 20 characters' })
], UserLoginDTO.prototype, "username", void 0);
__decorate([
    IsString(),
    MinLength(8, { message: 'Password must be at least 8 characters' })
], UserLoginDTO.prototype, "password", void 0);
__decorate([
    IsOptional(),
    IsString()
], UserLoginDTO.prototype, "twoFactorCode", void 0);
export default UserLoginDTO;
