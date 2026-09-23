import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {FreeAcquisitionRequestError} from '../lib/freeAcquisitionOutcome';

test('verification failure is not described as a silent provider or lost reply',()=>{
  const error=new FreeAcquisitionRequestError(422,'unverified_exchange');
  expect(error.message).toContain('could not verify the earlier conversation');
  expect(error.message).toContain('R-EXCHANGE');
  expect(error.message).not.toContain("didn't answer");
  expect(error.retryable).toBe(true);
});
test('shared playback markup has no redundant conversation activity bubble',()=>{
  // Static UI structure check, not a claim about device layout or audio output.
  const source=readFileSync(new URL('../app/rehearse/[id].tsx',import.meta.url),'utf8');
  expect(source).not.toContain('styles.activityBubble');
  expect(source).toContain('is speaking. Tap to stop.');
  expect(source).toContain('onPlaybackStart:present');
  expect(source).toContain('help: h.responseError ??');
});
