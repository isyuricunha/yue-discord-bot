import test from 'node:test';
import assert from 'node:assert/strict';
import {isSharedMirrorActive,hasSharedNobre,syncSharedNobre,shouldRemoveSharedRole} from './sharedNobreSync';

test('only currently linked, unexpired shared access retains a Discord role',()=>{
 const now=new Date('2026-10-18T12:00:00Z');
 assert.equal(isSharedMirrorActive(null,now),false);
 assert.equal(isSharedMirrorActive({linked:true,expiresAt:new Date('2026-10-18T12:00:01Z')},now),true);
 assert.equal(isSharedMirrorActive({linked:false,expiresAt:new Date('2026-11-18T12:00:00Z')},now),false);
 assert.equal(isSharedMirrorActive({linked:true,expiresAt:new Date('2026-10-18T12:00:00Z')},now),false);
 assert.equal(isSharedMirrorActive({linked:true,expiresAt:null},now),false);
});
test('never revoke manual staff roles or a still-active native entitlement',()=>{
 assert.equal(shouldRemoveSharedRole(false,false),false,
  'manual roles must remain even if linked user has no paid Nobre');
 assert.equal(shouldRemoveSharedRole(false,true),false);
 assert.equal(shouldRemoveSharedRole(true,true),false,
  'a paid Discord grant takes priority over an expired site grant');
 assert.equal(shouldRemoveSharedRole(true,false),true,
  'only a bridge-owned role with no native purchase can be revoked');
});

test('disabled bridge never changes Discord roles or consults the remote site',async()=>{
 const before=process.env.VB_SHARED_NOBRE_ENABLED;
 delete process.env.VB_SHARED_NOBRE_ENABLED;
 try{
  assert.equal(await hasSharedNobre('300000000000000001','200000000000000001',
   '400000000000000001'),false);
  await syncSharedNobre({} as never);
 }finally{
  if(before!==undefined)process.env.VB_SHARED_NOBRE_ENABLED=before;
 }
});
