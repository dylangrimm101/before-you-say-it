import type { SupabaseClient } from '@supabase/supabase-js';
type Auth = SupabaseClient['auth'];
export const RECOVERY_CONFIRMATION = 'If an account is eligible for this address, check its inbox and spam. Tap Reset password in the newest email, choose your new password on the secure website, then return to the app to sign in. Delivery is not confirmed.';
export function createAccountRecovery(auth: Auth, authUrl: string, now = Date.now) {
 let nextRequest=0;let completing=false;
 return {
  async complete(link:string,password:string) {
   if(completing)return {success:false,message:'Wait for the current password reset to finish.'};
   let token:string;
   try {
    const url=new URL(link.trim());
    if(url.origin!==new URL(authUrl).origin || url.protocol!=='https:' || url.username || url.password || url.pathname!=='/auth/v1/verify' || url.hash || url.searchParams.getAll('type').length!==1 || url.searchParams.get('type')!=='recovery' || url.searchParams.getAll('token').length!==1) throw new Error();
    // Only the original hash-link contract is supported, not opened implicit
    // credentials or PKCE callbacks. redirect_to is ignored, never followed.
    if([...url.searchParams.keys()].some(key=>!['token','type','redirect_to'].includes(key)) || url.searchParams.getAll('redirect_to').length>1) throw new Error();
    token=url.searchParams.get('token')!;
    if(!/^[a-zA-Z0-9_-]{6,512}$/.test(token)) throw new Error();
   } catch {return {success:false,diagnostic:{phase:'link_validation',reason:'original_link_required'},message:'Paste the original recovery link from this account provider, not an opened website address.'};}
   if(password.length<8 || password.length>128) return {success:false,diagnostic:{phase:'password_validation',reason:'password_length'},message:'Use a password of 8–128 characters.'};
   let changed=false;completing=true;
   let phase='recovery_verify';
   try {
    const verified=await auth.verifyOtp({type:'recovery',token_hash:token});
    const session=verified.data.session;
    if(verified.error) throw verified.error;
    if(!session || !verified.data.user || session.user.id!==verified.data.user.id) throw new Error();
    phase='authenticated_owner_read';
    const owner=await auth.getUser(session.access_token);
    if(owner.error) throw owner.error;
    if(owner.data.user?.id!==session.user.id || owner.data.user.is_anonymous) throw new Error();
    phase='password_update';
    const update=await auth.updateUser({password});
    if(update.error) throw update.error;
    if(update.data.user?.id!==session.user.id) throw new Error();
    changed=true;
    phase='global_signout';
    const revoked=await auth.signOut({scope:'global'});
    if(revoked.error) throw revoked.error;
    return {success:true,message:'Password updated. Return to login with your new password. Existing access tokens may last until expiry.'};
   } catch(error:unknown) {
    // Closed categories only: never expose provider text, link or credentials.
    const e=error as {code?:string;status?:number;name?:string}|null;
    const allowed=['otp_expired','otp_disabled','weak_password','same_password','session_not_found','over_request_rate_limit','request_timeout'];
    const reason=e?.code && allowed.includes(e.code)?e.code:e?.status===429?'rate_limited':typeof e?.status==='number'&&e.status>=500?'provider_unavailable':e?.name==='AuthRetryableFetchError'||error instanceof TypeError?'transport_unavailable':e?.name==='AuthSessionMissingError'?'session_missing':typeof e?.status==='number'?'provider_rejected':'verification_rejected';
    return {success:false,diagnostic:{phase,reason},message:(changed ? 'Password updated, but signing out other sessions was not confirmed. Log in with the new password and contact support.' : 'Password reset was not confirmed. Stop for review; do not reuse this link or request another email.')+` Diagnostic: ${phase}/${reason}.`};
   }
   finally {try {await auth.signOut({scope:'local'});} catch { /* isolated memory-only session */ } finally {completing=false;}}
  },
  async request(email:string) {
   const normalized=email.trim().toLowerCase();
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return {success:false,message:'Enter a valid email address.'};
   if (now()<nextRequest) return {success:false,message:'Wait one minute before requesting another recovery email.'};
   nextRequest=now()+60000;
   try {
    const result=await auth.resetPasswordForEmail(normalized,{redirectTo:'https://beforeyousayit.app/reset-password'});
    // Do not expose account-dependent 4xx outcomes (missing, unconfirmed,
    // banned or ineligible address). This is a conditional inbox instruction,
    // not a claim that the provider queued or delivered an email.
    if(result.error && !(result.error.status && result.error.status>=400 && result.error.status<500 && result.error.status!==429)) return {success:false,message:'Recovery could not be requested. Wait a minute and check your connection before retrying.'};
    return {success:true,message:RECOVERY_CONFIRMATION};
   } catch {return {success:false,message:'Recovery could not be requested. Check your connection and retry later.'};}
  },
 };
}
