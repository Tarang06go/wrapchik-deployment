import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runAudioPlayerCommand } from '../utils/safeAudioPlayerCommand.mjs';

const signup = readFileSync(new URL('../app/(auth)/signup.jsx', import.meta.url), 'utf8');
const confirmation = readFileSync(new URL('../app/order-confirmation.jsx', import.meta.url), 'utf8');
const appConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

test('signup scrolls the focused password field above the keyboard and supports return-key progression', () => {
  assert.match(signup, /KeyboardAvoidingView[^\n]*behavior=\{Platform\.OS === 'ios' \? 'padding' : undefined\}/);
  assert.match(signup, /keyboardDidShow/);
  assert.match(signup, /scrollResponderScrollNativeHandleToKeyboard/);
  assert.match(signup, /onFocus=\{\(\) => handleInputFocus\(passwordInputRef\)\}/);
  assert.match(signup, /onFocus=\{\(\) => handleInputFocus\(confirmPasswordInputRef\)\}/);
  assert.equal(appConfig.expo.android.softwareKeyboardLayoutMode, 'resize');
});

test('successful order confirmation plays one bundled native sound and shows native party-popper art', () => {
  assert.match(confirmation, /if \(!celebrate \|\| loading \|\| reduceMotion === null \|\| !orderId \|\| celebrationPlayedFor\.current === orderId\) return undefined/);
  assert.match(confirmation, /celebrationPlayedFor\.current = orderId/);
  assert.match(confirmation, /useAudioPlayer\(require\('\.\.\/assets\/sounds\/celebration-pop\.wav'\)\)/);
  assert.match(confirmation, /setAudioModeAsync\(\{ playsInSilentMode: false, interruptionMode: 'mixWithOthers' \}\)/);
  assert.match(confirmation, /runAudioPlayerCommand\(celebrationPlayer, 'play'/);
  assert.doesNotMatch(confirmation, /celebrationPlayer\.pause\(/);
  assert.match(confirmation, /PartyPopperGraphic/);
  assert.match(confirmation, /<Svg width=\{96\} height=\{96\} viewBox="0 0 96 96"/);
  assert.doesNotMatch(confirmation, /🎉|🎊/);
  assert.match(confirmation, /confetti\.forEach\(piece => piece\.progress\.setValue\(0\)\)/);
  assert.match(confirmation, /useNativeDriver: true/);
  assert.match(confirmation, /confetti\.map/);
  assert.match(confirmation, /pointerEvents="none" accessible=\{false\} style=\{styles\.celebrationLayer\}/);
  assert.match(confirmation, /zIndex: 999, elevation: 999, overflow: 'visible'/);
  assert.match(confirmation, /partyPopperProgress\.map/);
  assert.match(confirmation, /const sideBurst = index < 16/);
  assert.match(confirmation, /const leftBurst = index < 8/);
  assert.match(confirmation, /top: sideBurst \?.*: '0%',/);
  assert.match(confirmation, /staticCelebration \? 0\.94/);
  assert.match(confirmation, /reduceMotion !== true \|\| !showCelebration/);
});

test('released audio commands are contained and do not escape into order confirmation', async () => {
  const releasedPlayer = {
    async play() { throw new Error('Cannot use shared object that was already released'); },
  };
  let reported = 0;
  const succeeded = await runAudioPlayerCommand(
    releasedPlayer,
    'play',
    [],
    () => true,
    () => { reported += 1; },
  );
  assert.equal(succeeded, false);
  assert.equal(reported, 1);
});

test('audio command is skipped after navigation cleanup and an in-flight rejection is caught', async () => {
  let active = true;
  let rejectCommand;
  let calls = 0;
  let reported = 0;
  const player = {
    play() {
      calls += 1;
      return new Promise((_, reject) => { rejectCommand = reject; });
    },
  };
  const running = runAudioPlayerCommand(player, 'play', [], () => active, () => { reported += 1; });
  assert.equal(calls, 1);
  active = false;
  rejectCommand(new Error('player released during navigation'));
  assert.equal(await running, false);
  assert.equal(reported, 0);
  assert.equal(await runAudioPlayerCommand(player, 'play', [], () => active), false);
  assert.equal(calls, 1);
});

test('bundled celebration audio is short, mono PCM, and has a documented permissive license', () => {
  const sound = readFileSync(new URL('../assets/sounds/celebration-pop.wav', import.meta.url));
  const license = readFileSync(new URL('../assets/sounds/LICENSE.md', import.meta.url), 'utf8');
  assert.equal(sound.toString('ascii', 0, 4), 'RIFF');
  assert.equal(sound.toString('ascii', 8, 12), 'WAVE');
  assert.equal(sound.readUInt16LE(22), 1);
  assert.ok(sound.length < 100_000, `sound should stay lightweight (${sound.length} bytes)`);
  assert.match(license, /CC0 1\.0 Universal/);
  assert.match(license, /no third-party recordings, samples, or music/);
});
