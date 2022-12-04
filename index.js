const router = module.exports = require('express').Router();
const users = require('./users');
const boats = require('./boats');
const loads = require('./loads');
router.use('/boats', boats.router);
router.use('/loads', loads.router);
router.use('/', users.router);