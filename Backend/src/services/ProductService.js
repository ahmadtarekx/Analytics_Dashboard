// src/services/ProductService.js
// Service Layer: staging product additions/deletions for manager approval.

const EmployeeRepository = require('../repositories/EmployeeRepository');
const ProductRepository  = require('../repositories/ProductRepository');
const TicketRepository   = require('../repositories/TicketRepository');

class ProductService {
    async getProducts() {
        return ProductRepository.findAll();
    }

    async stageAddProduct(productData) {
        let managerId = await EmployeeRepository.findManagerIdByDept(5);
        if (!managerId) { console.warn('No Inventory Manager (dept 5). Falling back to Owner 91949.'); managerId = 91949; }
        const payload = JSON.stringify({ action: 'ADD_PRODUCT', payload: productData });
        await TicketRepository.create(managerId, 'Inquiry', `[PENDING_APPROVAL] ${payload}`);
        return { message: 'Product addition staged. Sent to Inventory Manager for approval.' };
    }

    async stageDeleteProduct(pid, reason) {
        let managerId = await EmployeeRepository.findManagerIdByDept(5);
        if (!managerId) { console.warn('No Inventory Manager (dept 5). Falling back to Owner 91949.'); managerId = 91949; }
        const product = await ProductRepository.findById(pid) || { product_id: pid };
        const payload = JSON.stringify({
            action: 'DELETE_PRODUCT',
            payload: { product_id: product.product_id, name: product.name || '(Unknown)', type: product.type || '—', model: product.model || '—', price_after_profit: product.price_after_profit || 0, amount_avail: product.amount_avail || 0, removal_reason: reason || '(No reason provided)' },
        });
        await TicketRepository.create(managerId, 'Inquiry', `[PENDING_APPROVAL] ${payload}`);
        return { message: 'Product deletion staged. Sent to Inventory Manager for approval.' };
    }
}

module.exports = new ProductService();
