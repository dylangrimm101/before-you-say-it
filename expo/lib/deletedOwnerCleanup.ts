/** Cleanup is authorized for the receipt owner, never for a later login. */
export async function finishDeletedOwnerLocally(owner:string,cleanup:(owner:string)=>Promise<void>,currentOwner:()=>string|null,logout:()=>Promise<{success:boolean}>){
 await cleanup(owner);
 if(currentOwner()!==owner)return;
 const result=await logout();
 if(!result.success)throw new Error('Sign out not confirmed');
}
