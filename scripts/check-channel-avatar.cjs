const assert = require('node:assert/strict');
const handler = require('../api/channel-avatar');
const {channelURL, avatarURL} = handler;
const response = () => ({headers:{}, setHeader(k,v){this.headers[k]=v;}, status(code){this.code=code;return this;}, end(){}});

(async () => {
  assert.equal(channelURL('https://youtube.com/@oalexcs/'), 'https://www.youtube.com/@oalexcs');
  for (const url of ['http://youtube.com/@x', 'https://youtube.com.evil.test/@x', 'https://user@youtube.com/@x', 'https://youtube.com:444/@x', 'https://youtube.com/watch?v=x', 'https://localhost/@x']) assert.equal(channelURL(url), null);
  assert.equal(avatarURL('<meta content="https://yt3.googleusercontent.com/avatar=s192&amp;x=1" property="og:image">'), 'https://yt3.googleusercontent.com/avatar=s192&x=1');
  assert.equal(avatarURL('<meta property="og:image" content="https://evil.test/avatar">'), null);
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => {calls++;return new Response('<meta property="og:image" content="https://yt3.ggpht.com/avatar">',{headers:{'content-type':'text/html'}});};
  try {
    const unknown=response(); await handler({method:'GET',query:{channel:'https://www.youtube.com/@uncatalogued'}},unknown);
    assert.equal(unknown.code,404); assert.equal(calls,0);
    const success=response(); await handler({method:'GET',query:{channel:'https://www.youtube.com/@oalexcs'}},success);
    assert.equal(success.code,302); assert.equal(success.headers.Location,'https://yt3.ggpht.com/avatar');
    assert.ok(success.headers['Cache-Control'].includes('s-maxage=21600'));
    global.fetch=async()=>{throw new Error('upstream unavailable');};
    const fail=response(); await handler({method:'GET',query:{channel:'https://www.youtube.com/@oalexcs'}},fail);
    assert.equal(fail.code,502); assert.equal(fail.headers['Cache-Control'],'no-store');
    const post=response(); await handler({method:'POST'},post); assert.equal(post.code,405);
  } finally {global.fetch=original;}
  console.log('Channel avatar checks passed: URL restrictions, registered channels, image resolution and upstream failure.');
})().catch(e=>{console.error(e);process.exitCode=1;});
