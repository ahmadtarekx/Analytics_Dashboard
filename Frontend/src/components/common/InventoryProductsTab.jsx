/**
 * InventoryProductsTab.jsx — Department Tab Component
 *
 * Self-contained UI for the Inventory department (dept 5) product catalog.
 * Owns ALL inventory-specific state and API calls. No external context required.
 *
 * ── Features ────────────────────────────────────────────────────────────────
 *   • Request new product addition (staged for Inventory Manager approval)
 *   • Live image URL preview
 *   • Paginated product grid with sell price, cost, margin, stock badges
 *   • Request product removal (reason modal → Inventory Manager approval)
 *   • Skeleton loading states + error fallback
 *
 * ── Dependencies ────────────────────────────────────────────────────────────
 *   useAuth()          — user, language          (no useDashboard / no DashboardContext)
 *   productRepository  — all API calls via Repository Pattern
 *   useTranslation     — i18n strings
 *
 * ── API Endpoints (via productRepository) ───────────────────────────────────
 *   GET    /api/products              — fetch full catalog
 *   POST   /api/products              — stage new product addition
 *   DELETE /api/products/:id          — stage product removal (body: { reason })
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth }         from '../../context/AuthContext';
import { useTranslation }  from '../../hooks/useTranslation';
import productRepository   from '../../api/productRepository';
import { BASE_URL }        from '../../api/apiClient';
import Icon, { IC }        from '../../components/ui/Icon';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_PROD = {
  product_id: '', name: '', type: '', model: '',
  price_before_profit: '', price_after_profit: '',
  amount_avail: '', image: '',
};

const FIELD_CONFIG = [
  ['product_id',          'Product ID',  'P-001'],
  ['name',                'Name',        'Product name'],
  ['type',                'Type',        'Laptop'],
  ['model',               'Model',       'Dell XPS'],
  ['price_before_profit', 'Cost Price',  '0.00'],
  ['price_after_profit',  'Sell Price',  '0.00'],
  ['amount_avail',        'Stock Qty',   '0'],
];

// ── Local helpers ─────────────────────────────────────────────────────────────

const calcMargin = (cost, sell) => {
  const c = parseFloat(cost);
  const s = parseFloat(sell);
  if (!c || c <= 0) return '—';
  return `${(((s - c) / c) * 100).toFixed(1)}%`;
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** Status banner shared between add-form and removal modal */
const StatusBanner = ({ status }) => {
  if (!status) return null;
  const isErr = status.type === 'error';
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
      marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
      background: isErr ? 'rgba(239,68,68,0.1)'  : 'rgba(16,185,129,0.08)',
      color:      isErr ? '#ef4444'               : '#10b981',
      border:     `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
    }}>
      <Icon d={isErr ? IC.warn : IC.check} size={14} />
      {status.msg}
    </div>
  );
};

/** Skeleton placeholder for product cards while loading */
const ProductSkeleton = () => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
    <div className="skeleton" style={{ height: 160, borderRadius: 0 }} />
    <div style={{ padding: '14px 16px' }}>
      <div className="skeleton" style={{ height: 10, width: '40%', marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 15, width: '70%', marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
      </div>
    </div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function InventoryProductsTab() {
  const { user, language } = useAuth();
  const tx = useTranslation(language);
  const isAr = language === 'ar';

  // ── Product catalog ────────────────────────────────────────────────────────
  const [products,        setProducts]        = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError,   setProductsError]   = useState(null);

  // ── Add-product form ───────────────────────────────────────────────────────
  const [newProd,          setNewProd]          = useState(EMPTY_PROD);
  const [productActLoading,setProductActLoading]= useState(false);
  const [productStatus,    setProductStatus]    = useState(null);

  // ── Removal modal ──────────────────────────────────────────────────────────
  // null → closed  |  { product_id, name, reason, loading } → open
  const [removalModal, setRemovalModal] = useState(null);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadProducts = useCallback(async () => {
    if (productsLoading) return;
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await productRepository.getProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[InventoryProductsTab] loadProducts:', err.message);
      setProductsError(err.message || (isAr ? 'فشل تحميل المنتجات' : 'Failed to load products.'));
    } finally {
      setProductsLoading(false);
    }
  }, [productsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load on mount
  useEffect(() => {
    loadProducts();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddProduct = async () => {
    if (!newProd.product_id || !newProd.name) return;
    setProductActLoading(true);
    setProductStatus(null);
    try {
      const d = await productRepository.stageAddProduct(newProd);
      setProductStatus({ type: 'success', msg: d.message || (isAr ? 'تم إرسال الطلب للموافقة.' : 'Request staged for approval.') });
      setNewProd(EMPTY_PROD);
    } catch (err) {
      setProductStatus({ type: 'error', msg: err.message || (isAr ? 'خطأ في الشبكة.' : 'Network error.') });
    } finally {
      setProductActLoading(false);
    }
  };

  const openRemovalModal = (product) => {
    setProductStatus(null);
    setRemovalModal({ product_id: product.product_id, name: product.name, reason: '', loading: false });
  };

  const closeRemovalModal = () => {
    if (!removalModal?.loading) setRemovalModal(null);
  };

  const handleRemovalSubmit = async () => {
    if (!removalModal?.reason?.trim()) return;
    setRemovalModal(m => ({ ...m, loading: true }));
    try {
      // DELETE with body — productRepository.stageDeleteProduct doesn't carry a reason,
      // so we call the raw endpoint here to include the { reason } payload.
      const res = await fetch(
        `${BASE_URL}/products/${encodeURIComponent(removalModal.product_id)}`,
        {
          method:  'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ reason: removalModal.reason.trim() }),
        }
      );
      const d = await res.json();
      if (res.ok) {
        setProductStatus({ type: 'success', msg: d.message || (isAr ? 'تم إرسال طلب الإزالة.' : 'Removal request submitted.') });
        setRemovalModal(null);
        loadProducts();
      } else {
        setProductStatus({ type: 'error', msg: d.error || (isAr ? 'فشل إرسال الطلب.' : 'Failed to submit removal request.') });
        setRemovalModal(m => ({ ...m, loading: false }));
      }
    } catch {
      setProductStatus({ type: 'error', msg: isAr ? 'خطأ في الشبكة.' : 'Network error.' });
      setRemovalModal(m => ({ ...m, loading: false }));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div style={{ animation: 'fadeUp 0.3s ease' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>
              {tx?.products ?? (isAr ? 'كتالوج المنتجات' : 'Product Catalog')}
            </h1>
            <div style={{ height: 3, width: 44, background: 'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius: 2, marginTop: 7 }} />
          </div>
          <button
            onClick={loadProducts}
            disabled={productsLoading}
            style={{ padding: '8px 16px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s', opacity: productsLoading ? 0.6 : 1 }}
          >
            {productsLoading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '↻'}
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>

        {/* ── Add Product Form ── */}
        <div className="ticket-card" style={{ marginBottom: 24 }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
          <div style={{ padding: '20px 24px' }}>

            {/* Form header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Icon d={IC.plus} size={15} color="#10b981" />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>
                {isAr ? 'طلب إضافة منتج جديد' : 'Request New Product Addition'}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <Icon d={IC.shield} size={10} color="#f59e0b" />
                {tx?.requiresInvApproval ?? (isAr ? 'يتطلب موافقة المدير' : 'Requires Manager Approval')}
              </span>
            </div>

            <StatusBanner status={productStatus} />

            {/* Field grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 9, marginBottom: 10 }}>
              {FIELD_CONFIG.map(([k, lbl, ph]) => (
                <div key={k}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 5 }}>
                    {lbl}
                  </label>
                  <input
                    value={newProd[k]}
                    onChange={e => setNewProd(p => ({ ...p, [k]: e.target.value }))}
                    className="it-sm"
                    placeholder={ph}
                  />
                </div>
              ))}
            </div>

            {/* Image URL */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '.6px', display: 'block', marginBottom: 5 }}>
                {isAr ? 'رابط الصورة (اختياري)' : 'Image URL (optional)'}
              </label>
              <input
                value={newProd.image}
                onChange={e => setNewProd(p => ({ ...p, image: e.target.value }))}
                className="it-sm"
                placeholder="https://... or leave blank"
              />
            </div>

            {/* Image preview */}
            {newProd.image && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                <img
                  src={newProd.image}
                  alt="preview"
                  style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', padding: 3 }}
                  onError={e => { e.target.style.opacity = '.3'; }}
                />
                <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{isAr ? 'معاينة الصورة' : 'Image Preview'}</span>
              </div>
            )}

            {/* Info notice */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(79,124,255,0.06)', border: '1px solid rgba(79,124,255,0.15)', borderRadius: 9, marginBottom: 14, fontSize: 12, color: 'var(--txt2)' }}>
              <Icon d={IC.warn} size={12} color="var(--accent2)" />
              {isAr
                ? 'سيتم مراجعة هذا الطلب من قِبل مدير المخزون قبل إضافة أي منتج إلى الكتالوج.'
                : 'This request will be staged and sent to the Inventory Manager for approval before any product is added to the catalog.'}
            </div>

            <button
              onClick={handleAddProduct}
              disabled={productActLoading || !newProd.product_id || !newProd.name}
              className="it-btn"
              style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}
            >
              {productActLoading
                ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} /> {isAr ? 'جارٍ الإرسال...' : 'Submitting for Approval...'}</>
                : <><Icon d={IC.plus} size={13} /> {isAr ? 'طلب إضافة منتج' : 'Submit Addition Request'}</>}
            </button>
          </div>
        </div>

        {/* ── Product Grid ── */}
        {productsLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        ) : productsError ? (
          <div style={{ textAlign: 'center', padding: '52px', background: 'var(--surface)', border: '1px dashed rgba(239,68,68,0.3)', borderRadius: 16 }}>
            <Icon d={IC.warn} size={28} color="#ef4444" style={{ display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginTop: 12 }}>{productsError}</div>
            <button
              onClick={loadProducts}
              style={{ marginTop: 16, padding: '8px 20px', borderRadius: 9, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {products.map((p, i) => (
              <div key={p.product_id} className="prod-card" style={{ animationDelay: `${i * 0.04}s` }}>

                {/* Product image / placeholder */}
                {p.image
                  ? <img
                      src={p.image}
                      alt={p.name}
                      className="prod-img"
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  : null}
                <div className="prod-ph" style={{ display: p.image ? 'none' : 'flex' }}>
                  <Icon d={IC.pkg} size={36} color="var(--txt3)" />
                </div>

                {/* Product details */}
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>
                    {[p.type, p.model].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 10, lineHeight: 1.3 }}>{p.name}</div>

                  {/* Sell Price + Stock badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 8 }}>
                    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '7px 9px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>
                        {isAr ? 'سعر البيع' : 'Sell Price'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                        {Number(p.price_after_profit || 0).toLocaleString()} EGP
                      </div>
                    </div>
                    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '7px 9px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>
                        {isAr ? 'المخزون' : 'Stock'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: p.amount_avail > 0 ? 'var(--txt)' : '#ef4444' }}>
                        {p.amount_avail} {isAr ? 'وحدة' : 'units'}
                      </div>
                    </div>
                  </div>

                  {/* Cost + Margin row */}
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '7px 9px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                        {isAr ? 'التكلفة' : 'Cost'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)' }}>
                        {Number(p.price_before_profit || 0).toLocaleString()} EGP
                      </div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
                    <div style={{ textAlign: isAr ? 'left' : 'right' }}>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                        {isAr ? 'الهامش' : 'Margin'}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>
                        {calcMargin(p.price_before_profit, p.price_after_profit)}
                      </div>
                    </div>
                  </div>

                  {/* Request removal */}
                  <button
                    onClick={() => openRemovalModal(p)}
                    style={{ width: '100%', padding: '7px', borderRadius: 8, background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .18s' }}
                  >
                    <Icon d={IC.trash} size={11} color="#f87171" />
                    {isAr ? 'طلب الإزالة' : 'Request Removal'}
                  </button>
                </div>
              </div>
            ))}

            {products.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0', color: 'var(--txt3)', fontSize: 14, fontWeight: 600 }}>
                {isAr ? 'لا توجد منتجات في الكتالوج.' : 'No products found in catalog.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Product Removal Modal ─────────────────────────────────────────────── */}
      {removalModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) closeRemovalModal(); }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', animation: 'fadeUp 0.2s ease' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon d={IC.trash} size={16} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>
                  {isAr ? 'طلب إزالة منتج' : 'Request Removal'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                  {isAr ? 'سيُرسَل هذا الطلب إلى مدير المخزون للموافقة.' : 'This will be sent to the Inventory Manager for approval.'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 6, fontWeight: 700 }}>
              {isAr ? 'المنتج:' : 'Product:'}{' '}
              <span style={{ color: 'var(--txt2)' }}>{removalModal.name}</span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 8, fontWeight: 700 }}>
              {isAr ? 'سبب الإزالة' : 'Reason for removal'}{' '}
              <span style={{ color: '#ef4444' }}>*</span>
            </div>

            <textarea
              rows={3}
              placeholder={isAr
                ? 'مثال: منتج متوقف، مخزون تالف، استُبدل بنموذج أحدث...'
                : 'e.g. Discontinued, damaged stock, replaced by newer model...'}
              value={removalModal.reason}
              onChange={e => setRemovalModal(m => ({ ...m, reason: e.target.value }))}
              disabled={removalModal.loading}
              style={{
                width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '10px 12px', color: 'var(--txt)', fontSize: 13,
                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5,
              }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={closeRemovalModal}
                disabled={removalModal.loading}
                style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--txt2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleRemovalSubmit}
                disabled={removalModal.loading || !removalModal.reason?.trim()}
                style={{ padding: '8px 18px', borderRadius: 9, background: '#ef4444', border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: (removalModal.loading || !removalModal.reason?.trim()) ? 0.5 : 1, transition: 'opacity .15s' }}
              >
                {removalModal.loading
                  ? <span className="spinner" style={{ width: 12, height: 12 }} />
                  : <Icon d={IC.trash} size={12} color="#fff" />}
                {isAr ? 'إرسال الطلب' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
