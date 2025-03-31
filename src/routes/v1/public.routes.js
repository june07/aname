const express = require('express')
const router = express.Router()

const { validateRequest } = require('../../middleware/validate')
const { checkJwt } = require('../../middleware/auth.middleware')
const { anameValidations } = require('../../common/validations')
const { anameController } = require('../../common/controllers')

router.route('/:publicKey')
    .get(checkJwt, validateRequest(anameValidations.public.aname), anameController.public.aname)

module.exports = router
