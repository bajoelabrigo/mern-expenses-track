//! Billetes y monedas de cada moneda, de mayor a menor, tal como se ordenan
//! en la mesa al contar la ofrenda. Con esto la hoja de conteo se parece a lo
//! que la tesorería hace de verdad: apilar por denominación y contar cuántos.
//!
//! Solo están las monedas donde sabemos las denominaciones. Para las demás la
//! hoja pide solo el total, que es mejor que inventarse unos billetes que no
//! existen.
export const DENOMINATIONS = {
  PEN: [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1],
  USD: [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05],
  MXN: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5],
  COP: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100],
  CLP: [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10],
  ARS: [20000, 10000, 2000, 1000, 500, 200, 100, 50],
  BOB: [200, 100, 50, 20, 10, 5, 2, 1, 0.5],
  DOP: [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1],
  GTQ: [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25],
  CRC: [50000, 20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25],
  PYG: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500],
  UYU: [2000, 1000, 500, 200, 100, 50, 10, 5, 2, 1],
  BRL: [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05],
  HNL: [500, 100, 50, 20, 10, 5, 2, 1],
  NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  VES: [100, 50, 20, 10, 5, 1],
};

export const denominationsFor = (currency) => DENOMINATIONS[currency] || [];

//! Suma el desglose: [{ value, count }] → total. En unidades, no en centavos:
//! se redondea a dos decimales para que 0.1 × 3 no dé 0.30000000000000004.
export const sumBreakdown = (rows) =>
  Number(
    rows
      .reduce((total, { value, count }) => total + Number(value) * (Number(count) || 0), 0)
      .toFixed(2)
  );
