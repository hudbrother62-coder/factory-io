import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const omron=readFileSync(new URL('../src/omron-ui.js',import.meta.url),'utf8');
test('workspace exposes real panel, focus and tools controls',()=>{
 for(const id of ['library-toggle','inspector-toggle','focus-btn','tools-menu','panel-collapse','expand-panel','panel-content','stage'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/updateLayout\(true\)/);
 assert.match(css,/#app\.focus-3d \.workspace/);
 assert.match(css,/#app\.panel-collapsed #panel-content/);
});
test('live status updates do not rerender entire monitor every interval',()=>{
 assert.match(app,/function updateIoLive\(/);
 assert.match(omron,/export function updateOmronLive\(/);
 const last=app.slice(app.lastIndexOf('setInterval(()=>'));
 assert.match(last,/updateIoLive\(\)/);
 assert.match(last,/updateOmronLive\(/);
 assert.doesNotMatch(last,/renderPanel\(\)/);
});
