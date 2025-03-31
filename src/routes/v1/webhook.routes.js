const express = require('express')
const router = express.Router()

const { stripeWebhook } = require('../../common/webhooks')

router.route('/stripe')
    .get((_request, response) => response.send('stripe webhook endpoint ok'))
    .post(stripeWebhook)

module.exports = router
