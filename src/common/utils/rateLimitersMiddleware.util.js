const limiters = require('./rateLimiters.util.js')

const middleware = {
    repliconUpload: (req, res, next) => {
        limiters.repliconUpload.consume(`${req.ip} ${req.session.id}`)
            .then(() => {
                next()
            })
            .catch(() => {
                res.status(429).send('Too Many Requests')
            })
    },
    repliconReplicate: (req, res, next) => {
        limiters.repliconReplicate.consume(`${req.ip} ${req.session.id}`)
            .then(() => {
                next()
            })
            .catch(() => {
                res.status(429).send('Too Many Requests')
            })
    },
    aname: (req, res, next) => {
        limiters.aname(req).consume(`${req.ip} ${req.session.id}`)
            .then(() => {
                next()
            })
            .catch(() => {
                res.status(429).send('Too Many Requests')
            })
    }
}

module.exports = middleware