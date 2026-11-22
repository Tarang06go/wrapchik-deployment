/**
 * Run an Expo AudioPlayer command without allowing a native shared-object
 * rejection to escape into the React tree during a route transition.
 * useAudioPlayer owns player release; callers should not release or pause it
 * from component cleanup.
 */
export async function runAudioPlayerCommand(player, command, args = [], isActive = () => true, onError) {
  try {
    if (!player || !isActive()) return false;
    const method = player[command];
    if (typeof method !== 'function') return false;
    await method.apply(player, args);
    return true;
  } catch (error) {
    let shouldReport = false;
    try { shouldReport = Boolean(isActive()); } catch { /* The route may already be gone. */ }
    if (shouldReport && typeof onError === 'function') {
      try { onError(error); } catch { /* Diagnostics must not affect order confirmation. */ }
    }
    return false;
  }
}
