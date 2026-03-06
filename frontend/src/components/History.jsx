import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const SEVERITY_OPTIONS   = ['Minor', 'Moderate', 'Severe', 'Total Loss'];
const BOL_STATUS_OPTIONS = [
  { value: 'signed_clean',    label: 'Signed Clean' },
  { value: 'damage_notated',  label: 'Damage Notated' },
  { value: 'not_signed',      label: 'Not Signed' },
  { value: 'no_bol',          label: 'No BOL' },
];
const CATEGORY_OPTIONS   = ['dining', 'living', 'bedroom', 'office', 'accent', 'outdoor'];
const STATUS_OPTIONS     = ['pending', 'processing', 'complete'];
const VERDICT_OPTIONS    = ['manufacturing', 'transit', 'inconclusive'];

const SORT_OPTIONS = [
  { value: 'created_at',      label: 'Date Created' },
  { value: 'updated_at',      label: 'Last Updated' },
  { value: 'severity',        label: 'Severity' },
  { value: 'carrier',         label: 'Carrier' },
  { value: 'category',        label: 'Category' },
  { value: 'status',          label: 'Status' },
  { value: 'confidence_score', label: 'Confidence Score' },
  { value: 'verdict',         label: 'Verdict' },
];

const verdictColor = (v) => {
  if (v === 'transit')       return { bg: '#fff3cd', text: '#856404', border: '#ffc107' };
  if (v === 'manufacturing') return { bg: '#f8d7da', text: '#721c24', border: '#dc3545' };
  if (v === 'inconclusive')  return { bg: '#e2e3e5', text: '#383d41', border: '#adb5bd' };
  return { bg: '#f8f9fa', text: '#6c757d', border: '#dee2e6' };
};

const statusColor = (s) => {
  if (s === 'complete')   return '#28a745';
  if (s === 'processing') return '#ffc107';
  return '#6c757d';
};

const formatDate = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';

function Badge({ label, style }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: '0.75rem',
      fontWeight: 600,
      border: `1px solid ${style.border}`,
      background: style.bg,
      color: style.text,
    }}>
      {label}
    </span>
  );
}

function FilterPanel({ filters, setFilters, onReset }) {
  const update = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  return (
    <div style={{
      background: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <strong style={{ fontSize: '0.95rem' }}>🔍 Filters</strong>
        <button
          onClick={onReset}
          style={{
            background: 'none', border: '1px solid #adb5bd', borderRadius: 6,
            padding: '3px 10px', cursor: 'pointer', fontSize: '0.8rem', color: '#6c757d',
          }}
        >
          Reset All
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>

        {/* Search */}
        <div>
          <label style={labelStyle}>Search</label>
          <input
            type="text"
            placeholder="Item, carrier, warehouse..."
            value={filters.search}
            onChange={e => update('search', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Status */}
        <div>
          <label style={labelStyle}>Status</label>
          <select value={filters.status} onChange={e => update('status', e.target.value)} style={inputStyle}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{capitalize(s)}</option>)}
          </select>
        </div>

        {/* Verdict */}
        <div>
          <label style={labelStyle}>Verdict</label>
          <select value={filters.verdict} onChange={e => update('verdict', e.target.value)} style={inputStyle}>
            <option value="">All Verdicts</option>
            {VERDICT_OPTIONS.map(v => <option key={v} value={v}>{capitalize(v)}</option>)}
          </select>
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>Category</label>
          <select value={filters.category} onChange={e => update('category', e.target.value)} style={inputStyle}>
            <option value="">All Categories</option>
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{capitalize(c)}</option>)}
          </select>
        </div>

        {/* Severity */}
        <div>
          <label style={labelStyle}>Severity</label>
          <select value={filters.severity} onChange={e => update('severity', e.target.value)} style={inputStyle}>
            <option value="">All Severities</option>
            {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* BOL Status */}
        <div>
          <label style={labelStyle}>BOL Status</label>
          <select value={filters.bol_status} onChange={e => update('bol_status', e.target.value)} style={inputStyle}>
            <option value="">All BOL Statuses</option>
            {BOL_STATUS_OPTIONS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>

        {/* Carrier */}
        <div>
          <label style={labelStyle}>Carrier</label>
          <input
            type="text"
            placeholder="e.g. FedEx"
            value={filters.carrier}
            onChange={e => update('carrier', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Warehouse */}
        <div>
          <label style={labelStyle}>Warehouse</label>
          <input
            type="text"
            placeholder="e.g. Dallas"
            value={filters.warehouse}
            onChange={e => update('warehouse', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Date From */}
        <div>
          <label style={labelStyle}>Date From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => update('date_from', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Date To */}
        <div>
          <label style={labelStyle}>Date To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => update('date_to', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Min Confidence */}
        <div>
          <label style={labelStyle}>Min Confidence %</label>
          <input
            type="number"
            min="0" max="100"
            placeholder="0"
            value={filters.min_confidence}
            onChange={e => update('min_confidence', e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Max Confidence */}
        <div>
          <label style={labelStyle}>Max Confidence %</label>
          <input
            type="number"
            min="0" max="100"
            placeholder="100"
            value={filters.max_confidence}
            onChange={e => update('max_confidence', e.target.value)}
            style={inputStyle}
          />
        </div>

      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#495057',
  marginBottom: 4,
};

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ced4da',
  borderRadius: 6,
  fontSize: '0.85rem',
  background: '#fff',
  boxSizing: 'border-box',
};

const EMPTY_FILTERS = {
  search:         '',
  status:         '',
  verdict:        '',
  category:       '',
  severity:       '',
  bol_status:     '',
  carrier:        '',
  warehouse:      '',
  date_from:      '',
  date_to:        '',
  min_confidence: '',
  max_confidence: '',
};

function History({ onViewCase }) {
  const [cases, setCases]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [page, setPage]           = useState(1);
  const [pageSize]                = useState(20);
  const [sortBy, setSortBy]       = useState('created_at');
  const [sortDir, setSortDir]     = useState('desc');
  const [filters, setFilters]     = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('page_size', pageSize);
      params.set('sort_by', sortBy);
      params.set('sort_dir', sortDir);

      if (filters.search)         params.set('search', filters.search);
      if (filters.status)         params.set('status', filters.status);
      if (filters.verdict)        params.set('verdict', filters.verdict);
      if (filters.category)       params.set('category', filters.category);
      if (filters.severity)       params.set('severity', filters.severity);
      if (filters.bol_status)     params.set('bol_status', filters.bol_status);
      if (filters.carrier)        params.set('carrier', filters.carrier);
      if (filters.warehouse)      params.set('warehouse', filters.warehouse);
      if (filters.date_from)      params.set('date_from', filters.date_from);
      if (filters.date_to)        params.set('date_to', filters.date_to);
      if (filters.min_confidence) params.set('min_confidence', filters.min_confidence);
      if (filters.max_confidence) params.set('max_confidence', filters.max_confidence);

      const res = await fetch(`${API_BASE}/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCases(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(`Failed to load cases: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortDir, filters]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters, sortBy, sortDir]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span style={{ color: '#ccc', marginLeft: 4 }}>↕</span>;
    return <span style={{ color: '#667eea', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thStyle = (field) => ({
    padding: '10px 12px',
    textAlign: 'left',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#495057',
    background: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  });

  const tdStyle = {
    padding: '10px 12px',
    fontSize: '0.85rem',
    borderBottom: '1px solid #f0f0f0',
    verticalAlign: 'middle',
  };

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#2d3748' }}>📋 Case History</h2>
          <p style={{ margin: '4px 0 0', color: '#6c757d', fontSize: '0.85rem' }}>
            {total} case{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowFilters(f => !f)}
            style={{
              padding: '8px 16px',
              border: '1px solid #667eea',
              borderRadius: 8,
              background: showFilters ? '#667eea' : '#fff',
              color: showFilters ? '#fff' : '#667eea',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            🔍 Filters
            {activeFilterCount > 0 && (
              <span style={{
                background: '#dc3545',
                color: '#fff',
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={fetchCases}
            style={{
              padding: '8px 16px',
              border: '1px solid #dee2e6',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: '#495057',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <FilterPanel filters={filters} setFilters={setFilters} onReset={resetFilters} />
      )}

      {/* Sort Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#6c757d', fontWeight: 600 }}>Sort by:</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleSort(opt.value)}
            style={{
              padding: '4px 10px',
              border: `1px solid ${sortBy === opt.value ? '#667eea' : '#dee2e6'}`,
              borderRadius: 6,
              background: sortBy === opt.value ? '#eef2ff' : '#fff',
              color: sortBy === opt.value ? '#667eea' : '#6c757d',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: sortBy === opt.value ? 700 : 400,
            }}
          >
            {opt.label}
            {sortBy === opt.value && (
              <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#f8d7da', border: '1px solid #f5c6cb',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#721c24',
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>
          Loading cases...
        </div>
      )}

      {/* Empty State */}
      {!loading && cases.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 60, color: '#6c757d',
          background: '#f8f9fa', borderRadius: 10, border: '1px dashed #dee2e6',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📂</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No cases found</div>
          <div style={{ fontSize: '0.85rem' }}>
            {activeFilterCount > 0 ? 'Try adjusting your filters.' : 'Submit your first case to get started.'}
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && cases.length > 0 && (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #dee2e6' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                <th style={thStyle('created_at')} onClick={() => handleSort('created_at')}>
                  Date <SortIcon field="created_at" />
                </th>
                <th style={thStyle('category')} onClick={() => handleSort('category')}>
                  Item / Category <SortIcon field="category" />
                </th>
                <th style={thStyle('carrier')} onClick={() => handleSort('carrier')}>
                  Carrier <SortIcon field="carrier" />
                </th>
                <th style={thStyle('severity')} onClick={() => handleSort('severity')}>
                  Severity <SortIcon field="severity" />
                </th>
                <th style={thStyle('verdict')} onClick={() => handleSort('verdict')}>
                  Verdict <SortIcon field="verdict" />
                </th>
                <th style={thStyle('confidence_score')} onClick={() => handleSort('confidence_score')}>
                  Confidence <SortIcon field="confidence_score" />
                </th>
                <th style={thStyle('status')} onClick={() => handleSort('status')}>
                  Status <SortIcon field="status" />
                </th>
                <th style={{ ...thStyle(), cursor: 'default' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c, idx) => {
                const vc = verdictColor(c.verdict);
                return (
                  <tr
                    key={c.id}
                    style={{
                      background: idx % 2 === 0 ? '#fff' : '#fafafa',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafafa'}
                  >
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{formatDate(c.created_at)}</div>
                      <div style={{ color: '#aaa', fontSize: '0.72rem' }}>
                        {c.id.slice(0, 8).toUpperCase()}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{c.item_name || '—'}</div>
                      <div style={{ color: '#6c757d', fontSize: '0.78rem' }}>
                        {capitalize(c.category)}{c.subcategory ? ` › ${c.subcategory}` : ''}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div>{c.carrier || '—'}</div>
                      {c.warehouse && (
                        <div style={{ color: '#6c757d', fontSize: '0.78rem' }}>{c.warehouse}</div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {c.severity ? (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: c.severity === 'Total Loss' ? '#f8d7da'
                            : c.severity === 'Severe' ? '#fff3cd'
                            : c.severity === 'Moderate' ? '#d1ecf1'
                            : '#d4edda',
                          color: c.severity === 'Total Loss' ? '#721c24'
                            : c.severity === 'Severe' ? '#856404'
                            : c.severity === 'Moderate' ? '#0c5460'
                            : '#155724',
                        }}>
                          {c.severity}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={tdStyle}>
                      {c.verdict ? (
                        <Badge label={capitalize(c.verdict)} style={vc} />
                      ) : (
                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>Pending</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {c.confidence_score != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 60, height: 6, background: '#e9ecef', borderRadius: 3, overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${c.confidence_score}%`,
                              height: '100%',
                              background: c.confidence_score >= 70 ? '#28a745'
                                : c.confidence_score >= 50 ? '#ffc107' : '#dc3545',
                              borderRadius: 3,
                            }} />
                          </div>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {c.confidence_score}%
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#aaa', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block',
                        width: 8, height: 8,
                        borderRadius: '50%',
                        background: statusColor(c.status),
                        marginRight: 6,
                      }} />
                      <span style={{ fontSize: '0.82rem' }}>{capitalize(c.status)}</span>
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => setSelectedCase(c)}
                        style={{
                          padding: '4px 10px',
                          border: '1px solid #667eea',
                          borderRadius: 6,
                          background: '#fff',
                          color: '#667eea',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          gap: 8, marginTop: 20,
        }}>
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            style={pageBtnStyle(page === 1)}
          >«</button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={pageBtnStyle(page === 1)}
          >‹</button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p;
            if (totalPages <= 5) {
              p = i + 1;
            } else if (page <= 3) {
              p = i + 1;
            } else if (page >= totalPages - 2) {
              p = totalPages - 4 + i;
            } else {
              p = page - 2 + i;
            }
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  ...pageBtnStyle(false),
                  background: page === p ? '#667eea' : '#fff',
                  color: page === p ? '#fff' : '#495057',
                  border: `1px solid ${page === p ? '#667eea' : '#dee2e6'}`,
                  fontWeight: page === p ? 700 : 400,
                }}
              >
                {p}
              </button>
            );
          })}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={pageBtnStyle(page === totalPages)}
          >›</button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages}
            style={pageBtnStyle(page === totalPages)}
          >»</button>

          <span style={{ fontSize: '0.8rem', color: '#6c757d', marginLeft: 8 }}>
            Page {page} of {totalPages} ({total} total)
          </span>
        </div>
      )}

      {/* Case Detail Modal */}
      {selectedCase && (
        <CaseDetailModal
          caseItem={selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </div>
  );
}

const pageBtnStyle = (disabled) => ({
  padding: '6px 10px',
  border: '1px solid #dee2e6',
  borderRadius: 6,
  background: disabled ? '#f8f9fa' : '#fff',
  color: disabled ? '#adb5bd' : '#495057',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '0.85rem',
  minWidth: 34,
});

function CaseDetailModal({ caseItem: c, onClose }) {
  const [fullCase, setFullCase] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/cases/${c.id}`);
        if (res.ok) {
          const data = await res.json();
          setFullCase(data);
        }
      } catch (e) {
        console.error('Failed to load case detail:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [c.id]);

  const vc = verdictColor(c.verdict);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, maxWidth: 680, width: '100%',
        maxHeight: '85vh', overflowY: 'auto', padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
              {fullCase?.case?.itemName || c.item_name || 'Case Details'}
            </h3>
            <div style={{ color: '#6c757d', fontSize: '0.8rem', marginTop: 4 }}>
              ID: {c.id.slice(0, 8).toUpperCase()} · {formatDate(c.created_at)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '1.4rem',
              cursor: 'pointer', color: '#6c757d', lineHeight: 1,
            }}
          >×</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6c757d' }}>Loading...</div>
        ) : (
          <>
            {/* Verdict */}
            {c.verdict && (
              <div style={{
                background: vc.bg, border: `1px solid ${vc.border}`,
                borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: vc.text, fontSize: '1rem' }}>
                    {c.verdict.toUpperCase()}
                  </div>
                  <div style={{ color: vc.text, fontSize: '0.8rem', opacity: 0.8 }}>
                    AI Verdict
                  </div>
                </div>
                {c.confidence_score != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.4rem', color: vc.text }}>
                      {c.confidence_score}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: vc.text, opacity: 0.8 }}>Confidence</div>
                  </div>
                )}
              </div>
            )}

            {/* Case Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                ['Category', `${c.category || '—'}${c.subcategory ? ' › ' + c.subcategory : ''}`],
                ['Carrier', c.carrier || '—'],
                ['Warehouse', c.warehouse || '—'],
                ['Severity', c.severity || '—'],
                ['BOL Status', c.bol_status?.replace('_', ' ') || '—'],
                ['Delivery Date', formatDate(c.delivery_date)],
                ['Notification Date', formatDate(c.notification_date)],
                ['Status', capitalize(c.status)],
              ].map(([label, value]) => (
                <div key={label} style={{
                  background: '#f8f9fa', borderRadius: 6, padding: '8px 12px',
                }}>
                  <div style={{ fontSize: '0.72rem', color: '#6c757d', fontWeight: 600, marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Reasoning */}
            {fullCase?.verdict?.reasoning && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6 }}>AI Reasoning</div>
                <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.7, color: '#495057' }}>
                  {fullCase.verdict.reasoning}
                </p>
              </div>
            )}

            {/* Photos */}
            {fullCase?.evidence?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
                  Photos ({fullCase.evidence.length})
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {fullCase.evidence.map((ev, i) => (
                    <img
                      key={i}
                      src={`${API_BASE}${ev.url}`}
                      alt={`Photo ${i + 1}`}
                      style={{
                        width: 100, height: 80, objectFit: 'cover',
                        borderRadius: 6, border: '1px solid #dee2e6',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Claim Report Link */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #dee2e6' }}>
              <a
                href={`${API_BASE}/api/cases/${c.id}/claim-report`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  background: '#667eea',
                  color: '#fff',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                📄 View Full Claim Report
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default History;