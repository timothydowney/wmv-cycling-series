export function getBackendBaseUrl(): string {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }

  if (typeof window !== 'undefined') {
    const { hostname, protocol, port } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return `${protocol}//${hostname}:3001`;
    }

    if (port === '5173' || port === '5174') {
      return `${protocol}//${hostname}:3001`;
    }
  }

  return '';
}
