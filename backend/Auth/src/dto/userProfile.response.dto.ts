/**
 * DTO for user profile response
 * Returned by /me and /users/:id/profile endpoints
 * Combines user table data with computed profile info
 */
class UserProfileResponseDTO {

    id!: string;                    // UUID

    username!: string;              // Username

    email!: string;                 // Email address

    avatarUrl!: string;             // Avatar URL (with default fallback)

    online!: boolean;               // Current online status

    // Two-Factor Authentication status
    twoFactorEnabled?: boolean;     // True if 2FA is enabled for this user

    // Profile stats
    wins!: number;                  // Total wins

    losses!: number;                // Total losses

    rank?: string;                  // Computed rank (default: 'Unranked')

    // Computed user status combining online flag and game state
    status!: 'online' | 'offline' | 'ingame';
}

export default UserProfileResponseDTO;
