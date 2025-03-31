const express = require('express')
const router = express.Router()

const webhookRoutes = require('./webhook.routes')
const publicRoutes = require('./public.routes')
const coreRoutes = require('./core.routes')

const defaultRoutes = [
    {
        path: '/webhook',
        route: webhookRoutes,
    },
    {
        path: '/aname/public',
        route: publicRoutes,
    },
    {
        path: '/aname',
        route: coreRoutes,
    }
]

defaultRoutes.forEach(route => {
    router.use(route.path, route.route)
})

module.exports = router
