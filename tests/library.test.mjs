import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inventory} from '../src/library.mjs';
import {loadConfig} from '../src/config.mjs';
import {CDP} from '../src/cdp.mjs';

test('inventory filters invalid projects and prevents traversal', t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cw-library-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const root=path.join(temp,'workshop');fs.mkdirSync(root);
  fs.writeFileSync(path.join(root,'outside.mp4'),'synthetic');
  function project(id, json, file=true) {
    const dir=path.join(root,id);fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir,'project.json'),JSON.stringify(json));
    if(file)fs.writeFileSync(path.join(dir,'video.mp4'),'synthetic media for metadata tests');
  }
  project('1',{type:'video',title:'Example',file:'video.mp4',preview:'../../outside.png'});
  project('2',{type:'video',file:'../outside.mp4'});
  project('3',{type:'scene',file:'video.mp4'});
  project('4',{type:'video',file:'missing.mp4'},false);
  const items=inventory([root,root,path.join(temp,'missing')],path.join(temp,'cache'));
  assert.equal(items.length,1);assert.equal(items[0].title,'Example');assert.equal(items[0].preview,null);
  assert.match(items[0].id,/^[a-f0-9]{24}$/);
  assert.equal(items[0].id,inventory([root],path.join(temp,'cache'))[0].id);
});
test('configuration accepts BOM and refuses relative media roots',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'cw-config-'));
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const env={LOCALAPPDATA:temp,APPDATA:temp,CODEX_WALLPAPER_HOME:temp};
  const file=path.join(temp,'config.json');
  fs.writeFileSync(file,'\ufeff'+JSON.stringify({workshopDirs:[temp]}));
  assert.equal(loadConfig(env).dataDir,temp);
  fs.writeFileSync(file,JSON.stringify({workshopDirs:['relative']}));
  assert.throws(()=>loadConfig(env),/absolute/);
  fs.writeFileSync(file,'{');assert.throws(()=>loadConfig(env),/Cannot read/);
});
test('CDP rejects remote or non-WebSocket endpoints before opening them',()=>{
  assert.throws(()=>new CDP('ws://example.com:9222/'),/local/);
  assert.throws(()=>new CDP('https://127.0.0.1:9222/'),/local/);
});
