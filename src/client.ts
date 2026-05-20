import axios, { AxiosInstance } from 'axios';
import { OPayCrypto } from './crypto';
import { OPaySanitizer } from './sanitizer';
import {
  OPayConfig,
  CreateVirtualAccountInput,
  VirtualAccountDetails,
  SweepInput,
  SweepDetails,
  SweepStatusInput,
  SweepStatusDetails,
  OPayResponseEnvelope,
} from './types';

export class OPayClient {
  private readonly config: OPayConfig;
  private readonly http: AxiosInstance;

  public readonly virtualAccounts: VirtualAccountResource;
  public readonly sweeps: SweepResource;

  constructor(config: OPayConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, ''),
    };

    this.http = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        version: 'V1.0.1',
        bodyFormat: 'JSON',
        clientAuthKey: this.config.clientAuthKey,
      },
    });

    this.virtualAccounts = new VirtualAccountResource(this);
    this.sweeps = new SweepResource(this);
  }

  /**
   * Helper that encrypts payload, posts to the endpoint, decrypts and parses response.
   */
  async post<T>(path: string, payload: any): Promise<OPayResponseEnvelope<T>> {
    const timestamp = Date.now().toString();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    const { paramContent, sign } = OPayCrypto.encrypt(
      payload,
      timestamp,
      this.config.publicKey,
      this.config.privateKey,
    );

    try {
      const response = await this.http.post(
        cleanPath,
        { paramContent, sign },
        {
          headers: {
            timestamp,
          },
        },
      );

      const rawResponse = response.data;

      if (rawResponse.code === '00000') {
        const decryptedData = OPayCrypto.decrypt(
          rawResponse,
          this.config.privateKey,
          this.config.publicKey,
        );

        return {
          code: rawResponse.code,
          message: rawResponse.message,
          data: decryptedData,
        };
      } else {
        throw new Error(
          `OPay API Error: [Code: ${rawResponse.code}] ${rawResponse.message || 'Request failed'}`,
        );
      }
    } catch (error: any) {
      if (error.response && error.response.data) {
        const rawResponse = error.response.data;
        throw new Error(
          `OPay API Http Error: [Code: ${rawResponse.code || 'UNKNOWN'}] ${rawResponse.message || error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Returns current config.
   */
  getConfig(): OPayConfig {
    return this.config;
  }
}

class VirtualAccountResource {
  constructor(private readonly client: OPayClient) {}

  /**
   * Provision a static deposit code (virtual account) with OPay.
   * Auto-sanitizes name, email, phone, and reference IDs before dispatching.
   */
  async create(input: CreateVirtualAccountInput): Promise<VirtualAccountDetails> {
    const refId = OPaySanitizer.sanitizeRefId(input.customerCode);
    const name = OPaySanitizer.sanitizeName(input.firstName, input.lastName);
    const emailAddress = OPaySanitizer.sanitizeEmail(input.email);
    const phoneNumber = OPaySanitizer.sanitizePhone(input.phone);

    const payload = {
      opayMerchantId: this.client.getConfig().merchantId,
      refId,
      name,
      emailAddress,
      phoneNumber,
      accountType: 'Merchant',
      sendPassWordFlag: 'N',
    };

    const response = await this.client.post<any>(
      '/api/v2/third/depositcode/generateStaticDepositCode',
      payload,
    );

    const vaData = response.data?.data;

    if (!vaData || !vaData.depositCode) {
      throw new Error(
        `Failed to retrieve virtual account details from decrypted OPay response: ${JSON.stringify(response.data)}`,
      );
    }

    return {
      accountNumber: vaData.depositCode,
      bankName: 'OPay',
      accountName: vaData.name || name,
      providerReference: vaData.refId || refId,
      customerCode: vaData.refId || refId,
      rawResponse: vaData,
    };
  }

  /**
   * Query details of an existing static deposit code (virtual account).
   */
  async queryInfo(depositCode: string): Promise<any> {
    const payload = {
      opayMerchantId: this.client.getConfig().merchantId,
      depositCode,
    };

    const response = await this.client.post<any>(
      '/api/v2/third/depositcode/queryStaticDepositCodeInfo',
      payload,
    );

    return response.data?.data || response.data;
  }
}

class SweepResource {
  constructor(private readonly client: OPayClient) {}

  /**
   * Transfer/sweep funds from a user's static deposit code to the Merchant main wallet.
   */
  async initiate(input: SweepInput): Promise<SweepDetails> {
    const payload = {
      opayMerchantId: this.client.getConfig().merchantId,
      depositCode: input.depositCode,
      amount: input.amount,
      collectionMerchantId: input.collectionMerchantId || this.client.getConfig().merchantId,
      requestSerialNo: input.requestSerialNo,
      description: input.description || '',
    };

    const response = await this.client.post<any>(
      '/api/v2/third/depositcode/transferToMerchant',
      payload,
    );

    const sweepData = response.data?.data || response.data;

    return {
      orderNo: sweepData.orderNo || '',
      requestSerialNo: sweepData.requestSerialNo || input.requestSerialNo,
      amount: sweepData.amount || input.amount,
      status: sweepData.status || 'SUCCESS',
      rawResponse: sweepData,
    };
  }

  /**
   * Query the status of an automated sweep/transfer transaction.
   */
  async queryStatus(input: SweepStatusInput): Promise<SweepStatusDetails> {
    const payload = {
      opayMerchantId: this.client.getConfig().merchantId,
      orderNo: input.orderNo || '',
      requestSerialNo: input.requestSerialNo || '',
    };

    const response = await this.client.post<any>(
      '/api/v2/third/depositcode/queryTransferStatus',
      payload,
    );

    const statusData = response.data?.data || response.data;

    return {
      orderNo: statusData.orderNo || '',
      requestSerialNo: statusData.requestSerialNo || input.requestSerialNo || '',
      amount: statusData.amount || '',
      status: statusData.status || 'INITIAL',
      rawResponse: statusData,
    };
  }
}
