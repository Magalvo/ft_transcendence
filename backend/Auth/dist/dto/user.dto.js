var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { IsEmail, Length } from "class-validator";
class UserDTO {
    username;
    password;
    email;
}
__decorate([
    Length(5)
], UserDTO.prototype, "username", void 0);
__decorate([
    Length(8)
], UserDTO.prototype, "password", void 0);
__decorate([
    IsEmail()
], UserDTO.prototype, "email", void 0);
export default UserDTO;
