/* Curated quality review of works published before automatic QC existed.
   production / complexity / professionalism: reviewed from 6 frames per video plus measured cut density.
   meta: measured with ffprobe on the 1080p masters (or the original Blob upload). The technical
   score is computed from meta by quality-control.js, so formula changes apply here too.
   New uploads carry their own scores from the admin QC and never need an entry here. */
(function(root){
  'use strict';
  const fhd=(fps,duration,bytes)=>({width:1920,height:1080,fps,duration,bytes});
  const BLOB='https://fmctstqjja9h7bqg.public.blob.vercel-storage.com/gustavo/videos/';
  const reviews={
    // key: original slug, or the uploaded video URL for managed projects
    'awp-the-prince':               {production:82,complexity:88,professionalism:82,meta:fhd(60,30.19,19699580),cuts:14},
    'flip-emerald-sfx':             {production:78,complexity:88,professionalism:80,meta:fhd(60,30.04,30814059),cuts:24},
    'flip-emerald-original':        {production:75,complexity:84,professionalism:74,meta:fhd(60,30.02,39717280),cuts:24},
    'butterfly-gamma-dark':         {production:87,complexity:76,professionalism:86,meta:fhd(60,10.58,2638704),cuts:0},
    'awp-orange-studio':            {production:85,complexity:70,professionalism:84,meta:fhd(60,5.87,1847894),cuts:0},
    'cs2-the-exchange':             {production:80,complexity:74,professionalism:77,meta:fhd(30,3.07,868020),cuts:1},
    'cs2-golden-hour-directors-cut':{production:79,complexity:70,professionalism:76,meta:fhd(30,7.13,3069329),cuts:0},
    'cs2-golden-hour-wide-cut':     {production:77,complexity:68,professionalism:74,meta:fhd(30,10,3561681),cuts:1},
    'neon-gloves-reveal':           {production:80,complexity:76,professionalism:77,meta:fhd(30,3.07,2004313),cuts:0},
    'purple-gloves-studio':         {production:72,complexity:64,professionalism:72,meta:fhd(30,3.1,1596445),cuts:0},
    'awp-creator-intro':            {production:74,complexity:72,professionalism:76,meta:fhd(60,15.7,3947587),cuts:5},
    'awp-gameplay-showcase':        {production:62,complexity:64,professionalism:66,meta:fhd(60,8.58,5633860),cuts:3},
    'karambit-floating':            {production:66,complexity:62,professionalism:64,meta:fhd(60,3.8,1518263),cuts:0},
    'purple-karambit-inspect':      {production:64,complexity:58,professionalism:66,meta:fhd(60,10.98,2770730),cuts:0},
    'kinetic-type-coral':           {production:62,complexity:66,professionalism:63,meta:fhd(29.97,5.04,680863),cuts:0},
    'kinetic-type-mint':            {production:60,complexity:60,professionalism:60,meta:fhd(29.97,2.07,265723),cuts:0},
    [BLOB+'abertura-keydrop-treino-mvb5csle-AZAxdGtZjIZReauGlG0qO5L0yXJuuD.mp4']:
                                    {production:87,complexity:86,professionalism:87,meta:{width:2560,height:1440,fps:60,duration:14.87,bytes:15093682},cuts:2},
    [BLOB+'5y56-mvfq0qb3-guubpWQFtBCv84shHPqC05B9FgZbXl.mp4']:
                                    {production:66,complexity:64,professionalism:64,meta:fhd(30,2.03,6616213),cuts:0},
    [BLOB+'121231232131-mvludqwh-wVYhR8yO2C6WAaUPwGxttE1fzd7mjs.mp4']:
                                    {production:72,complexity:55,professionalism:68,meta:fhd(30,4.53,13609041),cuts:0}
  };
  function lookup(key){
    const r=reviews[key];
    const Q=root.GustavoQuality;
    if(!r||!Q)return null;
    return Q.clean({production:r.production,complexity:r.complexity,professionalism:r.professionalism,technical:Q.technical(r.meta).score,source:'curator',confidence:'alta'});
  }
  const api={reviews,lookup};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GustavoQualityBaseline=api;
})(typeof globalThis==='object'?globalThis:this);
