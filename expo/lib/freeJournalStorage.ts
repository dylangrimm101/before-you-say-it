import {deflateSync,inflateSync,strFromU8,strToU8} from 'fflate';
import {speechBytesToBase64} from './nativeSpeechBytes';
const prefix='deflate-v1.';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Same owner key, one atomic value: retain old IDs without exceeding SecureStore's documented limit. */
export function encodeFreeJournal(value:string):string{
 if(strToU8(value).length<=2048)return value;
 if(strToU8(value).length>8192)throw Error('Free session recovery required');
 const packed=prefix+speechBytesToBase64(deflateSync(strToU8(value)));
 if(packed.length>2048)throw Error('Free session recovery required');
 return packed;
}
export function decodeFreeJournal(value:string):string{
 if(!value.startsWith(prefix))return value; // Build 18 journal compatibility; never clear a legacy journal.
 const data=value.slice(prefix.length);
 if(value.length>2048||data.length%4!==0||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))throw Error('Free session recovery required');
 const bytes=new Uint8Array(Math.floor(data.replace(/=/g,'').length*6/8));let accumulator=0,bits=0,offset=0;
 for(const character of data.replace(/=/g,'')){
  accumulator=(accumulator<<6)|alphabet.indexOf(character);bits+=6;
  if(bits>=8){bits-=8;bytes[offset++]=(accumulator>>bits)&255;}
 }
 const raw=inflateSync(bytes);if(raw.length>8192)throw Error('Free session recovery required');return strFromU8(raw);
}
