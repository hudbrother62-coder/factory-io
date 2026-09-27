import {MEMORY_TAGS,TIMER_TAGS,COUNTER_TAGS,normaliseProgram} from './softplc.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(items,selected)=>items.map(([v,label])=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(label)+'</option>').join('');
const opts=scene=>scene.parts.filter(p=>['sensor','button','conveyor','pusher','stopper','emitter','lamp'].includes(p.type)).map(p=>[p.id,(['sensor','button'].includes(p.type)?'I':'Q')+' · '+p.name]);
const contacts=scene=>[...opts(scene),...MEMORY_TAGS.map(t=>[t,t+' · Memory']),...TIMER_TAGS.map(t=>[t,t+'.Q · Timer']),...COUNTER_TAGS.map(t=>[t,t+'.Q · Counter'])];
const targetOpts=(scene,mode)=>mode==='TON'?TIMER_TAGS.map(t=>[t,t+' · Timer']):mode==='CTU'||mode==='RES'?[...COUNTER_TAGS.map(t=>[t,t+' · Counter']),...TIMER_TAGS.map(t=>[t,t+' · Timer']),...MEMORY_TAGS.map(t=>[t,t+' · Memory'])]:[...opts(scene).filter(([id])=>scene.parts.some(p=>p.id===id&&!['sensor','button'].includes(p.type))),...MEMORY_TAGS.map(t=>[t,t+' · Memory'])];
export function renderLadderEditor(host,scene,virtual,{changed,pulse}){
 scene.program=normaliseProgram(scene);
 const list=contacts(scene),pulses=scene.parts.filter(p=>p.type==='button');
 host.innerHTML='<div class="ladder-toolbar"><div><strong>VIRTUAL PLC · LADDER EDITOR</strong><small>Program dijalankan berurutan setiap scan saat RUN. Kontak hijau = kondisi terpenuhi.</small></div><div class="ladder-tools">'+pulses.map(p=>'<button class="ladder-pulse" data-pulse="'+esc(p.id)+'">● '+esc(p.name)+'</button>').join('')+'<button id="add-rung" class="add-rule">+ RUNG</button></div></div><div class="ladder-scroll">'+scene.program.map((r,i)=>{
 const mode=r.coil.mode,available=targetOpts(scene,mode);
 return '<div class="ladder-rung '+(virtual.trace[r.id]?'energized':'')+'" data-rung="'+esc(r.id)+'"><div class="rung-number">'+String(i+1).padStart(2,'0')+'<span>│</span></div><div class="rung-contacts">'+r.contacts.map((c,k)=>'<div class="ladder-contact"><select data-contact="'+k+'" aria-label="Tag kontak">'+options(list,c.tag)+'</select><select data-kind="'+k+'" aria-label="Jenis kontak"><option value="NO" '+(c.kind==='NO'?'selected':'')+'>—| |— NO</option><option value="NC" '+(c.kind==='NC'?'selected':'')+'>—|/|— NC</option></select><button data-remove-contact="'+k+'" title="Hapus kontak" aria-label="Hapus kontak">×</button></div>').join('')+'<button class="add-contact" title="Kontak seri" data-add-contact="1">+ CONTACT</button></div><div class="ladder-line"></div><div class="ladder-coil"><select data-mode="1" aria-label="Instruksi coil">'+options(['OUT','INVERT','SET','RESET','TON','CTU','RES'].map(t=>[t,t==='INVERT'?'NOT OUT':t]),mode)+'</select><select data-coil="1" aria-label="Tag coil">'+options(available,r.coil.tag)+'</select>'+(mode==='TON'?'<label>PT (s) <input type="number" min="0.05" max="120" step="0.05" data-pt="1" value="'+Number(r.coil.pt||.5)+'"></label>':mode==='CTU'?'<label>PV <input type="number" min="1" max="9999" step="1" data-pv="1" value="'+Number(r.coil.pv||2)+'"></label>':'')+'<button class="remove-rung" data-delete-rung="1" title="Hapus rung">×</button></div></div>';
 }).join('')+'</div>'+(scene.program.length?'':'<div class="empty-panel">Belum ada rung. Tambahkan kontak input dan satu output untuk memulai.</div>')+'<div class="ladder-footer"><span>SCAN '+virtual.scans+' · '+(virtual.lastScanMs||0).toFixed(1)+' ms timestep</span><span>'+scene.program.length+' rung · M0–M7 · T1–T4 · C1–C4</span></div>';
 host.querySelector('#add-rung').onclick=()=>{if(scene.program.length>=64)return;scene.program.push({id:crypto.randomUUID(),contacts:[{tag:list[0]?.[0]||'M0',kind:'NO'}],coil:{tag:targetOpts(scene,'OUT')[0]?.[0]||'M0',mode:'OUT'}});changed();};
 host.querySelectorAll('[data-pulse]').forEach(b=>b.onclick=()=>pulse(b.dataset.pulse));
 host.querySelectorAll('[data-rung]').forEach(row=>{
  const rung=scene.program.find(r=>r.id===row.dataset.rung);if(!rung)return;
  row.querySelectorAll('[data-contact]').forEach(s=>s.onchange=()=>{rung.contacts[Number(s.dataset.contact)].tag=s.value;changed();});
  row.querySelectorAll('[data-kind]').forEach(s=>s.onchange=()=>{rung.contacts[Number(s.dataset.kind)].kind=s.value;changed();});
  row.querySelectorAll('[data-remove-contact]').forEach(b=>b.onclick=()=>{rung.contacts.splice(Number(b.dataset.removeContact),1);changed();});
  row.querySelector('[data-add-contact]').onclick=()=>{if(rung.contacts.length<8){rung.contacts.push({tag:list[0]?.[0]||'M0',kind:'NO'});changed();}};
  row.querySelector('[data-mode]').onchange=e=>{rung.coil.mode=e.target.value;rung.coil.tag=targetOpts(scene,e.target.value)[0]?.[0]||'M0';if(e.target.value==='TON')rung.coil.pt=.5;if(e.target.value==='CTU')rung.coil.pv=2;changed();};
  row.querySelector('[data-coil]').onchange=e=>{rung.coil.tag=e.target.value;changed();};
  const pt=row.querySelector('[data-pt]');if(pt)pt.onchange=e=>{rung.coil.pt=Math.min(120,Math.max(.05,Number(e.target.value)||.5));changed();};
  const pv=row.querySelector('[data-pv]');if(pv)pv.onchange=e=>{rung.coil.pv=Math.min(9999,Math.max(1,Math.round(Number(e.target.value)||2)));changed();};
  row.querySelector('[data-delete-rung]').onclick=()=>{scene.program=scene.program.filter(r=>r!==rung);changed();};
 });
}

export function updateLadderLive(host,virtual){
 host.querySelectorAll('[data-rung]').forEach(row=>row.classList.toggle('energized',Boolean(virtual.trace[row.dataset.rung])));
 const info=host.querySelector('.ladder-footer span');
 if(info)info.textContent='SCAN '+virtual.scans+' · '+(virtual.lastScanMs||0).toFixed(1)+' ms timestep';
}
