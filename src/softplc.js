// Educational browser PLC; not for physical safety control.
export const MEMORY_TAGS=Array.from({length:8},(_,i)=>'M'+i);
export const TIMER_TAGS=Array.from({length:4},(_,i)=>'T'+(i+1));
export const COUNTER_TAGS=Array.from({length:4},(_,i)=>'C'+(i+1));
export const COIL_MODES=['OUT','SET','RESET','TON','CTU','RES'];
export function normaliseProgram(scene){
 if(Array.isArray(scene.program))return scene.program;
 return (scene.rules||[]).map(r=>({id:r.id,contacts:[{tag:r.source,kind:r.inverted?'NC':'NO'}],coil:{tag:r.target,mode:r.value?'OUT':'INVERT'}}));
}
export function validProgram(program,parts){
 if(!Array.isArray(program)||program.length>64)return false;
 const partTags=new Set(parts.filter(p=>['sensor','button','conveyor','pusher','stopper','emitter','lamp'].includes(p.type)).map(p=>p.id));
 const allowed=new Set([...partTags,...MEMORY_TAGS,...TIMER_TAGS,...COUNTER_TAGS]);
 return program.every(r=>r&&typeof r.id==='string'&&Array.isArray(r.contacts)&&r.contacts.length<=8&&r.contacts.every(c=>allowed.has(c.tag)&&['NO','NC'].includes(c.kind))&&r.coil&&allowed.has(r.coil.tag)&&[...COIL_MODES,'INVERT'].includes(r.coil.mode)&&
 (r.coil.mode!=='TON'||(TIMER_TAGS.includes(r.coil.tag)&&Number.isFinite(Number(r.coil.pt))&&Number(r.coil.pt)>=.05&&Number(r.coil.pt)<=120))&&
 (r.coil.mode!=='CTU'||(COUNTER_TAGS.includes(r.coil.tag)&&Number.isInteger(Number(r.coil.pv))&&Number(r.coil.pv)>=1&&Number(r.coil.pv)<=9999)));
}
export class VirtualPLC{
 constructor(){this.reset();}
 reset(){this.memory=Object.create(null);this.timers=Object.create(null);this.counters=Object.create(null);this.last=Object.create(null);this.trace=Object.create(null);this.scans=0;this.lastScanMs=0;}
 value(tag,image){
  if(TIMER_TAGS.includes(tag))return Boolean(this.timers[tag]?.q);
  if(COUNTER_TAGS.includes(tag))return Boolean(this.counters[tag]?.q);
  if(MEMORY_TAGS.includes(tag))return Boolean(this.memory[tag]);
  return Boolean(image[tag]);
 }
 scan(scene,seconds){
  const elapsed=Math.min(.1,Math.max(0,Number(seconds)||0)),image=Object.create(null);
  for(const p of scene.parts)image[p.id]=Boolean(p.value);
  const inputs=new Set(scene.parts.filter(p=>['sensor','button'].includes(p.type)).map(p=>p.id));
  const outputs=new Set(scene.parts.filter(p=>['conveyor','pusher','stopper','emitter','lamp'].includes(p.type)).map(p=>p.id));
  for(const rung of normaliseProgram(scene)){
   const conducted=rung.contacts.every(c=>c.kind==='NC'?!this.value(c.tag,image):this.value(c.tag,image));
   this.trace[rung.id]=conducted;
   const {tag,mode}=rung.coil;
   if(mode==='TON'){const t=this.timers[tag]||{et:0,q:false};t.et=conducted?Math.min(Number(rung.coil.pt),t.et+elapsed):0;t.q=conducted&&t.et>=Number(rung.coil.pt)-1e-9;this.timers[tag]=t;continue;}
   if(mode==='CTU'){const c=this.counters[tag]||{cv:0,q:false};if(conducted&&!this.last[rung.id])c.cv=Math.min(9999,c.cv+1);c.q=c.cv>=Number(rung.coil.pv);this.counters[tag]=c;this.last[rung.id]=conducted;continue;}
   if(mode==='RES'&&conducted){if(COUNTER_TAGS.includes(tag))this.counters[tag]={cv:0,q:false};else if(TIMER_TAGS.includes(tag))this.timers[tag]={et:0,q:false};else if(MEMORY_TAGS.includes(tag))this.memory[tag]=false;continue;}
   if(inputs.has(tag))continue;
   let next=mode==='INVERT'?!conducted:conducted;
   if((mode==='SET'||mode==='RESET')&&!conducted)continue;
   if(mode==='SET')next=true;if(mode==='RESET')next=false;
   if(MEMORY_TAGS.includes(tag))this.memory[tag]=next;else if(outputs.has(tag))image[tag]=next;
  }
  for(const p of scene.parts)if(outputs.has(p.id)&&!p.forced)p.value=Boolean(image[p.id]);
  this.scans++;this.lastScanMs=elapsed*1000;
 }
}
