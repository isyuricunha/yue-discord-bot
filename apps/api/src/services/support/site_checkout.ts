import {randomBytes} from 'node:crypto'
import {prisma,LivePixConnectionMode,LivePixConnectionStatus,SupportPaymentStatus} from '@yuebot/database'
import {decrypt_livepix_secret,encrypt_livepix_secret,LivePixClient,LivePixClientCredentialsTokenCache,LIVEPIX_REQUIRED_SCOPES} from '@yuebot/livepix'
import {CONFIG} from '../../config'
import {validate_support_role} from '../../internal/bot_internal_api'
import type {FastifyBaseLogger} from 'fastify'

const MAX_REUSE_MS=24*60*60*1000
const provider=new LivePixClient()
let cache:LivePixClientCredentialsTokenCache|null=null
function tokenCache(){
 if(!cache)cache=new LivePixClientCredentialsTokenCache(provider,{
  clientId:CONFIG.livePix.clientId,
  clientSecret:CONFIG.livePix.clientSecret,
  scopes:LIVEPIX_REQUIRED_SCOPES
 })
 return cache
}
export class PartnerCheckoutError extends Error{
 constructor(public readonly code:string){super(code);this.name='PartnerCheckoutError'}
}
export async function createSiteCheckout(input:{guildId:string;userId:string;planId:string},
 log:FastifyBaseLogger){
 if(!CONFIG.livePix.enabled)throw new PartnerCheckoutError('livepix_disabled')
 const [plan,config,connection]=await Promise.all([
  prisma.supportPlan.findFirst({where:{id:input.planId,guildId:input.guildId,enabled:true,archivedAt:null}}),
  prisma.guildSupportConfig.findUnique({where:{guildId:input.guildId},select:{enabled:true}}),
  prisma.livePixConnection.findUnique({where:{guildId:input.guildId}})
 ])
 if(!plan||!config?.enabled)throw new PartnerCheckoutError('plan_unavailable')
 if(!connection||connection.mode!==LivePixConnectionMode.OWNER||
    connection.status!==LivePixConnectionStatus.CONNECTED)
  throw new PartnerCheckoutError('livepix_connection_unavailable')
 const checked=await validate_support_role({guildId:input.guildId,roleId:plan.roleId},log)
 if(!checked.valid)throw new PartnerCheckoutError('role_unavailable')
 const pendingKey=input.guildId+':'+input.userId+':'+plan.id
 const existing=await prisma.supportPayment.findFirst({where:{
  pendingKey,guildId:input.guildId,userId:input.userId,planId:plan.id,
  status:{in:[SupportPaymentStatus.CREATING,SupportPaymentStatus.PENDING]}
 },orderBy:{createdAt:'desc'}})
 if(existing){
  if(existing.checkoutUrlEncrypted&&existing.status===SupportPaymentStatus.PENDING&&
     existing.createdAt.getTime()>Date.now()-MAX_REUSE_MS){
   const checkoutUrl=decrypt_livepix_secret(existing.checkoutUrlEncrypted,CONFIG.livePix.tokenEncryptionKey)
   return {publicId:existing.publicId,checkoutUrl,reused:true}
  }
  // Never generate a second provider payment while first creation may have succeeded.
  throw new PartnerCheckoutError('checkout_pending_reconciliation')
 }
 const accessToken=await tokenCache().getAccessToken()
 const account=await provider.getAccount(accessToken)
 if(account.id!==connection.providerAccountId)throw new PartnerCheckoutError('wrong_provider_account')
 const publicId=randomBytes(18).toString('base64url')
 let payment
 try{
  payment=await prisma.supportPayment.create({data:{
   publicId,guildId:input.guildId,userId:input.userId,planId:plan.id,
   livePixConnectionId:connection.id,providerAccountId:connection.providerAccountId,
   livePixReference:'creating:'+publicId,pendingKey,
   planNameSnapshot:plan.name,planDescriptionSnapshot:plan.description,
   amountCentsSnapshot:plan.amountCents,durationDaysSnapshot:plan.durationDays,
   roleIdSnapshot:plan.roleId,currency:'BRL',status:SupportPaymentStatus.CREATING
  },select:{id:true}})
 }catch{
  // A concurrent request may have won the unique pendingKey constraint.
  throw new PartnerCheckoutError('checkout_pending_reconciliation')
 }
 const redirectUrl=new URL('/conta?section=support&pagamento='+encodeURIComponent(publicId),
  'https://traducao.yuricunha.com').href
 try{
  const created=await provider.createPayment(accessToken,{
   amount:plan.amountCents,currency:'BRL',redirectUrl
  })
  const checkoutUrl=new URL(created.redirectUrl)
  if(checkoutUrl.protocol!=='https:'||checkoutUrl.hostname!=='checkout.livepix.gg'||
     checkoutUrl.username||checkoutUrl.password)throw new PartnerCheckoutError('invalid_checkout_url')
  await prisma.supportPayment.update({where:{id:payment.id},data:{
   status:SupportPaymentStatus.PENDING,livePixReference:created.reference,
   checkoutUrlEncrypted:encrypt_livepix_secret(checkoutUrl.href,CONFIG.livePix.tokenEncryptionKey)
  }})
  await prisma.supportAuditEvent.create({data:{
   guildId:input.guildId,userId:input.userId,supportPaymentId:payment.id,
   action:'support.site_checkout_created',metadata:{planId:plan.id}
  }}).catch(()=>{/* Checkout remains tracked even if audit is temporarily unavailable. */})
  return {publicId,checkoutUrl:checkoutUrl.href,reused:false}
 }catch{
  // Payment may have been created remotely. Leave CREATING and pendingKey
  // intact; never retry blindly or lose the immutable snapshots.
  throw new PartnerCheckoutError('checkout_pending_reconciliation')
 }
}
