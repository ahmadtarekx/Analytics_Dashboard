// src/repositories/ProductRepository.js
// Repository Pattern: encapsulates all SQL for the `product` table.

const { getConnection } = require('../config/database');

class ProductRepository {
    /**
     * Retrieve all products ordered by name.
     * @returns {Array}
     */
    async findAll() {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT product_id, name, type, model,
                    price_before_profit, price_after_profit,
                    amount_avail, image
             FROM product ORDER BY name`
        );
        await connection.end();
        return rows;
    }

    /**
     * Get a product's details by ID (for context in deletion requests).
     * @param {string|number} productId
     * @returns {object|null}
     */
    async findById(productId) {
        const connection = await getConnection();
        const [rows] = await connection.execute(
            `SELECT product_id, name, type, model,
                    price_after_profit, amount_avail
             FROM product WHERE product_id = ?`,
            [productId]
        );
        await connection.end();
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Insert a new product (called from resolveApproval only).
     * @param {object} p
     */
    async create(p) {
        const connection = await getConnection();
        await connection.execute(
            `INSERT INTO product
             (product_id, name, type, model,
              price_before_profit, price_after_profit, amount_avail, image)
             VALUES (?,?,?,?,?,?,?,?)`,
            [
                p.product_id, p.name, p.type || null, p.model || null,
                parseFloat(p.price_before_profit) || 0,
                parseFloat(p.price_after_profit)  || 0,
                parseInt(p.amount_avail) || 0,
                p.image || null,
            ]
        );
        await connection.end();
    }

    /**
     * Delete a product by ID (called from resolveApproval only).
     * @param {string|number} productId
     */
    async delete(productId) {
        const connection = await getConnection();
        await connection.execute(
            `DELETE FROM product WHERE product_id = ?`, [productId]
        );
        await connection.end();
    }
}

module.exports = new ProductRepository();
