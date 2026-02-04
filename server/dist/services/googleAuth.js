import { google } from 'googleapis';
const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file' // Access to files created/opened by the app
];
export function createOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Google must redirect to the BACKEND (where /api/auth/callback is handled), not the frontend.
    const base = process.env.BACKEND_PUBLIC_URL || process.env.FRONTEND_URL;
    const redirectUri = base ? `${base.replace(/\/$/, '')}/api/auth/callback` : 'http://localhost:3001/api/auth/callback';
    if (!clientId || !clientSecret) {
        throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables');
    }
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
export function getAuthUrl(oauth2Client, state) {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force consent to get refresh token
        state: state || ''
    });
}
export async function getTokensFromCode(oauth2Client, code) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}
export async function getUserInfo(accessToken) {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return {
        id: data.id,
        email: data.email,
        name: data.name || data.email,
        picture: data.picture ?? undefined
    };
}
export async function refreshAccessToken(oauth2Client, refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
}
export { SCOPES };
//# sourceMappingURL=googleAuth.js.map