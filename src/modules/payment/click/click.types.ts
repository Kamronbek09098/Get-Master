export interface ClickCallbackBody {
  click_trans_id?: string | number;
  service_id?: string | number;
  click_paydoc_id?: string | number;
  merchant_trans_id?: string;
  amount?: string | number;
  action?: string | number;
  error?: string | number;
  error_note?: string;
  sign_time?: string;
  sign_string?: string;
  merchant_prepare_id?: string | number;
}

export interface ClickCallbackResponse {
  click_trans_id?: string | number;
  merchant_trans_id?: string;
  merchant_prepare_id?: number;
  merchant_confirm_id?: number;
  error: number;
  error_note: string;
}

export const ClickError = {
  SUCCESS: 0,
  SIGN_FAILED: -1,
  AMOUNT_INVALID: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_UPDATE: -7,
  REQUEST_ERROR: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

export const ClickErrorNote: Record<number, string> = {
  [ClickError.SUCCESS]: 'Success',
  [ClickError.SIGN_FAILED]: 'SIGN CHECK FAILED',
  [ClickError.AMOUNT_INVALID]: 'Incorrect parameter amount',
  [ClickError.ACTION_NOT_FOUND]: 'Action not found',
  [ClickError.ALREADY_PAID]: 'Already paid',
  [ClickError.ORDER_NOT_FOUND]: 'Order does not exist',
  [ClickError.TRANSACTION_NOT_FOUND]: 'Transaction does not exist',
  [ClickError.FAILED_UPDATE]: 'Failed to update order',
  [ClickError.REQUEST_ERROR]: 'Error in request',
  [ClickError.TRANSACTION_CANCELLED]: 'Transaction cancelled',
};
