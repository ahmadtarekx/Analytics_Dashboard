/**
 * productRepository.js — Repository Pattern
 * Talks to: /api/products/*
 */

import { apiClient, BASE_URL } from './apiClient';

const ENDPOINT = `${BASE_URL}/products`;

const productRepository = {
  getProducts:      ()      => apiClient.get(ENDPOINT),
  stageAddProduct:  (body)  => apiClient.post(ENDPOINT, body),
  stageDeleteProduct:(pid)  => apiClient.delete(`${ENDPOINT}/${pid}`),
};

export default productRepository;
