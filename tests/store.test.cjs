const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const handler=require('../lib/store-checkout.js');
function mock(method,headers={}){const res={code:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this},end(){return this}};handler({method,headers},res);return res;}
function configure(){
 process.env.STORE_CAKTO_CHECKOUT_URL='https://pay.cakto.com.br/g6gcpgr_1217766';
 process.env.STORE_CAKTO_PRICE_CENTS='3990';
 process.env.CAKTO_PRODUCT_ID='11111111-1111-4111-8111-111111111111';
 process.env.STORE_CAKTO_DELIVERY_VERIFIED='true';
 process.env.STORE_CAKTO_LICENSE_VERIFIED='true';
 process.env.STORE_CAKTO_SALES_ENABLED='true';
}
function reset(){
 for(const key of ['STORE_CAKTO_CHECKOUT_URL','STORE_CAKTO_PRICE_CENTS','CAKTO_PRODUCT_ID',
 'STORE_CAKTO_DELIVERY_VERIFIED','STORE_CAKTO_LICENSE_VERIFIED','STORE_CAKTO_SALES_ENABLED']) delete process.env[key];
}
test('Cakto checkout blocked unless verified',()=>{
 reset();assert.equal(mock('GET').body.available,false);assert.equal(mock('POST').code,503);
 configure();assert.equal(mock('GET').body.available,true);
 assert.match(mock('GET').body.priceLabel,/39,90/);
 assert.equal(mock('POST').code,303);
 assert.equal(mock('POST').headers.Location,'https://pay.cakto.com.br/g6gcpgr_1217766');
 for(const key of ['STORE_CAKTO_DELIVERY_VERIFIED','STORE_CAKTO_LICENSE_VERIFIED','STORE_CAKTO_SALES_ENABLED','CAKTO_PRODUCT_ID']){
   const saved=process.env[key];delete process.env[key];
   assert.equal(mock('GET').body.available,false,key);process.env[key]=saved;
 }
 reset();
});
test('rejects wrong payment URLs, payment price and origin',()=>{
 for(const x of ['https://evil.example/pago','http://pay.cakto.com.br/g6gcpgr_1217766',
 'https://pay.cakto.com.br.evil.example/g6gcpgr_1217766',
 'https://pay.cakto.com.br/g6gcpgr_1217766?other=1',
 'https://pay.cakto.com.br/g6gcpgr_1217766#x',
 'https://pay.cakto.com.br/other-checkout'])
 assert.equal(handler._test.paymentLink(x),null,x);
 configure();
 assert.equal(mock('POST',{origin:'https://outro.example',host:'portfolio-gustavo-chi.vercel.app'}).code,403);
 assert.equal(mock('PUT').code,405);
 process.env.STORE_CAKTO_PRICE_CENTS='7900';
 assert.equal(mock('GET').body.available,false);
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
