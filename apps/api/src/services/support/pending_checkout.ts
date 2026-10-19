/** A LivePix checkout URL is reused regardless of age while the financial
 * record is still PENDING. Age alone must never create a second payment. */
export function pendingCheckoutUrl(record:{
 status:string;checkoutUrlEncrypted:string|null
},decrypt:(value:string)=>string):string|null{
 if(record.status!=='PENDING'||!record.checkoutUrlEncrypted)return null
 try{
  const url=new URL(decrypt(record.checkoutUrlEncrypted))
  return url.protocol==='https:'&&url.hostname==='checkout.livepix.gg'&&
   !url.username&&!url.password&&!url.port?url.href:null
 }catch{return null}
}
