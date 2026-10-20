function resolveProductionApiOrigin(nodeEnvironment, configuredOrigin) {
  if (nodeEnvironment !== 'production') return null;
  if (!configuredOrigin || !configuredOrigin.trim()) {
    throw new Error(
      'SMD_API_ORIGIN is required in production and must be the backend origin only, for example https://smmd-api.onrender.com.',
    );
  }

  let parsed;
  try {
    parsed = new URL(configuredOrigin);
  } catch {
    throw new Error('SMD_API_ORIGIN must be a valid absolute URL origin.');
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      'SMD_API_ORIGIN must contain only the backend origin, without a path, credentials, query, or fragment.',
    );
  }

  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    parsed.protocol !== 'https:' &&
    !(parsed.protocol === 'http:' && loopbackHosts.has(parsed.hostname))
  ) {
    throw new Error(
      'SMD_API_ORIGIN must use HTTPS, except for an HTTP loopback URL used by isolated local tests.',
    );
  }

  return parsed.origin;
}

module.exports = { resolveProductionApiOrigin };
