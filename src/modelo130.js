// ─── Modelo 130 (IRPF, estimación directa, pago fraccionado) ──────────────────
// Follows the AEAT instructions for section I (casillas 01-07) and section III
// (12-19). Section II (agriculture) does not apply. Casilla 16 (deduction for a home
// bought before 2013) and 18 (complementary returns) are left at 0.
//
// The model is CUMULATIVE: each quarter declares income, expenses and withholdings
// from 1 January to the end of that quarter, and subtracts what was already paid in
// the previous quarters (casilla 05).

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

// Casilla 13: reduction per quarter when the previous year's net income was <= 12.000 €
// (art. 110.3.c del Reglamento del IRPF). No activity the year before counts as 0 €.
function minoracion(prevYearNet) {
  if (prevYearNet == null) return 0;
  if (prevYearNet <= 9000) return 100;
  if (prevYearNet <= 10000) return 75;
  if (prevYearNet <= 11000) return 50;
  if (prevYearNet <= 12000) return 25;
  return 0;
}

/**
 * @param quarters  4 entries with this quarter's own (not cumulative) amounts:
 *                  { base: income, gastos_deducibles: deductible expenses, irpf: withholdings }
 * @param options   prevYearNet: net income of the previous year (casilla 13), null if unknown
 *                  porcentaje: casilla 04 rate (0.20 in general, 0.08 in Ceuta and Melilla)
 */
function calcModelo130(quarters, { prevYearNet = null, porcentaje = 0.20 } = {}) {
  const c13Value = minoracion(prevYearNet);
  let acc01 = 0, acc02 = 0, acc06 = 0;
  let paidBefore = 0;      // positive casillas 07 of previous quarters (→ casilla 05)
  let negativesLeft = 0;   // negative casillas 19 not yet deducted (→ casilla 15)

  return quarters.map((q, i) => {
    acc01 += q.base || 0;
    acc02 += q.gastos_deducibles || 0;
    acc06 += q.irpf || 0;

    const c01 = round2(acc01);
    const c02 = round2(acc02);
    const c03 = round2(c01 - c02);                       // may be negative
    const c04 = round2(Math.max(c03, 0) * porcentaje);
    const c05 = round2(paidBefore);
    const c06 = round2(acc06);
    const c07 = round2(c04 - c05 - c06);                 // may be negative

    const c12 = Math.max(c07, 0);                        // 07 + 11 (no section II), never negative
    const c13 = c13Value;
    const c14 = round2(c12 - c13);
    const c15 = c14 > 0 ? round2(Math.min(c14, negativesLeft)) : 0;
    const c16 = 0;
    const c17 = c14 > 0 ? round2(c14 - c15 - c16) : c14;
    const c18 = 0;
    const c19 = round2(c17 - c18);

    if (c07 > 0) paidBefore += c07;
    negativesLeft = round2(negativesLeft - c15 + (c19 < 0 ? -c19 : 0));

    return {
      quarter: i + 1, label: q.label || `T${i + 1}`,
      c01, c02, c03, c04, c05, c06, c07, c12, c13, c14, c15, c16, c17, c18, c19,
      aIngresar: Math.max(c19, 0)
    };
  });
}

module.exports = { calcModelo130, minoracion };
