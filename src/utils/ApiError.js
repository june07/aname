const { config } = require('../config')

const { NODE_ENV } = config
// eslint-disable-next-line security/detect-non-literal-regexp
const re = new RegExp(`/home/\w*/${process.env.DOMAIN}-rest/g`)
class ApiError extends Error {
    constructor(statusCode, message, isOperational = true, stack = '') {
        super(message)
        this.statusCode = statusCode
        this.isOperational = isOperational

        if (NODE_ENV === 'production') {
            this.stack = ''
            return
        }

        if (stack) {
            this.stack = stack
        } else {
            Error.captureStackTrace(this, this.constructor)
        }
        this.stack = this.stack.replace(re, '/')
    }
}

module.exports = ApiError
