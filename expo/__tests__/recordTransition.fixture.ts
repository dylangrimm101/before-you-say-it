import {plugin} from 'bun';
import {readFileSync} from 'node:fs';
import {recordTransitionSource} from './recordTransitionHarness';
process.env.BYSI_APP_FIRST_POSITIVE='1';
plugin({name:'record-transition-fixture',setup(build){
  build.onLoad({filter:/guestVisitMounted\.fixture\.ts$/},({path})=>({contents:recordTransitionSource(readFileSync(path,'utf8')),loader:'ts'}));
}});
await import('./guestVisitMounted.fixture');
