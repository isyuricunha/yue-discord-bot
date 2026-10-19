import assert from 'node:assert/strict'
import test from 'node:test'
import {pendingCheckoutUrl} from './pending_checkout'

test('reuses a 5-day pending LivePix checkout without creating a new payment',()=>{
 const record={status:'PENDING',checkoutUrlEncrypted:'ciphertext'}
 let calls=0
 const result=pendingCheckoutUrl(record,encoded=>{
  assert.equal(encoded,'ciphertext');calls++
  return 'https://checkout.livepix.gg/existing-payment'
 })
 assert.equal(result,'https://checkout.livepix.gg/existing-payment')
 assert.equal(calls,1)
})
test('never reveals checkout after settlement or for wrong hosts',()=>{
 const encrypted='ciphertext'
 for(const status of ['FULFILLED','CONFIRMED','CANCELLED','FAILED','CREATING'])
  assert.equal(pendingCheckoutUrl({status,checkoutUrlEncrypted:encrypted},()=>{
   throw Error('should not decrypt settled entries')
  }),null)
 for(const url of ['https://evil.invalid/x','http://checkout.livepix.gg/x',
  'https://checkout.livepix.gg.evil.invalid/x',
  'https://user:pass@checkout.livepix.gg/x']){
  assert.equal(pendingCheckoutUrl({status:'PENDING',checkoutUrlEncrypted:encrypted},()=>url),null)
 }
 assert.equal(pendingCheckoutUrl({status:'PENDING',checkoutUrlEncrypted:encrypted},
  ()=>{throw Error('invalid encrypted value')}),null)
 assert.equal(pendingCheckoutUrl({status:'PENDING',checkoutUrlEncrypted:null},()=>''),null)
})
