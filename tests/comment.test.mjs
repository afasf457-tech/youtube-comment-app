import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{videoURL,config} from '../netlify/functions/comment.mjs';
const origin='https://helpful-torrone-49624d.netlify.app';
const owner={user:{email:'afasf457@gmail.com'}};
const req=(body={url:'https://youtu.be/7epLoxc32dY',style:0},headers={})=>new Request(origin+'/api/comment',{method:'POST',headers:{origin,'content-type':'application/json','x-comment-app':'1',...headers},body:JSON.stringify(body)});
test('canonicalizes YouTube links and rejects credentials, spoofed hosts and arbitrary URLs',()=>{
  assert.equal(videoURL('https://youtu.be/7epLoxc32dY?si=x'),'https://www.youtube.com/watch?v=7epLoxc32dY');
  for(const u of ['https://youtube.com.evil.test/watch?v=7epLoxc32dY','https://youtube.com@evil.test/watch?v=7epLoxc32dY','http://youtu.be/7epLoxc32dY','https://youtu.be/7epLoxc32dY/extra','https://localhost/'])assert.equal(videoURL(u),null);
});
test('untrusted requests cannot reach upstream even with forged email headers',async()=>{
  for(const ctx of [{},{user:{email:'other@example.com'}}])assert.equal((await handler(req({}, {'x-user-email':'afasf457@gmail.com'}),ctx)).status,403);
  assert.equal((await handler(req(undefined,{origin:'https://evil.test'}),owner)).status,403);
  assert.equal((await handler(req({url:'https://evil.test',style:0}),owner)).status,400);
  assert.equal((await handler(req({url:'https://youtu.be/7epLoxc32dY',style:'0'}),owner)).status,400);
  assert.equal((await handler(req({url:'x'.repeat(3000),style:0}),owner)).status,413);
});
test('missing secret fails closed; GET never returns the secret',async()=>{
  const previous=process.env.GEMINI_API_KEY;delete process.env.GEMINI_API_KEY;
  assert.equal((await handler(req(),owner)).status,503);
  process.env.GEMINI_API_KEY='test-secret-do-not-expose';
  const r=await handler(new Request(origin+'/api/comment'),owner);
  assert.deepEqual(await r.json(),{ready:true});
  if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;
});
test('upstream key stays in server request and provider errors are redacted',async()=>{
  const oldFetch=globalThis.fetch,previous=process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY='test-secret-do-not-expose';
  try{
    globalThis.fetch=async(url,options)=>{assert.match(url,/^https:\/\/generativelanguage.googleapis.com\//);assert.equal(options.headers['x-goog-api-key'],'test-secret-do-not-expose');assert.equal(JSON.parse(options.body).contents[0].parts[1].videoMetadata.endOffset,'300s');return Response.json({candidates:[{content:{parts:[{text:'장면 전환이 빨라서 나도 모르게 끝까지 봤네'}]}}]});};
    assert.equal((await (await handler(req(),owner)).json()).comment,'장면 전환이 빨라서 나도 모르게 끝까지 봤네');
    globalThis.fetch=async()=>Response.json({error:{message:'test-secret-do-not-expose'}},{status:400});
    assert.ok(!(await (await handler(req(),owner)).text()).includes('test-secret'));
    assert.equal(config.rateLimit.windowLimit,5);
  }finally{globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previous;}
});
