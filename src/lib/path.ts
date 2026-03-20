export function normalizePathSeparators(path: string): string {
  return path.replace(/\\/g, "/");
}

export function pathBasename(path: string): string {
  const normalized = normalizePathSeparators(path).replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

export function relativeDisplayPath(path: string, rootPath?: string | null): string {
  if (!rootPath) return normalizePathSeparators(path);

  const normalizedPath = normalizePathSeparators(path);
  const normalizedRoot = normalizePathSeparators(rootPath).replace(/\/+$/, "");
  const prefix = `${normalizedRoot}/`;

  if (normalizedPath === normalizedRoot) {
    return pathBasename(path);
  }

  if (normalizedPath.startsWith(prefix)) {
    return normalizedPath.slice(prefix.length);
  }

  return normalizedPath;
}
