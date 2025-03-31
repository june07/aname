const express = require('express')
const router = express.Router()

const { rateLimitersMiddleware } = require('../../common/utils')
const { validateRequest } = require('../../middleware/validate')
const { checkJwt, checkJwtAllow } = require('../../middleware/auth.middleware')
const { anameController } = require('../../common/controllers')
const { anameValidations } = require('../../common/validations')
const { checkNameGenerationAccess, apikeyCheck } = require('../../middleware')

router.route('/stats')
    .get(rateLimitersMiddleware.aname, checkJwt, anameController.anameStats)
router.route('/apikey')
    .get(rateLimitersMiddleware.aname, checkJwt, anameController.anameApiKey)
router.route('/:name')
    .get(rateLimitersMiddleware.aname, validateRequest(anameValidations.lookupAname), anameController.lookupAname)
router.route('/')
    .get(
        rateLimitersMiddleware.aname,
        checkJwtAllow,
        validateRequest(anameValidations.aname),
        apikeyCheck({ app: 'aname', errorOnMissing: false }),
        checkNameGenerationAccess, // Enforce authentication for generating names; unauthenticated users can generate only one.
        anameController.aname
    )

module.exports = router
