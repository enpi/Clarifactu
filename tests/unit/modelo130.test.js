/**
 * Modelo 130 (src/modelo130.js), checked against the AEAT instructions
 * (sede.agenciatributaria.gob.es → Modelo 130 → Instrucciones). Expected values worked by hand.
 */
const { calcModelo130, minoracion } = require('../../src/modelo130');

const q = (base, gastos_deducibles = 0, irpf = 0) => ({ base, gastos_deducibles, irpf });

describe('section I: cumulative from 1 January', () => {
  // Income 6000 / 4000 / 0 / 5000, expenses 1000 / 1000 / 3000 / 0, no withholdings
  const r = calcModelo130([q(6000, 1000), q(4000, 1000), q(0, 3000), q(5000, 0)]);

  test('Q1: 01 6000, 02 1000, 03 5000, 04 1000, 05 0, 07 1000', () => {
    expect(r[0]).toMatchObject({ c01: 6000, c02: 1000, c03: 5000, c04: 1000, c05: 0, c06: 0, c07: 1000, c19: 1000 });
  });

  test('Q2 accumulates income and expenses and subtracts what Q1 paid (casilla 05)', () => {
    // 01 10000, 02 2000, 03 8000, 04 1600, 05 1000 → 07 600
    expect(r[1]).toMatchObject({ c01: 10000, c02: 2000, c03: 8000, c04: 1600, c05: 1000, c07: 600, c19: 600 });
  });

  test('Q3 with a negative 07: nothing to pay, and it does not count in later 05', () => {
    // 01 10000, 02 5000, 03 5000, 04 1000, 05 1600 → 07 -600 → 12 0 → 19 0
    expect(r[2]).toMatchObject({ c03: 5000, c04: 1000, c05: 1600, c07: -600, c12: 0, c19: 0, aIngresar: 0 });
  });

  test('Q4: 05 only adds the positive 07s (1000 + 600)', () => {
    // 01 15000, 02 5000, 03 10000, 04 2000, 05 1600 → 07 400
    expect(r[3]).toMatchObject({ c01: 15000, c03: 10000, c04: 2000, c05: 1600, c07: 400, c19: 400 });
  });

  test('over the year it pays 20 % of the annual net income (1000 + 600 + 0 + 400 = 2000)', () => {
    expect(r.reduce((s, x) => s + x.aIngresar, 0)).toBe(2000);
  });

  test('the old per-quarter calculation overcharged (it would have asked 1000 + 600 + 0 + 1000)', () => {
    const old = [q(6000, 1000), q(4000, 1000), q(0, 3000), q(5000, 0)]
      .map(x => Math.max(Math.max(x.base - x.gastos_deducibles, 0) * 0.2 - x.irpf, 0));
    expect(old.reduce((s, x) => s + x, 0)).toBe(2600);
  });
});

test('casilla 03 keeps its sign and 04 is 0 when it is negative', () => {
  const [r] = calcModelo130([q(1000, 3000)]);
  expect(r).toMatchObject({ c03: -2000, c04: 0, c07: 0, c19: 0 });
});

test('withholdings (casilla 06) are cumulative and subtracted', () => {
  const r = calcModelo130([q(1000, 0, 150), q(1000, 0, 150)]);
  expect(r[0]).toMatchObject({ c04: 200, c06: 150, c07: 50 });
  // 01 2000 → 04 400, 05 50, 06 300 → 07 50
  expect(r[1]).toMatchObject({ c01: 2000, c04: 400, c05: 50, c06: 300, c07: 50 });
});

test('Ceuta and Melilla: 8 %', () => {
  expect(calcModelo130([q(10000)], { porcentaje: 0.08 })[0].c04).toBe(800);
});

describe('section III: casilla 13 (minoración) and 15 (negative results)', () => {
  test.each([
    [null, 0], [0, 100], [9000, 100], [9000.01, 75], [10000, 75], [10000.01, 50],
    [11000, 50], [11000.01, 25], [12000, 25], [12000.01, 0]
  ])('previous year net %p → %p € per quarter', (prev, expected) => {
    expect(minoracion(prev)).toBe(expected);
  });

  test('the reduction applies every quarter and 05 still uses casilla 07, not 19', () => {
    const r = calcModelo130([q(6000, 1000), q(4000, 1000)], { prevYearNet: 8000 });
    expect(r[0]).toMatchObject({ c07: 1000, c13: 100, c14: 900, c19: 900 });
    expect(r[1]).toMatchObject({ c05: 1000, c07: 600, c13: 100, c14: 500, c19: 500 });
  });

  test('a negative 19 is deducted in later quarters through casilla 15', () => {
    // Q1: 07 50 - 100 → 14 -50 → 19 -50. Q2: 01 2500 → 04 500, 05 50 → 07 450 → 14 350, 15 50 → 19 300
    const r = calcModelo130([q(250), q(2250)], { prevYearNet: 5000 });
    expect(r[0]).toMatchObject({ c07: 50, c14: -50, c15: 0, c17: -50, c19: -50, aIngresar: 0 });
    expect(r[1]).toMatchObject({ c05: 50, c07: 450, c14: 350, c15: 50, c17: 300, c19: 300 });
  });

  test('casilla 15 never exceeds casilla 14 and the rest carries on', () => {
    // Q1: 07 0 → 14 -100 → 19 -100. Q2: 07 60 → 14 -40 → 19 -40 (pending 140).
    // Q3: 01 2000 → 04 400, 05 60 → 07 340 → 14 240, 15 140 → 19 100
    const r = calcModelo130([q(0), q(300), q(1700)], { prevYearNet: 0 });
    expect(r.map(x => x.c19)).toEqual([-100, -40, 100]);
    expect(r[2]).toMatchObject({ c14: 240, c15: 140 });
  });
});

test('amounts are rounded to cents', () => {
  const [r] = calcModelo130([q(1000.005, 0.003)]);
  expect(Number.isInteger(Math.round(r.c04 * 100))).toBe(true);
  expect(r.c04).toBe(200);
});
