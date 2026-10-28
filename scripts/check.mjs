import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const folder of ['src','scripts','tests'])for(const file of walk(path.join(root,folder))){
  if(/\.(mjs|js)$/.test(file)){
    const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
    if(result.status!==0)process.exit(1);
  }
}
if(process.platform==='win32'){
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts','check-powershell.ps1')],{stdio:'inherit',windowsHide:true});
  if(result.status!==0)process.exit(1);
}
console.log('Source syntax checks passed');
