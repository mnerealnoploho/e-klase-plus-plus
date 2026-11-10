(async function(){
  if(location.pathname.startsWith('/_auth/')||document.querySelector('#ek-plus-root'))return;
  const host=document.createElement('div');host.id='ek-plus-root';
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML='<link rel="stylesheet" href="/++/enhance.css"><button class="launcher" aria-label="Atvērt E-klase++ rīkus">++</button><section class="panel" hidden aria-label="E-klase++ rīki"><header><strong>E-klase<span>++</span></strong><button class="close" aria-label="Aizvērt">×</button></header><p class="intro">Ierastā E-klase. Papildu rīki tev.</p><div class="actions"><button data-action="analyze">Analizēt redzamo pārskatu</button><button data-action="save">Saglabāt šīs lapas pārskatu</button></div><div class="result" aria-live="polite"></div><nav><a href="/++/#planner"><b>Plāni un atgādinājumi</b><small>Dienas, prioritātes un Calendar eksports</small></a><a href="/++/#notes"><b>Personīgās piezīmes</b><small>Par stundu, priekšmetu vai dienu</small></a><a href="/++/#grades"><b>Aprēķini un saglabātie dati</b><small>Mērķa atzīmes, sadalījums un kopijas</small></a><a href="/++/#backup"><b>Šifrētas rezerves kopijas</b><small>Saglabā failu iCloud Drive</small></a><a href="/++/#settings"><b>Izskata iestatījumi</b><small>Krāsas, blīvums, attēli un efekti</small></a><a href="/++/lock"><b>Aizslēgt testa vietni</b><small>Pie nākamās atvēršanas prasīs testa paroli</small></a></nav><p class="foot">Aprēķini nemaina skolas ierakstus.</p></section>';
  document.body.append(host);
  const panel=shadow.querySelector('.panel'),output=shadow.querySelector('.result');
  shadow.querySelector('.launcher').addEventListener('click',()=>{panel.hidden=!panel.hidden;});
  shadow.querySelector('.close').addEventListener('click',()=>{panel.hidden=true;});
  const {defaults,validate,escape:e,average,median}=await import('/++/core.mjs');
  const visible=element=>element&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
  const text=element=>element?.innerText?.trim()||'';
  const number=value=>Number(String(value).replace(',','.'));
  function snapshot(){
    const main=document.querySelector('main'),dialog=[...document.querySelectorAll('[role="dialog"]')].find(visible);
    if(!main)return null;
    const scope=dialog||main,title=text(scope.querySelector('h1,h2'))||'Pārskats';
    const profile=[...main.querySelectorAll('button')].find(button=>button.querySelectorAll('p').length>=2);
    const entries=[];
    for(const row of scope.querySelectorAll('table tr')){
      const cells=[...row.querySelectorAll('td')];
      if(cells.length!==4||!/^\d{2}\.\d{2}\.\d{4}$/.test(text(cells[0])))continue;
      const raw=text(cells[3]),percent=raw.match(/(\d+(?:[.,]\d+)?)\s*%/),grade=raw.match(/(?:^|\s|\|)(10|[1-9])(?:[.,](\d+))?\s*$/);
      entries.push({date:text(cells[0]),subject:title,topic:text(cells[1]).slice(0,8000),homework:text(cells[2]).slice(0,8000),raw,value:!percent&&grade?number(grade[1]+(grade[2]?'.'+grade[2]:'')):null,percentage:percent?number(percent[1]):null});
    }
    const heading=[...scope.querySelectorAll('h2,h3')].find(element=>/^(Skolēnu sekmju reitings|Darba izpilde procentos)$/.test(text(element)));
    const section=heading?.closest('section')||heading?.parentElement;
    let rankings=[],scale=10;
    if(section){
      scale=/ballēs/.test(text(section))?10:100;
      const bars=[...section.querySelectorAll('div[style]')].filter(element=>visible(element)&&/^\d+(?:\.\d+)?%$/.test(element.style.width)&&/bg-graph-hover|bg-accent/.test(element.className));
      const anchors=bars.map(element=>({size:parseFloat(element.style.width),label:element.parentElement.parentElement.lastElementChild?.textContent.trim()})).filter(value=>/^\d+(?:[.,]\d+)?%?$/.test(value.label||''));
      const valid=anchors.length>=2&&anchors.every(value=>Math.abs(value.size*scale/100-number(value.label.replace('%','')))<(scale===10?.03:.3));
      if(valid)rankings=bars.map((element,index)=>({position:index+1,value:parseFloat(element.style.width)*scale/100,uncertainty:scale===10?.02:.2,own:/(?:^|\s)bg-accent(?:\s|$)/.test(element.className)}));
    }
    let summary='';
    if(dialog)summary=text(dialog).slice(0,30000);
    if(title==='Apmeklējums')summary=text(scope).split('Zīmes')[0].slice(-6000);
    if(!entries.length&&!rankings.length&&!summary)return null;
    return {title,account:text(profile).slice(0,200),source:location.pathname,captured:new Date().toISOString(),entries,rankings,scale,summary};
  }
  function analysis(data){
    if(!data)return '<p>Atver ielādētu žurnālu, reitingu, kavējumu vai pārbaudes darba pārskatu un mēģini vēlreiz.</p>';
    let html='';
    const values=data.entries.map(entry=>entry.value).filter(value=>Number.isFinite(value)&&value>=1&&value<=10);
    if(values.length)html+='<h3>'+e(data.title)+'</h3><div class="stats"><span>Redzamo ballu vidējais<b>'+average(values).toFixed(2)+'</b></span><span>Mediāna<b>'+median(values).toFixed(2)+'</b></span></div><p>Aprēķins bez svariem no '+values.length+' redzamām atzīmēm. Skolas aprēķins var atšķirties.</p>';
    if(data.rankings.length)html+='<h3>Vērtības pēc joslu izmēra</h3><p>Aptuvenas vērtības (±'+(data.scale===10?'0,02':'0,2%')+'). Pārbaudītas pret redzamajiem atskaites punktiem. Tās nav oficiālas atzīmes.</p><ol class="ranks">'+data.rankings.map(rank=>'<li class="'+(rank.own?'own':'')+'"><span>'+rank.position+'. vieta'+(rank.own?' · tu':'')+'</span><b>≈ '+rank.value.toFixed(2)+(data.scale===100?'%':'')+'</b></li>').join('')+'</ol>';
    if(!html)html='<p>Pārskatā ir saglabājama informācija, bet nav pietiekamu skaitlisku datu šim aprēķinam.</p>';
    return html;
  }
  async function save(data){
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('eklase-plus-plus',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('workspace'))request.result.createObjectStore('workspace');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise((resolve,reject)=>{const transaction=db.transaction('workspace','readwrite'),store=transaction.objectStore('workspace'),request=store.get('state');request.onsuccess=()=>{try{const state=request.result?validate(request.result):defaults();state.reports.unshift({id:crypto.randomUUID(),captured:data.captured,operation:'page.snapshot',label:data.title,data});state.reports=state.reports.slice(0,2000);store.put(state,'state');}catch(error){transaction.abort();reject(error);}};transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});
    db.close();
  }
  shadow.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const data=snapshot();output.innerHTML=analysis(data);
    if(button.dataset.action==='save'&&data){button.disabled=true;try{await save(data);output.insertAdjacentHTML('afterbegin','<p class="success">Saglabāts. Atver “Aprēķini un saglabātie dati”, lai apskatītu kopiju.</p>');}catch{output.insertAdjacentHTML('afterbegin','<p>Neizdevās saglabāt. Esošie dati nav aizvietoti.</p>');}finally{button.disabled=false;}}
  });
}());
