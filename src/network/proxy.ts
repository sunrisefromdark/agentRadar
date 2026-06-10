import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

let configured = false;

function readProxyEnv(): string | null {
  const candidates = [
    process.env.HTTPS_PROXY,
    process.env.https_proxy,
    process.env.HTTP_PROXY,
    process.env.http_proxy,
    process.env.ALL_PROXY,
    process.env.all_proxy,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) return value;
  }

  return null;
}

export function configureGlobalNetworkProxy(): string | null {
  const proxy = readProxyEnv();
  if (configured || !proxy) return proxy;

  setGlobalDispatcher(new EnvHttpProxyAgent());
  configured = true;
  return proxy;
}
