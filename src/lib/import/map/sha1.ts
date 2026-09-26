/**
 * Tiny synchronous SHA-1 (FIPS 180-4). Used only to derive deterministic
 * RFC 4122 v5 ids for the legacy import; it is not a security primitive.
 */

function rotl(x: number, n: number): number {
  return (x << n) | (x >>> (32 - n));
}

/** Pads the message to a multiple of 64 bytes with the 64-bit big-endian bit length. */
function pad(bytes: Uint8Array): Uint8Array {
  const bitLen = bytes.length * 8;
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const out = new Uint8Array(total);
  out.set(bytes);
  out[bytes.length] = 0x80;
  const view = new DataView(out.buffer);
  view.setUint32(total - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(total - 4, bitLen >>> 0);
  return out;
}

/** SHA-1 digest (20 bytes) of `bytes`. */
export function sha1(bytes: Uint8Array): Uint8Array {
  const msg = pad(bytes);
  const view = new DataView(msg.buffer);
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80).fill(0);
  for (let off = 0; off < msg.length; off += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(off + t * 4);
    for (let t = 16; t < 80; t += 1) w[t] = rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
    let [a, b, c, d, e] = h;
    for (let t = 0; t < 80; t += 1) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const tmp = (rotl(a, 5) + f + e + k + w[t]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30) >>> 0;
      b = a;
      a = tmp;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  h.forEach((v, i) => outView.setUint32(i * 4, v));
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Hex SHA-1 of the UTF-8 encoding of `text`. */
export function sha1Hex(text: string): string {
  return toHex(sha1(new TextEncoder().encode(text)));
}
