(() => {
  const boot = __CW_BOOT__;
  if (window.__codexWallpaper?.version === 20) { window.__codexWallpaper.update(boot); return; }
  window.__codexWallpaper?.dispose();
  if (!document.body || !document.getElementById('root')) return;
  let config={...boot.config},library=boot.library,disposed=false,frame=0,saveTimer=0,dragTimer=0,scanning=0;
  let pendingPatch={},dragging=false,selectedId=null,loadedId=null,selectionStarted=0,firstFrameMs=null,selectionCount=0,frameUpdates=0,messages=0,filterText='',filterRating='',filterType='';
  let painted={},glassDirty=true,drawerOpen=false;
  let pendingPackage=null,packageTimer=0,video,loadingVideo=null,sceneLayer=null,sceneInstance=null,scenePaused=null,sceneVolume=null,loadToken=0,loadedKind=null;
  const glass=new Map(),glassSelector='.app-shell-left-panel,[data-testid="app-shell-floating-left-panel"],.composer-surface-chrome,[class*="_floatingSurface_"],[class*="_canvasSurface_"],.reply-chain-composer';
  const root=document.documentElement,style=document.createElement('style');style.id='cw-style';style.textContent=boot.css;document.head.append(style);
  const background=document.createElement('div');background.id='cw-background';background.setAttribute('aria-hidden','true');
  const poster=document.createElement('img');poster.id='cw-poster';poster.hidden=true;poster.alt='';
  const scrim=document.createElement('div');scrim.id='cw-scrim';background.append(poster,scrim);document.body.prepend(background);
  const controls=document.createElement('div');controls.id='cw-controls';
  controls.dataset.open='false';
  controls.innerHTML=`<button id="cw-toggle" type="button" aria-label="壁纸与外观" title="壁纸与外观" aria-controls="cw-panel" aria-expanded="false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="m14 17-3-3-8 8"/></svg></button><button id="cw-backdrop" type="button" tabindex="-1" aria-label="关闭壁纸设置"></button><section id="cw-panel" role="dialog" aria-label="壁纸与外观" aria-hidden="true" inert><div class="cw-drawer-head"><h3>壁纸与外观</h3><button id="cw-close" type="button" aria-label="关闭壁纸设置" title="关闭"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><p>Wallpaper Engine · 在窗口内独立播放</p><div class="cw-lib"><div class="cw-lib-bar"><input id="cw-search" type="search" placeholder="搜索壁纸" aria-label="搜索壁纸" autocomplete="off"><select id="cw-type" aria-label="壁纸类型"><option value="">全部类型</option></select><select id="cw-fps" aria-label="场景帧率"><option value="15">15 帧</option><option value="30">30 帧</option><option value="60">60 帧</option></select><select id="cw-dpr" aria-label="场景渲染精度"><option value="1">1x 清晰度</option><option value="1.5">1.5x</option><option value="2">2x 锐利</option></select><select id="cw-rating" aria-label="内容分级"><option value="">全部分级</option></select><button id="cw-view" type="button" aria-label="切换卡片或列表视图" title="卡片 / 列表">卡片</button><button id="cw-refresh" type="button" aria-label="重新扫描壁纸库" title="重新扫描 Wallpaper Engine 库">刷新</button></div><div id="cw-grid" class="cw-grid" data-view="cards" role="listbox" aria-label="视频壁纸"></div><p id="cw-count" class="cw-count"></p></div><label>背景暗化 <span id="cw-shade-value"></span></label><input id="cw-shade" aria-label="背景暗化" type="range" min="0.1" max="0.8" step="0.01"><label>面板雾化 <span id="cw-blur-value"></span></label><input id="cw-blur" aria-label="面板雾化" type="range" min="0" max="40" step="1"><label>面板底色 <span id="cw-panel-value"></span></label><input id="cw-opacity" aria-label="面板底色" type="range" min="0.12" max="0.85" step="0.01"><label>壁纸音量 <span id="cw-volume-value"></span></label><input id="cw-volume" aria-label="壁纸音量" type="range" min="0" max="1" step="0.01"><div class="cw-row"><button id="cw-pause">暂停壁纸</button><button id="cw-sound">开启声音</button><button id="cw-sync">跟随主屏壁纸</button><button id="cw-glass">关闭毛玻璃</button><button id="cw-disable">恢复原版外观</button></div><output id="cw-status"></output></section>`;
  document.body.append(controls);
  // Lightweight diagnostics: long frames, visibility flips and video play/pause transitions.
  // Cheap enough to leave on; read through status() when investigating stutter.
  const diag={visibility:0,focus:0,blur:0,plays:0,pauses:0,longTasks:0,longest:0,scans:0,scanMs:0,scanMax:0,since:Date.now()};
  document.addEventListener('visibilitychange',()=>{diag.visibility++;});
  window.addEventListener('focus',()=>{diag.focus++;});
  window.addEventListener('blur',()=>{diag.blur++;});
  try{new PerformanceObserver(list=>{for(const entry of list.getEntries()){diag.longTasks++;if(entry.duration>diag.longest)diag.longest=Math.round(entry.duration);}}).observe({entryTypes:['longtask']});}catch{}  const $=id=>document.getElementById(id),toggle=$('cw-toggle'),inputs={shade:$('cw-shade'),blur:$('cw-blur'),panel:$('cw-opacity'),volume:$('cw-volume')};
  let lastMountCheck=0,mountedAnchor=null;
  function mountToggle(){
    if(disposed)return;
    const now=performance.now();if(mountedAnchor&&mountedAnchor.isConnected&&toggle.parentElement===mountedAnchor.parentElement&&now-lastMountCheck<1200)return;lastMountCheck=now;
    const action=[...document.querySelectorAll('#root button[aria-label="聊天操作"],#root button[aria-label="Chat actions"],#root button[aria-label="Conversation actions"]')].find(element=>{const r=element.getBoundingClientRect();return r.width>0&&r.x>innerWidth/2&&r.y<120;});
    if(action){let anchor=action;while(anchor.parentElement&&getComputedStyle(anchor.parentElement).display==='contents')anchor=anchor.parentElement;if(toggle.parentElement!==anchor.parentElement||toggle.nextSibling!==anchor)anchor.parentElement.insertBefore(toggle,anchor);mountedAnchor=action;if(toggle.className!==action.className)toggle.className=action.className;toggle.dataset.floating='false';controls.style.setProperty('--cw-drawer-top',Math.ceil(action.getBoundingClientRect().bottom+8)+'px');}
    else{mountedAnchor=null;if(toggle.parentElement!==controls)controls.prepend(toggle);toggle.dataset.floating='true';}
  }
  let lastMount=0;
  function mountToggleSoon(){const now=performance.now();if(toggle.isConnected&&now-lastMount<2000)return;lastMount=now;mountToggle();}
  function setDrawer(open,restoreFocus=true){drawerOpen=open;controls.dataset.open=String(open);toggle.setAttribute('aria-expanded',String(open));$('cw-panel').setAttribute('aria-hidden',String(!open));$('cw-panel').inert=!open;if(open)$('cw-close').focus({preventScroll:true});else if(restoreFocus)toggle.focus({preventScroll:true});}
  function onEscape(event){if(drawerOpen&&event.key==='Escape'){event.preventDefault();event.stopPropagation();setDrawer(false);}}
  function send(patch){try{messages++;window.codexWallpaperControl(JSON.stringify(patch));}catch{}}
  function flush(){clearTimeout(saveTimer);saveTimer=0;if(Object.keys(pendingPatch).length){const patch=pendingPatch;pendingPatch={};send(patch);}}
  function save(patch,immediate=false){config={...config,...patch};pendingPatch={...pendingPatch,...patch};schedule();clearTimeout(saveTimer);if(immediate)flush();else saveTimer=setTimeout(flush,220);}
  const posterFailed=new Set(),RATING_LABELS={Questionable:'敏感内容',Mature:'限制级'},TYPE_LABELS={video:'视频',scene:'场景',web:'网页'};
  function matches(item){if(filterType&&item.type!==filterType)return false;if(filterRating&&item.rating!==filterRating)return false;if(!filterText)return true;return item.title.toLowerCase().includes(filterText)||(item.tags||[]).some(tag=>tag.toLowerCase().includes(filterText));}
  function cardFor(item){const card=document.createElement('button');card.type='button';card.className='cw-card';card.dataset.id=item.id;card.setAttribute('role','option');card.setAttribute('aria-selected','false');card.title=item.title;if(item.preview&&!posterFailed.has(item.id)){const image=document.createElement('img');image.alt='';image.loading='lazy';image.decoding='async';image.src='https://codex-wallpaper.invalid/poster/'+encodeURIComponent(item.id);image.onerror=()=>{posterFailed.add(item.id);image.remove();card.classList.add('cw-card--empty');};card.append(image);}else card.classList.add('cw-card--empty');const kind=document.createElement('span');kind.className='cw-card-kind';kind.dataset.kind=item.type;kind.textContent=TYPE_LABELS[item.type]||item.type;card.append(kind);const title=document.createElement('span');title.className='cw-card-title';const text=document.createElement('span');text.className='cw-card-text';text.textContent=item.title;title.append(text);card.append(title);if(item.rating&&item.rating!=='Everyone'){const tag=document.createElement('span');tag.className='cw-card-tag';tag.textContent=RATING_LABELS[item.rating]||item.rating;card.append(tag);}card.onclick=()=>{if(config.wallpaperId===item.id)return;save({wallpaperId:item.id,followDesktop:false},true);select(item.id);markSelected();};return card;}
  function renderRatings(){const select=$('cw-rating');if(!select)return;const ratings=[...new Set(library.map(item=>item.rating).filter(rating=>rating&&rating!=='Everyone'))].sort(),current=select.value;select.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='全部分级';select.append(all);for(const rating of ratings){const option=document.createElement('option');option.value=rating;option.textContent=RATING_LABELS[rating]||rating;select.append(option);}select.value=ratings.includes(current)?current:'';select.hidden=!ratings.length;}
  function renderTypes(){const select=$('cw-type');if(!select)return;const kinds=[...new Set(library.map(item=>item.type))],current=select.value;select.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='全部类型';select.append(all);for(const kind of ['video','scene','web'].filter(kind=>kinds.includes(kind))){const option=document.createElement('option');option.value=kind;option.textContent=TYPE_LABELS[kind];select.append(option);}select.value=kinds.includes(current)?current:'';select.hidden=kinds.length<2;}
  function markSelected(){const grid=$('cw-grid');if(!grid)return;for(const card of grid.children)card.setAttribute('aria-selected',String(card.dataset.id===config.wallpaperId));}
  function renderLibrary(){const grid=$('cw-grid');if(!grid)return;const fragment=document.createDocumentFragment();let shown=0;for(const item of library)if(matches(item)){shown++;fragment.append(cardFor(item));}grid.replaceChildren(fragment);$('cw-count').textContent=shown===library.length?`共 ${library.length} 个壁纸`:`${shown} / ${library.length} 个壁纸`;markSelected();}
  function scanGlass(){scanning=0;const started=performance.now();mountToggle();for(const element of document.querySelectorAll(glassSelector))if(!glass.has(element)){glass.set(element,{background:element.style.getPropertyValue('background-color'),priority:element.style.getPropertyPriority('background-color'),filter:element.style.getPropertyValue('backdrop-filter')});glassDirty=true;}for(const element of glass.keys())if(!element.isConnected)glass.delete(element);if(glassDirty)schedule();const cost=performance.now()-started;diag.scans++;diag.scanMs=Math.round(diag.scanMs+cost);if(cost>diag.scanMax)diag.scanMax=Math.round(cost);}
  function restoreElement(element,original){if(original.background)element.style.setProperty('background-color',original.background,original.priority);else element.style.removeProperty('background-color');if(original.filter)element.style.setProperty('backdrop-filter',original.filter);else element.style.removeProperty('backdrop-filter');}
  function playback(){
    const blocked=!config.enabled||config.paused||document.hidden;
    for(const item of [video,loadingVideo])if(item){item.muted=!config.sound;if(Number.isFinite(config.volume))item.volume=config.volume;if(blocked||dragging)item.pause();else if(item.paused)item.play().catch(()=>{});}
    if(sceneInstance){const volume=sceneVolumeFor();if(sceneVolume!==volume){sceneVolume=volume;try{sceneInstance.setVolume(volume);}catch{}}if(scenePaused!==blocked){scenePaused=blocked;try{blocked?sceneInstance.pause():sceneInstance.resume();}catch{}}}
  }
  function apply(){
    frame=0;if(disposed)return;frameUpdates++;if(painted.enabled!==config.enabled){root.dataset.codexWallpaper=config.enabled?'on':'off';background.hidden=!config.enabled;}
    const shade=String(config.shade),color=`rgb(13 22 35 / ${config.panel})`,filter=`blur(${config.blur}px) saturate(140%)`;
    // Keep CSS-driven surfaces in sync with panels updated through inline styles.
    // Re-blurring the Codex panels is a compositor-bound operation: writing a new blur
    // radius on every pointer move stalls the frame (measured 90-280 ms per frame here).
    // Keep the previous radius while dragging and apply the new one on release.
    if(!dragging){
      if(painted.panel!==config.panel)root.style.setProperty('--cw-panel',String(config.panel));
      if(painted.blur!==config.blur)root.style.setProperty('--cw-blur',`${config.blur}px`);
    }
    if(scrim.style.opacity!==shade)scrim.style.opacity=shade;
    if(!dragging&&(glassDirty||painted.enabled!==config.enabled||painted.blur!==config.blur||painted.panel!==config.panel||painted.glass!==config.glass))for(const[element,original]of glass){if(!config.enabled){restoreElement(element,original);continue;}if(glassDirty||painted.enabled!==config.enabled||painted.panel!==config.panel)element.style.setProperty('background-color',color,'important');if(glassDirty||painted.enabled!==config.enabled||painted.blur!==config.blur||painted.glass!==config.glass){if(config.glass===false)element.style.removeProperty('backdrop-filter');else element.style.backdropFilter=filter;}}
    if(!dragging){painted={enabled:config.enabled,blur:config.blur,panel:config.panel,glass:config.glass};glassDirty=false;}else{painted={...painted,enabled:config.enabled,glass:config.glass};}
    for(const[key,input]of Object.entries(inputs))if(input.value!==String(config[key]))input.value=config[key];
    $('cw-shade-value').textContent=Math.round(config.shade*100)+'%';$('cw-blur-value').textContent=config.blur+' px';$('cw-panel-value').textContent=Math.round(config.panel*100)+'%';$('cw-volume-value').textContent=Math.round((Number.isFinite(config.volume)?config.volume:.6)*100)+'%';
    $('cw-disable').textContent=config.enabled?'恢复原版外观':'开启毛玻璃壁纸';$('cw-pause').textContent=config.paused?'播放壁纸':'暂停壁纸';$('cw-sync').textContent=config.followDesktop?'已跟随主屏 ✓':'跟随主屏壁纸';$('cw-sound').textContent=config.sound?'关闭声音':'开启声音';$('cw-glass').textContent=config.glass===false?'开启毛玻璃':'关闭毛玻璃';if(root.dataset.cwGlass!==(config.glass===false?'off':'on'))root.dataset.cwGlass=config.glass===false?'off':'on';
    const grid=$('cw-grid');if(grid){const view=config.view==='list'?'list':'cards';if(grid.dataset.view!==view)grid.dataset.view=view;$('cw-view').textContent=view==='list'?'列表':'卡片';}
    if(painted.wallpaperId!==config.wallpaperId){painted.wallpaperId=config.wallpaperId;markSelected();}
    const fps=$('cw-fps');if(fps&&fps.value!==String(config.sceneFps||30))fps.value=String(config.sceneFps||30);const dpr=$('cw-dpr');if(dpr&&dpr.value!==String(config.sceneDpr||1.5))dpr.value=String(config.sceneDpr||1.5);
  }
  function schedule(){if(disposed)return;if(document.hidden){apply();return;}if(!frame)frame=requestAnimationFrame(apply);}
  function cancelVideo(item){if(!item)return;item.pause();item.removeAttribute('src');item.load();item.remove();}
  function requestPackage(id,token){
    return new Promise((resolve,reject)=>{
      pendingPackage={id,resolve,reject,token};
      send({_sceneRequest:id});
      clearTimeout(packageTimer);
      packageTimer=setTimeout(()=>{if(pendingPackage&&pendingPackage.id===id){pendingPackage=null;reject(Error('场景包传输超时'));}},300000);
    });
  }
  const pkg={id:null,buffer:null,offset:0};
  function pkgBegin(id,size){pkg.id=id;pkg.buffer=new Uint8Array(size);pkg.offset=0;$('cw-status').textContent=`正在接收场景包 0 / ${Math.round(size/1048576)} MB`;}
  function pkgPush(base64){if(!pkg.buffer)return;const binary=atob(base64);for(let i=0;i<binary.length;i++)pkg.buffer[pkg.offset++]=binary.charCodeAt(i);if(pkg.offset<pkg.buffer.length)$('cw-status').textContent=`正在接收场景包 ${Math.round(pkg.offset/1048576)} / ${Math.round(pkg.buffer.length/1048576)} MB`;}
  function pkgEnd(){const incoming={id:pkg.id,buffer:pkg.buffer};pkg.id=null;pkg.buffer=null;if(!pendingPackage||pendingPackage.id!==incoming.id||!incoming.buffer)return;const pending=pendingPackage;pendingPackage=null;clearTimeout(packageTimer);pending.resolve(incoming.buffer.buffer);}
  function pkgAbort(){pkg.id=null;pkg.buffer=null;const pending=pendingPackage;pendingPackage=null;clearTimeout(packageTimer);if(pending)pending.reject(Error('场景包传输失败'));}
  window.__cwPkgBegin=pkgBegin;window.__cwPkgPush=pkgPush;window.__cwPkgEnd=pkgEnd;window.__cwPkgAbort=pkgAbort;  function sceneHost(){if(!sceneLayer){sceneLayer=document.createElement('div');sceneLayer.id='cw-scene';background.insertBefore(sceneLayer,poster);}return sceneLayer;}
  function clearScene(){if(sceneInstance)try{sceneInstance.destroy();}catch{}sceneInstance=null;scenePaused=null;sceneVolume=null;if(sceneLayer){sceneLayer.remove();sceneLayer=null;}}
  function sceneEngine(){const engine=globalThis.WebWallGL;if(!engine){$('cw-status').textContent='场景壁纸引擎未就绪，请重启壁纸辅助进程';return null;}return engine;}
  function sceneVolumeFor(){return config.sound?(Number.isFinite(config.volume)?config.volume:.6):0;}
  async function loadScene(id,item){
    const token=++loadToken,engine=sceneEngine();if(!engine)return;
    if(document.hidden){$('cw-status').textContent='打开 Codex 窗口后加载场景壁纸';return;}
    $('cw-status').textContent='正在加载场景壁纸…';
    try{
      const pkg=await requestPackage(id,token);
      if(disposed||token!==loadToken)return;
      const instance=engine.createScene(sceneHost(),{fit:'cover',volume:sceneVolumeFor(),fps:Number(config.sceneFps)||30,renderDpr:Number(config.sceneDpr)||1.5});
      sceneInstance=instance;scenePaused=null;
      instance.on?.('error',error=>{if(token!==loadToken)return;clearScene();poster.hidden=false;$('cw-status').textContent='场景壁纸渲染失败：'+(error?.message||error);});
      await instance.load(engine.bytesSource(pkg,{type:'scene',title:item.title},'scene:'+id));
      if(disposed||token!==loadToken){try{instance.destroy();}catch{}return;}
      loadedKind='scene';loadedId=id;firstFrameMs=Math.round(performance.now()-selectionStarted);poster.hidden=true;
      const canvas=sceneLayer?.querySelector('canvas')||instance.canvas;
      $('cw-status').textContent=`${canvas?.width||0} × ${canvas?.height||0} · 场景壁纸 · ${library.length} 个壁纸`;
      playback();
    }catch(error){if(!disposed&&token===loadToken){clearScene();poster.hidden=false;$('cw-status').textContent='场景壁纸加载失败：'+(error?.message||error);}}
  }
  function select(id,retry=false){
    if(selectedId===id&&!retry)return;selectedId=id;selectionCount++;selectionStarted=performance.now();firstFrameMs=null;loadToken++;
    const item=library.find(entry=>entry.id===id);if(!item)return;
    cancelVideo(loadingVideo);loadingVideo=null;
    poster.onload=()=>{if(selectedId===id&&!video&&!sceneInstance)poster.hidden=false;};poster.onerror=()=>{poster.hidden=true;};
    poster.src='https://codex-wallpaper.invalid/poster/'+encodeURIComponent(id);
    if(item.type&&item.type!=='video'){
      cancelVideo(video);video=null;loadedKind=null;clearScene();
      if(item.type==='scene')void loadScene(id,item);
      return;
    }
    clearScene();
    const next=document.createElement('video');next.loop=true;next.muted=!config.sound;next.autoplay=true;next.playsInline=true;next.preload='auto';next.style.opacity='0';loadingVideo=next;background.insertBefore(next,poster);$('cw-status').textContent='正在切换…';
    next.addEventListener('loadeddata',()=>{if(disposed||loadingVideo!==next)return;firstFrameMs=Math.round(performance.now()-selectionStarted);const previous=video;video=next;loadedId=id;loadedKind='video';loadingVideo=null;next.style.opacity='1';poster.hidden=true;cancelVideo(previous);$('cw-status').textContent=`${next.videoWidth} × ${next.videoHeight} · ${config.sound?'有声':'静音'}循环 · ${library.length} 个壁纸`;playback();},{once:true});
    next.addEventListener('play',()=>{diag.plays++;});next.addEventListener('pause',()=>{diag.pauses++;});
    next.addEventListener('error',()=>{if(disposed||loadingVideo!==next)return;$('cw-status').textContent='此视频需要兼容处理，正在准备…';send({_mediaError:id});},{once:true});
    next.src='https://codex-wallpaper.invalid/media/'+encodeURIComponent(id)+(retry?'?retry='+Date.now():'');playback();
  }
  function finishDrag(){clearTimeout(dragTimer);dragging=false;flush();glassDirty=true;schedule();playback();}
  function onSlider(key,event){if(!dragging){dragging=true;playback();}save({[key]:Number(event.target.value)});clearTimeout(dragTimer);dragTimer=setTimeout(finishDrag,240);}
  for(const[key,input]of Object.entries(inputs)){input.oninput=event=>onSlider(key,event);input.onchange=finishDrag;input.addEventListener('pointerup',finishDrag);}
  toggle.onclick=()=>setDrawer(!drawerOpen);$('cw-close').onclick=()=>setDrawer(false);$('cw-backdrop').onclick=()=>setDrawer(false);
  $('cw-search').oninput=event=>{filterText=event.target.value.trim().toLowerCase();renderLibrary();};$('cw-type').onchange=event=>{filterType=event.target.value;renderLibrary();};$('cw-rating').onchange=event=>{filterRating=event.target.value;renderLibrary();};$('cw-fps').onchange=event=>save({sceneFps:Number(event.target.value)},true);$('cw-dpr').onchange=event=>save({sceneDpr:Number(event.target.value)},true);$('cw-view').onclick=()=>save({view:config.view==='list'?'cards':'list'},true);$('cw-refresh').onclick=()=>{$('cw-count').textContent='正在重新扫描…';send({_rescan:true});};
  $('cw-pause').onclick=()=>{save({paused:!config.paused},true);playback();};$('cw-disable').onclick=()=>{save({enabled:!config.enabled},true);playback();};$('cw-sync').onclick=()=>save({followDesktop:!config.followDesktop},true);$('cw-sound').onclick=()=>{save({sound:!config.sound},true);playback();};$('cw-glass').onclick=()=>save({glass:config.glass===false},true);
  const observer=new MutationObserver(records=>{if(scanning)return;let changed=false;for(const record of records){for(const node of record.addedNodes){if(node.nodeType===1){changed=true;break;}}if(!changed)for(const node of record.removedNodes){if(node.nodeType===1){changed=true;break;}}if(changed)break;}if(!changed)return;if(!toggle.isConnected||toggle.getBoundingClientRect().x<1)mountToggleSoon();scanning=setTimeout(()=>{if('requestIdleCallback' in window)requestIdleCallback(()=>scanGlass(),{timeout:800});else scanGlass();},320);});observer.observe(document.getElementById('root'),{childList:true,subtree:true});
  function onVisibility(){playback();if(!document.hidden&&!sceneInstance){const item=library.find(entry=>entry.id===config.wallpaperId);if(item&&item.type==='scene')select(config.wallpaperId,true);}}document.addEventListener('visibilitychange',onVisibility);document.addEventListener('keydown',onEscape,true);window.addEventListener('resize',mountToggle);window.addEventListener('pagehide',flush);
  window.__codexWallpaper={
    version:20,
    update(next){if(disposed)return;if(style.textContent!==next.css)style.textContent=next.css;library=next.library;renderTypes();renderRatings();renderLibrary();this.updateConfig(next.config);},
    updateConfig(patch){if(disposed)return;patch={...patch};for(const key of Object.keys(pendingPatch))delete patch[key];config={...config,...patch};schedule();select(config.wallpaperId);playback();},
    retry(id){if(id===config.wallpaperId)select(id,true);},loading(message){$('cw-status').textContent=message;},
    status(){const quality=video&&video.getVideoPlaybackQuality?video.getVideoPlaybackQuality():null;return{version:20,diag:{...diag,runningForSeconds:Math.round((Date.now()-diag.since)/1000)},video:quality?{total:quality.totalVideoFrames,dropped:quality.droppedVideoFrames}:null,kind:loadedKind,scene:Boolean(sceneInstance),enabled:config.enabled,paused:video?.paused??scenePaused??true,time:video?.currentTime??0,width:video?.videoWidth??sceneLayer?.querySelector('canvas')?.width??0,height:video?.videoHeight??sceneLayer?.querySelector('canvas')?.height??0,error:video?.error?.message,wallpaperId:config.wallpaperId,loadedId,firstFrameMs,selectionCount,frameUpdates,messages,dragging,drawerOpen};},
    capture(){const canvas=sceneLayer?.querySelector('canvas')||sceneInstance?.canvas;if(!canvas||!canvas.width)return null;try{return canvas.toDataURL('image/png');}catch{return null;}},
    dispose(){if(disposed)return;flush();disposed=true;observer.disconnect();clearTimeout(scanning);clearTimeout(dragTimer);clearTimeout(saveTimer);cancelAnimationFrame(frame);cancelVideo(loadingVideo);cancelVideo(video);clearScene();poster.removeAttribute('src');background.remove();toggle.remove();controls.remove();style.remove();for(const[element,original]of glass)restoreElement(element,original);glass.clear();delete root.dataset.codexWallpaper;delete root.dataset.cwGlass;for(const name of ['--cw-shade','--cw-blur','--cw-panel'])root.style.removeProperty(name);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('keydown',onEscape,true);window.removeEventListener('resize',mountToggle);window.removeEventListener('pagehide',flush);delete window.__codexWallpaper;}
  };
  renderTypes();renderRatings();renderLibrary();mountToggle();scanGlass();apply();select(config.wallpaperId);
})();
