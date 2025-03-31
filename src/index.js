const tracer = require('dd-trace').init()
const mongoose = require('mongoose')
const inspector = require('node:inspector')
const { Server } = require('socket.io')
const https = require('https')
const fs = require('fs')
const redis = require('./config/redis')
const { createAdapter } = require("@socket.io/redis-streams-adapter")

const app = require('./app')
const logger = require('./config/logger')
const config = require('./config/config')
const routes = require('./routes/v1')

mongoose.connect(config.MONGODB_URI).then(() => {
    logger.info('Connected to MongoDB')
})

const server = https.createServer({
    key: fs.readFileSync('./cert.pem', 'utf8'),
    cert: fs.readFileSync('./cert.pem', 'utf8'),
}, app)
server.listen(config.PORT, () => {
    console.log(`listening on ${config.PORT}`)
})
const io = new Server(server, {
    cors: {
        credentials: true,
        origin: config.CORS_DOMAINS.split(' ')
    },
    maxPayload: 10e6,
    maxHttpBufferSize: 10e6,
    cookie: {
        name: "io",
        path: "/",
        httpOnly: true,
        sameSite: "strict",
        secure: true,
        domain: config.COOKIE_DOMAIN
    },
    adapter: createAdapter(redis),
})

io.engine.use(app.expressSession)
app.use((req, _res, next) => {
    req.io = io
    req.tracer = tracer
    next()
})
app.use('/v1', routes)

const unexpectedErrorHandler = (error) => {
    logger.error(error)
    // exitHandler()
}

process.on('uncaughtException', unexpectedErrorHandler)
process.on('unhandledRejection', unexpectedErrorHandler)

process.on('SIGUSR2', () => {
    logger.info('SIGUSR2 received')
    if (server) {
        server.close()
        inspector.close()
        // process.exit(1)
    }
})
