const Stripe = require('stripe')
const { roleUtils } = require('../utils')
const { keycloakService } = require('../services')
const { config, logger } = require('../../config')

const {
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET
} = config
const stripe = Stripe(STRIPE_SECRET_KEY)
const logNS = 'aname-backend:stripe:webhook'

function webhook(request, response) {
    const sig = request.headers['stripe-signature']

    let event

    try {
        event = stripe.webhooks.constructEvent(Buffer.from(request.body), sig, STRIPE_WEBHOOK_SECRET)
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`)
        return
    }

    logger.log({ level: 'info', namespace: logNS, message: `Received Stripe event: ${event}` })
    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const { metadata } = event.data.object
            const role = roleUtils.getRoleFromProductIds(metadata.productIds.split(','))

            if (!role) {
                logger.log({ level: 'info', namespace: logNS, message: `No role found for productIds: ${metadata.productIds.split(',')}` })
                break
            }
            // update the user role
            logger.log({ level: 'info', namespace: logNS, message: `Successfully completed Stripe payment_intent.succeeded webhook...` })
            break
        // ... handle other event types
        default:
            logger.log({ level: 'info', namespace: logNS, message: `Unhandled event type ${event.type}` })
    }

    // Return a 200 response to acknowledge receipt of the event
    response.send()
}

module.exports = webhook