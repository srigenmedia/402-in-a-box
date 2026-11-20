/**
 * Google AP2 mandate hash & Visa TAP Ed25519 signature verification hooks.
 */

const HEX64_RX = /^[a-f0-9]{64}$/i;

function decodeBytes(val: string): Uint8Array | null {
  const clean = val.trim();
  if (/^[a-f0-9]+$/i.test(clean) && clean.length % 2 === 0) {
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  try {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function verifyMandateAndTap(params: {
  ap2MandateHeader: string | null;
  tapSignatureHeader: string | null;
  tapPublicKeyEd25519: string | null;
  signedPayload: string;
}): Promise<{ ok: true; ap2MandateHash: string | null; tapVerified: boolean } | { ok: false; status: 400 | 401; code: string }> {
  const raw = params.ap2MandateHeader?.trim() || null;
  if (raw && !HEX64_RX.test(raw) && !raw.startsWith("sha256:")) {
    return { ok: false, status: 400, code: "INVALID_AP2_MANDATE_HASH" };
  }
  const ap2MandateHash = raw ? raw.replace(/^sha256:/i, "").toLowerCase() : null;

  const sig = params.tapSignatureHeader?.trim() || null;
  if (!sig) return { ok: true, ap2MandateHash, tapVerified: false };
  if (!params.tapPublicKeyEd25519) return { ok: false, status: 401, code: "INVALID_TAP_SIGNATURE" };

  const pubBytes = decodeBytes(params.tapPublicKeyEd25519);
  const sigBytes = decodeBytes(sig);
  if (!pubBytes || !sigBytes) return { ok: false, status: 401, code: "INVALID_TAP_SIGNATURE" };

  try {
    const key = await crypto.subtle.importKey("raw", pubBytes as unknown as BufferSource, { name: "Ed25519" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      "Ed25519",
      key,
      sigBytes as unknown as BufferSource,
      new TextEncoder().encode(params.signedPayload) as unknown as BufferSource,
    );
    if (!valid) return { ok: false, status: 401, code: "INVALID_TAP_SIGNATURE" };
    return { ok: true, ap2MandateHash, tapVerified: true };
  } catch {
    return { ok: false, status: 401, code: "INVALID_TAP_SIGNATURE" };
  }
}
