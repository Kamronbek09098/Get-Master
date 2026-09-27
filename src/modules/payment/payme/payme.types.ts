export interface PaymeRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface PaymeErrorMessage {
  ru: string;
  uz: string;
  en: string;
}

export interface PaymeRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: PaymeErrorMessage; data?: string };
}

export const PaymeError = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INTERNAL_ERROR: -32603,
  INSUFFICIENT_PRIVILEGE: -32504,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANT_CANCEL: -31007,
  CANT_PERFORM: -31008,
  ORDER_NOT_FOUND: -31050,
} as const;

export const PaymeState = {
  CREATED: 1,
  COMPLETED: 2,
  CANCELLED: -1,
  CANCELLED_AFTER_COMPLETE: -2,
} as const;

export interface PaymeMetadata {
  transactionId: string;
  createTime: number;
  performTime?: number;
  cancelTime?: number;
  state: number;
  reason?: number;
}

/** Payme tranzaksiyasi 12 soatdan ortiq PROCESSING holatida qolsa, avtomatik bekor qilinadi. */
export const PAYME_TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;
