const express = require('express');
const router = express.Router();
const houseController = require('../controllers/houseController');
const { auth, checkRole } = require('../middleware/authMiddleware');

// Student Routes
router.get('/browse', auth, houseController.getAllHouses);
router.post('/like/:id', auth, houseController.toggleHouseLike);
router.post('/pay/:id', auth, houseController.payForUnlock);
router.post('/unlock/:id', auth, houseController.unlockOwnerContact);
router.post('/book/:id', auth, houseController.bookHouse);

// Admin Only Routes
router.post('/add', auth, checkRole(['admin']), houseController.createHouse);
router.patch('/status/:id', auth, checkRole(['admin']), houseController.toggleAvailability);
router.get('/admin/list', auth, checkRole(['admin']), houseController.adminListHouses);
router.patch('/admin/update/:id', auth, checkRole(['admin']), houseController.adminUpdateHouse);
router.patch('/admin/restore/:id', auth, checkRole(['admin']), houseController.adminRestoreHouse);
router.delete('/admin/delete/:id', auth, checkRole(['admin']), houseController.adminDeleteHouse);

module.exports = router;