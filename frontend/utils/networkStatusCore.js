export const isOfflineStatus = online => !Boolean(online);

// A slower request that began before a newer successful response must not
// overwrite the app's connectivity state with a stale offline event.
export const shouldReportOfflineFailure = (failedSequence, latestSuccessSequence) => {
  const failed = Number(failedSequence);
  const latestSuccess = Number(latestSuccessSequence);
  if (!Number.isSafeInteger(failed) || failed < 1) return true;
  if (!Number.isSafeInteger(latestSuccess) || latestSuccess < 1) return true;
  return failed > latestSuccess;
};
