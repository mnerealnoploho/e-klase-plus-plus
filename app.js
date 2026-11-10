import {defaults,average,weighted,required,estimate,median,csv,calendar,validate,encrypt,decrypt,escape as e} from './core.mjs';

const main=document.querySelector('#main');
const dialog=document.querySelector('#dialog');
const tabs=[['home','◫','Overview'],['live','◎','E-klase'],['grades','▥','Grades'],['planner','▦','Planner'],['notes','▤','Notes'],['focus','◷','Focus'],['backup','⇅','Backups'],['settings','⚙','Customize']];
let state=defaults(),db,connected=false,configured=false,view='home',filter='',taskFilter='open',selectedDay='',catalog={},liveOperation='diary.get',liveData=null,liveError='',liveLoading=false;
let toastTimer,storageReady=false;
const dateText=(value,options={day:'numeric',month:'short'})=>new Date(value).toLocaleDateString('en-GB',options);
const today=()=>new Date().toLocaleDateString('en-CA');
const round=value=>Number.isFinite(value)?value.toLocaleString('en-GB',{maximumFractionDigits:2}):'—';
const id=()=>crypto.randomUUID();
const icon=(value)=>'<span class="nav-icon" aria-hidden="true">'+value+'</span>';
const button=(text,action,kind='secondary',extra='')=>'<button class="button '+kind+'" data-action="'+action+'" '+extra+'>'+text+'</button>';
const empty=(symbol,title,text,action='')=>'<div class="empty"><div class="empty-symbol">'+symbol+'</div><h3>'+title+'</h3><p>'+text+'</p>'+action+'</div>';
const heading=(label,title,description,action='')=>'<div class="page-heading"><div><div class="eyebrow">'+label+'</div><h1>'+title+'</h1><p>'+description+'</p></div>'+action+'</div>';

async function load() {
  db=await new Promise((resolve,reject)=>{const request=indexedDB.open('eklase-plus-plus',1);request.onupgradeneeded=()=>request.result.createObjectStore('workspace');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const saved=await new Promise((resolve,reject)=>{const request=db.transaction('workspace').objectStore('workspace').get('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  if(saved) state=validate(saved);
  storageReady=true;
}

async function save() {
  try {
    if(!storageReady)throw Error("Storage is unavailable. Existing data has not been overwritten.");
    validate(state);
    await new Promise((resolve,reject)=>{const transaction=db.transaction('workspace','readwrite');transaction.objectStore('workspace').put(state,'state');transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});
  } catch(error) { toast('Could not save changes. Export a backup now. '+error.message); throw error; }
}

function toast(message) {
  const element=document.querySelector('#toast');element.textContent=message;element.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.classList.remove('visible'),6000);
}

function appearance() {
  const settings=state.settings;
  const light=settings.theme==='light'||settings.theme==='system'&&matchMedia('(prefers-color-scheme:light)').matches;
  document.documentElement.classList.toggle('light',light);
  document.documentElement.style.setProperty('--accent',settings.accent);
  document.documentElement.style.setProperty('--font',settings.font+'px');
  document.body.classList.toggle('compact',settings.density==='compact');
  document.body.classList.toggle('no-motion',!settings.motion);
  document.body.classList.toggle('effects',settings.motion&&settings.effects);
  const background=document.querySelector('.background');
  background.style.backgroundImage=settings.background?'url("'+settings.background+'")':'none';
  background.style.opacity=settings.opacity;background.style.filter='blur('+settings.blur+'px)';
}

function navigation() {
  const html=tabs.map(([name,symbol,label])=>'<a href="#'+name+'" class="nav-item '+(view===name?'active':'')+'" data-tab="'+name+'" '+(view===name?'aria-current="page"':'')+'>'+icon(symbol)+'<span>'+label+'</span>'+(name==='planner'&&state.tasks.some(task=>!task.complete)?'<span class="badge">'+state.tasks.filter(task=>!task.complete).length+'</span>':'')+'</a>').join('');
  document.querySelector('#desktop-nav').innerHTML=html;document.querySelector('#mobile-nav').innerHTML=html;
  document.querySelector('#breadcrumb').innerHTML='Workspace <span>/</span> '+e(tabs.find(tab=>tab[0]===view)?.[2]||'Overview');
  const status=document.querySelector('#connection');status.className='connection '+(connected?'online':'');status.textContent=!navigator.onLine?'Offline workspace':connected?'E-klase connected':'E-klase not connected';
}

function stat(label,value,sub,symbol) { return '<div class="stat"><div class="stat-top"><span>'+label+'</span><span>'+symbol+'</span></div><div class="stat-value">'+value+'</div><small>'+sub+'</small></div>'; }

function taskRow(task) {
  const due=new Date(task.due),overdue=!task.complete&&due<Date.now();
  const steps=String(task.checklist||'').split('\n').filter(line=>line.trim()).map((line,index)=>'<div class="checklist-step"><button class="check '+(line.startsWith('[x] ')?'done':'')+'" data-action="toggle-step" data-id="'+e(task.id)+'" data-step="'+index+'" aria-label="Toggle checklist step">'+(line.startsWith('[x] ')?'✓':'')+'</button><span>'+e(line.replace(/^\[[x ]\] /,''))+'</span></div>').join('');
  return '<div class="row"><button class="check '+(task.complete?'done':'')+'" data-action="toggle-task" data-id="'+e(task.id)+'" aria-label="'+(task.complete?'Reopen':'Complete')+' '+e(task.title)+'">'+(task.complete?'✓':'')+'</button><div class="row-main"><h3 class="'+(task.complete?'done-title':'')+'">'+e(task.title)+'</h3><p>'+e(task.subject||'Personal')+' · '+e(dateText(due))+' '+e(due.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))+(overdue?' · overdue':'')+'</p><div class="checklist">'+steps+'</div></div><span class="priority '+e(task.priority)+'" title="'+e(task.priority)+' priority"></span><button class="icon-button" data-action="edit-task" data-id="'+e(task.id)+'" aria-label="Edit task">⋯</button></div>';
}

function home() {
  const pending=state.tasks.filter(task=>!task.complete).sort((a,b)=>new Date(a.due)-new Date(b.due));
  const numeric=state.grades.filter(grade=>grade.scale==='grade');
  const complete=state.tasks.filter(task=>task.complete).length;
  const averageGrade=weighted(numeric.map(grade=>[grade.value,grade.weight]));
  const hour=new Date().getHours(),greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  return heading('A LITTLE MORE CLARITY',greeting+'.','Your school day, all in one place.','<span class="date-chip">'+e(dateText(new Date(),{weekday:'short',day:'numeric',month:'long'}))+'</span>')+
  '<section class="hero"><div><span class="tag">YOUR SCHOOL DAY, UPGRADED</span><h2>Less keeping track.<br>More moving forward.</h2><p>Bring your plans, grades, and ideas together. Make room for what comes next.</p>'+button(connected?'Open your E-klase ↗':'Connect your E-klase ↗',connected?'go-live':'login','')+'</div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="spark"></div><div class="mini-card top"><span>✓</span><div>One thing at a time<small>A little progress, every day</small></div></div><div class="mini-card bottom"><b>↗</b><div>A clearer picture<small>Goals you can work towards</small></div></div></div></section>'+
  '<section class="stats">'+stat('Personal grade average',round(averageGrade),numeric.length+' numeric entries · weighted','↗')+stat('On your to-do list',pending.length,'Plans waiting for their next step','◷')+stat('Ideas & remarks',state.notes.length,'Your personal notes, saved here','▤')+stat('Completed plans',complete,'Small steps worth counting','✓')+'</section>'+
  '<div class="grid"><section class="card"><div class="card-heading"><h2>Coming up next</h2>'+button('+ Add plan','add-task','ghost small')+'</div>'+(pending.length?pending.slice(0,4).map(taskRow).join(''):empty('▦','A little space to plan','Add homework, a deadline, or a reminder for a day that matters.',button('Create your first plan','add-task','secondary small')))+'</section><section class="card"><div class="card-heading"><h2>Your grade picture</h2><a class="subtle" href="#grades">View all ↗</a></div>'+(numeric.length?distribution(numeric):empty('▥','Start with a clear picture','Connect E-klase to inspect your reports, or add your own grade entries for calculations.',button('Explore grades','go-grades','secondary small')))+'</section></div>'+
  '<div class="card"><div class="card-heading"><h2>A few useful shortcuts</h2><small>Make it yours</small></div><div class="links-grid"><a class="shortcut" href="#notes"><span>▤</span><strong>Notes for any day</strong><small>Remarks, ideas, and things to remember.</small></a><a class="shortcut" href="#focus"><span>◷</span><strong>A little focus time</strong><small>Give the next task your attention.</small></a><a class="shortcut" href="#backup"><span>⇅</span><strong>Keep a safe copy</strong><small>Password-encrypted backups for Files.</small></a></div></div>';
}

function distribution(grades) {
  const counts=Array.from({length:10},(_,index)=>grades.filter(grade=>Math.round(grade.value)===index+1).length),maximum=Math.max(1,...counts);
  return '<div class="bar-chart" aria-label="Personal grade distribution">'+counts.map((count,index)=>'<div class="bar-column" style="height:'+Math.max(2,count/maximum*105)+'px" title="Grade '+(index+1)+': '+count+' entries"><span>'+(count||'')+'</span><small>'+(index+1)+'</small></div>').join('')+'</div><p class="subtle">Median '+round(median(grades.map(grade=>grade.value)))+' · Best '+round(Math.max(...grades.map(grade=>grade.value)))+' · '+grades.length+' numeric entries</p>';
}

function grades() {
  const selected=state.grades.filter(grade=>(grade.subject+' '+grade.note).toLowerCase().includes(filter.toLowerCase()));
  const subjects=[...new Set(selected.filter(grade=>grade.scale==='grade').map(grade=>grade.subject))].sort();
  return heading('LOOK A LITTLE CLOSER','Your grades. Your next step.','Personal calculations stay separate from official E-klase results.',button('+ Add grade','add-grade',''))+
  '<div class="toolbar"><input class="search" id="grade-search" placeholder="Search a subject or remark" value="'+e(filter)+'" aria-label="Search grades">'+button('Export CSV','export-grades','secondary small')+button('Goal calculator','calculator','secondary small')+button('Chart estimate','estimate','secondary small')+'</div>'+
  '<div class="info"><strong>Personal grade ledger.</strong> Entries here are for your own analysis. They do not change official grades. E-klase reports are available in the E-klase tab and saved snapshots below.</div>'+
  '<div class="grid"><div><section class="card"><div class="card-heading"><h2>By subject</h2><small>Numeric grades only</small></div>'+(subjects.length?subjects.map(subject=>{const values=selected.filter(grade=>grade.subject===subject&&grade.scale==='grade');return '<div class="row"><div class="row-main"><h3>'+e(subject)+'</h3><p>'+values.length+' grades · weights included</p></div><div class="grade">'+round(weighted(values.map(grade=>[grade.value,grade.weight])))+'</div></div>';}).join(''):empty('↗','Make your progress visible','Add a grade to start calculating subject averages.'))+'</section><section class="card"><div class="card-heading"><h2>Recent personal entries</h2><small>'+selected.length+' total</small></div>'+(selected.length?[...selected].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(grade=>'<div class="row"><div class="grade">'+round(grade.value)+(grade.scale==='percent'?'%':'')+'</div><div class="row-main"><h3>'+e(grade.subject)+'</h3><p>'+e(dateText(grade.date))+' · weight '+grade.weight+(grade.note?' · '+e(grade.note):'')+'</p></div><button class="icon-button" data-action="edit-grade" data-id="'+e(grade.id)+'" aria-label="Edit grade">⋯</button></div>').join(''):empty('▥','No entries yet','Official and personal records are kept distinct.'))+'</section></div><div><section class="card"><div class="card-heading"><h2>Grade distribution</h2></div>'+(selected.some(grade=>grade.scale==='grade')?distribution(selected.filter(grade=>grade.scale==='grade')):empty('▥','See the bigger picture','Your numeric grade distribution will appear here.'))+'</section><section class="card"><div class="card-heading"><h2>Target grades</h2>'+button('+ Goal','add-goal','ghost small')+'</div>'+(state.goals.length?state.goals.map(goal=>{const values=state.grades.filter(grade=>grade.subject===goal.subject&&grade.scale==='grade');const current=weighted(values.map(grade=>[grade.value,grade.weight]));return '<div class="row"><div class="row-main"><h3>'+e(goal.subject)+'</h3><p>Target '+round(goal.target)+' · current '+round(current)+'</p><div class="progress-track"><div class="progress-fill" style="width:'+Math.min(100,(current||0)/goal.target*100)+'%"></div></div></div><button class="icon-button" data-action="delete-goal" data-id="'+e(goal.id)+'" aria-label="Remove goal">×</button></div>';}).join(''):empty('◎','Give yourself a direction','Set a realistic target for a subject.'))+'</section></div></div>'+
  '<section class="card"><div class="card-heading"><h2>Saved E-klase snapshots</h2><small>Time-stamped account responses</small></div>'+(state.reports.length?state.reports.slice(0,30).map(report=>'<div class="row"><div class="row-main"><h3>'+e(operationLabel(report.operation))+'</h3><p>'+e(new Date(report.captured).toLocaleString('en-GB'))+' · '+e(report.label||'Saved report')+'</p></div>'+button('Open','open-report','secondary small','data-id="'+e(report.id)+'"')+'</div>').join(''):empty('⇩','Keep useful reports close','In the E-klase tab, load a report and save a snapshot for offline reference.'))+'</section>';
}

function planner() {
  const now=new Date(),start=new Date(now);start.setDate(now.getDate()-((now.getDay()+6)%7));
  const days=Array.from({length:7},(_,index)=>{const day=new Date(start);day.setDate(start.getDate()+index);return day;});
  const tasks=state.tasks.filter(task=>(taskFilter==='all'||taskFilter==='done'&&task.complete||taskFilter==='open'&&!task.complete)&&(!selectedDay||task.due.slice(0,10)===selectedDay)&&(task.title+' '+task.subject+' '+task.note).toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>new Date(a.due)-new Date(b.due));
  return heading('ONE DAY AT A TIME','A little plan goes a long way.','Homework, personal reminders, and space for everything else.',button('+ New plan','add-task',''))+
  '<div class="calendar-week">'+days.map(day=>{const key=day.toLocaleDateString('en-CA'),count=state.tasks.filter(task=>task.due.slice(0,10)===key&&!task.complete).length;return '<button class="day-button '+(selectedDay===key?'active':'')+'" data-action="select-day" data-day="'+key+'">'+day.toLocaleDateString('en-GB',{weekday:'short'})+'<b>'+day.getDate()+'</b>'+(count?'<span class="dot"></span>':'<span style="display:block;height:9px"></span>')+'</button>';}).join('')+'</div>'+
  '<div class="toolbar"><div class="tabs">'+['open','all','done'].map(value=>'<button data-action="task-filter" data-filter="'+value+'" class="'+(taskFilter===value?'active':'')+'">'+({open:'Upcoming',all:'All plans',done:'Completed'}[value])+'</button>').join('')+'</div><input id="task-search" class="search" aria-label="Search plans" placeholder="Search your plans" value="'+e(filter)+'">'+button('All dates','all-days','secondary small')+'<a class="button secondary small" href="#notes">Day remarks ↗</a></div>'+
  '<section class="card">'+(tasks.length?tasks.map(taskRow).join(''):empty('▦','A clear space for your next step','Add a plan with a day, priority, checklist, and optional Calendar reminder.',button('Add a plan','add-task','secondary small')))+'</section><div class="info"><strong>Reliable reminders on iPhone.</strong> Export a plan to Apple Calendar to receive its alert while the web app is closed. This app does not promise background timers or automatic push reminders. Your custom plans do not alter school records.</div>';
}

function notes() {
  const notes=state.notes.filter(note=>(note.title+' '+note.text+' '+note.subject).toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.updated)-new Date(a.updated));
  return heading('KEEP THE SMALL THINGS','A place for your thoughts.','Custom remarks for a lesson, a subject, or a day.',button('+ Write a note','add-note',''))+
  '<div class="toolbar"><input id="note-search" class="search" placeholder="Find a note, subject, or tag" aria-label="Search notes" value="'+e(filter)+'">'+button('Export notes','export-notes','secondary small')+'</div>'+
  (notes.length?'<div class="note-grid">'+notes.map(note=>'<article class="card"><div class="card-heading"><span class="pill '+(note.pinned?'accent':'')+'">'+(note.pinned?'Pinned · ':'')+e(note.subject||'Personal')+'</span><button class="icon-button" data-action="edit-note" data-id="'+e(note.id)+'" aria-label="Edit note">⋯</button></div><h3>'+e(note.title)+'</h3><div class="note">'+e(note.text)+'</div><div class="note-footer"><small>'+e(dateText(note.day))+'</small>'+button('Make a plan','note-to-task','ghost small','data-id="'+e(note.id)+'"')+'</div></article>').join('')+'</div>':'<section class="card">'+empty('▤','A thought worth keeping?','Save lesson remarks, revision notes, questions for a teacher, or a reminder to yourself.',button('Write your first note','add-note','secondary small'))+'</section>');
}

function focus() {
  return heading('MAKE A LITTLE SPACE','Just the next 25 minutes.','Choose one thing. Give it your attention. Everything else can wait.')+
  '<div class="grid"><section class="card"><div class="card-heading"><h2>Focus session</h2><span class="pill accent" id="focus-label">'+(state.focus?'In progress':'Ready when you are')+'</span></div><label class="field"><span>Session length</span><select id="focus-length"><option value="25">25 minutes · Focus</option><option value="45">45 minutes · Deep work</option><option value="5">5 minutes · Short break</option><option value="15">15 minutes · Long break</option></select></label><div class="focus-clock" id="focus-clock">25:00</div><div class="focus-controls">'+button(state.focus?'Restart':'Start session','start-focus','')+button('Finish','stop-focus','secondary')+'</div><p class="subtle" style="text-align:center;margin-top:22px">Time is recalculated when you return. iOS may suspend this page while it is closed.</p></section><section class="card"><div class="card-heading"><h2>What could you work on?</h2></div>'+(state.tasks.some(task=>!task.complete)?state.tasks.filter(task=>!task.complete).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,5).map(taskRow).join(''):empty('✓','One small thing is enough','Add a plan, then choose a manageable step for this session.'))+'</section></div>';
}

function backup() {
  return heading('KEEP A SAFE COPY','Your progress comes with you.','Password-encrypted backups you control.')+
  '<div class="grid"><section class="card"><div class="card-heading"><h2>Save an encrypted backup</h2><span class="pill accent">AES-256-GCM</span></div><p class="subtle">Includes personal grades, snapshots, tasks, notes, goals, appearance, and your background image. E-klase passwords and sessions are excluded.</p><div style="margin:22px 0">'+button('Create encrypted backup ↓','export-backup','')+'</div><div class="info"><strong>For iCloud:</strong> choose Save to Files, then iCloud Drive. The app cannot silently write to iCloud. Keep the password somewhere safe; there is no password recovery.</div><p class="subtle">Last export: '+(state.lastBackup?e(new Date(state.lastBackup).toLocaleString('en-GB')):'No backup exported yet')+'</p></section><section class="card"><div class="card-heading"><h2>Restore your workspace</h2></div><p class="subtle">Choose a backup from Files or iCloud Drive and enter its password. A successful restore replaces this device’s workspace after you confirm it.</p><div style="margin:22px 0">'+button('Choose an encrypted backup','import-backup','secondary')+'</div><div class="info warn">Before deleting this Home Screen app or clearing website data, save a backup and check that the file appears in iCloud Drive.</div></section></div><section class="card"><div class="card-heading"><h2>What is protected?</h2></div><div class="links-grid"><div class="shortcut"><span>⌁</span><strong>Encrypted before export</strong><small>The backup is encrypted on this device using a password-derived key.</small></div><div class="shortcut"><span>⇄</span><strong>Portable by design</strong><small>Restore on another device from the same backup file and password.</small></div><div class="shortcut"><span>◎</span><strong>Sessions stay separate</strong><small>Sign into E-klase again after restoring. No credentials in backup files.</small></div></div></section>';
}

function settings() {
  const prefs=state.settings;
  return heading('A WORKSPACE THAT FEELS LIKE YOU','Make a little change.','Choose your colors, your pace, and your view.')+
  '<div class="grid"><section class="card"><div class="card-heading"><h2>Look & feel</h2></div><label class="field"><span>Appearance</span><select data-setting="theme">'+['dark','light','system'].map(value=>'<option '+(prefs.theme===value?'selected':'')+' value="'+value+'">'+value[0].toUpperCase()+value.slice(1)+'</option>').join('')+'</select></label><div class="field"><span>Accent color</span><div class="theme-picks">'+['#ff775e','#9c93f5','#6db7ec','#75b99a','#e48cab','#deb36a'].map(color=>'<button class="color-pick '+(prefs.accent===color?'selected':'')+'" style="background:'+color+'" data-action="accent" data-color="'+color+'" aria-label="Choose accent '+color+'"></button>').join('')+'</div></div><label class="field"><span>Custom accent</span><input type="color" value="'+prefs.accent+'" data-setting="accent"></label><label class="field"><span>Text size · '+prefs.font+' px</span><input type="range" min="12" max="24" step="1" value="'+prefs.font+'" data-setting="font"></label><label class="field"><span>Density</span><select data-setting="density"><option value="comfortable" '+(prefs.density==='comfortable'?'selected':'')+'>Comfortable</option><option value="compact" '+(prefs.density==='compact'?'selected':'')+'>Compact</option></select></label></section><div><section class="card"><div class="card-heading"><h2>Your own backdrop</h2></div><p class="subtle">Choose a PNG, JPEG, or WebP image. It stays in your workspace and encrypted backups.</p><div class="toolbar" style="margin-top:18px">'+button('Choose image','background','secondary small')+button('Remove','remove-background','ghost small')+'</div><label class="field"><span>Image opacity · '+Math.round(prefs.opacity*100)+'%</span><input type="range" min="0" max="0.6" step="0.02" value="'+prefs.opacity+'" data-setting="opacity"></label><label class="field"><span>Background blur · '+prefs.blur+' px</span><input type="range" min="0" max="30" step="1" value="'+prefs.blur+'" data-setting="blur"></label></section><section class="card"><div class="card-heading"><h2>Motion & effects</h2></div><label class="toggle-row"><div><h3>Gentle animations</h3><p>Page transitions and soft movements.</p></div><input type="checkbox" data-setting="motion" '+(prefs.motion?'checked':'')+'></label><label class="toggle-row"><div><h3>Ambient effects</h3><p>A little movement in the overview.</p></div><input type="checkbox" data-setting="effects" '+(prefs.effects?'checked':'')+'></label><p class="subtle" style="margin-top:15px">Your iPhone’s Reduce Motion preference always takes priority.</p></section></div></div>'+
  '<section class="card"><div class="card-heading"><h2>Account & installation</h2></div><div class="toolbar">'+button(connected?'Disconnect E-klase':'Connect E-klase',connected?'logout':'login','secondary')+'<a class="button secondary" href="#backup">Backups</a>'+button('Add to Home Screen','install','secondary')+'<a class="button secondary" href="https://family.e-klase.lv/" target="_blank" rel="noopener noreferrer">Official E-klase ↗</a></div><p class="subtle">E-klase++ is an independent companion. A hosted connection is needed for live account data; offline notes, plans, and calculations run on your iPhone. It does not turn Safari into an always-running server.</p></section>';
}

function operationLabel(name) {
  return ({'diary.get':'Diary & timetable','homework.list':'Homework','diary.testSchedules':'Upcoming tests','diary.lessonTimes':'Lesson times','evaluations.summary':'Grade overview','reports.journals':'Subject journals','reports.journal':'Subject report','evaluations.ratings':'Class rankings','evaluations.testReport':'Assessment breakdown','attendance.statistics':'Attendance statistics','mail.folders':'Message folders','profiles.currentUser':'Account profile','diary.studyYearPeriods':'Study periods','home.news':'School news','home.teacherMessages':'Teacher remarks','surveys.list':'Surveys','meetings.list':'Video meetings','links.list':'School links','profiles.byYear':'Available profiles'})[name]||name.replaceAll('.',' · ');
}

function tree(value,depth=0) {
  if(depth>7) return '<p class="subtle">Nested data is available in the JSON export.</p>';
  if(value===null||value===undefined) return '<span class="subtle">—</span>';
  if(typeof value!=='object') return '<span class="value">'+e(String(value).slice(0,12000))+'</span>';
  const entries=Array.isArray(value)?value.map((item,index)=>[String(index+1),item]):Object.entries(value);
  if(!entries.length) return '<span class="subtle">No entries returned.</span>';
  return '<div class="data-tree">'+entries.slice(0,200).map(([key,item])=>typeof item==='object'&&item!==null?'<details '+(depth===0&&entries.length<3?'open':'')+'><summary>'+e((item.name||item.title||item.journalName||item.classJournalName||key))+(Array.isArray(item)?' <span class="pill">'+item.length+'</span>':'')+'</summary><div class="children">'+tree(item,depth+1)+'</div></details>':'<div class="pair"><span class="key">'+e(key)+'</span>'+tree(item,depth+1)+'</div>').join('')+(entries.length>200?'<p class="subtle">Showing 200 entries. Download JSON for the full report.</p>':'')+'</div>';
}

function live() {
  const operation=catalog[liveOperation],operations=Object.keys(catalog).filter(name=>name!=='auth.config');
  const fields=operation?[...operation.path.matchAll(/\{([^}]+)\}/g)].map(match=>'<label class="field"><span>'+e(match[1])+'</span><input name="param:'+e(match[1])+'" required placeholder="ID returned by E-klase"></label>').join('')+operation.query.map(key=>'<label class="field"><span>'+e(key)+'</span><input name="query:'+e(key)+'" '+(/from|to/.test(key)?'type="date"':'placeholder="Optional filter"')+'></label>').join(''):'';
  return heading('YOUR ACCOUNT, CONNECTED','E-klase, a little closer.','Load live account reports when a compatible sign-in succeeds.',button(connected?'Account connected':'Connect account','login',connected?'secondary':''))+
  (!connected?'<div class="info warn"><strong>Live connection is not verified yet.</strong> The current E-klase sign-in differs from the older public client. This app will report an unsupported flow instead of pretending to connect. Your existing Cloud Browser login is separate.</div>':'<div class="info"><strong>Connected.</strong> Account data is fetched only when you request it. Saved snapshots include a timestamp; your E-klase access permissions still apply.</div>')+
  '<div class="grid"><section class="card"><div class="card-heading"><h2>Choose a report</h2><span class="pill">Read only</span></div><form id="live-form"><label class="field"><span>Account section</span><select id="operation">'+operations.map(name=>'<option value="'+e(name)+'" '+(name===liveOperation?'selected':'')+'>'+e(operationLabel(name))+'</option>').join('')+'</select></label><div class="two">'+fields+'</div><button class="button" '+(!connected||liveLoading?'disabled':'')+' type="submit">'+(liveLoading?'Loading…':'Load live report ↗')+'</button></form><p class="subtle" style="margin-top:17px">Use IDs and dates returned by your own account. This view does not modify school records or infer account permissions.</p></section><section class="card"><div class="card-heading"><h2>Prefer the original?</h2></div><p class="subtle">The official E-klase site remains the reliable place for account changes, messaging, forms, and unsupported features.</p><div class="toolbar" style="margin-top:20px"><a class="button secondary" href="https://family.e-klase.lv/" target="_blank" rel="noopener noreferrer">Open official E-klase ↗</a></div><div class="links-grid"><a class="shortcut" href="#notes"><span>▤</span><strong>Personal remarks</strong><small>Notes that are just for you.</small></a><a class="shortcut" href="#planner"><span>▦</span><strong>Plan a day</strong><small>Your own tasks and reminders.</small></a></div></section></div>'+
  (liveError?'<div class="info warn" role="alert">'+e(liveError)+'</div>':'')+
  (liveData?'<section class="card"><div class="card-heading"><div><h2>'+e(operationLabel(liveData.operation))+'</h2><small>Loaded '+e(new Date(liveData.captured).toLocaleString('en-GB'))+'</small></div><div class="toolbar">'+button('Save snapshot','save-live','secondary small')+button('Download JSON','export-live','secondary small')+'</div></div>'+renderDiary(liveData)+tree(liveData.data)+'</section>':'');
}

function renderDiary(report) {
  if(report.operation!=='diary.get'||!Array.isArray(report.data)) return '';
  return report.data.map(day=>'<div class="date-line">'+e(dateText(day.date,{weekday:'long',day:'numeric',month:'long'}))+'</div>'+(Array.isArray(day.lessons)?day.lessons:[]).map(lesson=>'<div class="row"><div class="grade">'+e(lesson.lessonNumber)+'</div><div class="row-main"><h3>'+e(lesson.classJournalName)+'</h3><p>'+e(lesson.roomNumber||'')+'</p>'+((lesson.homeTasks||[]).map(task=>'<p>'+e(task.task?.text||'')+'</p>').join(''))+'</div></div>').join('')).join('');
}

function render() {
  appearance();navigation();
  const pages={home,live,grades,planner,notes,focus,backup,settings};
  main.innerHTML='<div class="'+(state.settings.motion?'fade':'')+'">'+(pages[view]||home)()+'</div>';
  if(view==='focus') tick();
  document.querySelector('#live-form')?.addEventListener('submit',loadLive);
  for(const [selector,key] of [['#grade-search','grades'],['#task-search','planner'],['#note-search','notes']]) {
    const input=document.querySelector(selector);input?.addEventListener('input',()=>{const position=input.selectionStart;filter=input.value;render();const replacement=document.querySelector(selector);replacement?.focus();replacement?.setSelectionRange(position,position);});
  }
}

function modal(title,content,handler,submit='Save') {
  document.querySelector('#dialog-content').innerHTML='<div class="dialog-heading"><h2>'+e(title)+'</h2><button class="icon-button" data-action="close" aria-label="Close dialog">×</button></div><form id="modal-form">'+content+'<div class="dialog-actions">'+button('Cancel','close','ghost')+'<button class="button" type="submit">'+submit+'</button></div></form>';
  dialog.showModal();
  document.querySelector('#modal-form').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,submitButton=form.querySelector('button[type=submit]');submitButton.disabled=true;try{await handler(new FormData(form));dialog.close();render();}catch(error){toast(error.message);}finally{submitButton.disabled=false;}});
}

const field=(name,label,value='',type='text',extra='')=>'<label class="field"><span>'+label+'</span><input name="'+name+'" type="'+type+'" value="'+e(value)+'" '+extra+'></label>';

function editTask(task={}) {
  const current={id:id(),title:'',subject:'',note:'',due:new Date(Date.now()+3600000).toISOString(),priority:'normal',complete:false,reminder:true,repeat:'none',checklist:'',...task};
  const date=new Date(current.due),local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
  modal(task.id?'Edit your plan':'Make a little plan',field('title','What would you like to do?',current.title,'text','required maxlength="200"')+field('subject','Subject or tag',current.subject,'text','maxlength="100"')+'<div class="two">'+field('due','Day & time',local,'datetime-local','required')+'<label class="field"><span>Priority</span><select name="priority">'+['low','normal','high'].map(value=>'<option '+(value===current.priority?'selected':'')+'>'+value+'</option>').join('')+'</select></label></div><label class="field"><span>Your remark</span><textarea name="note" maxlength="10000">'+e(current.note)+'</textarea></label><label class="field"><span>Checklist · one step per line</span><textarea name="checklist" maxlength="10000">'+e(current.checklist)+'</textarea></label><div class="two"><label class="field"><span>Calendar repetition</span><select name="repeat">'+['none','daily','weekly'].map(value=>'<option '+(value===current.repeat?'selected':'')+'>'+value+'</option>').join('')+'</select></label><label class="toggle-row"><span>15-minute Calendar alert</span><input type="checkbox" name="reminder" '+(current.reminder?'checked':'')+'></label></div><p class="subtle">Use Export to Calendar after saving to enable alerts on iPhone.</p>'+(task.id?'<div class="toolbar">'+button('Export to Calendar','calendar-task','secondary small','data-id="'+e(task.id)+'"')+button('Delete plan','delete-task','danger small','data-id="'+e(task.id)+'"')+'</div>':''),async form=>{
    const item={...current,title:form.get('title').trim(),subject:form.get('subject').trim(),note:form.get('note'),due:new Date(form.get('due')).toISOString(),priority:form.get('priority'),repeat:form.get('repeat'),reminder:form.has('reminder'),checklist:form.get('checklist')};
    if(!item.title)throw Error('Give your plan a title.');
    const index=state.tasks.findIndex(value=>value.id===current.id);if(index<0)state.tasks.push(item);else state.tasks[index]=item;await save();toast('Plan saved. Export it to Calendar for alerts.');
  });
}

function editNote(note={}) {
  const current={id:id(),title:'',text:'',subject:'',day:today(),pinned:false,updated:new Date().toISOString(),...note};
  modal(note.id?'Edit your remark':'A thought worth keeping',field('title','Title',current.title,'text','required maxlength="200"')+'<div class="two">'+field('subject','Subject or tag',current.subject,'text','maxlength="100"')+field('day','For this day',current.day,'date','required')+'</div><label class="field"><span>Your note</span><textarea name="text" maxlength="30000" rows="7">'+e(current.text)+'</textarea></label><label class="toggle-row"><span>Keep this note pinned</span><input name="pinned" type="checkbox" '+(current.pinned?'checked':'')+'></label>'+(note.id?button('Delete note','delete-note','danger small','data-id="'+e(note.id)+'"'):''),async form=>{
    const item={...current,title:form.get('title').trim(),text:form.get('text'),subject:form.get('subject').trim(),day:form.get('day'),pinned:form.has('pinned'),updated:new Date().toISOString()};if(!item.title)throw Error('Give your note a title.');const index=state.notes.findIndex(value=>value.id===current.id);if(index<0)state.notes.push(item);else state.notes[index]=item;await save();toast('Note saved.');
  });
}

function editGrade(grade={}) {
  const current={id:id(),subject:'',value:8,weight:1,scale:'grade',date:today(),note:'',...grade};
  modal(grade.id?'Edit personal grade':'Add a personal grade',field('subject','Subject',current.subject,'text','required maxlength="100"')+'<div class="two">'+field('value','Value',current.value,'number','required min="0" max="100" step="0.01"')+'<label class="field"><span>Scale</span><select name="scale"><option value="grade" '+(current.scale==='grade'?'selected':'')+'>1–10 grade</option><option value="percent" '+(current.scale==='percent'?'selected':'')+'>0–100 percentage</option></select></label>'+field('weight','Weight',current.weight,'number','required min="0.01" max="100" step="0.01"')+field('date','Date',current.date,'date','required')+'</div>'+field('note','Your remark',current.note,'text','maxlength="1000"')+'<p class="subtle">This entry is personal. It will not change an official E-klase grade.</p>'+(grade.id?button('Delete entry','delete-grade','danger small','data-id="'+e(grade.id)+'"'):''),async form=>{
    const item={...current,subject:form.get('subject').trim(),value:Number(form.get('value')),weight:Number(form.get('weight')),scale:form.get('scale'),date:form.get('date'),note:form.get('note')};
    if(!item.subject||item.value<(item.scale==='grade'?1:0)||item.value>(item.scale==='grade'?10:100))throw Error('Enter a subject and a value within the selected scale.');
    const index=state.grades.findIndex(value=>value.id===current.id);if(index<0)state.grades.push(item);else state.grades[index]=item;await save();toast('Personal grade saved.');
  });
}

function calculator() {
  modal('What grade would I need?','<p class="subtle" style="margin-bottom:18px">A planning estimate using equal-weight future grades. Official rounding and subject rules may differ.</p><div class="two">'+field('current','Current average',8,'number','required min="1" max="10" step="0.01"')+field('count','Current grade count / total weight',4,'number','required min="0.01" step="0.01"')+field('target','Target average',8.5,'number','required min="1" max="10" step="0.01"')+field('remaining','Future grades / total future weight',2,'number','required min="0.01" step="0.01"')+'</div><div id="calculation-result"></div>',async form=>{const result=required(...['current','count','target','remaining'].map(name=>Number(form.get(name))));if(result===null)throw Error('Check the values.');toast(result>10?'You would need '+round(result)+', above the 10-point maximum. Increase the number of future grades or lower the target.':result<=1?'Your target is already secured under these assumptions.':'You would need an average of '+round(result)+' in the future grades.');},'Calculate');
}

function chartEstimate() {
  modal('Estimate from a chart','<div class="info warn">An estimate is not an official grade. Use two visible labeled values from the same chart and measure the same dimension for all bars. A changing baseline or nonlinear scale makes the result unreliable.</div><div class="two">'+field('first','First visible value',6,'number','required step="any"')+field('firstSize','First bar size (px)',120,'number','required min="0" step="any"')+field('second','Second visible value',9,'number','required step="any"')+field('secondSize','Second bar size (px)',180,'number','required min="0" step="any"')+field('size','Unlabeled bar size (px)',156,'number','required min="0" step="any"')+field('error','Measurement uncertainty (px)',1,'number','required min="0" step="any"')+'</div>',async form=>{const result=estimate(...['first','firstSize','second','secondSize','size','error'].map(name=>Number(form.get(name))));if(!result)throw Error('The two calibration bar sizes must differ.');toast('Estimated value: '+round(result.value)+' ± '+round(result.uncertainty)+'. Rendering uncertainty only; scale assumptions may add error.');},'Estimate');
}

function loginForm() {
  modal('Connect your E-klase','<div class="info warn"><strong>Experimental connection.</strong> This private backend uses the public web login flow. The current flow may need interactive sign-in that is not yet supported. Credentials are not stored or logged.</div>'+field('username','E-klase username','','text','required autocomplete="username" maxlength="200"')+field('password','E-klase password','','password','required autocomplete="current-password" maxlength="1024"')+'<p class="subtle">The app server processes your login and sends it only to auth.e-klase.lv if it recognizes a valid POST form. If unsupported, it stops. Your existing E-klase browser session is not imported.</p>',async form=>{const result=await api('/api/login',{username:form.get('username'),password:form.get('password')});connected=result.connected;toast('E-klase connected.');},'Connect account');
}

async function api(path,body) {
  const result=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});
  const type=result.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw Error('Sign in to the private app in Safari, then try again.');
  const value=await result.json();if(!result.ok) {if(result.status===401)connected=false;throw Error(value.error||'The connection could not be completed.');}return value;
}

async function loadLive(event) {
  event.preventDefault();const form=new FormData(event.currentTarget),query={},params={};for(const [key,value]of form)if(value){if(key.startsWith('query:'))query[key.slice(6)]=value;if(key.startsWith('param:'))params[key.slice(6)]=value;}
  liveLoading=true;liveError='';render();try{liveData=await api('/api/read',{operation:liveOperation,query,params});}catch(error){liveError=error.message;toast(error.message);}finally{liveLoading=false;render();}
}

function download(data,name,type='application/octet-stream') {
  const blob=new Blob([data],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}

function chooseFile(accept,handler) {
  const input=document.createElement('input');input.type='file';input.accept=accept;input.addEventListener('change',async()=>{if(!input.files?.[0])return;try{await handler(input.files[0]);}catch(error){toast(error.message);}});input.click();
}

function exportBackup() {
  modal('Protect your backup',field('password','Backup password · at least 12 characters','','password','required minlength="12" maxlength="1024" autocomplete="new-password"')+field('confirm','Repeat the password','','password','required minlength="12" maxlength="1024" autocomplete="new-password"')+'<p class="subtle">You will need this exact password to restore. Save the downloaded file to iCloud Drive using Files. There is no password recovery.</p>',async form=>{if(form.get('password')!==form.get('confirm'))throw Error('The passwords do not match.');const time=new Date().toISOString();const backup=await encrypt({...state,lastBackup:time},form.get('password'));download(backup,'e-klase-backup-'+today()+'.ekbackup');state.lastBackup=time;await save();toast('Encrypted file exported. Choose iCloud Drive when saving to Files.');},'Encrypt & export');
}

function importBackup() {
  chooseFile('.ekbackup,application/json',async file=>{if(file.size>45000000)throw Error('Backup exceeds 45 MB.');const text=await file.text();modal('Restore your workspace',field('password','Backup password','','password','required minlength="12" maxlength="1024" autocomplete="off"')+'<label class="toggle-row"><span>I understand this replaces the workspace on this device.</span><input type="checkbox" name="confirm" required></label>',async form=>{const restored=await decrypt(text,form.get('password'));state=restored;storageReady=!!db;await save();appearance();toast('Workspace restored. Connect E-klase separately when needed.');},'Decrypt & restore');});
}

async function background() {
  chooseFile('image/png,image/jpeg,image/webp',async file=>{if(file.size>5000000)throw Error('Choose an image smaller than 5 MB.');if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Use PNG, JPEG, or WebP.');const value=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});state.settings.background=value;await save();render();toast('Your background is saved.');});
}

function tick() {
  if(view!=='focus')return;
  const element=document.querySelector('#focus-clock');if(!element)return;
  const seconds=state.focus?Math.max(0,Math.ceil((state.focus.end-Date.now())/1000)):Number(document.querySelector('#focus-length')?.value||25)*60;
  element.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  if(state.focus&&seconds===0){state.focus=null;save().catch(()=>{});toast('A little progress. Your focus session is complete.');document.querySelector('#focus-label').textContent='Session complete';}
}

async function action(name,element) {
  const key=element?.dataset.id;
  if(name==='close'){dialog.close();return;}
  if(name?.startsWith('go-')){location.hash=name.slice(3);return;}
  if(name==='login'){loginForm();return;}
  if(name==='add-task'){editTask();return;}
  if(name==='edit-task'){editTask(state.tasks.find(task=>task.id===key));return;}
  if(name==='toggle-step'){const task=state.tasks.find(item=>item.id===key),lines=String(task.checklist||'').split('\n').filter(line=>line.trim()),index=Number(element.dataset.step);if(lines[index]!==undefined)lines[index]=lines[index].startsWith('[x] ')?lines[index].slice(4):'[x] '+lines[index].replace(/^\[ \] /,'');task.checklist=lines.join('\n');await save();render();return;}
  if(name==='toggle-task'){const task=state.tasks.find(task=>task.id===key);task.complete=!task.complete;await save();render();return;}
  if(name==='calendar-task'){const task=state.tasks.find(task=>task.id===key);download(calendar(task),task.title.replace(/[^\w\s-]/g,'').slice(0,60)+'.ics','text/calendar');toast('Open the .ics file in Calendar to add the reminder.');return;}
  if(name==='delete-task'||name==='delete-note'||name==='delete-grade'||name==='delete-goal'){
    if(!confirm('Remove this personal record from this device?'))return;
    const table={'delete-task':'tasks','delete-note':'notes','delete-grade':'grades','delete-goal':'goals'}[name];state[table]=state[table].filter(item=>item.id!==key);await save();if(dialog.open)dialog.close();render();return;
  }
  if(name==='add-note'){editNote();return;}
  if(name==='edit-note'){editNote(state.notes.find(note=>note.id===key));return;}
  if(name==='note-to-task'){const note=state.notes.find(note=>note.id===key);editTask({title:note.title,subject:note.subject,note:note.text,due:note.day+'T17:00'});return;}
  if(name==='add-grade'){editGrade();return;}
  if(name==='edit-grade'){editGrade(state.grades.find(grade=>grade.id===key));return;}
  if(name==='add-goal'){modal('A direction to work towards',field('subject','Subject','','text','required maxlength="100"')+field('target','Target average',8,'number','required min="1" max="10" step="0.01"'),async form=>{state.goals.push({id:id(),subject:form.get('subject').trim(),target:Number(form.get('target'))});await save();});return;}
  if(name==='calculator'){calculator();return;}
  if(name==='estimate'){chartEstimate();return;}
  if(name==='export-grades'){download(csv([['Subject','Value','Scale','Weight','Date','Remark'],...state.grades.map(grade=>[grade.subject,grade.value,grade.scale,grade.weight,grade.date,grade.note])]),'personal-grades.csv','text/csv');return;}
  if(name==='export-notes'){download(state.notes.map(note=>note.title+'\n'+note.subject+' · '+note.day+'\n\n'+note.text).join('\n\n---\n\n'),'personal-notes.txt','text/plain');return;}
  if(name==='export-backup'){exportBackup();return;}
  if(name==='import-backup'){importBackup();return;}
  if(name==='background'){await background();return;}
  if(name==='remove-background'){state.settings.background='';await save();render();return;}
  if(name==='accent'){state.settings.accent=element.dataset.color;await save();render();return;}
  if(name==='task-filter'){taskFilter=element.dataset.filter;render();return;}
  if(name==='select-day'){selectedDay=selectedDay===element.dataset.day?'':element.dataset.day;render();return;}
  if(name==='all-days'){selectedDay='';render();return;}
  if(name==='start-focus'){state.focus={end:Date.now()+Number(document.querySelector('#focus-length').value)*60000};await save();render();return;}
  if(name==='stop-focus'){state.focus=null;await save();render();return;}
  if(name==='save-live'){if(!liveData)return;state.reports.unshift({...liveData,id:id(),label:'Account report'});state.reports=state.reports.slice(0,2000);await save();toast('Time-stamped snapshot saved to Grades.');return;}
  if(name==='export-live'){if(liveData)download(JSON.stringify(liveData,null,2),'eklase-report-'+today()+'.json','application/json');return;}
  if(name==='open-report'){const report=state.reports.find(item=>item.id===key);document.querySelector('#dialog-content').innerHTML='<div class="dialog-heading"><h2>'+e(operationLabel(report.operation))+'</h2>'+button('Close','close','ghost small')+'</div><p class="subtle">Snapshot from '+e(new Date(report.captured).toLocaleString('en-GB'))+'</p>'+tree(report.data);dialog.showModal();return;}
  if(name==='logout'){await api('/api/logout',{});connected=false;liveData=null;toast('E-klase session disconnected. Your personal workspace remains.');render();return;}
  if(name==='install'){modal('Add E-klase++ to your iPhone','<div class="info"><strong>In Safari:</strong> tap Share → Add to Home Screen → keep Open as Web App enabled → Add.</div><p class="subtle">Open the app online once. Your personal workspace then works offline. Live E-klase reports require the hosted backend and an active connection.</p>',async()=>{},'Got it');return;}
}

document.addEventListener('click',event=>{const element=event.target.closest('[data-action]');if(element){event.preventDefault();action(element.dataset.action,element).catch(error=>toast(error.message));}});
document.addEventListener('change',async event=>{
  const element=event.target;
  if(element.id==='operation'){liveOperation=element.value;render();return;}
  if(element.id==='focus-length'){tick();return;}
  if(element.dataset.setting){const key=element.dataset.setting;state.settings[key]=element.type==='checkbox'?element.checked:['font','opacity','blur'].includes(key)?Number(element.value):element.value;try{await save();render();}catch{}}
});
document.querySelector('#account-button').addEventListener('click',loginForm);
document.querySelector('#open-search').addEventListener('click',()=>{location.hash='notes';setTimeout(()=>document.querySelector('#note-search')?.focus(),0);});
window.addEventListener('hashchange',()=>{view=tabs.some(tab=>tab[0]===location.hash.slice(1))?location.hash.slice(1):'home';filter='';render();window.scrollTo({top:0,behavior:'instant'});});
window.addEventListener('online',navigation);window.addEventListener('offline',navigation);window.addEventListener('visibilitychange',tick);
setInterval(tick,1000);
matchMedia('(prefers-color-scheme:light)').addEventListener('change',appearance);

try{await load();}catch(error){toast('Saved data could not be opened: '+error.message);document.querySelector('#connection').textContent='Storage unavailable';}
view=location.hash.slice(1)||'home';render();
try{catalog=await fetch('/operations.json').then(result=>result.json());if(view==='live')render();}catch{}
try{const session=await api('/api/session');connected=session.connected;configured=session.configured;navigation();}catch{navigation();}
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>toast('Offline setup could not complete. Try opening the app online again.'));
