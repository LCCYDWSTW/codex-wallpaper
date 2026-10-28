import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';
import {inventory} from './library.mjs';
import {sanitizeSettings, mediaRange} from './core.mjs';
import {CDP} from './cdp.mjs';
import {ChildProcesses} from './child-processes.mjs';
import {buildBootScript} from './renderer-boot.mjs';
import {cleanupRuntimeTemps, parseEndpoint, sameEndpoint, runtimeTempPath} from './lifecycle.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const config=loadConfig(),{profile,workshopDirs,weConfig,ffmpegPath,dataDir}=config;
const startedAt=Date.now();
const settingsFile=path.join(dataDir,'settings.json'),runtimeFile=path.join(dataDir,'runtime.json'),cacheDir=path.join(dataDir,'cache');
const runtimeTemp=runtimeTempPath(runtimeFile,process.pid);
const conversions=new ChildProcesses();
cleanupRuntimeTemps(runtimeFile);
const metrics={mediaRequests:0,mediaBytes:0,settingsWrites:0,configMessages:0};
const state={connections:new Map(),library:[],config:null,closed:false};
let saveTimer=null,saveQueue=Promise.resolve(),tickTimer=null;
let boundEndpoint=null;
const log=message=>console.log(new Date().toISOString(),message);
function selected(){try{const cfg=JSON.parse(fs.readFileSync(weConfig,'utf8'));for(const value of Object.values(cfg)){const file=value?.general?.wallpaperconfig?.selectedwallpapers?.Monitor0?.file;if(file)return state.library.find(item=>path.normalize(item.file).toLowerCase()===path.normalize(file).toLowerCase())?.id;}}catch{}return null;}
state.library=inventory(workshopDirs,cacheDir);if(!state.library.length)throw Error('No video wallpapers found in configured workshopDirs. Download a Video wallpaper in Wallpaper Engine and try again.');
state.config={enabled:true,wallpaperId:selected()||state.library[0].id,shade:.38,blur:22,panel:.36,paused:false,followDesktop:true};
try{Object.assign(state.config,sanitizeSettings(JSON.parse(fs.readFileSync(settingsFile,'utf8'))));}catch{}
if(!state.library.some(item=>item.id===state.config.wallpaperId))state.config.wallpaperId=selected()||state.library[0].id;
function persist(){clearTimeout(saveTimer);saveTimer=null;const text=JSON.stringify(state.config,null,2);saveQueue=saveQueue.catch(()=>{}).then(async()=>{const temp=settingsFile+'.tmp';await fs.promises.writeFile(temp,text);await fs.promises.rename(temp,settingsFile);metrics.settingsWrites++;}).catch(error=>log('settings: '+error.message));return saveQueue;}
const scheduleSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(persist,100);};
function boot(){return{config:{...state.config},library:state.library.map(({id,title})=>({id,title})),css:fs.readFileSync(path.join(dir,'wallpaper.css'),'utf8')};}
const renderer=fs.readFileSync(path.join(dir,'renderer.js'),'utf8'),script=()=>buildBootScript(renderer,boot());
async function broadcast(patch,source){for(const entry of state.connections.values())if(entry!==source)try{await entry.cdp.evaluate(`window.__codexWallpaper?.updateConfig(${JSON.stringify(patch)})`);}catch(error){log('config: '+error.message);}}
function change(payload,source){
  let incoming;try{incoming=JSON.parse(payload);}catch{return;}if(!incoming||typeof incoming!=='object')return;
  if(typeof incoming._mediaError==='string'){void compatible(incoming._mediaError,source);return;}metrics.configMessages++;
  const patch={};for(const key of ['enabled','paused','followDesktop'])if(typeof incoming[key]==='boolean')patch[key]=incoming[key];
  for(const[key,min,max]of [['shade',.1,.8],['panel',.12,.85],['blur',0,40]])if(Number.isFinite(incoming[key]))patch[key]=Math.min(max,Math.max(min,incoming[key]));
  if(typeof incoming.wallpaperId==='string'&&state.library.some(item=>item.id===incoming.wallpaperId))patch.wallpaperId=incoming.wallpaperId;
  if(!Object.keys(patch).length)return;Object.assign(state.config,patch);
  if(state.config.followDesktop){const id=selected();if(id&&id!==state.config.wallpaperId){state.config.wallpaperId=id;patch.wallpaperId=id;void source.cdp.evaluate(`window.__codexWallpaper?.updateConfig(${JSON.stringify({wallpaperId:id})})`).catch(error=>log(error.message));}}
  scheduleSave();void broadcast(patch,source);
}
const mime=file=>({'.webm':'video/webm','.gif':'image/gif','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[path.extname(file).toLowerCase()]||'video/mp4');
async function serve(cdp,event){
  let handle;
  try{
    const url=new URL(event.request.url),parts=url.pathname.split('/'),item=state.library.find(item=>item.id===decodeURIComponent(parts[2]||''));
    if(!item||!['media','poster'].includes(parts[1])||!['GET','HEAD'].includes(event.request.method))throw Error('not found');
    const poster=parts[1]==='poster',file=poster?item.preview:(fs.existsSync(item.cached)?item.cached:item.file);if(!file)throw Error('not found');
    handle=await fs.promises.open(file,'r');const stat=await handle.stat(),range=Object.entries(event.request.headers).find(([key])=>key.toLowerCase()==='range')?.[1];
    // A preview may change after inventory scanning; keep per-request memory bounded.
    if(!stat.isFile()||(poster&&(stat.size===0||stat.size>10*1024*1024)))throw Error('invalid preview');
    let from=0,to=stat.size-1;
    if(!poster){const bounded=mediaRange(range,stat.size);
      if(!bounded){await cdp.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:416,responseHeaders:[{name:'Content-Range',value:`bytes */${stat.size}`}],body:''});return;}
      from=bounded.start;to=bounded.end;}
    const size=to-from+1,body=Buffer.alloc(event.request.method==='HEAD'?0:size);
    if(body.length){let read=0;while(read<body.length){const result=await handle.read(body,read,body.length-read,from+read);if(!result.bytesRead)throw Error('short media read');read+=result.bytesRead;}}
    const headers=[{name:'Content-Type',value:mime(file)},{name:'Content-Length',value:String(size)},{name:'Cache-Control',value:'private, max-age=86400'},{name:'Accept-Ranges',value:'bytes'},{name:'Cross-Origin-Resource-Policy',value:'cross-origin'}];if(!poster)headers.push({name:'Content-Range',value:`bytes ${from}-${to}/${stat.size}`});
    await cdp.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:poster?200:206,responseHeaders:headers,body:body.toString('base64')});if(!poster){metrics.mediaRequests++;metrics.mediaBytes+=body.length;}
  }catch{try{await cdp.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:404,body:''});}catch{}}
  finally{if(handle)await handle.close().catch(()=>{});}
}
const preparing=new Map();
async function compatible(id,entry){
  if(state.closed)return;const item=state.library.find(item=>item.id===id);if(!item)return;if(entry.failed?.has(id)){try{await entry.cdp.evaluate(`window.__codexWallpaper?.loading('视频无法播放，请选择其他壁纸；重启后可重试')`);}catch{}return;}entry.failed??=new Set();entry.failed.add(id);
  if(!preparing.has(id)){const job=(async()=>{fs.mkdirSync(cacheDir,{recursive:true});const temp=item.cached+'.partial.mp4';log('Compatibility conversion: '+item.title);const base=['-hide_banner','-loglevel','error','-nostdin','-y','-i',item.file,'-an','-vf','fps=30,scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2','-pix_fmt','yuv420p'];
    try{
      try{await conversions.run(ffmpegPath,[...base,'-c:v','h264_nvenc','-preset','p1','-cq','25','-b:v','0','-movflags','+faststart',temp],{windowsHide:true,timeout:600000,maxBuffer:1024*1024});}
      catch(error){if(state.closed)throw error;await conversions.run(ffmpegPath,[...base,'-c:v','libx264','-preset','veryfast','-crf','23','-threads','2','-movflags','+faststart',temp],{windowsHide:true,timeout:600000,maxBuffer:1024*1024});}
      await fs.promises.rename(temp,item.cached);
    }finally{await fs.promises.unlink(temp).catch(()=>{});}
  })();preparing.set(id,job);job.finally(()=>preparing.delete(id)).catch(()=>{});}
  try{await preparing.get(id);if(!state.closed&&state.config.wallpaperId===id)await entry.cdp.evaluate(`window.__codexWallpaper?.retry(${JSON.stringify(id)})`);}catch(error){if(state.closed)return;log('conversion: '+error.message);try{await entry.cdp.evaluate(`window.__codexWallpaper?.loading('视频兼容处理失败，请选择其他壁纸；重启后可重试')`);}catch{}}
}
async function attach(target){
  const cdp=new CDP(target.webSocketDebuggerUrl),entry={cdp};state.connections.set(target.id,entry);cdp.ws.addEventListener('close',()=>{if(state.connections.get(target.id)===entry)state.connections.delete(target.id);});
  cdp.on('Fetch.requestPaused',event=>serve(cdp,event));cdp.on('Runtime.bindingCalled',event=>{if(event.name==='codexWallpaperControl')change(event.payload,entry);});cdp.on('Page.domContentEventFired',async()=>{entry.ready=false;await cdp.evaluate(script());entry.ready=await cdp.evaluate('Boolean(window.__codexWallpaper)');});
  await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Runtime.addBinding',{name:'codexWallpaperControl'});await cdp.send('Fetch.enable',{patterns:[{urlPattern:'https://codex-wallpaper.invalid/*',requestStage:'Request'}]});await cdp.evaluate(script());entry.ready=await cdp.evaluate('Boolean(window.__codexWallpaper)');log('Attached streaming wallpaper '+target.id);
}
let missed=0;
async function tick(){
  if(state.closed)return;
  try{const endpoint=parseEndpoint(fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8'));if(!endpoint)throw Error('Invalid debugging endpoint');
    if(boundEndpoint&&!sameEndpoint(boundEndpoint,endpoint)){log('Codex debugging endpoint changed; leaving before a new helper attaches');await stop(true);return;}
    boundEndpoint=endpoint;const {port}=endpoint;
    const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(2500)})).json();missed=0;
    for(const target of targets){if(target.type!=='page'||!target.url.startsWith('app://-/index.html'))continue;const route=new URL(target.url).searchParams.get('initialRoute')||'';if(/spotlight|avatar-overlay|screen-overlay|application-menu/.test(route))continue;if(!state.connections.has(target.id))try{await attach(target);}catch(error){state.connections.get(target.id)?.cdp.close();state.connections.delete(target.id);log(error.message);}}
    for(const entry of state.connections.values())if(!entry.ready)try{await entry.cdp.evaluate(script());entry.ready=await entry.cdp.evaluate('Boolean(window.__codexWallpaper)');}catch{}
    const snapshot={pid:process.pid,startedAt,port,browserPath:endpoint.browserPath,profile,videoCount:state.library.length,version:1,ready:[...state.connections.values()].some(entry=>entry.ready),updatedAt:Date.now(),metrics};
    await fs.promises.writeFile(runtimeTemp,JSON.stringify(snapshot,null,2));await fs.promises.rename(runtimeTemp,runtimeFile);
    if(state.config.followDesktop){const id=selected();if(id&&id!==state.config.wallpaperId){state.config.wallpaperId=id;scheduleSave();await broadcast({wallpaperId:id});}}
  }catch(error){if(++missed===1)log('Waiting for Codex: '+error.message);if(missed>60){await stop();return;}}
  tickTimer=setTimeout(tick,2000);
}
async function stop(endpointChanged=false){if(state.closed)return;state.closed=true;clearTimeout(tickTimer);await conversions.stopAll();await Promise.allSettled([...preparing.values()]);if(saveTimer)await persist();await saveQueue;for(const{cdp}of state.connections.values()){if(!endpointChanged)try{await cdp.evaluate('window.__codexWallpaper?.dispose()');await cdp.send('Fetch.disable');}catch{}cdp.close();}try{if(JSON.parse(fs.readFileSync(runtimeFile,'utf8')).pid===process.pid)fs.unlinkSync(runtimeFile);}catch{}await fs.promises.unlink(runtimeTemp).catch(()=>{});process.exit(0);}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());log(`Ready: ${state.library.length} video wallpapers; direct ranged playback`);void tick();
