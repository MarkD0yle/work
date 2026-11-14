/** Deterministic, check-digit-valid security identifiers derived from a sequence number. */

const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SEDOL_ALPHABET = '0123456789BCDFGHJKLMNPQRSTVWXYZ';

function encode(n: number, alphabet: string, width: number): string {
  let out = '';
  let rest = n;
  for (let i = 0; i < width; i += 1) {
    out = alphabet[rest % alphabet.length] + out;
    rest = Math.floor(rest / alphabet.length);
  }
  return out;
}

export function cusip(seq: number): string {
  // Spread sequence numbers over the id space so identifiers do not look sequential.
  const base = encode((seq * 7919 + 104729) % 36 ** 8, B36, 8);
  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    let v = B36.indexOf(base[i] as string);
    if (i % 2 === 1) v *= 2;
    sum += Math.floor(v / 10) + (v % 10);
  }
  return base + String((10 - (sum % 10)) % 10);
}

export function isin(country: string, nsin9: string): string {
  const body = country + nsin9;
  const digits = [...body].map((c) => String(B36.indexOf(c))).join('');
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let v = Number(digits[i]);
    if (double) {
      v *= 2;
      if (v > 9) v -= 9;
    }
    sum += v;
    double = !double;
  }
  return body + String((10 - (sum % 10)) % 10);
}

export function sedol(seq: number): string {
  const base = encode((seq * 6151 + 15485863) % SEDOL_ALPHABET.length ** 6, SEDOL_ALPHABET, 6);
  const weights = [1, 3, 1, 7, 3, 9];
  let sum = 0;
  for (let i = 0; i < 6; i += 1) sum += B36.indexOf(base[i] as string) * (weights[i] as number);
  return base + String((10 - (sum % 10)) % 10);
}
