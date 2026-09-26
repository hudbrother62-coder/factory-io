import test from 'node:test';
import assert from 'node:assert/strict';
import {PlcLink} from '../src/plc.js';

test('addresses survive normalization and scene serialization; invalid edits are rejected',()=>{
 const scene={parts:[{id:'a',type:'conveyor'},{id:'b',type:'lamp'},{id:'s',type:'sensor'}]};
 const link=Object.create(PlcLink.prototype);let saves=0;
 Object.assign(link,{scene:()=>scene,changed:()=>saves++,connected:false});
 link.setAddress('a',7);
 assert.equal(link.mapping().find(m=>m.id==='a').address,7);
 assert.equal(JSON.parse(JSON.stringify(scene)).plcMapping.find(m=>m.id==='a').address,7);
 link.setAddress('s',7); // Independent input and output areas.
 assert.throws(()=>link.setAddress('b',7));
 assert.throws(()=>link.setAddress('a',256));
 assert.equal(link.mapping().find(m=>m.id==='a').address,7);
 link.connected=true;assert.throws(()=>link.setAddress('a',8));
 assert.equal(saves,2);
});
