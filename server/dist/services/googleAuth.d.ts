declare const SCOPES: string[];
export declare function createOAuth2Client(): import("google-auth-library").OAuth2Client;
export declare function getAuthUrl(oauth2Client: ReturnType<typeof createOAuth2Client>, state?: string): string;
export declare function getTokensFromCode(oauth2Client: ReturnType<typeof createOAuth2Client>, code: string): Promise<import("google-auth-library").Credentials>;
export declare function getUserInfo(accessToken: string): Promise<{
    id: string;
    email: string;
    name: string;
    picture: string | undefined;
}>;
export declare function refreshAccessToken(oauth2Client: ReturnType<typeof createOAuth2Client>, refreshToken: string): Promise<import("google-auth-library").Credentials>;
export { SCOPES };
//# sourceMappingURL=googleAuth.d.ts.map