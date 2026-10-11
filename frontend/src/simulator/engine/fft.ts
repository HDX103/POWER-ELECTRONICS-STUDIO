import { FFTResults } from '../types';

/**
 * Computes the Discrete Fourier Transform (DFT) over an integer number of periodic cycles
 * for harmonic spectral analysis up to maxOrder (default 25).
 */
export function computeFFT(
  signalV: number[],
  signalI: number[],
  samplesPerPeriod: number,
  baseFrequency: number,
  maxOrder = 25
): FFTResults {
  const N = Math.max(8, samplesPerPeriod);
  // Take the last complete period of the steady-state signal
  const startIdx = Math.max(0, signalV.length - N);
  const vSlice = signalV.slice(startIdx, startIdx + N);
  const iSlice = signalI.slice(startIdx, startIdx + N);

  const actualN = vSlice.length;
  if (actualN === 0) {
    return {
      orders: [],
      frequencies: [],
      voltages: [],
      currents: [],
      voltagesPct: [],
      currentsPct: [],
    };
  }

  const orders: number[] = [];
  const frequencies: number[] = [];
  const voltages: number[] = [];
  const currents: number[] = [];
  const voltagesPct: number[] = [];
  const currentsPct: number[] = [];

  // Compute Fundamental (order = 1) first for percentage base
  let v1 = 0;
  let i1 = 0;

  for (let n = 1; n <= maxOrder; n++) {
    let reV = 0;
    let imV = 0;
    let reI = 0;
    let imI = 0;

    for (let k = 0; k < actualN; k++) {
      const angle = (2 * Math.PI * n * k) / actualN;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const vVal = vSlice[k] || 0;
      const iVal = iSlice[k] || 0;

      reV += vVal * cosA;
      imV -= vVal * sinA;
      reI += iVal * cosA;
      imI -= iVal * sinA;
    }

    // Peak amplitude for harmonic n
    const ampV = (2 / actualN) * Math.sqrt(reV * reV + imV * imV);
    const ampI = (2 / actualN) * Math.sqrt(reI * reI + imI * imI);

    const rmsV = ampV / Math.SQRT2;
    const rmsI = ampI / Math.SQRT2;

    if (n === 1) {
      v1 = Math.max(1e-6, rmsV);
      i1 = Math.max(1e-6, rmsI);
    }

    orders.push(n);
    frequencies.push(n * baseFrequency);
    voltages.push(Number(rmsV.toFixed(3)));
    currents.push(Number(rmsI.toFixed(3)));
    voltagesPct.push(Number(((rmsV / v1) * 100).toFixed(2)));
    currentsPct.push(Number(((rmsI / i1) * 100).toFixed(2)));
  }

  return {
    orders,
    frequencies,
    voltages,
    currents,
    voltagesPct,
    currentsPct,
  };
}

/**
 * Calculates THD (%) from an array of harmonic RMS values where index 0 is fundamental (n=1)
 */
export function calculateTHD(harmonicRMS: number[]): number {
  if (harmonicRMS.length < 2) return 0;
  const h1 = harmonicRMS[0];
  if (h1 <= 1e-4) return 0;

  let sumSqHarmonics = 0;
  for (let i = 1; i < harmonicRMS.length; i++) {
    sumSqHarmonics += harmonicRMS[i] * harmonicRMS[i];
  }

  const thd = (Math.sqrt(sumSqHarmonics) / h1) * 100;
  return Number(Math.min(999.9, thd).toFixed(2));
}
