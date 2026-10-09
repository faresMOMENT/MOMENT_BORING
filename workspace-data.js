/* Shared record identity. Identical copies are removed; different measurements remain. */
(() => {
  const signature = sample => JSON.stringify(Object.fromEntries(Object.entries(sample || {}).filter(([key]) => key !== 'id').sort(([a], [b]) => a.localeCompare(b))));
  function uniqueSamples(samples = []) {
    const seen = new Set();
    return samples.filter(sample => {
      const key = JSON.stringify([sample.id || null, signature(sample)]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function normalize(source) {
    if (!Array.isArray(source?.borings)) return source;
    const borings = new Map();
    source.borings.forEach(boring => {
      const { samples, ...details } = boring;
      const key = JSON.stringify([boring.projectId, boring.id, signature(details)]);
      if (borings.has(key)) {
        const existing = borings.get(key);
        existing.samples = uniqueSamples([...(existing.samples || []), ...(boring.samples || [])]);
      } else borings.set(key, { ...boring, samples: uniqueSamples(boring.samples || []) });
    });
    return { ...source, borings: [...borings.values()] };
  }
  const sampleLabel = (boring, sample) => {
    const number = String(sample.number ?? '').trim();
    if (!number) return boring.id + '-sample';
    return /^\d+(?:\.\d+)?$/.test(number) ? boring.id + '-' + number : number;
  };
  window.MomentWorkspaceData = { normalize, uniqueSamples, sampleLabel };
})();
