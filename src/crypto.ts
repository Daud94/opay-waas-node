import NodeRSA from 'node-rsa';
import { KEYUTIL, KJUR, hextob64, b64tohex } from 'jsrsasign';

export class OPayCrypto {
  /**
   * Recursively traverses an array or object and sorts keys alphabetically.
   */
  static traverseAndSort(data: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => OPayCrypto.traverseAndSort(item)).sort();
    } else if (typeof data === 'object' && data !== null) {
      const sorted: any = {};
      Object.keys(data)
        .sort()
        .forEach((key) => {
          sorted[key] = OPayCrypto.traverseAndSort(data[key]);
        });
      return sorted;
    }
    return data;
  }

  /**
   * Formats a public key into standard PEM header if it is not already wrapped.
   */
  static formatPublicKey(key: string): string {
    if (!key) return '';
    let formatted = key.trim();
    formatted = formatted.replace(/^['"]|['"]$/g, '');
    formatted = formatted.replace(/\\n/g, '\n');

    if (formatted.includes('-----BEGIN PUBLIC KEY-----')) {
      return formatted;
    }

    formatted = formatted.replace(/\s+/g, '');
    return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
  }

  /**
   * Formats a private key into standard PEM header if it is not already wrapped.
   */
  static formatPrivateKey(key: string): string {
    if (!key) return '';
    let formatted = key.trim();
    formatted = formatted.replace(/^['"]|['"]$/g, '');
    formatted = formatted.replace(/\\n/g, '\n');

    if (
      formatted.includes('-----BEGIN PRIVATE KEY-----') ||
      formatted.includes('-----BEGIN RSA PRIVATE KEY-----')
    ) {
      return formatted;
    }

    formatted = formatted.replace(/\s+/g, '');
    return `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`;
  }

  /**
   * Encrypts plain payload using OPay's RSA public key and generates signature.
   */
  static encrypt(
    data: any,
    timestamp: string,
    publicKey: string,
    privateKey: string,
  ): { paramContent: string; sign: string } {
    const formattedPublicKey = OPayCrypto.formatPublicKey(publicKey);
    const formattedPrivateKey = OPayCrypto.formatPrivateKey(privateKey);

    const rsa = new NodeRSA({ b: 1024 });
    rsa.setOptions({
      encryptionScheme: { scheme: 'pkcs1' } as any,
      environment: 'browser', // Bypasses Node 21+ RSA padding issues
    });
    rsa.importKey(formattedPublicKey, 'pkcs8-public-pem');

    const sortedData = OPayCrypto.traverseAndSort(data);
    const encrypted = rsa.encrypt(JSON.stringify(sortedData), 'base64');

    const sign = OPayCrypto.generateSignature(
      encrypted + timestamp,
      formattedPrivateKey,
    );

    return { paramContent: encrypted, sign };
  }

  /**
   * Decrypts OPay response payload using Merchant's Private Key.
   */
  static decrypt(
    responseData: any,
    privateKey: string,
    publicKey: string,
  ): any {
    const formattedPrivateKey = OPayCrypto.formatPrivateKey(privateKey);
    const formattedPublicKey = OPayCrypto.formatPublicKey(publicKey);

    const rsa = new NodeRSA(formattedPrivateKey);
    rsa.setOptions({
      encryptionScheme: { scheme: 'pkcs1' } as any,
      environment: 'browser', // Bypasses Node 21+ RSA padding issues
    });

    const decrypted = rsa.decrypt(responseData.data, 'utf8');
    const data = JSON.parse(decrypted);

    if (responseData.sign) {
      const isValid = OPayCrypto.verifyResponseSignature(
        responseData,
        formattedPublicKey,
      );
      if (!isValid) {
        throw new Error('OPay response signature verification failed.');
      }
    }

    return data;
  }

  /**
   * Generates SHA256withRSA signature.
   */
  static generateSignature(inputString: string, privateKey: string): string {
    const rsaKey = KEYUTIL.getKey(privateKey);
    const sig = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    sig.init(rsaKey);
    sig.updateString(inputString);
    return hextob64(sig.sign());
  }

  /**
   * Verifies response signature.
   */
  static verifyResponseSignature(
    responseData: any,
    publicKey: string,
  ): boolean {
    const { sign, ...rest } = responseData;
    const sortedData = OPayCrypto.traverseAndSort(rest);

    let mapSplicing = '';
    for (const k in sortedData) {
      if (mapSplicing) {
        mapSplicing += '&';
      }
      mapSplicing += `${k}=${sortedData[k]}`;
    }

    const signatureVf = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    signatureVf.init(publicKey);
    signatureVf.updateString(mapSplicing);
    return signatureVf.verify(b64tohex(sign));
  }

  /**
   * Verifies standard webhook/general signatures.
   */
  static verifyGeneralSignature(
    sign: string,
    data: any,
    publicKey: string,
  ): boolean {
    const formattedPublicKey = OPayCrypto.formatPublicKey(publicKey);
    const sortedData = OPayCrypto.traverseAndSort(data);

    let mapSplicing = '';
    for (const k in sortedData) {
      if (mapSplicing) {
        mapSplicing += '&';
      }
      mapSplicing += `${k}=${sortedData[k]}`;
    }

    const signatureVf = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
    signatureVf.init(formattedPublicKey);
    signatureVf.updateString(mapSplicing);
    return signatureVf.verify(b64tohex(sign));
  }

  /**
   * Verifies the OPay signature for secure/encrypted incoming webhooks.
   * Webhook signatures are signed over: paramContent + timestamp
   */
  static verifyWebhookSignature(
    paramContent: string,
    timestamp: string,
    sign: string,
    publicKey: string,
  ): boolean {
    try {
      const formattedPublicKey = OPayCrypto.formatPublicKey(publicKey);
      const inputString = paramContent + timestamp;
      const signatureVf = new KJUR.crypto.Signature({ alg: 'SHA256withRSA' });
      signatureVf.init(formattedPublicKey);
      signatureVf.updateString(inputString);
      return signatureVf.verify(b64tohex(sign));
    } catch (error) {
      return false;
    }
  }

  /**
   * Decrypts the RSA-encrypted paramContent webhook payload using the private key.
   */
  static decryptParamContent(paramContent: string, privateKey: string): any {
    try {
      const formattedPrivateKey = OPayCrypto.formatPrivateKey(privateKey);
      const rsa = new NodeRSA(formattedPrivateKey);
      rsa.setOptions({
        encryptionScheme: { scheme: 'pkcs1' } as any,
        environment: 'browser',
      });

      const decrypted = rsa.decrypt(paramContent, 'utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt OPay paramContent: ${(error as any).message}`);
    }
  }
}
