import jwt from 'jsonwebtoken';
import { createOAuth2Client, refreshAccessToken, getUserInfo } from '../services/googleAuth.js';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
/**
 * Middleware to verify authentication and attach user info to request
 */
export async function authMiddleware(req, res, next) {
    try {
        // Check for token in Authorization header or session
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7)
            : req.session?.accessToken;
        if (!token) {
            return res.status(401).json({ error: 'Unauthorized', message: 'No authentication token provided' });
        }
        // If using session
        if (req.session?.user && req.session?.accessToken) {
            req.user = req.session.user;
            req.accessToken = req.session.accessToken;
            req.refreshToken = req.session.refreshToken;
            return next();
        }
        // If using JWT token
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded.user;
            req.accessToken = decoded.accessToken;
            req.refreshToken = decoded.refreshToken;
            // Check if access token is still valid by making a test call
            try {
                await getUserInfo(decoded.accessToken);
            }
            catch (tokenError) {
                // Token might be expired, try to refresh
                if (decoded.refreshToken) {
                    const oauth2Client = createOAuth2Client();
                    const newCredentials = await refreshAccessToken(oauth2Client, decoded.refreshToken);
                    req.accessToken = newCredentials.access_token;
                    // Return new token in response header
                    const newToken = generateToken(decoded.user, newCredentials.access_token, decoded.refreshToken);
                    res.setHeader('X-New-Token', newToken);
                }
                else {
                    throw tokenError;
                }
            }
            return next();
        }
        catch (jwtError) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
        }
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication error' });
    }
}
/**
 * Generate JWT token with user info and Google tokens
 */
export function generateToken(user, accessToken, refreshToken) {
    const payload = {
        user,
        accessToken,
        refreshToken
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
/**
 * Verify and decode JWT token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=auth.js.map