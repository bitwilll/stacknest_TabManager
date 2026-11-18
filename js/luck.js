// A little luck for the foot of a saved painting (Brush Stroke): five lotto numbers and a
// 12-word phrase that is valid BIP-39. Both start from crypto.getRandomValues (the system's
// cryptographic random source), never Math.random. For the phrase, 32 system bytes are hashed
// together with the game's own movement (the timing and way of every turn, every press and
// swipe) and the first 128 bits of that SHA-256 are the entropy: the movement can only add
// unpredictability, never take the system's away. The checksum is then the first 4 bits of the
// entropy's own SHA-256, and the 132 bits read as twelve 11-bit indexes into the standard
// English list. The painting is drawn synchronously, so SHA-256 is computed here rather than
// with crypto.subtle (which is async).
import { BIP39_WORDS } from './bip39-words.js';

// an unbiased whole number in [0, n)
function rand(n) {
  const limit = Math.floor(0x100000000 / n) * n, a = new Uint32Array(1);
  do crypto.getRandomValues(a); while (a[0] >= limit);
  return a[0] % n;
}

// `count` different numbers from 1..top, smallest first (a partial Fisher–Yates shuffle)
export function lottoNumbers(count = 5, top = 50) {
  const pool = Array.from({ length: top }, (_, i) => i + 1);
  for (let i = 0; i < count; i++) {
    const j = i + rand(top - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

/* ——— SHA-256 (FIPS 180-4) ———
   The round constants are the first 32 bits of the fractional parts of the cube roots of the
   first 64 primes, the initial hash those of the square roots of the first 8; a double carries
   enough bits to compute them exactly, which spares 72 hand-typed hex numbers. */
const PRIMES = (() => { const p = []; for (let n = 2; p.length < 64; n++) if (p.every((q) => n % q)) p.push(n); return p; })();
const frac32 = (x) => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
const K = Uint32Array.from(PRIMES, (p) => frac32(Math.cbrt(p)));
const H0 = Uint32Array.from(PRIMES.slice(0, 8), (p) => frac32(Math.sqrt(p)));
const ror = (x, n) => (x >>> n) | (x << (32 - n));

export function sha256(bytes) {
  const len = bytes.length, total = Math.ceil((len + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(bytes); m[len] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(len / 0x20000000));   // the length in bits, as 64 bits
  dv.setUint32(total - 4, (len * 8) >>> 0);
  const H = H0.slice(), W = new Uint32Array(64);
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      W[i] = (W[i - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + W[i - 7] + (ror(b, 17) ^ ror(b, 19) ^ (b >>> 10))) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  H.forEach((v, i) => ov.setUint32(i * 4, v));
  return out;
}

// BIP-39: entropy of 16–32 bytes (a multiple of 4) to its phrase; 16 bytes give 12 words
export function phraseFor(entropy) {
  if (entropy.length < 16 || entropy.length > 32 || entropy.length % 4) throw new Error('BIP-39 entropy is 16 to 32 bytes, in fours');
  let bits = '';
  for (const b of entropy) bits += b.toString(2).padStart(8, '0');
  bits += sha256(entropy)[0].toString(2).padStart(8, '0').slice(0, entropy.length / 4);   // ENT/32 checksum bits
  return Array.from({ length: bits.length / 11 }, (_, i) => BIP39_WORDS[parseInt(bits.slice(i * 11, i * 11 + 11), 2)]);
}

// 12 words: SHA-256 over 32 system-random bytes and `extra` (bytes from the player's movement)
export function seedPhrase(extra = null) {
  const sys = crypto.getRandomValues(new Uint8Array(32));
  const mix = new Uint8Array(sys.length + (extra?.length || 0));
  mix.set(sys);
  if (extra?.length) mix.set(extra, sys.length);
  return phraseFor(sha256(mix).slice(0, 16));
}

// one painting's luck, made once so the thumbnail and the saved file agree: its numbers, its
// phrase, 16 bytes of its own for a sigil (separate from the phrase's, so the mark reveals
// nothing of the words), and the moment it was made
export const luckFor = (extra = null) => ({
  lotto: lottoNumbers(5, 50), phrase: seedPhrase(extra),
  sigil: crypto.getRandomValues(new Uint8Array(16)), at: Date.now(),
});
