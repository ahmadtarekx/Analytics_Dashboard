/**
 * ProductsTab.jsx — Tab Component (Strategy Pattern)
 *
 * Extracted from old Dashboard.jsx / FinanceDashboardStrategy.
 *
 * Renders the Product Catalog view:
 *   - Add-product request form (staged for Manager approval)
 *   - Product grid with sell price, stock, margin, and removal request
 *   - Product removal confirmation modal (rendered inline, no portal)
 *
 * Props (all injected by the parent strategy — no context reads):
 *   language            {string}
 *   products            {Array}
 *   productsLoading     {boolean}
 *   productStatus       {object|null}   — { type: 'success'|'error', msg }
 *   setProductStatus    {Function}
 *   productRemovalModal {object|null}   — { product_id, name, reason, loading }
 *   setProductRemovalModal {Function}
 *   productActLoading   {boolean}
 *   setProductActLoading {Function}
 *   newProd             {object}        — { product_id, name, type, model, price_before_profit, price_after_profit, amount_avail, image }
 *   setNewProd          {Function}
 *   onLoadProducts      {Function}      — refresh catalog
 *   onAddProduct        {Function}      — submit new product request
 *   onRemoveProduct     {Function(product_id, name, reason)} — submit removal request
 */

import Icon, { IC } from '../ui/Icon';

// ── Sub-components ────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, overflow: 'hidden',
  }}>
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

export default function ProductsTab({
  language              = 'en',

  // Catalog
  products              = [],
  productsLoading       = false,
  onLoadProducts,

  // Add product form
  productStatus         = null,
  setProductStatus,
  productActLoading     = false,
  setProductActLoading,
  newProd               = { product_id: '', name: '', type: '', model: '', price_before_profit: '', price_after_profit: '', amount_avail: '', image: '' },
  setNewProd,
  onAddProduct,

  // Removal modal
  productRemovalModal   = null,
  setProductRemovalModal,
  onRemoveProduct,
}) {
  const FORM_FIELDS = [
    ['product_id',          'Product ID',   'P-001'],
    ['name',                'Name',         'Product name'],
    ['type',                'Type',         'Laptop'],
    ['model',               'Model',        'Dell XPS'],
    ['price_before_profit', 'Cost Price',   '0.00'],
    ['price_after_profit',  'Sell Price',   '0.00'],
    ['amount_avail',        'Stock Qty',    '0'],
  ];

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', letterSpacing: '-0.4px' }}>
            Product Catalog
          </h1>
          <div style={{
            height: 3, width: 44,
            background: 'linear-gradient(90deg,var(--accent),var(--accent2))',
            borderRadius: 2, marginTop: 7,
          }} />
        </div>
        <button
          onClick={onLoadProducts}
          style={{
            padding: '8px 16px', borderRadius: 9,
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--txt2)', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Add product form ── */}
      <div className="ticket-card" style={{ marginBottom: 24 }}>
        <div style={{ height: 4, background: 'linear-gradient(90deg,#10b981,#06b6d4)' }} />
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Icon d={IC.plus} size={15} color="#10b981" />
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>
              Request New Product Addition
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#f59e0b',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              padding: '3px 10px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <Icon d={IC.shield} size={10} color="#f59e0b" /> Requires Manager Approval
            </span>
          </div>

          {/* Status banner */}
          {productStatus && (
            <div style={{
              padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
              background: productStatus.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.08)',
              color:      productStatus.type === 'error' ? '#ef4444' : '#10b981',
              border:    `1px solid ${productStatus.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
            }}>
              <Icon d={productStatus.type === 'error' ? IC.warn : IC.check} size={14} />
              {productStatus.msg}
            </div>
          )}

          {/* Field grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 9, marginBottom: 10 }}>
            {FORM_FIELDS.map(([k, lbl, ph]) => (
              <div key={k}>
                <label style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--txt3)',
                  textTransform: 'uppercase', letterSpacing: '.6px',
                }}>
                  {lbl}
                </label>
                <input
                  value={newProd[k] ?? ''}
                  onChange={e => setNewProd?.(p => ({ ...p, [k]: e.target.value }))}
                  className="it-sm"
                  placeholder={ph}
                />
              </div>
            ))}
          </div>

          {/* Image URL */}
          <div style={{ marginBottom: 12 }}>
            <label style={{
              fontSize: 10, fontWeight: 700, color: 'var(--txt3)',
              textTransform: 'uppercase', letterSpacing: '.6px',
            }}>
              Image URL (optional)
            </label>
            <input
              value={newProd.image ?? ''}
              onChange={e => setNewProd?.(p => ({ ...p, image: e.target.value }))}
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
                style={{
                  width: 50, height: 50, objectFit: 'contain', borderRadius: 8,
                  background: 'var(--surface2)', border: '1px solid var(--border)', padding: 3,
                }}
                onError={e => { e.target.style.opacity = '.3'; }}
              />
              <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Image Preview</span>
            </div>
          )}

          {/* Info callout */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', background: 'rgba(79,124,255,0.06)',
            border: '1px solid rgba(79,124,255,0.15)', borderRadius: 9,
            marginBottom: 14, fontSize: 12, color: 'var(--txt2)',
          }}>
            <Icon d={IC.warn} size={12} color="var(--accent2)" />
            This request will be staged and sent to the Inventory Manager for approval before any product is added to the catalog.
          </div>

          <button
            onClick={onAddProduct}
            className="it-btn"
            disabled={productActLoading || !newProd.product_id || !newProd.name}
            style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 7 }}
          >
            {productActLoading
              ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(255,255,255,.3)', borderTopColor: '#fff' }} />Submitting for Approval...</>
              : <><Icon d={IC.plus} size={13} />{language === 'ar' ? 'طلب إضافة منتج' : 'Submit Addition Request'}</>}
          </button>
        </div>
      </div>

      {/* ── Product grid ── */}
      {productsLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {products.map((p, i) => (
            <div key={p.product_id} className="prod-card" style={{ animationDelay: `${i * 0.04}s` }}>
              {/* Product image */}
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

              <div style={{ padding: '14px 16px' }}>
                {/* Type · Model label */}
                <div style={{
                  fontSize: 10, color: 'var(--txt3)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4,
                }}>
                  {[p.type, p.model].filter(Boolean).join(' · ')}
                </div>

                {/* Product name */}
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 10 }}>
                  {p.name}
                </div>

                {/* Price + stock grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 8 }}>
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '7px 9px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Sell Price</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>
                      {Number(p.price_after_profit || 0).toLocaleString()} EGP
                    </div>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '7px 9px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>Stock</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: p.amount_avail > 0 ? 'var(--txt)' : '#ef4444' }}>
                      {p.amount_avail} units
                    </div>
                  </div>
                </div>

                {/* Cost + margin */}
                <div style={{
                  background: 'var(--surface2)', borderRadius: 8, padding: '7px 9px',
                  border: '1px solid var(--border)', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Cost</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt2)' }}>
                      {Number(p.price_before_profit || 0).toLocaleString()} EGP
                    </div>
                  </div>
                  <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Margin</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>
                      {p.price_before_profit > 0
                        ? `${(((p.price_after_profit - p.price_before_profit) / p.price_before_profit) * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Removal request */}
                <button
                  onClick={() => {
                    setProductRemovalModal?.({ product_id: p.product_id, name: p.name, reason: '', loading: false });
                    setProductStatus?.(null);
                  }}
                  style={{
                    width: '100%', padding: '7px', borderRadius: 8,
                    background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)',
                    color: '#f87171', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    transition: 'all .18s',
                  }}
                >
                  <Icon d={IC.trash} size={11} color="#f87171" /> Request Removal
                </button>
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div style={{
              gridColumn: '1/-1', textAlign: 'center', padding: '60px 0',
              color: 'var(--txt3)', fontSize: 14, fontWeight: 600,
            }}>
              No products found in catalog.
            </div>
          )}
        </div>
      )}

      {/* ── Removal confirmation modal ── */}
      {productRemovalModal && (
        <div className="modal-overlay" onClick={() => setProductRemovalModal?.(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
                  Request Product Removal
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)' }}>
                  {productRemovalModal.name}
                </div>
              </div>
              <button className="close-btn" onClick={() => setProductRemovalModal?.(null)}>
                <Icon d={IC.close} size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{
                padding: '12px 14px', background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 16,
                fontSize: 13, color: '#fca5a5', lineHeight: 1.6,
              }}>
                <Icon d={IC.warn} size={13} color="#fca5a5" style={{ marginRight: 6 }} />
                This will send a removal request to the Inventory Manager for approval. The product will not be deleted until approved.
              </div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Reason for Removal *
              </label>
              <textarea
                value={productRemovalModal.reason}
                onChange={e => setProductRemovalModal?.(m => ({ ...m, reason: e.target.value }))}
                className="it-input"
                rows="3"
                style={{ resize: 'vertical', marginTop: 8, marginBottom: 16 }}
                placeholder="Explain why this product should be removed..."
              />
              {productStatus && (
                <div style={{
                  padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                  marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
                  background: productStatus.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                  color:      productStatus.type === 'error' ? '#ef4444' : '#10b981',
                  border:    `1px solid ${productStatus.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.22)'}`,
                }}>
                  <Icon d={productStatus.type === 'error' ? IC.warn : IC.check} size={13} />
                  {productStatus.msg}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    if (!productRemovalModal.reason.trim()) return;
                    onRemoveProduct?.(productRemovalModal.product_id, productRemovalModal.name, productRemovalModal.reason);
                  }}
                  disabled={productRemovalModal.loading || !productRemovalModal.reason.trim()}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 9,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#ef4444', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    opacity: (productRemovalModal.loading || !productRemovalModal.reason.trim()) ? 0.5 : 1,
                  }}
                >
                  {productRemovalModal.loading
                    ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: 'rgba(239,68,68,.3)', borderTopColor: '#ef4444' }} />Submitting...</>
                    : <><Icon d={IC.trash} size={13} color="#ef4444" />Submit Removal Request</>}
                </button>
                <button
                  onClick={() => setProductRemovalModal?.(null)}
                  style={{
                    flex: 1, padding: '11px', borderRadius: 9,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--txt2)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
