const Joi = require('joi')
const httpStatus = require('http-status')
const pick = require('../utils/pick')
const ApiError = require('../utils/ApiError')

const validateRequest = (schema) => (req, res, next) => {
    const validSchema = pick(schema, ['params', 'query', 'body', 'headers'])
    const object = pick(req, Object.keys(validSchema))
    const { value, error } = Joi.compile(validSchema)
        .prefs({ errors: { label: 'key' } })
        .validate(object)

    if (error) {
        const errorMessage = error.details.map((details) => details.message).join(', ')
        return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage))
    }
    Object.assign(req, value)
    return next()
}
const validatePayload = (payload, schema, callback) => new Promise((resolve, reject) => {
    const validSchema = pick(schema, ['payload'])
    const { _value, error } = Joi.compile(validSchema.payload)
        .prefs({ errors: { label: 'key' } })
        .validate(payload)

    if (error) {
        const errorMessage = error.details.map((details) => details.message).join(', ')
        if (callback) {
            callback(new ApiError(httpStatus.BAD_REQUEST, errorMessage))
        } else {
            reject(new ApiError(httpStatus.BAD_REQUEST, errorMessage))
        }
    } else {
        if (callback) {
            callback()
        } else {
            resolve()
        }
    }
})
const validateArgs = (args, schema, next) => {
    const validSchema = pick(schema, ['id', 'name', 'payload'])
    const object = pick(args, Object.keys(validSchema))
    const { value, error } = Joi.compile(validSchema)
        .prefs({ errors: { label: 'key' } })
        .validate(object)

    if (error) {
        const errorMessage = error.details.map((details) => details.message).join(', ')
        next(new ApiError(httpStatus.BAD_REQUEST, errorMessage))
    } else {
        Object.assign(args, value)
        next()
    }
}

module.exports = {
    validateRequest,
    validateArgs,
    validatePayload
}
