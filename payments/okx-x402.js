// Official OKX x402 seller SDK wiring. OKX's sandbox runs a payment-exempt test
// that only recognizes services built on this SDK, so gating goes through it here
// rather than the hand-rolled facilitator calls in x402.js. The SDK handles the
// atomic amount, the USD0 EIP-712 domain, verify/settle, and the exempt handshake.
import { paymentMiddleware, x402ResourceServer } from '@okxweb3/x402-express';
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server';
import { OKXFacilitatorClient } from '@okxweb3/x402-core';
import { config } from '../config.js';

export function okxSdkConfigured() {
  const a = config.x402.facilitatorAuth;
  return !!(config.x402.enforce && a?.apiKey && a?.secretKey && a?.passphrase);
}

// Returns the Express payment middleware, or null when creds/enforce are absent
// (dev/free mode falls back to the legacy x402.js gate).
export function buildOkxPaymentMiddleware(skills) {
  if (!okxSdkConfigured()) return null;
  const a = config.x402.facilitatorAuth;
  const facilitator = new OKXFacilitatorClient({
    apiKey: a.apiKey,
    secretKey: a.secretKey,
    passphrase: a.passphrase,
  });
  const resourceServer = new x402ResourceServer(facilitator)
    .register(config.x402.network, new ExactEvmScheme());

  const routes = {};
  for (const skill of skills) {
    routes[`POST /skills/${skill.name}`] = {
      accepts: {
        scheme: config.x402.scheme,
        network: config.x402.network,
        payTo: config.x402.payTo,
        price: `$${skill.priceUsdt}`,
      },
      description: `${skill.title}: ${skill.description}`,
    };
  }
  // 5th arg: sync with the facilitator on boot (registers the service for the
  // sandbox). Set X402_FACILITATOR_SYNC=0 to skip (local boot without network).
  const syncOnStart = process.env.X402_FACILITATOR_SYNC !== '0';
  return paymentMiddleware(routes, resourceServer, undefined, undefined, syncOnStart);
}

export default { okxSdkConfigured, buildOkxPaymentMiddleware };
