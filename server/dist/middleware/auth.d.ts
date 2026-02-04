import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest, UserInfo } from '../types.js';
export interface JWTPayload {
    user: UserInfo;
    accessToken: string;
    refreshToken: string;
    exp: number;
}
/**
 * Middleware to verify authentication and attach user info to request
 */
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
/**
 * Generate JWT token with user info and Google tokens
 */
export declare function generateToken(user: UserInfo, accessToken: string, refreshToken: string): string;
/**
 * Verify and decode JWT token
 */
export declare function verifyToken(token: string): JWTPayload | null;
//# sourceMappingURL=auth.d.ts.map