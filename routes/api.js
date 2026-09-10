const express = require('express');
const { auth, admin } = require('../middleware/auth');
const createAuth = require('../controllers/authController');
const createPlace = require('../controllers/placeController');

module.exports = (db) => {
  const router = express.Router();
  const authCtrl = createAuth(db);
  const placeCtrl = createPlace(db);

  // PUBLIC
  router.get('/health', (req, res) => res.json({ status: 'ok' }));
  router.post('/auth/register', authCtrl.register);
  router.post('/auth/login', authCtrl.login);
  router.post('/auth/logout', authCtrl.logout);
  router.get('/auth/seeded-users', authCtrl.seededUsers);
  router.get('/cities', (req, res) => res.json({ cities: require('../utils/cities') }));

  router.get('/places', placeCtrl.getPlaces);
  router.get('/places/:id', placeCtrl.getPlaceById);
  router.get('/categories', placeCtrl.getCategories);
  router.get('/category-points', placeCtrl.getCategoryPoints);   // NEW public

  // PROTECTED
  router.get('/auth/me', auth, authCtrl.me);
  router.post('/user/city', auth, authCtrl.setCity);
  router.post('/places/collect', auth, placeCtrl.collectPlace);
  router.get('/user/collections', auth, placeCtrl.getUserCollections);

  // ADMIN
  router.get('/admin/users', auth, admin, placeCtrl.adminGetUsers);
  router.get('/admin/collections', auth, admin, placeCtrl.adminGetCollections);
  router.delete('/admin/collections/:id', auth, admin, placeCtrl.adminDeleteCollection);
  router.get('/admin/category-points', auth, admin, placeCtrl.adminGetCategoryPoints);
  router.post('/admin/category-points', auth, admin, placeCtrl.adminSetCategoryPoints);   // NEW

  return router;
};