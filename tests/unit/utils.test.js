/**
 * Unit tests for pure utility functions copied from src/renderer/app.js.
 * These functions have no DOM or Electron dependencies and can run in Node.
 */

// ─── Copies of pure functions from app.js ─────────────────────────────────────

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '0,00 €';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dtStr) {
  if (!dtStr) return '-';
  const d = new Date(dtStr);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dtStr) {
  if (!dtStr) return '';
  const diff = Math.floor((Date.now() - new Date(dtStr)) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ayer';
  return formatDateTime(dtStr);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── formatDate tests ─────────────────────────────────────────────────────────

describe('formatDate', () => {
  test('formats a valid ISO date to DD/MM/YYYY', () => {
    const result = formatDate('2024-01-15');
    expect(result).toBe('15/01/2024');
  });

  test('formats another date correctly', () => {
    const result = formatDate('2026-03-12');
    expect(result).toBe('12/03/2026');
  });

  test('returns "-" for empty string', () => {
    expect(formatDate('')).toBe('-');
  });

  test('returns "-" for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  test('returns "-" for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });
});

// ─── formatCurrency tests ─────────────────────────────────────────────────────

describe('formatCurrency', () => {
  test('formats a typical amount with € symbol', () => {
    const result = formatCurrency(1234.5);
    expect(result).toContain('€');
    // Spanish locale: 1.234,50 €
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  test('formats zero as "0,00 €"', () => {
    const result = formatCurrency(0);
    expect(result).toContain('€');
    expect(result).toContain('0');
    expect(result).toContain('00');
  });

  test('returns "0,00 €" for null', () => {
    expect(formatCurrency(null)).toBe('0,00 €');
  });

  test('returns "0,00 €" for NaN', () => {
    expect(formatCurrency(NaN)).toBe('0,00 €');
  });

  test('formats negative values', () => {
    const result = formatCurrency(-50);
    expect(result).toContain('€');
    expect(result).toContain('50');
  });

  test('formats decimal values correctly', () => {
    const result = formatCurrency(99.99);
    expect(result).toContain('99');
    expect(result).toContain('€');
  });
});

// ─── timeAgo tests ────────────────────────────────────────────────────────────

describe('timeAgo', () => {
  test('returns empty string for null', () => {
    expect(timeAgo(null)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(timeAgo('')).toBe('');
  });

  test('returns "hace un momento" for date 30 seconds ago', () => {
    const thirtySecsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    expect(timeAgo(thirtySecsAgo)).toBe('hace un momento');
  });

  test('returns "hace un momento" for date 59 seconds ago', () => {
    const fiftyNineSecsAgo = new Date(Date.now() - 59 * 1000).toISOString();
    expect(timeAgo(fiftyNineSecsAgo)).toBe('hace un momento');
  });

  test('returns "hace N min" for date 5 minutes ago', () => {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinsAgo)).toBe('hace 5 min');
  });

  test('returns "hace N min" for date 30 minutes ago', () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(timeAgo(thirtyMinsAgo)).toBe('hace 30 min');
  });

  test('returns "hace N h" for date 2 hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('hace 2 h');
  });

  test('returns "hace N h" for date 5 hours ago', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    expect(timeAgo(fiveHoursAgo)).toBe('hace 5 h');
  });

  test('returns "ayer" for date 25 hours ago', () => {
    const yesterdayish = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    expect(timeAgo(yesterdayish)).toBe('ayer');
  });

  test('returns formatted date string for date older than 2 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    const result = timeAgo(threeDaysAgo);
    // Should NOT be one of the relative strings
    expect(result).not.toBe('hace un momento');
    expect(result).not.toBe('ayer');
    expect(result).not.toMatch(/^hace \d+ min$/);
    expect(result).not.toMatch(/^hace \d+ h$/);
    // Should contain year digits
    expect(result).toMatch(/\d{4}/);
  });
});

// ─── escapeHtml tests ─────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('returns empty string for null', () => {
    expect(escapeHtml(null)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('escapes & to &amp;', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  test('escapes < to &lt;', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  test('escapes > to &gt;', () => {
    expect(escapeHtml('1 > 0')).toBe('1 &gt; 0');
  });

  test('escapes " to &quot;', () => {
    expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  test('does not modify safe strings', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
  });
});
