const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const handler=require('../lib/store-checkout.js');
function mock(method,headers={}){const res={code:0,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this},end(){return this}};handler({method,headers},res);return res;}
const KEYS=['STORE_CT_CHECKOUT_URL','STORE_CT_PRICE_CENTS','STORE_CT_SALES_DISABLED'];
function reset(){for(const k of KEYS)delete process.env[k];}
const CAKTO='https://pay.cakto.com.br/g6gcpgr_1217766';
test('checkout Cakto ativo por padrão, com link e preço oficiais',()=>{reset();const b=mock('GET').body;assert.equal(b.available,true);assert.equal(b.product,'creative-tools');assert.equal(b.provider,'cakto');assert.match(b.priceLabel,/39,90/);assert.equal(b.checkoutUrl,CAKTO);const post=mock('POST');assert.equal(post.code,303);assert.equal(post.headers.Location,CAKTO);});
test('não permite redirect perigoso',()=>{for(const x of ['https://evil.example/pago','http://pay.cakto.com.br/abc_123','https://pay.cakto.com.br.evil.example/abc','https://buy.stripe.com/abcdefghi','javascript:alert(1)','https://user:pass@pay.cakto.com.br/abc','https://pay.cakto.com.br/abc?email=a@b.c','https://pay.cakto.com.br/'])assert.equal(handler._test.paymentLink(x),null);assert.equal(handler._test.paymentLink(CAKTO),CAKTO);});
test('chave de pausa e configuração inválida fecham a venda',()=>{reset();process.env.STORE_CT_SALES_DISABLED='true';assert.equal(mock('GET').body.available,false);assert.equal(mock('GET').body.checkoutUrl,null);assert.equal(mock('POST').code,503);reset();process.env.STORE_CT_CHECKOUT_URL='https://evil.example/pago';assert.equal(mock('GET').body.available,false);assert.equal(mock('POST').code,503);reset();process.env.STORE_CT_PRICE_CENTS='abc';assert.equal(mock('GET').body.available,false);reset();});
test('link e preço podem ser trocados por variável de ambiente',()=>{reset();process.env.STORE_CT_CHECKOUT_URL='https://pay.cakto.com.br/outro_999';process.env.STORE_CT_PRICE_CENTS='4990';const b=mock('GET').body;assert.equal(b.available,true);assert.match(b.priceLabel,/49,90/);assert.equal(mock('POST').headers.Location,'https://pay.cakto.com.br/outro_999');reset();});
test('bloqueia origin estranho e métodos extras',()=>{reset();assert.equal(mock('POST',{origin:'https://outro.example',host:'portfolio-gustavo-chi.vercel.app'}).code,403);assert.equal(mock('PUT').code,405);});
test('loja aponta o botão de compra para o checkout oficial da Cakto',()=>{const html=fs.readFileSync(path.join(__dirname,'../loja.html'),'utf8');assert.match(html,/<a id="checkout" class="order-buy" href="https:\/\/pay\.cakto\.com\.br\/g6gcpgr_1217766" target="_blank" rel="noopener">/);assert.match(html,/id="price"[^>]*>R\$ 39,90</);assert.match(html,/taxa de serviço de R\$ 0,99/);assert.doesNotMatch(html,/buy\.stripe\.com/);assert.match(html,/id="ferramentas"/);assert.match(html,/id="duvidas"/);assert.doesNotMatch(html,/sk_live_|pk_live_|BLOB_READ_WRITE_TOKEN/);});


test('transparência não inventa certificações e explica pagamento, entrega e reembolso',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../loja.html'),'utf8');
 const info=fs.readFileSync(path.join(__dirname,'../informacoes-de-compra.html'),'utf8');
 assert.match(html,/id="compra-segura"/);
 assert.match(html,/href="\/informacoes-de-compra.html"/);
 assert.match(html,/Nenhum selo de certificação independente é exibido sem autorização do emissor/);
 assert.match(info,/pay\.cakto\.com\.br/);
 assert.match(info,/R\$ 39,90/);
 assert.match(info,/7 dias/);
 assert.match(info,/art\. 49 do Código de Defesa do Consumidor/);
 assert.match(info,/href="\/privacidade.html"/);
 assert.match(info,/href="\/#contato"/);
 assert.doesNotMatch(html,/pré-lançamento: vendas indisponíveis/i);
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
