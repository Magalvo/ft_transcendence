

/**
 * DTO representing the complete user entity from database
 * Maps to 'users' table schema
 */
class UserDBDTO {

    id!: string;               // UUID primary key

    username!: string;         // Unique username

    email!: string | null;     // Email address (nullable for OAuth)
    
    passwordHash!: string | null;  // Bcrypt hash (nullable for OAuth users)

    avatarUrl!: string | null; // URL to user avatar image

    online!: boolean;          // Current online status

    twoFactorSecret!: string | null;  // TOTP secret for 2FA

    tempTwoFactorSecret!: string | null;  // Temporary secret during 2FA setup

    last_request!: string | null;  // ISO timestamp of last API request

    resetToken!: string | null;    // Token for password reset

    resetExpires!: string | null;  // Expiration time for password reset token
}

export default UserDBDTO;