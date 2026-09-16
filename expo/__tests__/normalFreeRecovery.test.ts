import {test,expect} from 'bun:test';import {FreeAcquisitionRequestError} from '../lib/freeAcquisitionOutcome';
test('expired and exhausted free errors are server-side containment while ordinary start can renew elsewhere; pending preserves recovery',()=>{
 expect(new FreeAcquisitionRequestError(429,'exhausted').retryable).toBe(false);
 expect(new FreeAcquisitionRequestError(410,'expired').retryable).toBe(false);
 expect(new FreeAcquisitionRequestError(409,'pending').retryable).toBe(true);
 expect(new FreeAcquisitionRequestError(409,'pending').message).toContain('same');
});
