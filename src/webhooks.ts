import { OPayCrypto } from './crypto';

export class OPayWebhooks {
  /**
   * Verifies the authenticity of OPay webhook signatures.
   *
   * @param payload The raw parsed body of the webhook callback.
   * @param signature The signature string passed in the webhook headers (e.g. `req.headers['sign']`).
   * @param opayPublicKey OPay's Public RSA Key from environment.
   */
  static verify(payload: any, signature: string, opayPublicKey: string): boolean {
    if (!signature || !payload) return false;
    return OPayCrypto.verifyGeneralSignature(signature, payload, opayPublicKey);
  }

  /**
   * Helper utility to normalize and parse transaction webhook events.
   * Handles flat format or nested OPay webhook payload structures.
   */
  static parseEvent(body: any): {
    status: string;
    depositCode: string;
    amount: string;
    transactionId: string;
    currency: string;
    reference?: string;
    rawPayload: any;
  } {
    let normalizedPayload: any;

    if (body.data && typeof body.data === 'object') {
      // General payment callback: { data: { receiptAccount, amount, status... } }
      const d = body.data;
      normalizedPayload = {
        status: d.status,
        depositCode: d.receiptAccount,
        amount: d.amount,
        transactionId: d.orderNo || d.payNo,
        currency: d.currency || 'NGN',
        reference: d.outOrderNo,
        rawPayload: d,
      };
    } else {
      // Digital Wallets Callback structure: flat { status, depositCode, depositAmount... }
      normalizedPayload = {
        status: body.status,
        depositCode: body.depositCode,
        amount: body.depositAmount || body.amount,
        transactionId: body.orderNo || body.payNo || body.transactionId,
        currency: body.currency || 'NGN',
        reference: body.outOrderNo || body.reference,
        rawPayload: body,
      };
    }

    return normalizedPayload;
  }
}
