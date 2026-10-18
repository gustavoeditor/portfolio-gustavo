const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const handler=require('../lib/store-checkout.js');
function mock(method,headers={}){const res={code:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this},end(){return this}};handler({method,headers},res);return res;}
function configure(){process.env.STORE_TRIO_COMMERCIAL_HOSTING_APPROVED='true';process.env.STORE_TRIO_CHECKOUT_URL='https://buy.stripe.com/abcdefghi';process.env.STORE_TRIO_PRICE_CENTS='7900';process.env.STORE_TRIO_STRIPE_PAYMENT_LINK_ID='plink_1234567890123456';process.env.STRIPE_SECRET_KEY=['sk','live','123456789012345678901234567890'].join('_');process.env.STORE_TRIO_PRIVATE_BLOB_TOKEN=['blob','fake','123456789012345678901234567890123456'].join('_');process.env.STORE_TRIO_PRIVATE_BLOB_PATH='products/gustavo-trio/release-1.3.zip';process.env.STORE_TRIO_RELEASE_SHA256='a'.repeat(64);}
function reset(){for(const k of ['STORE_TRIO_COMMERCIAL_HOSTING_APPROVED','STORE_TRIO_SALES_ENABLED','STORE_TRIO_DELIVERY_READY','STORE_TRIO_CHECKOUT_URL' ,'STORE_TRIO_PRICE_CENTS','STORE_TRIO_STRIPE_PAYMENT_LINK_ID','STRIPE_SECRET_KEY','STORE_TRIO_PRIVATE_BLOB_TOKEN','STORE_TRIO_PRIVATE_BLOB_PATH','STORE_TRIO_RELEASE_SHA256','STORE_CAKTO_CHECKOUT_URL','STORE_CAKTO_PRICE_CENTS','STORE_CAKTO_DELIVERY_READY','STORE_CAKTO_SALES_ENABLED'])delete process.env[k];}
test('checkout bloqueado por padrão',()=>{reset();assert.equal(mock('GET').body.available,false);assert.equal(mock('POST').code,503);});
test('não permite redirect perigoso',()=>{for(const x of ['https://evil.example/pago','http://buy.stripe.com/test','https://buy.stripe.com.evil.example/test','javascript:alert(1)','https://user:pass@buy.stripe.com/test'])assert.equal(handler._test.paymentLink(x),null);});
test('checkout só abre com entrega pronta e comprovável',()=>{reset();configure();process.env.STORE_TRIO_SALES_ENABLED='true';assert.equal(mock('GET').body.available,false);process.env.STORE_TRIO_DELIVERY_READY='true';assert.equal(mock('GET').body.available,true);assert.match(mock('GET').body.priceLabel,/79,00/);assert.equal(mock('POST').code,303);assert.equal(mock('POST').headers.Location,'https://buy.stripe.com/abcdefghi');reset();});
test('bloqueia origin estranho e métodos extras',()=>{reset();configure();process.env.STORE_TRIO_SALES_ENABLED='true';process.env.STORE_TRIO_DELIVERY_READY='true';assert.equal(mock('POST',{origin:'https://outro.example',host:'portfolio-gustavo-chi.vercel.app'}).code,403);assert.equal(mock('PUT').code,405);reset();});
test('Cakto checkout URL is validated against official host and cannot redirect to strangers',()=>{
 for(const bad of [
  'https://evil.example/checkout','http://pay.cakto.com.br/offer',
  'https://pay.cakto.com.br.evil.example/offer','https://cakto.com.br/offer',
  'https://user:secret@pay.cakto.com.br/offer',
  'https://pay.cakto.com.br/offer#fragment','javascript:alert(1)',
  'https://pay.cakto.com.br/'
 ])assert.equal(handler._test.caktoLink(bad),null,bad);
 assert.equal(handler._test.caktoLink('https://pay.cakto.com.br/creative-tools'),'https://pay.cakto.com.br/creative-tools');
});
test('Cakto works without a Stripe backend only after commercial and digital-delivery approvals',()=>{
 reset();
 const link='https://pay.cakto.com.br/creative-tools';
 process.env.STORE_CAKTO_SALES_ENABLED='true';
 process.env.STORE_CAKTO_CHECKOUT_URL=link;
 process.env.STORE_CAKTO_PRICE_CENTS='3900';
 // Approval and delivery must be explicitly verified. No payment is taken by tests.
 assert.equal(mock('GET').body.available,false);
 process.env.STORE_TRIO_COMMERCIAL_HOSTING_APPROVED='true';
 assert.equal(mock('GET').body.available,false);
 process.env.STORE_CAKTO_DELIVERY_READY='true';
 assert.equal(mock('GET').body.available,true);
 assert.equal(mock('GET').body.provider,'cakto');
 assert.equal(mock('GET').body.priceLabel,'R$ 39,00');
 const post=mock('POST',{origin:'https://portfolio-gustavo-chi.vercel.app',host:'portfolio-gustavo-chi.vercel.app'});
 assert.equal(post.code,303);
 assert.equal(post.headers.Location,link);
 assert.equal(mock('POST',{origin:'https://bad.example',host:'portfolio-gustavo-chi.vercel.app'}).code,403);
 process.env.STORE_CAKTO_CHECKOUT_URL='https://evil.example/offer';
 assert.equal(mock('POST').code,503);
 process.env.STORE_CAKTO_CHECKOUT_URL=link;
 process.env.STORE_CAKTO_PRICE_CENTS='0';
 assert.equal(mock('GET').body.available,false);
 reset();
});
test('Cakto misconfiguration never falls through to a previously configured Stripe checkout',()=>{
 reset();configure();
 process.env.STORE_TRIO_SALES_ENABLED='true';
 process.env.STORE_TRIO_DELIVERY_READY='true';
 assert.equal(mock('GET').body.available,true);
 process.env.STORE_CAKTO_SALES_ENABLED='true';
 assert.equal(mock('GET').body.available,false);
 assert.equal(mock('POST').code,503);
 reset();
});

test('loja contém informações e bloqueio antes de configurar',()=>{const html=fs.readFileSync(path.join(__dirname,'../loja.html'),'utf8');assert.match(html,/id="checkout" type="submit" disabled/);assert.match(html,/id="recursos"/);assert.match(html,/id="duvidas"/);assert.doesNotMatch(html,/sk_live_|pk_live_|BLOB_READ_WRITE_TOKEN/);});


test('transparência não inventa certificações nem ativa checkout',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../loja.html'),'utf8');
 const info=fs.readFileSync(path.join(__dirname,'../informacoes-de-compra.html'),'utf8');
 assert.match(html,/id="compra-segura"/);
 assert.match(html,/href="\/informacoes-de-compra.html"/);
 assert.match(html,/Nenhum selo de certificação independente é exibido sem autorização do emissor/);
 assert.match(info,/Produto em pré-lançamento/);
 assert.match(info,/O processo de entrega ainda está em testes/);
 assert.match(info,/href="\/privacidade.html"/);
 assert.match(info,/href="\/#contato"/);
 assert.match(html,/id="checkout" type="submit" disabled/);
 assert.doesNotMatch(html,/100% seguro|certificado oficial|verificado por terceiros/i);
 assert.doesNotMatch(info,/100% seguro|certificado oficial|verificado por terceiros/i);
});

test('Pack em pré-lançamento convida para contato, sem checkout fictício',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../loja.html'),'utf8');
 const home=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const sales=fs.readFileSync(path.join(__dirname,'../sales.js'),'utf8');
 assert.match(html,/id="pack-interesse"/);
 assert.ok(html.includes('href="/?interesse=pack"'));

 assert.match(home,/value="pack"/);
 assert.match(sales,/isPack=service==='pack'/);
 assert.match(html,/Ainda não existe checkout, entrega ou data oficial/);
});
