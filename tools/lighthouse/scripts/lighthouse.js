export const scoreTo100 = (v) => {
  return Math.round((v ?? 0) * 100);
}

export const failIfBelow = (name, score, min) => {
  if (score < min) return `${name} ${score} < ${min}`;
  return null;
}

export const failIfAbove = (name, score, max) => {
  if (score > max) return `${name} ${score} > ${max}`;
  return null;
}

export const auditNumericValue = (audits, id) => {
  const a = audits?.[id];
  if (!a) return null;
  // numericValue is usually in ms for paints, unit depends on audit
  return typeof a.numericValue === "number" ? a.numericValue : null;
}

export const auditDisplayValue = (audits, id) => {
  const a = audits?.[id];
  return a?.displayValue ?? null;
}