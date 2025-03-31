const dotenv = require('dotenv')
const path = require('path')
const Joi = require('joi')

dotenv.config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env' : '../../.env.local') })

const envVarsSchema = Joi.object()
    .keys({
        NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
        PORT: Joi.number().default(3000),
        MONGODB_URI: Joi.string().required().description('Mongo DB URI'),
        COOKIE_DOMAIN: Joi.string().required().description('Cookie Domain'),
        DOMAIN: Joi.string().required().description('Main Site Domain'),
        CORS_DOMAINS: Joi.string().required(),
        EXPRESS_SESSION_SECRET: Joi.string().required(),
        REDIS_HOST_PASSWORD: Joi.string().required(),

        KEYCLOAK_DOMAIN: Joi.string().required(),
        KEYCLOAK_URL: Joi.string().required(),
        KEYCLOAK_REALM: Joi.string().required(),
        KEYCLOAK_CLIENT_ID: Joi.string().required(),
        KEYCLOAK_CLIENT_SECRET: Joi.string().required(),
        
        GITHUB_ORG: Joi.string().required(),
        GITHUB_USER: Joi.string().required(),
        GITHUB_PAT: Joi.string().required(),

        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),

        ANAME_PRIVATE_KEY: Joi.string().required(),
        ANAME_PUBLIC_KEY: Joi.string().required(),
        ANAME_API_KEY: Joi.string().required(),
        ANAME_API_URL: Joi.string().required(),
    })
    .unknown()

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env)

if (error) {
    throw new Error(`Config validation error: ${error.message}`)
}

module.exports = envVars
