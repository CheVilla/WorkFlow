let editPid=null, editTid=null, defStat='backlog';

// ── COLOR HELPERS ──
function h2r(h){const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return`rgb(${r}, ${g}, ${b})`;}
function r2h(rgb){const m=rgb.match(/\d+/g);if(!m||m.length<3)return'#888';return'#'+[m[0],m[1],m[2]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');}
function pickCol(c){document.querySelectorAll('.csw').forEach(s=>s.classList.toggle('sel',s.style.background===c||s.style.background===h2r(c)));}

// ── PROJECT MODAL ──
function openProjModal(id) {
  editPid=id||null;
  document.getElementById('pmtitle').textContent=id?'Edit project':'New project';
  const p=id?byId(id):null;
  document.getElementById('pname').value=p?p.title:'';
  document.getElementById('pdesc').value=p?p.description||'':'';
  document.getElementById('pdeadline').value=p?p.deadline||'':'';
  document.getElementById('pdelbtn').style.display=id?'inline-flex':'none';
  document.getElementById('parchbtn').style.display=id?'inline-flex':'none';
  if(p){
    document.getElementById('parchbtnlbl').textContent=p.archived?'Unarchive':'Archive';
    document.getElementById('parchbtn').className='btn '+(p.archived?'btng':'btna');
  }
  const sc=p?p.color:COLORS[0];
  document.getElementById('cpick').innerHTML=COLORS.map(c=>`<div class="csw ${c===sc?'sel':''}" style="background:${c}" onclick="pickCol('${c}')"></div>`).join('');
  document.getElementById('pmodal').classList.remove('hidden');
}

function closeProjModal() { document.getElementById('pmodal').classList.add('hidden'); editPid=null; }

async function saveProj() {
  const name=document.getElementById('pname').value.trim();
  if(!name){document.getElementById('pname').focus();return;}
  const sel=document.querySelector('.csw.sel');
  const col=sel?sel.style.background:COLORS[0];
  const colH=col.startsWith('#')?col:r2h(col);
  if(editPid){
    const p=byId(editPid);
    if(p){p.title=name;p.description=document.getElementById('pdesc').value.trim();p.deadline=document.getElementById('pdeadline').value;p.color=colH;}
    await upsertRow('projects',editPid,p);
  } else {
    const np={id:uid(),title:name,description:document.getElementById('pdesc').value.trim(),color:colH,deadline:document.getElementById('pdeadline').value,archived:false,createdAt:new Date().toISOString()};
    S.projects.push(np);
    await upsertRow('projects',np.id,np);
  }
  closeProjModal(); renderAll();
}

async function toggleArchive() {
  if(!editPid)return;
  const p=byId(editPid);if(!p)return;
  p.archived=!p.archived;
  await upsertRow('projects',p.id,p);
  closeProjModal(); renderAll();
  notify(p.archived?'Project archived':'Project restored',p.title,p.archived?'📦':'✅');
}

function confirmDelProj() {
  const idToDelete=editPid;
  showConfirm('Delete project?',`"${byId(idToDelete)?.title}" and all its tasks will be permanently deleted.`,async()=>{
    const tasksToDelete=S.tasks.filter(t=>t.projectId===idToDelete);
    for(const t of tasksToDelete) await deleteRow('tasks',t.id);
    S.tasks=S.tasks.filter(t=>t.projectId!==idToDelete);
    await deleteRow('projects',idToDelete);
    S.projects=S.projects.filter(p=>p.id!==idToDelete);
    if(S.activeProj===idToDelete) S.activeProj=null;
    closeProjModal(); renderAll();
  });
}

// ── TASK MODAL ──
function updateQuadrantPreview() {
  const u=document.getElementById('turgent').checked;
  const i=document.getElementById('timportant').checked;
  const q=getQuadrant({urgent:u,important:i});
  document.getElementById('quadrant-preview').innerHTML=`<span class="qbadge ${q.cls}">${q.emoji} ${q.label}</span>`;
}

function openTaskModal(id, status) {
  editTid=id||null; defStat=status||'todo';
  document.getElementById('tmtitle').textContent=id?'Edit task':'New task';
  const t=id?S.tasks.find(t=>t.id===id):null;
  document.getElementById('ttitle').value=t?t.title:'';
  document.getElementById('tdesc').value=t?t.description||'':'';
  document.getElementById('tdl').value=t?t.deadline||'':'';
  document.getElementById('tstat').value=t?t.status:defStat;
  document.getElementById('tpomo').value=t?t.estimatedPomodoros||1:1;
  document.getElementById('turgent').checked=t?!!t.urgent:false;
  document.getElementById('timportant').checked=t?!!t.important:true;
  updateQuadrantPreview();
  const ps=document.getElementById('tproj');
  ps.innerHTML=activeProjects().map(p=>`<option value="${p.id}" ${(t&&t.projectId===p.id)||(S.activeProj===p.id)?'selected':''}>${p.title}</option>`).join('');
  document.getElementById('tdelbtn').style.display=id?'inline-flex':'none';
  document.getElementById('tmodal').classList.remove('hidden');
}

function closeTaskModal() { document.getElementById('tmodal').classList.add('hidden'); editTid=null; }

async function saveTask() {
  const title=document.getElementById('ttitle').value.trim();
  if(!title){document.getElementById('ttitle').focus();return;}
  const pid=document.getElementById('tproj').value; if(!pid)return;
  const d={title,projectId:pid,description:document.getElementById('tdesc').value.trim(),
    status:document.getElementById('tstat').value,
    urgent:document.getElementById('turgent').checked,
    important:document.getElementById('timportant').checked,
    deadline:document.getElementById('tdl').value,
    estimatedPomodoros:parseInt(document.getElementById('tpomo').value)||1};
  if(editTid){
    const t=S.tasks.find(t=>t.id===editTid); if(t) Object.assign(t,d);
    await upsertRow('tasks',editTid,S.tasks.find(t=>t.id===editTid));
  } else {
    const nt={id:uid(),completedPomodoros:0,timeTracked:0,createdAt:new Date().toISOString(),...d};
    S.tasks.push(nt);
    await upsertRow('tasks',nt.id,nt);
  }
  closeTaskModal(); renderAll();
}

async function delTask() {
  if(!editTid)return;
  const idToDelete=editTid;
  showConfirm('Delete task?','This task will be permanently deleted.',async()=>{
    await deleteRow('tasks',idToDelete);
    S.tasks=S.tasks.filter(t=>t.id!==idToDelete);
    closeTaskModal(); renderAll();
  });
}
