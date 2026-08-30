const express = require('express');
const mapController = require('../controllers/mapController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

router.get('/places', mapController.getPlaces);
router.post('/collect', mapController.collectPlace);
router.get('/locations', mapController.getUserLocations);
router.post('/position', mapController.updatePosition);
router.get('/leaderboard', mapController.getLeaderboard);

module.exports = router;
