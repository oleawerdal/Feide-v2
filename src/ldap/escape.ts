/**
 * Escaping for LDAP for å hindre injeksjon i filtre (RFC 4515) og DN-er
 * (RFC 4514). All brukerinput som havner i et søkefilter eller en DN MÅ
 * gå gjennom disse.
 */

export function escapeFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (ch) => {
    switch (ch) {
      case "\\":
        return "\\5c";
      case "*":
        return "\\2a";
      case "(":
        return "\\28";
      case ")":
        return "\\29";
      case "\0":
        return "\\00";
      default:
        return ch;
    }
  });
}

export function escapeDnValue(value: string): string {
  let out = value.replace(/([\\,+"<>;=])/g, "\\$1");
  if (out.startsWith(" ") || out.startsWith("#")) out = "\\" + out;
  if (out.endsWith(" ")) out = out.slice(0, -1) + "\\ ";
  return out;
}
