// Omron CP1E-inspired training addressing. Independent virtual PLC, not a CP1E emulator.
// CIO availability and terminal assignments depend on the actual CPU and expansion modules.
const INPUT_TYPES = new Set(['sensor','button']);
const OUTPUT_TYPES = new Set(['conveyor','pusher','stopper','emitter','lamp']);
export const isInput = part => INPUT_TYPES.has(part.type);
export const isOutput = part => OUTPUT_TYPES.has(part.type);
export const isMapped = part => isInput(part)||isOutput(part);
export const workAddress = id => /^M[0-7]$/.test(id) ? 'W0.'+String(Number(id.slice(1))).padStart(2,'0') : null;
export const timerAddress = id => /^T[1-4]$/.test(id) ? 'T'+String(Number(id.slice(1))-1).padStart(4,'0') : null;
export const counterAddress = id => /^C[1-4]$/.test(id) ? 'C'+String(Number(id.slice(1))-1).padStart(4,'0') : null;
export function normalizeCio(input){
 const v=String(input??'').trim().toUpperCase().replace(/^(?:CIO\s*|[IQ]:\s*)/,'');
 const m=/^(\d{1,3})\.(\d{1,2})$/.exec(v);
 if(!m)return null;
 const word=Number(m[1]),bit=Number(m[2]);
 if(word>199||bit>15)return null;
 return word+'.'+String(bit).padStart(2,'0');
}
export function validCio(address,part){
 const normalized=normalizeCio(address);
 if(!normalized||!isMapped(part))return false;
 const word=Number(normalized.split('.')[0]);
 // Educational range. Actual available words depend on the selected CP1E CPU hardware.
 return isInput(part)?word<100:word>=100;
}
export function ensureOmronAddresses(scene){
 const used=new Set();const counts={input:0,output:0};
 for(const p of scene.parts||[]){
  if(!isMapped(p))continue;
  let address=normalizeCio(p.omronAddress);
  if(!validCio(address,p)||used.has(address)){
   const kind=isInput(p)?'input':'output',base=isInput(p)?0:100;
   let next=counts[kind],candidate;
   do { candidate=(base+Math.floor(next/16))+'.'+String(next%16).padStart(2,'0');next++; } while(used.has(candidate));
   counts[kind]=next;address=candidate;
  }
  p.omronAddress=address;used.add(address);
 }
 return scene;
}
export function updateOmronAddress(scene,id,input){
 const part=(scene.parts||[]).find(p=>p.id===id&&isMapped(p));
 const address=normalizeCio(input);
 if(!part||!validCio(address,part))throw Error('Alamat CIO tidak sesuai area. Input: 0.00–99.15; output: 100.00–199.15 (rentang latihan).');
 if(scene.parts.some(p=>p.id!==id&&isMapped(p)&&normalizeCio(p.omronAddress)===address))throw Error('Alamat '+address+' sudah digunakan komponen lain.');
 part.omronAddress=address;return address;
}
export function labelFor(scene,id){
 const special=workAddress(id)||timerAddress(id)||counterAddress(id);
 if(special)return special;
 const part=scene.parts.find(p=>p.id===id);
 return part?(part.omronAddress||'—')+' · '+part.name:id;
}
export function timerPreset(seconds){
 return '#'+String(Math.min(9999,Math.max(1,Math.round((Number(seconds)||.1)*10)))).padStart(4,'0');
}
export function secondsFromPreset(input){
 const match=/^#?(\d{1,4})$/.exec(String(input??'').trim());
 if(!match)return null;
 const ticks=Number(match[1]);if(ticks<1||ticks>1200)return null;
 return ticks/10;
}
