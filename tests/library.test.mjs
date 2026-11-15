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
  project('5',{type:'video',title:'Rated',file:'video.mp4',contentrating:'Mature',tags:['Anime',7,'Blue Archive']});
  // A scene project counts only when scene.pkg is present inside the folder.
  project('6',{type:'scene',title:'Scene',file:'scene.json'});
  fs.writeFileSync(path.join(root,'6','scene.pkg'),'synthetic scene package');
  // A web project counts only with an HTML entry file that stays inside its folder.
  project('7',{type:'web',title:'Web',file:'index.html'});
  fs.writeFileSync(path.join(root,'7','index.html'),'<html></html>');
  project('8',{type:'web',title:'Escaping web',file:'../../outside.mp4'});
  const items=inventory([root,root,path.join(temp,'missing')],path.join(temp,'cache'));
  // Web projects are listed only when the page can frame them; Codex CSP blocks it, so they are skipped.
  assert.equal(items.length,3);
  const example=items.find(item=>item.title==='Example'),rated=items.find(item=>item.title==='Rated');
  const scene=items.find(item=>item.title==='Scene');
  assert.equal(example.preview,null);assert.equal(example.rating,'');assert.deepEqual(example.tags,[]);
  assert.equal(rated.rating,'Mature');assert.deepEqual(rated.tags,['Anime','Blue Archive']);
  assert.equal(scene.type,'scene');assert.match(scene.file,/scene\.pkg$/);
  assert.match(example.id,/^[a-f0-9]{24}$/);
  assert.equal(example.id,inventory([root],path.join(temp,'cache')).find(item=>item.title==='Example').id);
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
