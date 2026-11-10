const $=id=>document.getElementById(id);
try { localStorage.removeItem('gemini_api_key'); } catch {}
let last='',busy=false;
const status=s=>$('status').textContent=s;
async function generate(){
  if(busy)return;
  const url=$('url').value.trim();
  if(!url)return status('유튜브 링크를 입력해 주세요.');
  busy=true; last=''; $('copy').disabled=true; $('go').disabled=true; $('again').disabled=true;
  status('영상 앞부분 최대 5분을 분석하고 있어요…'); $('result').textContent='분석 중…';
  try{
    const r=await fetch('/api/comment',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Comment-App':'1'},body:JSON.stringify({url,style:$('style').selectedIndex}),signal:AbortSignal.timeout(60000)});
    if(!r.headers.get('content-type')?.includes('application/json'))throw Error(r.status===429?'요청이 많습니다. 1분 뒤 다시 시도해 주세요.':r.status>=500?'서버 응답 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.':'로그인이 만료됐습니다. 페이지를 새로 열어 주세요.');
    const data=await r.json(); if(!r.ok)throw Error(data.error||'요청에 실패했습니다.');
    if(data.comment.includes('영상 분석 불가')){$('result').textContent='영상 분석 불가';status('영상에 접근하지 못했습니다. 다른 공개 영상을 시도해 주세요.');}
    else{last=data.comment;$('result').textContent=last;$('copy').disabled=false;status('댓글이 생성됐어요. 내용을 확인한 뒤 복사하세요.');}
  }catch(e){$('result').textContent='댓글을 생성하지 못했어요.';status(e.name==='TimeoutError'?'분석 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.':e.message);}
  finally{busy=false;$('go').disabled=false;$('again').disabled=false;}
}
$('go').addEventListener('click',generate);$('again').addEventListener('click',generate);
$('copy').addEventListener('click',async()=>{if(!last)return;try{await navigator.clipboard.writeText(last);status('댓글을 복사했어요.');}catch{status('댓글을 길게 눌러 복사해 주세요.');}});
fetch('/api/comment',{credentials:'same-origin'}).then(async r=>{if(!r.headers.get('content-type')?.includes('application/json'))return status('본인 Netlify 계정으로 로그인해 주세요.');const d=await r.json();status(!r.ok?d.error:d.ready?'준비됐어요. 영상 링크를 입력해 주세요.':'서버 API 키 설정이 필요합니다.');}).catch(()=>status('서버 연결을 확인해 주세요.'));
