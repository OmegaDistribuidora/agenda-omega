export function clipboardImageFiles(clipboardData) {
  if (!clipboardData) return [];
  const candidates = [];
  for (const file of Array.from(clipboardData.files || [])) {
    if (file?.type?.startsWith("image/")) candidates.push(file);
  }
  for (const item of Array.from(clipboardData.items || [])) {
    if (item?.kind !== "file" || !item.type?.startsWith("image/")) continue;
    const file = item.getAsFile?.();
    if (file) candidates.push(file);
  }
  const seen = new Set();
  return candidates.filter((file) => {
    const key = `${file.name}|${file.type}|${file.size}|${file.lastModified || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function imageExtension(mimeType = "") {
  const subtype = mimeType.split("/")[1]?.toLowerCase() || "png";
  if (subtype === "jpeg") return "jpg";
  if (subtype === "svg+xml") return "svg";
  return subtype.replace(/[^a-z0-9]/g, "") || "png";
}
