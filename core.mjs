export const defaults = () => ({version:1,tasks:[],notes:[],grades:[],goals:[],reports:[],settings:{theme:'light',accent:'#4f79e8',motion:true,effects:false,density:'comfortable',font:16,background:'',opacity:0.14,blur:0},focus:null,lastBackup:null});

export function average(values) {
  return values.length && values.every(Number.isFinite) ? values.reduce((sum,value)=>sum+value,0)/values.length : null;
}

export function weighted(values) {
  if (!values.length || values.some(([value,weight])=>!Number.isFinite(value)||!Number.isFinite(weight)||weight<=0)) return null;
  return values.reduce((sum,[value,weight])=>sum+value*weight,0)/values.reduce((sum,[,weight])=>sum+weight,0);
}

export function required(current,count,target,remaining) {
  if (![current,count,target,remaining].every(Number.isFinite)||current<1||current>10||count<=0||target<1||target>10||remaining<=0) return null;
  return (target*(count+remaining)-current*count)/remaining;
}

export function estimate(first,firstSize,second,secondSize,size,error=1) {
  if (![first,firstSize,second,secondSize,size,error].every(Number.isFinite)||Math.abs(secondSize-firstSize)<0.0001||error<0) return null;
  const slope=(second-first)/(secondSize-firstSize);
  return {value:first+(size-firstSize)*slope,uncertainty:Math.abs(slope)*error};
}

export function median(values) {
  if (!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b), index=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[index] : (sorted[index-1]+sorted[index])/2;
}

export function csv(rows) {
  const field=value=>'"'+(/^[=+@\-\t\r]/.test(String(value))?"'":'')+String(value??'').replaceAll('"','""')+'"';
  return '\uFEFF'+rows.map(row=>row.map(field).join(',')).join('\r\n');
}

export function calendar(task) {
  const escape=value=>String(value??'').replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;');
  const date=value=>new Date(value).toISOString().replaceAll('-','').replaceAll(':','').replace(/\.\d{3}/,'');
  const end=new Date(new Date(task.due).getTime()+30*60000);
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//E-klase++//Planner//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+escape(task.id)+'@eklase-plus-plus','DTSTAMP:'+date(new Date()),'DTSTART:'+date(task.due),'DTEND:'+date(end),'SUMMARY:'+escape(task.title),'DESCRIPTION:'+escape(task.note)];
  if (['daily','weekly'].includes(task.repeat)) lines.push('RRULE:FREQ='+task.repeat.toUpperCase());
  if (task.reminder) lines.push('BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:'+escape(task.title),'END:VALARM');
  lines.push('END:VEVENT','END:VCALENDAR');
  return lines.map(line=>line.replaceAll('\r','')).join('\r\n');
}

export function validate(value) {
  if (!value || value.version!==1) throw Error('Unsupported backup version.');
  for (const key of ['tasks','notes','grades','goals','reports']) if (!Array.isArray(value[key])||value[key].length>10000) throw Error('Invalid '+key+'.');
  const settings=value.settings;
  if (!settings || !['dark','light','system'].includes(settings.theme)||!/^#[a-f\d]{6}$/i.test(settings.accent)||!Number.isFinite(settings.font)||settings.font<12||settings.font>24||!Number.isFinite(settings.opacity)||settings.opacity<0||settings.opacity>0.6||!Number.isFinite(settings.blur)||settings.blur<0||settings.blur>30||typeof settings.background!=='string'||settings.background.length>7_000_000||settings.background&&!/^data:image\/(png|jpeg|webp);base64,/.test(settings.background)) throw Error('Invalid appearance settings.');
  for (const grade of value.grades) if (typeof grade.id!=='string'||typeof grade.subject!=='string'||!Number.isFinite(grade.value)||grade.value<0||grade.value>(grade.scale==='percent'?100:10)||!Number.isFinite(grade.weight)||grade.weight<=0||grade.weight>100) throw Error('Invalid grade record.');
  for (const task of value.tasks) if (typeof task.id!=='string'||typeof task.title!=='string'||!Number.isFinite(Date.parse(task.due))||!['none','daily','weekly'].includes(task.repeat)) throw Error('Invalid task record.');
  for (const note of value.notes) if (typeof note.id!=='string'||typeof note.title!=='string'||typeof note.text!=='string') throw Error('Invalid note record.');
  return value;
}

const encoder=new TextEncoder();
const decoder=new TextDecoder();
function base64(bytes) { let text=''; for (const value of bytes) text+=String.fromCharCode(value); return btoa(text); }
function unbase64(text) { if (typeof text!=='string') throw Error('Invalid backup encoding.'); return Uint8Array.from(atob(text),value=>value.charCodeAt(0)); }
async function derive(password,salt,iterations) {
  if (typeof password!=='string'||password.length<12||password.length>1024||salt.length!==32||!Number.isInteger(iterations)||iterations<100000||iterations>1000000) throw Error('Use a password of 12–1024 characters.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

export async function encrypt(value,password) {
  validate(value);
  const plain=encoder.encode(JSON.stringify(value));
  if (plain.length>30_000_000) throw Error('Backup exceeds 30 MB. Remove older snapshots first.');
  const salt=crypto.getRandomValues(new Uint8Array(32)), iv=crypto.getRandomValues(new Uint8Array(12)), iterations=310000;
  const key=await derive(password,salt,iterations);
  const sealed=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('e-klase-plus-plus:1')},key,plain);
  return JSON.stringify({format:'e-klase-plus-plus',version:1,iterations,salt:base64(salt),iv:base64(iv),sealed:base64(new Uint8Array(sealed))});
}

export async function decrypt(text,password) {
  if (typeof text!=='string'||text.length>45_000_000) throw Error('Backup is too large.');
  const envelope=JSON.parse(text);
  if (envelope.format!=='e-klase-plus-plus'||envelope.version!==1) throw Error('Unsupported backup format.');
  try {
    const salt=unbase64(envelope.salt),iv=unbase64(envelope.iv);
    if (iv.length!==12) throw Error('Invalid nonce.');
    const key=await derive(password,salt,envelope.iterations);
    const opened=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode('e-klase-plus-plus:1')},key,unbase64(envelope.sealed));
    return validate(JSON.parse(decoder.decode(opened)));
  } catch { throw Error('The password is incorrect or the backup is damaged.'); }
}

export function escape(value) { return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
