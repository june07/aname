const winston = require('winston')
const config = require('./config')

const { NODE_ENV } = config

const winstonConfig = {
    level: NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.errors({ stack: true }), // Always capture stack but selectively print it
        winston.format.splat(),
        winston.format.printf(({ level, message, stack }) => 
            NODE_ENV === 'production' 
                ? `${level}: ${message}` 
                : `${level}: ${message}${stack ? `\n${stack}` : ''}` // Print stack in non-production environments
        ),
    ),
    transports: new winston.transports.Console({
        stderrLevels: ['info', 'error'],
    })
}
const logger = winston.createLogger(winstonConfig)

if (NODE_ENV !== 'production') {
    const debugTransport = new winston.transports.Console({
        format: winston.format.simple(),
        stderrLevels: ['error'],
    })
    debugTransport.on('logging', (_transport, info) => {
        console.log(`${info.message}\n${info.stack}`)
        debug.enable(info.namespace)
        debug(`${info.message}\n${info.stack}`)
        debug.disable(info.namespace)
    })
    logger.transports.push(debugTransport)
}

module.exports = logger
