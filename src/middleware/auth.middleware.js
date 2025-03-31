const { expressjwt: jwt } = require('express-jwt')
const jwksRsa = require('jwks-rsa')
const jwtAuthz = require('express-jwt-authz')
const jsonwebtoken = require('jsonwebtoken')
const { config } = require('../config')
const {
    KEYCLOAK_DOMAIN,
    KEYCLOAK_REALM
} = config
const client = jwksRsa({
    cache: true, // Default Value
    cacheMaxEntries: 5, // Default value
    cacheMaxAge: 600000, // Defaults to 10m
    jwksUri: `https://${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
})

verify = async (token) => {
    const decodedHeader = jsonwebtoken.decode(token, { complete: true })
    const kid = decodedHeader?.header?.kid
    const key = await client.getSigningKey(kid)
    const signingKey = key.getPublicKey()

    return jsonwebtoken.verify(token, signingKey)
}
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`,
    }),

    issuer: `https://${KEYCLOAK_DOMAIN}/realms/${KEYCLOAK_REALM}`,
    algorithms: ['RS256'],
})
const checkJwtWithErrorHandler = (req, res, next) => {
    const errorHandler = (error) => {
        if (error && error.name === 'UnauthorizedError' && res.header) {
            res.header('err', error.name)
            res.status(401).send('invalid token...')
        } else if (error) {
            if (res.send) {
                res.send(error)
            } else {
                // if being called from socket.io context
                next(error)
            }
        } else {
            osubMiddleware(req, res, next)
        }
    }
    // checkJwt(req, res, errorHandler)
    checkJwt(req, res, errorHandler)
}
const checkJwtAllow = (req, res, next) => {
    const errorHandler = (error) => {
        if (error && error.name === 'UnauthorizedError') {
            res.header('err', error.name)
            next()
        } else if (error) {
            res.send(error)
        } else {
            next()
        }
    }
    checkJwt(req, res, errorHandler)
}
module.exports = {
    checkJwt: checkJwtWithErrorHandler,
    checkJwtAllow,
    jwtAuthz: (scopes, options) => jwtAuthz(scopes, { customScopeKey: 'realm_access.roles', customUserKey: 'auth', ...options }),
    verify,
}
