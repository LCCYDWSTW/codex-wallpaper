(() => {
  const boot = __CW_BOOT__;
  if (window.__codexWallpaper?.version === 4) { window.__codexWallpaper.update(boot); return; }
  window.__codexWallpaper?.dispose();
  if (!document.body || !document.getElementById('root')) return;
  let config={...boot.config},library=boot.library,disposed=false,frame=0,saveTimer=0,dragTimer=0,scanning=0;
  let pendingPatch={},dragging=false,selectedId=null,loadedId=null,selectionStarted=0,firstFrameMs=null,selectionCount=0,frameUpdates=0,messages=0;
  let painted={},glassDirty=true,drawerOpen=false;
  let video,loadingVideo=null;
  const glass=new Map(),glassSelector='.app-shell-left-panel,[data-testid="app-shell-floating-left-panel"],.composer-surface-chrome,[class*="_floatingSurface_"],[class*="_canvasSurface_"],.reply-chain-composer';
  const root=document.documentElement,style=document.createElement('style');style.id='cw-style';style.textContent=boot.css;document.head.append(style);
  const background=document.createElement('div');background.id='cw-background';background.setAttribute('aria-hidden','true');
  const poster=document.createElement('img');poster.id='cw-poster';poster.hidden=true;poster.alt='';
  const scrim=document.createElement('div');scrim.id='cw-scrim';background.append(poster,scrim);document.body.prepend(background);
  const controls=document.createElement('div');controls.id='cw-controls';
  controls.dataset.open='false';
  controls.innerHTML=`<button id="cw-toggle" type="button" aria-label="壁纸与外观" title="壁纸与外观" aria-controls="cw-panel" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="m14 17-3-3-8 8"/></svg></button><button id="cw-backdrop" type="button" tabindex="-1" aria-label="关闭壁纸设置"></button><section id="cw-panel" role="dialog" aria-label="壁纸与外观" aria-hidden="true" inert><div class="cw-drawer-head"><h3>壁纸与外观</h3><button id="cw-close" type="button" aria-label="关闭壁纸设置" title="关闭"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><p>Wallpaper Engine · 在窗口内独立播放</p><label>视频壁纸</label><select id="cw-library" aria-label="视频壁纸"></select><label>背景暗化 <span id="cw-shade-value"></span></label><input id="cw-shade" aria-label="背景暗化" type="range" min="0.1" max="0.8" step="0.01"><label>面板雾化 <span id="cw-blur-value"></span></label><input id="cw-blur" aria-label="面板雾化" type="range" min="0" max="40" step="1"><label>面板底色 <span id="cw-panel-value"></span></label><input id="cw-opacity" aria-label="面板底色" type="range" min="0.12" max="0.85" step="0.01"><div class="cw-row"><button id="cw-pause">暂停壁纸</button><button id="cw-sync">跟随主屏壁纸</button><button id="cw-disable">恢复原版外观</button></div><output id="cw-status"></output></section>`;
  document.body.append(controls);
  const $=id=>document.getElementById(id),toggle=$('cw-toggle'),inputs={shade:$('cw-shade'),blur:$('cw-blur'),panel:$('cw-opacity')};
  function mountToggle(){
    if(disposed)return;
    const action=[...document.querySelectorAll('#root button[aria-label="聊天操作"],#root button[aria-label="Chat actions"],#root button[aria-label="Conversation actions"]')].find(element=>{const r=element.getBoundingClientRect();return r.width>0&&r.x>innerWidth/2&&r.y<120;});
    if(action){let anchor=action;while(anchor.parentElement&&getComputedStyle(anchor.parentElement).display==='contents')anchor=anchor.parentElement;if(toggle.parentElement!==anchor.parentElement||toggle.nextSibling!==anchor)anchor.parentElement.insertBefore(toggle,anchor);if(toggle.className!==action.className)toggle.className=action.className;toggle.dataset.floating='false';controls.style.setProperty('--cw-drawer-top',Math.ceil(action.getBoundingClientRect().bottom+8)+'px');}
    else{if(toggle.parentElement!==controls)controls.prepend(toggle);toggle.dataset.floating='true';}
  }
  function setDrawer(open,restoreFocus=true){drawerOpen=open;controls.dataset.open=String(open);toggle.setAttribute('aria-expanded',String(open));$('cw-panel').setAttribute('aria-hidden',String(!open));$('cw-panel').inert=!open;if(open)$('cw-close').focus({preventScroll:true});else if(restoreFocus)toggle.focus({preventScroll:true});}
  function onEscape(event){if(drawerOpen&&event.key==='Escape'){event.preventDefault();event.stopPropagation();setDrawer(false);}}
  function send(patch){try{messages++;window.codexWallpaperControl(JSON.stringify(patch));}catch{}}
  function flush(){clearTimeout(saveTimer);saveTimer=0;if(Object.keys(pendingPatch).length){const patch=pendingPatch;pendingPatch={};send(patch);}}
  function save(patch,immediate=false){config={...config,...patch};pendingPatch={...pendingPatch,...patch};schedule();clearTimeout(saveTimer);if(immediate)flush();else saveTimer=setTimeout(flush,220);}
  function populate(){const select=$('cw-library');select.replaceChildren();for(const item of library){const option=document.createElement('option');option.value=item.id;option.textContent=item.title;select.append(option);}select.value=config.wallpaperId;}
  function scanGlass(){scanning=0;mountToggle();for(const element of document.querySelectorAll(glassSelector))if(!glass.has(element)){glass.set(element,{background:element.style.getPropertyValue('background-color'),priority:element.style.getPropertyPriority('background-color'),filter:element.style.getPropertyValue('backdrop-filter')});glassDirty=true;}for(const element of glass.keys())if(!element.isConnected)glass.delete(element);if(glassDirty)schedule();}
  function restoreElement(element,original){if(original.background)element.style.setProperty('background-color',original.background,original.priority);else element.style.removeProperty('background-color');if(original.filter)element.style.setProperty('backdrop-filter',original.filter);else element.style.removeProperty('backdrop-filter');}
  function playback(){for(const item of [video,loadingVideo])if(item){if(!config.enabled||config.paused||document.hidden||dragging)item.pause();else if(item.paused)item.play().catch(()=>{});}}
  function apply(){
    frame=0;if(disposed)return;frameUpdates++;if(painted.enabled!==config.enabled){root.dataset.codexWallpaper=config.enabled?'on':'off';background.hidden=!config.enabled;}
    const shade=String(config.shade),color=`rgb(13 22 35 / ${config.panel})`,filter=`blur(${config.blur}px) saturate(140%)`;
    // Keep CSS-driven surfaces in sync with panels updated through inline styles.
    if(painted.panel!==config.panel)root.style.setProperty('--cw-panel',String(config.panel));
    if(painted.blur!==config.blur)root.style.setProperty('--cw-blur',`${config.blur}px`);
    if(scrim.style.opacity!==shade)scrim.style.opacity=shade;
    if(glassDirty||painted.enabled!==config.enabled||painted.blur!==config.blur||painted.panel!==config.panel)for(const[element,original]of glass){if(!config.enabled){restoreElement(element,original);continue;}if(glassDirty||painted.enabled!==config.enabled||painted.panel!==config.panel)element.style.setProperty('background-color',color,'important');if(glassDirty||painted.enabled!==config.enabled||painted.blur!==config.blur)element.style.backdropFilter=filter;}
    painted={enabled:config.enabled,blur:config.blur,panel:config.panel};glassDirty=false;
    for(const[key,input]of Object.entries(inputs))if(input.value!==String(config[key]))input.value=config[key];
    $('cw-shade-value').textContent=Math.round(config.shade*100)+'%';$('cw-blur-value').textContent=config.blur+' px';$('cw-panel-value').textContent=Math.round(config.panel*100)+'%';
    $('cw-disable').textContent=config.enabled?'恢复原版外观':'开启毛玻璃壁纸';$('cw-pause').textContent=config.paused?'播放壁纸':'暂停壁纸';$('cw-sync').textContent=config.followDesktop?'已跟随主屏 ✓':'跟随主屏壁纸';
    if($('cw-library').value!==config.wallpaperId)$('cw-library').value=config.wallpaperId;
  }
  function schedule(){if(!frame&&!disposed)frame=requestAnimationFrame(apply);}
  function cancelVideo(item){if(!item)return;item.pause();item.removeAttribute('src');item.load();item.remove();}
  function select(id,retry=false){
    if(selectedId===id&&!retry)return;selectedId=id;selectionCount++;selectionStarted=performance.now();firstFrameMs=null;cancelVideo(loadingVideo);loadingVideo=null;
    if(!library.some(item=>item.id===id))return;
    poster.onload=()=>{if(selectedId===id&&loadingVideo)poster.hidden=false;};poster.onerror=()=>{poster.hidden=true;};poster.src='https://codex-wallpaper.invalid/poster/'+encodeURIComponent(id);
    const next=document.createElement('video');next.loop=true;next.muted=true;next.autoplay=true;next.playsInline=true;next.preload='auto';next.style.opacity='0';loadingVideo=next;background.insertBefore(next,poster);$('cw-status').textContent='正在切换…';
    next.addEventListener('loadeddata',()=>{if(disposed||loadingVideo!==next)return;firstFrameMs=Math.round(performance.now()-selectionStarted);const previous=video;video=next;loadedId=id;loadingVideo=null;next.style.opacity='1';poster.hidden=true;cancelVideo(previous);$('cw-status').textContent=`${next.videoWidth} × ${next.videoHeight} · 静音循环 · ${library.length} 个视频壁纸`;playback();},{once:true});
    next.addEventListener('error',()=>{if(disposed||loadingVideo!==next)return;$('cw-status').textContent='此视频需要兼容处理，正在准备…';send({_mediaError:id});},{once:true});
    next.src='https://codex-wallpaper.invalid/media/'+encodeURIComponent(id)+(retry?'?retry='+Date.now():'');playback();
  }
  function finishDrag(){clearTimeout(dragTimer);dragging=false;flush();playback();}
  function onSlider(key,event){if(!dragging){dragging=true;playback();}save({[key]:Number(event.target.value)});clearTimeout(dragTimer);dragTimer=setTimeout(finishDrag,240);}
  for(const[key,input]of Object.entries(inputs)){input.oninput=event=>onSlider(key,event);input.onchange=finishDrag;input.addEventListener('pointerup',finishDrag);}
  toggle.onclick=()=>setDrawer(!drawerOpen);$('cw-close').onclick=()=>setDrawer(false);$('cw-backdrop').onclick=()=>setDrawer(false);
  $('cw-library').onchange=event=>{const id=event.target.value;save({wallpaperId:id,followDesktop:false},true);select(id);};
  $('cw-pause').onclick=()=>{save({paused:!config.paused},true);playback();};$('cw-disable').onclick=()=>{save({enabled:!config.enabled},true);playback();};$('cw-sync').onclick=()=>save({followDesktop:!config.followDesktop},true);
  const observer=new MutationObserver(records=>{if(!scanning&&records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1)))scanning=setTimeout(scanGlass,180);});observer.observe(document.getElementById('root'),{childList:true,subtree:true});
  document.addEventListener('visibilitychange',playback);document.addEventListener('keydown',onEscape,true);window.addEventListener('resize',mountToggle);window.addEventListener('pagehide',flush);
  window.__codexWallpaper={
    version:4,
    update(next){if(disposed)return;if(style.textContent!==next.css)style.textContent=next.css;if(JSON.stringify(library)!==JSON.stringify(next.library)){library=next.library;populate();}this.updateConfig(next.config);},
    updateConfig(patch){if(disposed)return;patch={...patch};for(const key of Object.keys(pendingPatch))delete patch[key];config={...config,...patch};schedule();select(config.wallpaperId);playback();},
    retry(id){if(id===config.wallpaperId)select(id,true);},loading(message){$('cw-status').textContent=message;},
    status(){return{version:4,enabled:config.enabled,paused:video?.paused??true,time:video?.currentTime??0,width:video?.videoWidth??0,height:video?.videoHeight??0,error:video?.error?.message,wallpaperId:config.wallpaperId,loadedId,firstFrameMs,selectionCount,frameUpdates,messages,dragging,drawerOpen};},
    dispose(){if(disposed)return;flush();disposed=true;observer.disconnect();clearTimeout(scanning);clearTimeout(dragTimer);clearTimeout(saveTimer);cancelAnimationFrame(frame);cancelVideo(loadingVideo);cancelVideo(video);poster.removeAttribute('src');background.remove();toggle.remove();controls.remove();style.remove();for(const[element,original]of glass)restoreElement(element,original);glass.clear();delete root.dataset.codexWallpaper;for(const name of ['--cw-shade','--cw-blur','--cw-panel'])root.style.removeProperty(name);document.removeEventListener('visibilitychange',playback);document.removeEventListener('keydown',onEscape,true);window.removeEventListener('resize',mountToggle);window.removeEventListener('pagehide',flush);delete window.__codexWallpaper;}
  };
  populate();scanGlass();apply();select(config.wallpaperId);
})();
