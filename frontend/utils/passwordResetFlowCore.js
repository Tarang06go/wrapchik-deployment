const FALLBACK_NOTICE = 'If an account matches this email, a recovery code has been sent.';
const FALLBACK_ERROR = 'A recovery code could not be requested.';

export const canSendPasswordResetCode = (inFlight, resendSeconds) => (
  !inFlight && Number(resendSeconds || 0) <= 0
);

export const normalizePasswordResetSend = (result) => {
  if (result?.success !== true) {
    return { success: false, message: result?.message || FALLBACK_ERROR };
  }

  return {
    success: true,
    message: result.message || FALLBACK_NOTICE,
    developmentCode: typeof result.developmentCode === 'string' ? result.developmentCode : '',
    resendAfterSeconds: Number(result.resendAfterSeconds) || 60,
    expiresInSeconds: Number(result.expiresInSeconds) || 600,
  };
};
