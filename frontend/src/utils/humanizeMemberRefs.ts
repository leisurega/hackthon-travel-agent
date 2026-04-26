/** Escape dynamic segments for RegExp construction */
function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace member user_id and patterns like "A 用户" with display_name for UI copy.
 */
export function humanizeMemberRefs(text: string, profileById: Record<string, any>): string {
  if (!text) return text;
  const entries = Object.entries(profileById).sort((a, b) => b[0].length - a[0].length);
  let out = text;
  for (const [uid, p] of entries) {
    const name = p?.display_name;
    if (!name || name === uid) continue;
    out = out.replace(new RegExp(`${escapeReg(uid)}\\s*用户`, 'g'), name);
  }
  for (const [uid, p] of entries) {
    const name = p?.display_name;
    if (!name || name === uid) continue;
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeReg(uid)}(?![A-Za-z0-9_])`, 'g');
    out = out.replace(re, name);
  }
  return out;
}
