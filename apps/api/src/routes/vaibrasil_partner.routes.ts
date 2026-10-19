import {timingSafeEqual} from 'node:crypto'
import type {FastifyInstance} from 'fastify'
import {z} from 'zod'
import {LivePixConnectionStatus,prisma,SupportPaymentStatus} from '@yuebot/database'
import {verify_and_fulfill_support_payment} from '../internal/bot_internal_api'
import {createSiteCheckout} from '../services/support/site_checkout'
import {decrypt_livepix_secret} from '@yuebot/livepix'
import {CONFIG} from '../config'
import {pendingCheckoutUrl} from '../services/support/pending_checkout'

const id=z.string().regex(/^[0-9]{16,22}$/)
const input=z.object({discordId:id,planId:z.string().min(5).max(120)}).strict()
const person=z.object({discordId:id}).strict()
const verify=z.object({discordId:id,publicId:z.string().min(10).max(120).regex(/^[a-zA-Z0-9_-]+$/)}).strict()
export function partnerAuthorized(auth:string|undefined,token:string|undefined):boolean{
 if(!token||token.length<40||!auth?.startsWith('Bearer '))return false
 const actual=Buffer.from(auth.slice(7),'utf8'),expected=Buffer.from(token,'utf8')
 return actual.length===expected.length&&timingSafeEqual(actual,expected)
}
function config(){
 const guildId=process.env.VB_SHARED_NOBRE_GUILD_ID
 const token=process.env.VB_SHARED_NOBRE_TOKEN
 return process.env.VB_SHARED_NOBRE_ENABLED==='1'&&guildId&&id.safeParse(guildId).success&&
  token&&token.length>=40?{guildId,token}:null
}
const view=(p:{id:string;name:string;description:string;amountCents:number;durationDays:number})=>({
 id:p.id,name:p.name,description:p.description,
 amountCents:p.amountCents,days:p.durationDays
})
export function createPartnerRoutes(deps={
 db:prisma,
 start:createSiteCheckout,
 verifyPayment:verify_and_fulfill_support_payment
}){
 return async function partnerRoutes(app:FastifyInstance){
  app.addHook('onRequest',async(_req,reply)=>{
   reply.header('Cache-Control','private, no-store')
   reply.header('Referrer-Policy','no-referrer')
  })
  app.addHook('preHandler',async(req,reply)=>{
   const cfg=config()
   if(!cfg)return reply.code(503).send({error:'partner_disabled'})
   if(!partnerAuthorized(req.headers.authorization,cfg.token))
    return reply.code(401).send({error:'unauthorized'})
  })
  app.get('/plans',async(_req,reply)=>{
   const cfg=config()
   if(!cfg)return reply.code(503).send({error:'partner_disabled'})
   const [settings,connection,plans]=await Promise.all([
    deps.db.guildSupportConfig.findUnique({where:{guildId:cfg.guildId},select:{enabled:true}}),
    deps.db.livePixConnection.findUnique({where:{guildId:cfg.guildId},select:{status:true}}),
    deps.db.supportPlan.findMany({where:{
      guildId:cfg.guildId,enabled:true,archivedAt:null
     },orderBy:[{sortOrder:'asc'},{createdAt:'asc'}],take:25,
     select:{id:true,name:true,description:true,amountCents:true,durationDays:true}})
   ])
   return {enabled:Boolean(settings?.enabled&&connection?.status===LivePixConnectionStatus.CONNECTED
    &&process.env.LIVEPIX_ENABLED==='true'&&process.env.VB_SITE_CHECKOUT_ENABLED==='1'),
    plans:plans.map(view)}
  })
  app.post('/checkout',async(req,reply)=>{
   const parsed=input.safeParse(req.body)
   if(!parsed.success)return reply.code(400).send({error:'invalid_request'})
   if(process.env.VB_SITE_CHECKOUT_ENABLED!=='1')
    return reply.code(503).send({error:'checkout_not_enabled'})
   const cfg=config()
   if(!cfg)return reply.code(503).send({error:'partner_disabled'})
   try{
    const result=await deps.start({guildId:cfg.guildId,userId:parsed.data.discordId,planId:parsed.data.planId},req.log)
    const url=new URL(result.checkoutUrl)
    if(url.protocol!=='https:'||url.hostname!=='checkout.livepix.gg'||
       url.username||url.password)return reply.code(503).send({error:'checkout_unavailable'})
    return reply.code(result.reused?200:201).send(result)
   }catch{
    return reply.code(503).send({error:'checkout_pending_or_unavailable'})
   }
  })
  app.post('/history',async(req,reply)=>{
   const parsed=person.safeParse(req.body)
   if(!parsed.success)return reply.code(400).send({error:'invalid_request'})
   const cfg=config()
   if(!cfg)return reply.code(503).send({error:'partner_disabled'})
   const payments=await deps.db.supportPayment.findMany({where:{
    guildId:cfg.guildId,userId:parsed.data.discordId
   },orderBy:{createdAt:'desc'},take:35,select:{
    publicId:true,planNameSnapshot:true,amountCentsSnapshot:true,durationDaysSnapshot:true,
    status:true,createdAt:true,fulfilledAt:true,checkoutUrlEncrypted:true
   }})
   return {payments:payments.map(p=>{
    const checkoutUrl=pendingCheckoutUrl(p,
     encrypted=>decrypt_livepix_secret(encrypted,CONFIG.livePix.tokenEncryptionKey))
    return {publicId:p.publicId,name:p.planNameSnapshot,amountCents:p.amountCentsSnapshot,
     durationDays:p.durationDaysSnapshot,status:p.status,createdAt:p.createdAt,
     fulfilledAt:p.fulfilledAt,checkoutUrl}
   })}
  })
  app.post('/verify',async(req,reply)=>{
   const parsed=verify.safeParse(req.body)
   if(!parsed.success)return reply.code(400).send({error:'invalid_request'})
   const cfg=config()
   if(!cfg)return reply.code(503).send({error:'partner_disabled'})
   const payment=await deps.db.supportPayment.findFirst({where:{
    guildId:cfg.guildId,userId:parsed.data.discordId,publicId:parsed.data.publicId
   },select:{id:true,status:true}})
   if(!payment)return reply.code(404).send({error:'payment_not_found'})
   if(payment.status===SupportPaymentStatus.PENDING||
      payment.status===SupportPaymentStatus.CREATING){
    try{await deps.verifyPayment({guildId:cfg.guildId,paymentId:payment.id},req.log)}
    catch{return reply.code(503).send({error:'verification_deferred'})}
   }
   const updated=await deps.db.supportPayment.findUnique({where:{id:payment.id},
    select:{status:true,fulfilledAt:true}})
   return updated||reply.code(404).send({error:'payment_not_found'})
  })
 }
}
export const vaiBrasilPartnerRoutes=createPartnerRoutes()
