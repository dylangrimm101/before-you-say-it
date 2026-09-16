// Local DB-network adapter only; production runtime/store/RPCs are not replaced.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export async function deletionDatabaseHost(){
 const socket=process.env.REVIEW_PG_SOCKET;
 if(!socket){
  const {PGlite}=createRequire(new URL('../../../test-deps/package.json',import.meta.url))('@electric-sql/pglite');
  const db=new PGlite();
  return {db,connect:async(role:string)=>({release(){},async query(sql:string,args?:any[]){if(sql==='BEGIN'){await db.exec('reset role;begin;set local role '+role);return {rows:[]};}return db.query(sql,args);}})};
 }
 assert.match(socket,/^\/private\/tmp\/bysi-repair-[A-Za-z0-9_-]+$/);
 // Absolute installed driver path bypasses the mocked public module name.
 const {Client}=require(new URL('../../../server/node_modules/pg/lib/index.js',import.meta.url).pathname);
 const base={host:socket,port:Number(process.env.REVIEW_PG_PORT),user:process.env.USER,database:'postgres'};
 const admin=new Client(base);await admin.connect();
 const name='connected_'+process.pid;await admin.query('create database '+name);
 const config={...base,database:name};const client=new Client(config);await client.connect();
 const db={exec:(sql:string)=>client.query(sql),query:(sql:string,args?:any[])=>client.query(sql,args),async close(){await client.end();await admin.query('drop database '+name);await admin.end();}};
 return {db,connect:async(role:string)=>{
  assert.ok(['bysi_account_deletion_api','bysi_account_deletion_worker'].includes(role));
  const connection=new Client(config);await connection.connect();
  return {release(){void connection.end();},async query(sql:string,args?:any[]){if(sql==='BEGIN'){await connection.query('begin;set local role '+role);return {rows:[]};}return connection.query(sql,args);}};
 }};
}
