const express = require('express');
const mapController = require('../controllers/mapController');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

// ==================== PLACE DISCOVERY & PAGINATION ====================
router.get('/places', mapController.getPlaces);
router.get('/places/paginated', mapController.getPlacesPaginated);
router.get('/categories', mapController.getAvailableCategories);
router.get('/load-all', mapController.loadAllPlaces);

// ==================== COLLECTION & GAMEPLAY ====================
router.post('/collect', mapController.collectPlace);
router.get('/locations', mapController.getUserLocations);
router.post('/position', mapController.updatePosition);
router.get('/leaderboard', mapController.getLeaderboard);

// ==================== SYSTEM ====================
router.get('/status', mapController.getStatus);

module.exports = router;