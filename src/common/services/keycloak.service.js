const { config, logger, redis } = require('../../config')

const logNS = 'aname-backend:keycloak:blur:service'

const {
    KEYCLOAK_REALM_JUNE07,
    KEYCLOAK_URL,
    KEYCLOAK_ADMIN_CLIENT_ID,
    KEYCLOAK_ADMIN_CLIENT_SECRET
} = config
let cachedAccessToken = null
let accessTokenExpiry = 0

const _getKeycloakAccessToken = async () => {
    const { got } = await import('got')

    try {
        const currentTime = Date.now()

        // Check if the cached access token is still valid
        if (cachedAccessToken && currentTime < accessTokenExpiry) {
            return cachedAccessToken
        }

        // Fetch a new access token
        const tokenResponse = await got.post(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM_JUNE07}/protocol/openid-connect/token`, {
            form: {
                grant_type: 'client_credentials',
                client_id: KEYCLOAK_ADMIN_CLIENT_ID_BLUR,
                client_secret: KEYCLOAK_ADMIN_CLIENT_SECRET_BLUR,
            }
        }).json()

        // Cache the new access token and its expiry time
        cachedAccessToken = tokenResponse.access_token
        accessTokenExpiry = currentTime + (tokenResponse.expires_in * 1000) // Convert expires_in to milliseconds

        return cachedAccessToken
    } catch (error) {
        logger.log({ level: 'error', namespace: logNS, message: `Error retrieving Keycloak access token: ${error.message}` })
        throw error // Re-throw the error for handling at the caller's level
    }
}
async function getUserRefreshToken(userAuth) {
    // Obtain service account access token
    const accessToken = await getServiceAccountToken()

    const response = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Bearer ${accessToken}`, // Use the service account's access token
        },
        body: new URLSearchParams({
            client_id: USER_CLIENT_ID,          // The client's ID for the user
            grant_type: 'authorization_code',  // Grant type for user login flow (or similar)
            code: userAuth.code,                // Authorization code from the user's login (if available)
            redirect_uri: userAuth.redirectUri, // The redirect URI to complete the flow
        }),
    })

    const data = await response.json()

    if (data.refresh_token) {
        return data.refresh_token // Return the refresh token securely to the backend
    } else {
        throw new Error("Failed to get user refresh token")
    }
}

module.exports = {
    getUserRefreshToken
}