/* eslint-disable security/detect-non-literal-regexp */
const express = require('express')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const compression = require('compression')
const cors = require('cors')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const cookieParser = require('cookie-parser')

const config = require('./config/config')
const morgan = require('./config/morgan')
const redis = require('./config/redis')

const { authLimiter } = require('./middleware/rateLimiter')
const { errorConverter, errorHandler } = require('./middleware/error')

const app = express()
const sessionStore = MongoStore.create({
    mongoUrl: config.MONGODB_URI,
    touchAfter: config.NODE_ENV === 'production' ? 24 * 3600 : 0,
    ttl: 365 * 24 * 3600
})

app.use(cookieParser())
app.use(express.raw({ type: (req) => /\/v1\/webhook\/stripe/.test(req.originalUrl) }))
app.use(express.text())
app.use(express.json({
    limit: '10mb'
}))
app.use(express.urlencoded({ extended: true }))

if (config.env !== 'test') {
    app.use(morgan.successHandler)
    app.use(morgan.errorHandler)
}
if (config.NODE_ENV !== 'production') {
    global.redis = redis
}

// set security HTTP headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                frameAncestors: ["'self'", '*.june07.com'],
            },
        },
    })
)

// sanitize request data
app.use(mongoSanitize())

// gzip compression
app.use(compression())

// enable cors
app.use(
    cors({
        origin: (_origin, callback) => {
            callback(
                null,
                config.NODE_ENV === 'production'
                    ? config.CORS_DOMAINS.split(',')
                        .map(domain => [`https://${domain}`, `https://www.${domain}`, new RegExp(`https?://(.*\\.)?${domain}$`)])
                        .flat()
                    : config.CORS_DOMAINS.split(',')
                        .map(domain => [
                            `https://api-localdev.${domain}`,
                            `https://api-localtunnel.${domain}`, // tunnel address needed for testing webhooks locally
                            new RegExp(`https?://(.*.)?${domain}$`),
                        ])
                        .flat()
            )
        },
        credentials: true,
        exposedHeaders: ['set-cookie'],
    })
)
app.options('*', cors())
app.head('/health', (_req, res) => res.send('ok'))
const expressSession = session({
    secret: config.EXPRESS_SESSION_SECRET,
    store: sessionStore,
    saveUninitialized: true,
    resave: false,
    cookie: {
        sameSite: 'none',
        httpOnly: false,
        secure: true,
        domain: config.COOKIE_DOMAIN,
        maxAge: 31536000000
    }
})
app.use(expressSession)
app.expressSession = expressSession
app.sessionStore = sessionStore

// limit repeated failed requests to auth endpoints
if (config.NODE_ENV === 'production') {
    app.use('/v1/auth', authLimiter)
}
app.use('/v1/info', (_req, res) => res.send('v1'))
app.use((req, _res, next) => {
    req.redis = redis
    next()
})

// convert error to ApiError, if needed
app.use(errorConverter)

// handle error
app.use(errorHandler)

module.exports = app
