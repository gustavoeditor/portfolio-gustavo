'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {Readable} = require('node:stream');
const webhook = require('../api/cakto-webhook')._test;

const SECRET = 'webhook-secret-for-unit-tests-123456';
const PRODUCT_ID = '12345678-1234-4234-8234-123456789012';
const ORDER_ID = '87654321-4321-4321-8321-210987654321';
const ENV = Object.freeze({
  CAKTO_WEBHOOK_SECRET:SECRET,
  CAKTO_PRODUCT_ID:PRODUCT_ID,
  CAKTO_OFFER_ID:'testOffer',
  SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY:'private-test-key-never-used-in-production'
});
const NOW = 1792410000000;
function order(status='paid') {
  return {id:ORDER_ID,status,currency:'BRL',offer_type:'main',
    product:{id:PRODUCT_ID},offer:{id:'testOffer',price:39.9},
    amount:39.9,customer:{email:'Buyer@Example.com'}};
}
function mock(payload, options={}) {
  const raw = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
  const timestamp = String(Math.floor(NOW/1000));
  const signature = 'v1=' + crypto.createHmac('sha256',SECRET).update(timestamp + '.').update(raw).digest('hex');
  const request = Readable.from([raw]);
  request.method = options.method || 'POST';
  request.headers = {'content-type':'application/json','x-cakto-timestamp':timestamp,'x-cakto-signature':signature,...(options.headers || {})};
  const response = {code:200,data:null,headers:{},setHeader(k,v){this.headers[k]=v},
    status(code){this.code=code;return this},json(value){this.data=value;return this}};
  const recorded = [];
  const handler = webhook.handlerFactory({env:options.env||ENV,now:NOW,
    recordOrder: async record => {recorded.push(record);if (options.rejectDb) throw Error('DB unavailable');}});
  return handler(request,response).then(() => ({response,recorded,raw}));
}
test('HMAC validates exact raw bytes, clock, and rejects edits',async()=>{
  const good = {secret:SECRET,event:'purchase_approved',data:order()};
  const result = await mock(good);
  assert.equal(result.response.code,200);
  assert.equal(result.response.data.processed,1);
  assert.deepEqual(result.recorded,[{
    p_order_id:ORDER_ID,p_product_id:PRODUCT_ID,p_offer_id:'testOffer',
    p_customer_email:'buyer@example.com',p_event:'purchase_approved'
  }]);
  assert.equal((await mock(good,{headers:{'x-cakto-signature':'v1='+'0'.repeat(64)}})).response.code,401);
  assert.equal((await mock(good,{headers:{'x-cakto-timestamp':'1692410000'}})).response.code,401);
  assert.equal((await mock({...good,secret:'not-the-secret'})).response.code,401);
});
test('filters other events, products, offers, non-main orders and unpaid orders',async()=>{
  const otherProduct = order();otherProduct.product.id='99999999-9999-4999-8999-999999999999';
  const otherOffer = order();otherOffer.offer.id='somethingElse';
  const upsell = order();upsell.offer_type='upsell';
  const wrongStatus = order('waiting_payment');
  for(const item of [otherProduct,otherOffer,upsell,wrongStatus]) {
    const result = await mock({secret:SECRET,event:'purchase_approved',data:item});
    assert.equal(result.response.code,200);assert.deepEqual(result.recorded,[]);
  }
  const unrelated = await mock({secret:SECRET,event:'checkout_abandonment',data:order()});
  assert.equal(unrelated.response.data.ignored,true);
});
test('accepts V2 multiple orders but only records matching main purchases',async()=>{
  const extra = order();extra.offer_type='orderbump';
  const result = await mock({secret:SECRET,event:'purchase_approved',data:[order(),extra]});
  assert.equal(result.recorded.length,1);
});
test('refund and chargeback events record revocation intent, not licence keys',async()=>{
  for(const [event,status] of [['refund','refunded'],['chargeback','chargedback']]){
    const result = await mock({secret:SECRET,event,data:order(status)});
    assert.equal(result.response.code,200);
    assert.equal(result.recorded[0].p_event,event);
  }
});
test('rejects dangerous inputs, non-POST and misconfiguration',async()=>{
  const payload = {secret:SECRET,event:'purchase_approved',data:order()};
  assert.equal((await mock(payload,{method:'GET'})).response.code,405);
  assert.equal((await mock(payload,{env:{}})).response.code,503);
  assert.equal((await mock(payload,{headers:{'content-type':'text/plain'}})).response.code,415);
  assert.equal((await mock(Buffer.from('invalid json'))).response.code,400);
  const zero = order();zero.amount=0;
  assert.deepEqual((await mock({secret:SECRET,event:'purchase_approved',data:zero})).recorded,[]);
  const fake = order();fake.offer.price=1;
  assert.deepEqual((await mock({secret:SECRET,event:'purchase_approved',data:fake})).recorded,[]);
});
test('DB failure must be visible to operator: Cakto does not automatically retry 5xx',async()=>{
  const result = await mock({secret:SECRET,event:'purchase_approved',data:order()},{rejectDb:true});
  assert.equal(result.response.code,503);
  assert.equal(result.recorded.length,1);
});
test('never trusts a forged V2 event and enforces body limits',async()=>{
  const huge = {secret:SECRET,event:'purchase_approved',data:order(),padding:'x'.repeat(129*1024)};
  assert.equal((await mock(huge)).response.code,413);
  const tampered = order();tampered.customer.email='wrong';
  assert.equal((await mock({secret:SECRET,event:'purchase_approved',data:tampered},{headers:{'x-cakto-signature':'v1=bad'}})).response.code,401);
});
