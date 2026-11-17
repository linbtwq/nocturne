const external = new Map();

function openSyncedRelease(row) {
  history.replaceState(null,'',href(row));
  render();
}

function externalFallback(entry,error='') {
  const tracks=(entry.tracks??[]).map(track=>'<li><span>'+esc(track.title)+'</span><small>'+durationLabel(track.duration)+'</small></li>').join('');
  return '<a class="back-link" href="#">← Релизы</a><section class="release external-release">'+feedArt(entry)+
    '<div class="release-title"><span class="kicker">'+(entry.kind==='album'?'АЛЬБОМ':'ТРЕК')+'</span><h1>'+esc(entry.title)+'</h1><p>'+esc(entry.artist)+(entry.year?' · '+entry.year:'')+'</p>'+
    sourceLink(entry.url,sourceLabels[entry.provider])+'</div></section>'+
    (error?'<p class="error" role="status">'+esc(error)+'</p>':cloud()?.user?'<p class="muted" role="status">Загружаю оценки и рецензии…</p>':'<p><a href="#profile" class="primary link-button">Войти, чтобы оценить</a></p>')+
    (tracks?'<section class="quiet"><h2>Треклист</h2><ol class="import-tracks">'+tracks+'</ol></section>':'');
}
function loadExternal(path) {
  const target=document.querySelector('#external-release');
  if(!target)return;
  const [,provider,kind,id,country='RU']=path.split('/');
  if(!Object.hasOwn(sourceLabels,provider)||!['album','track'].includes(kind)||!id){
    target.innerHTML='<h1>Релиз не найден</h1><a href="#">К релизам →</a>';
    return;
  }
  if(!external.has(path))external.set(path,{});
  const state=external.get(path);
  const row=model.catalog.find(r=>r.provider===provider&&r.sourceId===id&&r.kind===kind);
  if(row&&!state.sync&&!state.error){openSyncedRelease(row);return}
  if(state.entry){
    target.innerHTML=externalFallback(state.entry,state.error);
    if(!cloud()?.user||state.sync||state.synced||state.error)return;
    state.sync=cloud().importRelease(state.entry).then(()=>{
      state.synced=true;
    }).catch(error=>{
      state.error=cloud().describeError(error);
    }).finally(()=>{
      state.sync=null;
      if(location.hash.slice(1)===path)loadExternal(path);
    });
    return;
  }
  if(state.error){
    target.innerHTML='<p role="status" class="error">'+esc(state.error)+'</p><a href="#">К релизам →</a>';
    return;
  }
  if(state.request)return;
  state.request=musicRequest(provider+'/'+encodeURIComponent(id),{kind,country}).then(entry=>{state.entry=entry})
    .catch(error=>{state.error=error.message})
    .finally(()=>{state.request=null;if(location.hash.slice(1)===path)loadExternal(path)});
}
render();
