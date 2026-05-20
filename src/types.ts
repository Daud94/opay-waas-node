export interface OPayConfig {
  merchantId: string;
  clientAuthKey: string;
  publicKey: string;
  privateKey: string;
  baseUrl: string;
}

export interface CreateVirtualAccountInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  customerCode?: string;
}

export interface VirtualAccountDetails {
  accountNumber: string;
  bankName: string;
  accountName: string;
  providerReference: string;
  customerCode: string;
  rawResponse: any;
}

export interface SweepInput {
  amount: string;
  depositCode: string;
  requestSerialNo: string;
  collectionMerchantId?: string;
  description?: string;
}

export interface SweepDetails {
  orderNo: string;
  requestSerialNo: string;
  amount: string;
  status: string;
  rawResponse: any;
}

export interface SweepStatusInput {
  orderNo?: string;
  requestSerialNo?: string;
}

export interface SweepStatusDetails {
  orderNo: string;
  requestSerialNo: string;
  amount: string;
  status: 'SUCCESS' | 'FAIL' | 'PROCESSING' | 'INITIAL';
  rawResponse: any;
}

export interface OPayResponseEnvelope<T> {
  code: string;
  message: string;
  data: T;
}
