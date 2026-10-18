import type {Client} from 'discord.js';
import {prisma,SupportPaymentStatus} from '@yuebot/database';
import {logger} from '../../utils/logger';
import {safe_error_details} from '../../utils/safe_error';

const snowflake=/^[0-9]{16,22}$/;
type Linked={discordId:string;linkedAt:string;legacySnapshotAt:string|null;expiresAt:string|null};
type Links={guildId:string;links:Linked[]};
function config(){
 const guildId=process.env.VB_SHARED_NOBRE_GUILD_ID;
 const roleId=process.env.VB_SHARED_NOBRE_ROLE_ID;
 const token=process.env.VB_SHARED_NOBRE_TOKEN;
 const origin=process.env.VB_SHARED_NOBRE_ORIGIN;
 if(process.env.VB_SHARED_NOBRE_ENABLED!=='1'||!guildId||!roleId||!token||
  token.length<40||!snowflake.test(guildId)||!snowflake.test(roleId)||!origin)return null;
 try{
  const url=new URL(origin);
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||
   url.username||url.password)return null;
  return {guildId,roleId,token,origin:url.origin};
 }catch{return null;}
}
type Config=NonNullable<ReturnType<typeof config>>;
async function bridge(cfg:Config,path:string,body?:unknown){
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),12000);
 try{
  const response=await fetch(cfg.origin+'/api/v1/nobre-bridge/'+path,{
   method:body?'POST':'GET',
   headers:{authorization:'Bearer '+cfg.token,
    ...(body?{'content-type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,cache:'no-store',signal:ctrl.signal
  });
  if(!response.ok)throw Error('nobre_bridge_response_'+response.status);
  return await response.json() as unknown;
 }finally{clearTimeout(timer);}
}
export function shouldRemoveSharedRole(roleManagedByBridge:boolean,hasNative:boolean){
 return roleManagedByBridge&&!hasNative;
}
async function applyRole(client:Client,cfg:Config,discordId:string,shouldHave:boolean){
 const guild=await client.guilds.fetch(cfg.guildId).catch(()=>null);
 if(!guild)throw Error('shared_guild_unavailable');
 const member=await guild.members.fetch(discordId).catch(()=>null);
 if(!member)return; // Do not invite members who are not in the community.
 const where={guildId_discordId:{guildId:cfg.guildId,discordId}};
 const mirror=await prisma.sharedNobreMirror.findUnique({where,select:{
  roleManagedByBridge:true
 }});
 if(!mirror)return;
 if(shouldHave){
  if(!member.roles.cache.has(cfg.roleId)){
   await member.roles.add(cfg.roleId,'Shared Nobre entitlement');
   // Only a role actually added by this bridge may be removed by it later.
   await prisma.sharedNobreMirror.update({where,data:{roleManagedByBridge:true}});
  }
  return;
 }
 if(!mirror.roleManagedByBridge)return; // Preserve manual/staff and unrelated roles.
 const native=await prisma.supportEntitlement.findFirst({where:{
  guildId:cfg.guildId,userId:discordId,roleId:cfg.roleId,
  status:'ACTIVE',expiresAt:{gt:new Date()},revokedAt:null
 },select:{id:true}});
 if(!shouldRemoveSharedRole(mirror.roleManagedByBridge,Boolean(native))){
  await prisma.sharedNobreMirror.update({where,data:{roleManagedByBridge:false}});
  return;
 }
 if(member.roles.cache.has(cfg.roleId))
  await member.roles.remove(cfg.roleId,'Shared Nobre entitlement ended');
 await prisma.sharedNobreMirror.update({where,data:{roleManagedByBridge:false}});
}
export function isSharedMirrorActive(mirror:{linked:boolean;expiresAt:Date|null}|null,
 now=new Date()){
 return Boolean(mirror?.linked&&mirror.expiresAt&&mirror.expiresAt>now);
}
export async function hasSharedNobre(guildId:string,discordId:string,roleId:string){
 const cfg=config();
 if(!cfg||cfg.guildId!==guildId||cfg.roleId!==roleId)return false;
 const mirror=await prisma.sharedNobreMirror.findUnique({where:{
  guildId_discordId:{guildId,discordId}},select:{linked:true,expiresAt:true}
 });
 return isSharedMirrorActive(mirror);
}
export async function syncSharedNobre(client:Client){
 const cfg=config();
 if(!cfg)return;
 // On provider outages, do not mutate roles or cached grants.
 const data=await bridge(cfg,'links') as Links;
 if(!data||data.guildId!==cfg.guildId||!Array.isArray(data.links)||data.links.length>=5000)
  throw Error('shared_nobre_link_list_invalid');
 const seen=new Set<string>();
 for(const link of data.links){
  if(!link||typeof link.discordId!=='string'||!snowflake.test(link.discordId)||
   typeof link.linkedAt!=='string'||(link.expiresAt!==null&&typeof link.expiresAt!=='string'))
    throw Error('shared_nobre_link_invalid');
  seen.add(link.discordId);
  try{
   if(!link.legacySnapshotAt){
    const native=await prisma.supportEntitlement.findFirst({where:{
     guildId:cfg.guildId,userId:link.discordId,roleId:cfg.roleId,
     status:'ACTIVE',expiresAt:{gt:new Date()},revokedAt:null
    },orderBy:{expiresAt:'desc'},select:{expiresAt:true}});
    const snapshotAt=new Date().toISOString();
    const expiresAt=native?.expiresAt.toISOString()??snapshotAt;
    await bridge(cfg,'credit',{kind:'legacy',guildId:cfg.guildId,
     discordId:link.discordId,expiresAt,snapshotAt});
    // The next poll reads the updated central expiration.
    continue;
   }
   const cutoff=new Date(link.legacySnapshotAt);
   if(!Number.isFinite(cutoff.getTime()))throw Error('shared_snapshot_invalid');
   let cursor:string|undefined;
   for(let page=0;page<100;page++){
    const payments=await prisma.supportPayment.findMany({where:{
     guildId:cfg.guildId,userId:link.discordId,roleIdSnapshot:cfg.roleId,
     status:SupportPaymentStatus.FULFILLED,fulfilledAt:{gt:cutoff}
    },orderBy:[{fulfilledAt:'asc'},{id:'asc'}],take:100,
     ...(cursor?{cursor:{id:cursor},skip:1}:{}),
     select:{id:true,durationDaysSnapshot:true,fulfilledAt:true}});
    for(const paid of payments){
     if(!paid.fulfilledAt)continue;
     await bridge(cfg,'credit',{kind:'payment',guildId:cfg.guildId,
      discordId:link.discordId,paymentId:paid.id,
      days:paid.durationDaysSnapshot,fulfilledAt:paid.fulfilledAt.toISOString()});
    }
    if(payments.length<100)break;
    cursor=payments.at(-1)?.id;
   }
   const expires=link.expiresAt?new Date(link.expiresAt):null;
   if(expires&&!Number.isFinite(expires.getTime()))throw Error('shared_expiration_invalid');
   await prisma.sharedNobreMirror.upsert({where:{
    guildId_discordId:{guildId:cfg.guildId,discordId:link.discordId}
   },create:{guildId:cfg.guildId,discordId:link.discordId,
    roleId:cfg.roleId,expiresAt:expires,linked:true},
   update:{roleId:cfg.roleId,expiresAt:expires,linked:true,lastCheckedAt:new Date()}});
   await applyRole(client,cfg,link.discordId,Boolean(expires&&expires>new Date()));
  }catch(err){
   logger.warn({err:safe_error_details(err)},'Shared Nobre account synchronization deferred');
  }
 }
 // Unlinking stops site-derived role access; native Discord benefits stay intact.
 const known=await prisma.sharedNobreMirror.findMany({where:{guildId:cfg.guildId,linked:true},
  select:{discordId:true}});
 for(const mirror of known){
  if(seen.has(mirror.discordId))continue;
  try{
   await prisma.sharedNobreMirror.update({where:{guildId_discordId:{
    guildId:cfg.guildId,discordId:mirror.discordId
   }},data:{linked:false,expiresAt:null,lastCheckedAt:new Date()}});
   await applyRole(client,cfg,mirror.discordId,false);
  }catch(err){logger.warn({err:safe_error_details(err)},'Shared Nobre unlink deferred');}
 }
}
