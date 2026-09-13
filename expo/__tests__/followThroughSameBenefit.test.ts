import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const overlay=resolve(import.meta.dir,'../../../unified-b-mapping');
const read=(rel:string)=>readFileSync(resolve(overlay,rel),'utf8');

test('unified B mapping restores original Follow-Through and does not convert it into monthly Pro',()=>{
 const screen=read('expo/app/saved-result.tsx');
 const follow=read('expo/components/OriginalFollowThrough.tsx');
 expect(screen).toContain('OriginalFollowThrough');
 expect(screen).toContain('Don’t buy the same plan again');
 expect(screen).toContain('Review monthly subscription');
 expect(follow).toContain('Your original one-time benefit is separate from monthly practice');
 expect(follow).toContain('Don’t buy the same benefit again');
 expect(follow).toContain('does not grant a subscription');
 expect(follow).not.toContain('30-day');
 expect(follow).not.toContain('launch pass');
 const purchases=readFileSync(new URL('../lib/purchases.ts',import.meta.url),'utf8');
 expect(purchases).toContain("pkg.product.identifier !== 'byis_pro_monthly_5'");
});
