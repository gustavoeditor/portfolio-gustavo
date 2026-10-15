const sharp=require('sharp');
const svg="<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"630\" viewBox=\"0 0 1200 630\">\n<defs>\n <radialGradient id=\"shine\"><stop stop-color=\"#533c85\" stop-opacity=\".68\"/><stop offset=\"1\" stop-color=\"#110e18\" stop-opacity=\"0\"/></radialGradient>\n <linearGradient id=\"background\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop stop-color=\"#15111e\"/><stop offset=\"1\" stop-color=\"#08080d\"/></linearGradient>\n <pattern id=\"grid\" width=\"42\" height=\"42\" patternUnits=\"userSpaceOnUse\"><path d=\"M42 0H0V42\" fill=\"none\" stroke=\"#856caf\" stroke-opacity=\".095\" stroke-width=\"1\"/></pattern>\n <linearGradient id=\"line\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"0\"><stop stop-color=\"#bda6ff\"/><stop offset=\"1\" stop-color=\"#523d75\" stop-opacity=\"0\"/></linearGradient>\n</defs>\n<rect width=\"1200\" height=\"630\" fill=\"url(#background)\"/><rect width=\"1200\" height=\"630\" fill=\"url(#grid)\"/>\n<ellipse cx=\"942\" cy=\"293\" rx=\"360\" ry=\"350\" fill=\"url(#shine)\"/>\n<circle cx=\"926\" cy=\"328\" r=\"230\" stroke=\"#bda4fc\" stroke-opacity=\".24\" stroke-width=\"2\" fill=\"none\"/>\n<circle cx=\"926\" cy=\"328\" r=\"278\" stroke=\"#bda4fc\" stroke-opacity=\".12\" stroke-width=\"1.5\" fill=\"none\"/>\n<rect x=\"66\" y=\"73\" width=\"8\" height=\"8\" rx=\"4\" fill=\"#bfa9ff\"/>\n<text x=\"90\" y=\"83\" fill=\"#cbb9e6\" font-family=\"sans-serif\" font-weight=\"700\" font-size=\"19\" letter-spacing=\"4\">DIREÇÃO VISUAL / EDIÇÃO / GAMING</text>\n<text x=\"60\" y=\"291\" fill=\"#ffffff\" font-family=\"sans-serif\" font-weight=\"800\" font-size=\"98\" letter-spacing=\"-5\">GUSTAVO</text>\n<text x=\"66\" y=\"367\" fill=\"#d0b9ff\" font-family=\"sans-serif\" font-weight=\"700\" font-size=\"36\" letter-spacing=\"7\">EDITOR DE VÍDEO</text>\n<rect x=\"66\" y=\"405\" width=\"590\" height=\"2\" fill=\"url(#line)\"/>\n<text x=\"66\" y=\"467\" fill=\"#d8cfdf\" font-family=\"sans-serif\" font-weight=\"500\" font-size=\"22\" letter-spacing=\"2\">CINEMATICS  /  MOTION DESIGN  /  CS2</text>\n<text x=\"66\" y=\"559\" fill=\"#9990a5\" font-family=\"sans-serif\" font-weight=\"500\" font-size=\"16\" letter-spacing=\"3\">PORTFÓLIO CRIATIVO · BRASIL</text>\n<path d=\"M330 652 L707 435 L482 435 L562 457 L389 558 L363 420 L361 396 L706 396 L607 339 L358 382 L348 330 L343 385 L276 396 L344 397Z\" transform=\"translate(570 -45) scale(.75)\" fill=\"#f1eaff\"/>\n<rect x=\"22\" y=\"22\" width=\"1156\" height=\"586\" rx=\"26\" fill=\"none\" stroke=\"#baa3f1\" stroke-opacity=\".26\" stroke-width=\"2\"/>\n</svg>";
module.exports=async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 try{
  const png=await sharp(Buffer.from(svg)).png({compressionLevel:9}).toBuffer();
  res.setHeader('Content-Type','image/png');
  res.setHeader('Content-Length',png.length);
  if(req.method==='HEAD')return res.status(200).end();
  return res.status(200).send(png);
 }catch(error){
  console.error('OG image generation failed:',error.message);
  return res.status(500).end('Image unavailable');
 }
};
