const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { auth } = require('../middleware/authMiddleware');

router.get('/:moduleName', auth, profileController.getModuleHistory);

// THIS IS THE LINE YOU ARE LIKELY MISSING:
module.exports = router;