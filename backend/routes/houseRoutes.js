const express = require('express');
const router = express.Router();
const houseController = require('../controllers/houseController');
const { auth, checkRole } = require('../middleware/authMiddleware');

// Student Routes
router.get('/browse', auth, houseController.getAllHouses);
router.post('/book/:id', auth, houseController.bookHouse);

// Admin Only Routes
router.post('/add', auth, checkRole(['admin']), houseController.createHouse);
router.patch('/status/:id', auth, checkRole(['admin']), houseController.toggleAvailability);

module.exports = router;