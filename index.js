const router = module.exports = require('express').Router();
const users = require('./users')
//router.use('/boats', require('./boat'));
//router.use('/loads', require('./load'));
router.use('/', users.router);