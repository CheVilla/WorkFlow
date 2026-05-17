let pTimer=null, pRun=false, pMode='work', pSec=25*60, pTotal=25*60, pSessId=null;
let audioCtx=null;

function getACtx() {
  if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx=getACtx(), vol=(S.settings.volume||70)/100*0.5;
    const seqs={work:[[523,.1],[659,.1],[784,.14],[1047,.28]],break:[[784,.1],[659,.1],[523,.22]]};
    let t=ctx.currentTime+.05;
    (seqs[type]||seqs.work).forEach(([freq,dur])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);o.type='sine';
      o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(vol,t);
      g.gain.exponentialRampToValueAtTime(.001,t+dur);
      o.start(t);o.stop(t+dur);t+=dur+.04;
    });
  } catch(e) {}
}

function testSound() { playSound('work'); }

function updVol(v) {
  S.settings.volume=parseInt(v);
  document.getElementById('svollbl').textContent=v+'%';
  saveSettings();
}

function applyPS() {
  document.getElementById('swrk').value=S.settings.workMin;
  document.getElementById('sbrk').value=S.settings.breakMin;
  if(!pRun){pTotal=(pMode==='work'?S.settings.workMin:S.settings.breakMin)*60;pSec=pTotal;updPD();}
  document.getElementById('twrk').textContent=`Work (${S.settings.workMin}m)`;
  document.getElementById('tbrk').textContent=`Break (${S.settings.breakMin}m)`;
}

function setPMode(m) {
  if(pRun)return;
  pMode=m;
  document.getElementById('twrk').classList.toggle('active',m==='work');
  document.getElementById('tbrk').classList.toggle('active',m==='break');
  pTotal=(m==='work'?S.settings.workMin:S.settings.breakMin)*60;pSec=pTotal;updPD();
}

function toggleP() { pRun ? pauseP() : startP(); }

function startP() {
  if(pMode==='work'&&!pSessId){
    const sel=document.getElementById('ptask').value;
    pSessId=uid();
    S.sessions.push({id:pSessId,taskId:sel||null,
      projectId:sel?(S.tasks.find(t=>t.id===sel)?.projectId||null):null,
      startedAt:new Date().toISOString(),duration:S.settings.workMin,completed:false});
  }
  pRun=true;
  document.getElementById('picon').className='ri-pause-fill';
  document.getElementById('ptime').classList.toggle('run',pMode==='work');
  document.getElementById('ptime').classList.toggle('brk',pMode==='break');
  pTimer=setInterval(()=>{pSec--;updPD();if(pSec<=0){clearInterval(pTimer);pTimer=null;pRun=false;pomoComplete();}},1000);
}

function pauseP() {
  clearInterval(pTimer);pTimer=null;pRun=false;
  document.getElementById('picon').className='ri-play-fill';
  document.getElementById('ptime').classList.remove('run','brk');
}

function resetP() { pauseP();pSessId=null;pSec=pTotal;updPD(); }
function skipP()  { pauseP();pSec=0;pomoComplete(); }

function pomoComplete() {
  document.getElementById('picon').className='ri-play-fill';
  document.getElementById('ptime').classList.remove('run','brk');
  if(pMode==='work'){
    const sess=S.sessions.find(s=>s.id===pSessId);
    if(sess){
      sess.completed=true;
      if(sess.taskId){
        const t=S.tasks.find(t=>t.id===sess.taskId);
        if(t){t.completedPomodoros=(t.completedPomodoros||0)+1;t.timeTracked=(t.timeTracked||0)+S.settings.workMin;}
        saveTasks();
      }
      saveSessions();
    }
    pSessId=null;
    playSound('work');
    notify('Pomodoro complete!',`Time for a ${S.settings.breakMin}-min break 🎉`,'🍅');
    setPMode('break');renderPomo();
  } else {
    playSound('break');
    notify('Break over','Ready to focus? ⚡','☕');
    setPMode('work');
  }
}

function updPD() {
  const m=Math.floor(pSec/60),s=pSec%60;
  document.getElementById('ptime').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const pct=pTotal>0?(pSec/pTotal*100):100;
  document.getElementById('pbar').style.width=pct+'%';
  document.getElementById('pbar').style.background=pMode==='work'?'var(--pomo)':'var(--green)';
}

function renderPomo() {
  const sel=document.getElementById('ptask'),cur=sel.value;
  const at=S.tasks.filter(t=>t.status!=='done');
  sel.innerHTML='<option value="">— No task —</option>'+activeProjects().map(p=>{
    const ts=at.filter(t=>t.projectId===p.id);
    if(!ts.length)return'';
    return`<optgroup label="${p.title}">${ts.map(t=>`<option value="${t.id}" ${t.id===cur?'selected':''}>${t.title}</option>`).join('')}</optgroup>`;
  }).join('');
  const rec=[...S.sessions].filter(s=>s.completed).reverse().slice(0,5);
  document.getElementById('psess').innerHTML=!rec.length
    ?'<div class="es" style="padding:16px 0"><p>No sessions yet</p></div>'
    :rec.map(s=>{
      const t=s.taskId?S.tasks.find(t=>t.id===s.taskId):null;
      const p=s.projectId?byId(s.projectId):null;
      const d=s.startedAt?new Date(s.startedAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      return`<div class="sess-row"><i class="ri-timer-flash-line" style="color:var(--pomo)"></i><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t?t.title:'Free session'}</span>${p?`<span class="dot" style="background:${p.color}"></span>`:''}<span style="color:var(--text3);font-size:11px;flex-shrink:0;margin-left:4px">${s.duration}m · ${d}</span></div>`;
    }).join('');
  const td=S.sessions.filter(s=>s.completed&&s.startedAt&&s.startedAt.slice(0,10)===today()).length;
  document.getElementById('pdots').innerHTML=Array(Math.max(4,td+1)).fill(0).map((_,i)=>`<div class="pdot ${i<td?'on':''}"></div>`).join('');
  document.getElementById('pphase').textContent=pMode==='work'?'FOCUS TIME':'BREAK TIME';
}

function updPS() {
  S.settings.workMin=Math.max(1,Math.min(90,parseInt(document.getElementById('swrk').value)||25));
  S.settings.breakMin=Math.max(1,Math.min(30,parseInt(document.getElementById('sbrk').value)||5));
  saveSettings();
  if(!pRun){pTotal=(pMode==='work'?S.settings.workMin:S.settings.breakMin)*60;pSec=pTotal;updPD();}
  document.getElementById('twrk').textContent=`Work (${S.settings.workMin}m)`;
  document.getElementById('tbrk').textContent=`Break (${S.settings.breakMin}m)`;
}
