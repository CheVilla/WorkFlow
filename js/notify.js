let notifStack = [];
let confirmCb = null;

function notify(title, body, icon) {
  const el=document.createElement('div');
  el.className='notif';
  el.innerHTML=`<div class="notif-icon">${icon||'🔔'}</div><div class="notif-body"><h4>${title}</h4><p>${body}</p></div>`;
  document.body.appendChild(el);
  notifStack.push(el);
  notifStack.forEach((n,i)=>{ n.style.top=(12+i*72)+'px'; });
  setTimeout(()=>{
    el.remove();
    notifStack=notifStack.filter(n=>n!==el);
    notifStack.forEach((n,i)=>{ n.style.top=(12+i*72)+'px'; });
  }, 4000);
}

function showConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  confirmCb=cb;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.add('hidden');
  confirmCb=null;
}

async function runConfirm() {
  const cb=confirmCb;
  closeConfirm();
  if(cb) await cb();
}
