// Node and material names of the models. Pure TypeScript.

// The model prefix: the identifier up to and including the first run of five or six digits (`R5BiankaMd019271`, `R3Bianka01001`);
// the captured digits are the model id.
export const MODEL_PREFIX = /^[A-Za-z0-9]*?(\d{5,6})/

/**
 * A mesh or material name without its model prefix (`R5BiankaMd010031Body` → `Body`, `R3Bianka01001Eye` → `Eye`); a name without a
 * prefix is returned as it is. The one prefix rule: the parts list, the toon outline pairing and the retargeting of face morphs use it.
 */
export function stripModelPrefix(name: string): string {
  return name.replace(MODEL_PREFIX, '')
}
