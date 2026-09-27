import {MEMORY_TAGS,TIMER_TAGS,COUNTER_TAGS,normaliseProgram} from './softplc.js';
import {labelFor,ensureOmronAddresses,timerPreset,secondsFromPreset} from './omron.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(items,value)=>items.map(([id,label])=>'<option value="'+esc(id)+'" '+(id===value?'selected':'')+'>'+esc(label)+'</option>').join('');
const addresses=scene=>scene.parts.filter(p=>['sensor','button','conveyor','pusher','stopper','emitter','lamp'].includes(p.type)).map(p=>[p.id,labelFor(scene,p.id)]);
const contactOptions=scene=>[...addresses(scene),...MEMORY_TAGS.map(t=>[t,labelFor(scene,t)+' · Work']),...TIMER_TAGS.map(t=>[t,labelFor(scene,t)+' · Done']),...COUNTER_TAGS.map(t=>[t,labelFor(scene,t)+' · Done'])];
const targetOptions=(scene,mode)=>mode==='TON'?TIMER_TAGS.map(t=>[t,labelFor(scene,t)]):mode==='CTU'||mode==='RES'?[...COUNTER_TAGS.map(t=>[t,labelFor(scene,t)]),...TIMER_TAGS.map(t=>[t,labelFor(scene,t)]),...MEMORY_TAGS.map(t=>[t,labelFor(scene,t)])]:[...addresses(scene).filter(([id])=>scene.parts.some(p=>p.id===id&&!['sensor','button'].includes(p.type))),...MEMORY_TAGS.map(t=>[t,labelFor(scene,t)])];
const modes=[['OUT','OUT ( )'],['INVERT','OUT NOT'],['SET','SET'],['RESET','RSET'],['TON','TIM · 100 ms'],['CTU','CNT · pulse'],['RES','RES']];
const renderPath=(path,i,list,locked)=>'<div class="omron-path" data-path="'+i+'"><span class="omron-path-label">'+(i===0?'LD / AND':'OR '+i)+'</span>'+path.map((c,k)=>'<div class="ladder-contact"><select data-contact="'+k+'" aria-label="Alamat kontak" '+locked+'>'+options(list,c.tag)+'</select><select data-kind="'+k+'" aria-label="Kontak NO atau NC" '+locked+'><option value="NO" '+(c.kind==='NO'?'selected':'')+'>—| |— NO</option><option value="NC" '+(c.kind==='NC'?'selected':'')+'>—|/|— NC</option></select><button data-remove-contact="'+k+'" title="Hapus kontak" '+locked+'>×</button></div>').join('')+'<button class="add-contact" data-add-contact="1" '+locked+'>+ Seri</button>'+(i>0?'<button class="remove-rung" data-remove-branch="1" '+locked+' title="Hapus jalur paralel">× Cabang</button>':'')+'</div>';
export function renderLadderEditor(host,scene,virtual,{changed,pulse,editable=true}){
 ensureOmronAddresses(scene);
 scene.program=normaliseProgram(scene);
 const list=contactOptions(scene),pulses=scene.parts.filter(p=>p.type==='button');
 const locked=editable?'':'disabled';
 host.innerHTML='<div class="ladder-toolbar"><div><strong>OMRON CP1E · LADDER WORKSPACE</strong><small>Gaya CX-Programmer: CIO input/output, area W, TIM 100 ms, CNT. Simulasi virtual—bukan impor proyek .cxp.</small></div><div class="ladder-tools">'+pulses.map(p=>'<button class="ladder-pulse" data-pulse="'+esc(p.id)+'" '+(editable?'disabled':'')+'>● '+esc(p.omronAddress)+' '+esc(p.name)+'</button>').join('')+'<button id="add-rung" class="add-rule" '+locked+'>+ NETWORK</button></div></div><div class="omron-command-legend">LD / LD NOT → AND / AND NOT → OR (cabang) → OUT, SET, RSET, TIM, CNT. Klik <b>EDIT SCENE</b> untuk mengubah program, kemudian <b>RUN SIMULASI</b> untuk memonitor.</div><div class="ladder-scroll">'+scene.program.map((r,i)=>{
 const mode=r.coil.mode,available=targetOptions(scene,mode),paths=[r.contacts,...(r.branches||[])];
 return '<section class="ladder-rung '+(virtual.trace[r.id]?'energized':'')+'" data-rung="'+esc(r.id)+'"><div class="rung-number">N'+String(i+1).padStart(2,'0')+'<span>│</span></div><div class="omron-network"><div class="omron-paths">'+paths.map((path,j)=>renderPath(path,j,list,locked)).join('')+'</div><button class="add-contact parallel-action" data-add-branch="1" '+locked+'>+ Cabang paralel (OR)</button></div><div class="ladder-line"></div><div class="ladder-coil"><select data-mode="1" aria-label="Instruksi output" '+locked+'>'+options(modes,mode)+'</select><select data-coil="1" aria-label="Alamat output" '+locked+'>'+options(available,r.coil.tag)+'</select>'+(mode==='TON'?'<label>SV <input type="text" maxlength="5" data-tpreset="1" value="'+timerPreset(r.coil.pt)+'" '+locked+' title="Contoh #0050 = 5 detik"></label>':mode==='CTU'?'<label>PV <input type="number" min="1" max="9999" step="1" data-pv="1" value="'+Number(r.coil.pv||2)+'" '+locked+'></label>':'')+'<button class="remove-rung" data-delete-rung="1" '+locked+' title="Hapus network">×</button></div></section>';
 }).join('')+'</div>'+(scene.program.length?'':'<div class="empty-panel">Klik + NETWORK untuk menambahkan rung Ladder baru.</div>')+'<div class="ladder-footer"><span>SCAN '+virtual.scans+' · '+(virtual.lastScanMs||0).toFixed(1)+' ms</span><span>'+scene.program.length+' network · W0.00–W0.07 · T0000–T0003 · C0000–C0003</span></div>';
 host.querySelector('#add-rung').onclick=()=>{if(!editable||scene.program.length>=64)return;scene.program.push({id:crypto.randomUUID(),contacts:[{tag:list[0]?.[0]||'M0',kind:'NO'}],coil:{tag:targetOptions(scene,'OUT')[0]?.[0]||'M0',mode:'OUT'}});changed();};
 host.querySelectorAll('[data-pulse]').forEach(b=>b.onclick=()=>pulse(b.dataset.pulse));
 host.querySelectorAll('[data-rung]').forEach(row=>{
  const rung=scene.program.find(r=>r.id===row.dataset.rung);if(!rung)return;
  const pathOf=n=>Number(n)===0?rung.contacts:(rung.branches||[])[Number(n)-1];
  row.querySelectorAll('[data-path]').forEach(pathRow=>{
   const idx=Number(pathRow.dataset.path),path=pathOf(idx);
   pathRow.querySelectorAll('[data-contact]').forEach(s=>s.onchange=()=>{if(!editable)return;path[Number(s.dataset.contact)].tag=s.value;changed();});
   pathRow.querySelectorAll('[data-kind]').forEach(s=>s.onchange=()=>{if(!editable)return;path[Number(s.dataset.kind)].kind=s.value;changed();});
   pathRow.querySelectorAll('[data-remove-contact]').forEach(b=>b.onclick=()=>{if(!editable)return;path.splice(Number(b.dataset.removeContact),1);changed();});
   pathRow.querySelector('[data-add-contact]').onclick=()=>{if(editable&&path.length<8){path.push({tag:list[0]?.[0]||'M0',kind:'NO'});changed();}};
   const del=pathRow.querySelector('[data-remove-branch]');if(del)del.onclick=()=>{if(!editable)return;rung.branches.splice(idx-1,1);changed();};
  });
  row.querySelector('[data-add-branch]').onclick=()=>{if(!editable)return;rung.branches??=[];if(rung.branches.length>=3)return;rung.branches.push([{tag:'M0',kind:'NO'}]);changed();};
  row.querySelector('[data-mode]').onchange=e=>{if(!editable)return;rung.coil.mode=e.target.value;rung.coil.tag=targetOptions(scene,e.target.value)[0]?.[0]||'M0';if(e.target.value==='TON')rung.coil.pt=.5;if(e.target.value==='CTU')rung.coil.pv=2;changed();};
  row.querySelector('[data-coil]').onchange=e=>{if(!editable)return;rung.coil.tag=e.target.value;changed();};
  const pt=row.querySelector('[data-tpreset]');if(pt)pt.onchange=e=>{if(!editable)return;const seconds=secondsFromPreset(e.target.value);if(seconds===null){e.target.value=timerPreset(rung.coil.pt);return;}rung.coil.pt=seconds;changed();};
  const pv=row.querySelector('[data-pv]');if(pv)pv.onchange=e=>{if(!editable)return;rung.coil.pv=Math.min(9999,Math.max(1,Math.round(Number(e.target.value)||2)));changed();};
  row.querySelector('[data-delete-rung]').onclick=()=>{if(!editable)return;scene.program=scene.program.filter(r=>r!==rung);changed();};
 });
}
export function updateLadderLive(host,virtual){
 host.querySelectorAll('[data-rung]').forEach(row=>row.classList.toggle('energized',Boolean(virtual.trace[row.dataset.rung])));
 const info=host.querySelector('.ladder-footer span');
 if(info)info.textContent='SCAN '+virtual.scans+' · '+(virtual.lastScanMs||0).toFixed(1)+' ms';
}
