// src/controllers/productController.js
// SRP: only handles HTTP request/response. All logic is in ProductService.

const ProductService = require('../services/ProductService');

const handle = (fn) => async (req, res, next) => { try { return res.json(await fn(req)); } catch (e) { next(e); } };

const getProducts        = handle(()   => ProductService.getProducts());
const stageAddProduct    = handle(req  => ProductService.stageAddProduct(req.body));
const stageDeleteProduct = handle(req  => ProductService.stageDeleteProduct(
    req.params.pid, req.body?.reason
));

module.exports = { getProducts, stageAddProduct, stageDeleteProduct };
