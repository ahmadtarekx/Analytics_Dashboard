// src/routes/productRoutes.js
const express = require('express');
const router  = express.Router();
const { getProducts, stageAddProduct, stageDeleteProduct } = require('../controllers/productController');

router.get('/',       getProducts);
router.post('/',      stageAddProduct);
router.delete('/:pid', stageDeleteProduct);

module.exports = router;
