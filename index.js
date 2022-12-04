const router = module.exports = require('express').Router();
const users = require('./users')
const boats = require('./boats')
router.use('/boats', boats.router);
//router.use('/loads', require('./load'));
router.use('/', users.router);