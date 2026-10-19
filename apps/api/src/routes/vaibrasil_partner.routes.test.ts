import assert from 'node:assert/strict'
import test from 'node:test'
import Fastify from 'fastify'
import {partnerAuthorized,createPartnerRoutes} from './vaibrasil_partner.routes'

const original={
  token:process.env.VB_SHARED_NOBRE_TOKEN,guild:process.env.VB_SHARED_NOBRE_GUILD_ID,
  active:process.env.VB_SHARED_NOBRE_ENABLED,checkout:process.env.VB_SITE_CHECKOUT_ENABLED,
  livepix:process.env.LIVEPIX_ENABLED
}
const token='x'.repeat(55),guild='123456789012345678'
function configure(){
 process.env.VB_SHARED_NOBRE_TOKEN=token
 process.env.VB_SHARED_NOBRE_GUILD_ID=guild
 process.env.VB_SHARED_NOBRE_ENABLED='1'
 process.env.VB_SITE_CHECKOUT_ENABLED='0'
 process.env.LIVEPIX_ENABLED='true'
}
function restore(){
 for(const [n,key] of [['token','VB_SHARED_NOBRE_TOKEN'],['guild','VB_SHARED_NOBRE_GUILD_ID'],
  ['active','VB_SHARED_NOBRE_ENABLED'],['checkout','VB_SITE_CHECKOUT_ENABLED'],
  ['livepix','LIVEPIX_ENABLED']] as const){
  const val=original[n]
  if(val===undefined)delete process.env[key]
  else process.env[key]=val
 }
}
function fake(){
 const calls:{where?:unknown}[]=[]
 const db={
  guildSupportConfig:{findUnique:async()=>({enabled:true})},
  livePixConnection:{findUnique:async()=>({status:'CONNECTED'})},
  supportPlan:{findMany:async ({where}:{where:unknown})=>{
   calls.push({where})
   return [{id:'plan-month',name:'Apoio Mensal',description:'30 dias',
    amountCents:3500,durationDays:30}]}},
  supportPayment:{
   findMany:async({where}:{where:unknown})=>{calls.push({where});return []},
   findFirst:async({where}:{where:unknown})=>{calls.push({where});return null},
   findUnique:async()=>null
  }
 }
 let created=0
 const start=async()=>{created++;return {publicId:'checkout_123456789',
  checkoutUrl:'https://checkout.livepix.gg/abcd',reused:false}}
 const api=Fastify()
 api.register(createPartnerRoutes({db:db as never,start:start as never,
  verifyPayment:(async()=>({success:true,status:'fulfilled',message:'ok'})) as never}))
 return {api,calls,get created(){return created}}
}
test('partner auth rejects malformed and timing-independent invalid tokens',()=>{
 assert.equal(partnerAuthorized(undefined,token),false)
 assert.equal(partnerAuthorized('Bearer '+token,token),true)
 assert.equal(partnerAuthorized('Bearer '+token+'a',token),false)
 assert.equal(partnerAuthorized('Bearer '+ 'y'.repeat(55),token),false)
 assert.equal(partnerAuthorized('Bearer '+token,'short'),false)
})
test('plans use only active guild records and hide role and other private fields',async()=>{
 configure()
 const {api,calls}=fake()
 try{
  const denied=await api.inject({url:'/plans'})
  assert.equal(denied.statusCode,401)
  assert.equal(calls.length,0)
  const response=await api.inject({url:'/plans',headers:{authorization:'Bearer '+token}})
  assert.equal(response.statusCode,200)
  assert.equal(response.json().enabled,false)
  assert.equal(response.json().plans[0].amountCents,3500)
  assert.equal(response.json().plans[0].roleId,undefined)
  assert.deepEqual(calls[0].where,{guildId:guild,enabled:true,archivedAt:null})
 }finally{await api.close();restore()}
})
test('checkout is strictly opt-in, rejects arbitrary price and forwards only guild-bound plan',async()=>{
 configure()
 const harness=fake(),api=harness.api
 try{
  const body={discordId:'234567890123456789',planId:'plan-month'}
  let response=await api.inject({method:'POST',url:'/checkout',
    headers:{authorization:'Bearer '+token},payload:body})
  assert.equal(response.statusCode,503)
  assert.equal(harness.created,0)
  process.env.VB_SITE_CHECKOUT_ENABLED='1'
  response=await api.inject({method:'POST',url:'/checkout',
    headers:{authorization:'Bearer '+token},payload:{...body,amountCents:1}})
  assert.equal(response.statusCode,400)
  response=await api.inject({method:'POST',url:'/checkout',
    headers:{authorization:'Bearer '+token},payload:body})
  assert.equal(response.statusCode,201)
  assert.equal(harness.created,1)
  assert.match(response.json().checkoutUrl,/^https:\/\/checkout\.livepix\.gg\//)
 }finally{await api.close();restore()}
})
test('private history scopes query to the authenticated site identity',async()=>{
 configure()
 const {api,calls}=fake()
 try{
  const response=await api.inject({method:'POST',url:'/history',headers:{
   authorization:'Bearer '+token},payload:{discordId:'234567890123456789'}})
  assert.equal(response.statusCode,200)
  assert.equal(response.json().payments.length,0)
  assert.deepEqual(calls[0].where,{guildId:guild,userId:'234567890123456789'})
  const malformed=await api.inject({method:'POST',url:'/history',headers:{
   authorization:'Bearer '+token},payload:{discordId:'abc'}})
  assert.equal(malformed.statusCode,400)
 }finally{await api.close();restore()}
})
