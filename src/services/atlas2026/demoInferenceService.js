const DEFAULT_INFERENCE_ENDPOINT = 'http://localhost:4310/infer-zcodes';
const INFERENCE_BEARER = (import.meta.env.VITE_ATLAS_DEMO_INFERENCE_BEARER || '').trim();

const CATEGORY_TO_ZCODE = {
  Housing: 'Z59.1',
  Employment: 'Z56.0',
  Transportation: 'Z59.9',
  Food: 'Z59.4',
  Healthcare: 'Z60.8',
  Education: 'Z55.9',
  Childcare: 'Z62.9',
  Legal: 'Z65.3',
};

function normalizeZCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return /^Z\d{2}(\.\d+)?$/.test(normalized) ? normalized : null;
}

function buildFallbackCodes({ situationCategories = [], backgroundNotes = '' }) {
  const seeded = [];
  for (const category of situationCategories) {
    const mapped = CATEGORY_TO_ZCODE[String(category || '').trim()];
    if (mapped) seeded.push(mapped);
  }
  const notes = String(backgroundNotes || '').toLowerCase();
  if (notes.includes('housing') || notes.includes('shelter') || notes.includes('rent')) seeded.push('Z59.1');
  if (notes.includes('job') || notes.includes('work') || notes.includes('employment')) seeded.push('Z56.0');
  if (notes.includes('food') || notes.includes('hunger')) seeded.push('Z59.4');
  if (notes.includes('legal') || notes.includes('court') || notes.includes('probation')) seeded.push('Z65.3');

  // Keep fallback deterministic: the first two distinct valid ZCodes are returned.
  const unique = Array.from(new Set(seeded.map(normalizeZCode).filter(Boolean)));
  if (unique.length >= 2) return unique.slice(0, 2);
  if (unique.length === 1) return [unique[0], 'Z60.8'];
  return ['Z59.1', 'Z56.0'];
}

export async function inferZCodesForReferral(payload) {
  const endpoint = (import.meta.env.VITE_ATLAS_DEMO_INFERENCE_URL || DEFAULT_INFERENCE_ENDPOINT).trim();
  try {
    const headers = { 'content-type': 'application/json' };
    if (INFERENCE_BEARER) {
      headers.authorization = `Bearer ${INFERENCE_BEARER}`;
    }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Inference request failed with status ${response.status}`);
    }
    const data = await response.json();
    const normalized = Array.from(
      new Set((Array.isArray(data?.zCodes) ? data.zCodes : []).map(normalizeZCode).filter(Boolean))
    );
    if (normalized.length >= 2) {
      return {
        zCodes: normalized.slice(0, 4),
        rationale: typeof data?.rationale === 'string' ? data.rationale : '',
        model: typeof data?.model === 'string' ? data.model : 'qwen2.5:3b-instruct',
        fallback: false,
      };
    }
  } catch (error) {
    console.warn('Demo inference request failed; using local fallback.', error);
  }
  return {
    zCodes: buildFallbackCodes(payload),
    rationale: 'Deterministic fallback from referral categories and notes.',
    model: 'fallback-rules',
    fallback: true,
  };
}
