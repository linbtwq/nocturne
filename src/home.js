const regions = {RU:'Россия',US:'США'};
const homeState = {region:'RU', feeds:new Map(), feedRequests:new Map(), feedErrors:new Map(),
  query:'', submittedQuery:'', results:null, searchRequest:null, searchError:''};
function feedArt(item) {
  const initials=item.title.trim().split(/\s+/u).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
  return '<div class="feed-art"><span aria-hidden="true">'+esc(initials)+'</span>'+artwork(item.cover,item.coverFallback)+'</div>';
}
function releaseGrid(items,showKind=false) {
  return '<div class="feed-grid">'+items.map(item=>'<a class="feed-card" href="'+externalHref(item)+'">'+feedArt(item)+
    '<strong>'+esc(item.title)+'</strong><span>'+esc(item.artist)+'</span>'+
    (showKind?'<span>'+(item.kind==='track'?'Трек':'Альбом')+'</span>':'')+'</a>').join('')+'</div>';
}
function ranking(items) {
  return '<ol class="feed-ranking">'+items.map((item,index)=>'<li><a href="'+externalHref(item)+'"><span class="rank">'+String(index+1).padStart(2,'0')+
    '</span>'+feedArt(item)+'<span><strong>'+esc(item.title)+'</strong><small>'+esc(item.artist)+'</small></span></a></li>').join('')+'</ol>';
}
function shelf(title,note,body) {
  return '<section class="feed-shelf"><div class="feed-heading"><h2>'+title+'</h2>'+note+'</div>'+body+'</section>';
}
function homeMusic() {
  const regionButtons=Object.entries(regions).map(([country,name])=>
    '<button type="button" data-feed-region="'+country+'" aria-pressed="'+(homeState.region===country)+'">'+name+'</button>'
  ).join('');
  return '<div class="music-home"><div class="browse-head"><div><h1>Релизы</h1><div class="region-switch" role="group" aria-label="Регион чарта">'+regionButtons+'</div></div><form id="home-music-search" class="browse-search">'+
    '<label for="home-music-query" class="visually-hidden">Артист, альбом или трек</label><input id="home-music-query" name="q" type="search" minlength="2" maxlength="180" required placeholder="Артист, альбом или трек" value="'+esc(homeState.query)+'"><button class="primary">Найти</button></form></div>'+
    '<div id="home-music-feed"></div></div>';
}
function paintHome() {
  const target=document.querySelector('#home-music-feed');
  if(!target)return;
  if(homeState.searchRequest||homeState.results||homeState.searchError){
    const items=homeState.results?.sources;
    const sections=items?Object.entries(items).filter(([,matches])=>matches.length).map(([provider,matches])=>shelf(sourceLabels[provider],'',releaseGrid(matches,true))).join(''):'';
    const unavailable=homeState.results?.unavailable.map(provider=>sourceLabels[provider])??[];
    target.innerHTML='<div class="feed-heading"><h2>Результаты поиска</h2>'+button('К подборкам','home-reset')+'</div>'+
      sections+
      (homeState.searchRequest?'<p role="status" class="muted">Ищу в музыкальных каталогах…</p>':
        homeState.searchError?'<p role="status" class="error">'+esc(homeState.searchError)+'</p>':
        sections?'':'<p class="muted">Ничего не найдено. Попробуй поискать по артисту или названию.</p>')+
      (homeState.results?.canExpand&&!homeState.searchRequest?button('Поискать в других каталогах','home-search-extra'):'')+
      (unavailable.length?'<p class="muted">Временно недоступны '+esc(unavailable.join(', '))+'.</p>':'');
    return;
  }
  const region=homeState.region;
  const feed=homeState.feeds.get(region);
  const latest=feed?.recent??[];
  const albums=feed?.albums??[];
  const tracks=feed?.tracks??[];
  const indie=feed?.indie??[];
  const fresh=latest.length?shelf('Новые релизы','<span>MusicBrainz · последние 30 дней</span>',releaseGrid(latest)):'';
  const chartSource=items=>'<span>Apple Music · '+regions[region]+(items[0]?.stale?' · последняя загрузка':'')+'</span>';
  const top=albums.length?shelf('Топ альбомов',chartSource(albums),releaseGrid(albums)):
    feed?shelf('Топ альбомов',chartSource(albums),'<div class="feed-empty"><p>Чарт альбомов временно недоступен.</p>'+button('Обновить','home-retry')+'</div>'):'';
  const indieShelf=indie.length?shelf('Независимая музыка','<span>Audius · в тренде</span>',releaseGrid(indie)):'';
  const tracksShelf=tracks.length?shelf('Топ треков',chartSource(tracks),ranking(tracks)):
    feed?shelf('Топ треков',chartSource(tracks),'<div class="feed-empty"><p>Чарт треков временно недоступен.</p>'+button('Обновить','home-retry')+'</div>'):'';
  const globalShelf=feed?.global?.length?shelf('Мировой чарт','<span>Deezer</span>',ranking(feed.global)):'';
  const reviews=reviewRows().slice(0,3);
  const community=shelf('Рецензии','<a href="#reviews">Все →</a>',reviews.length?reviewCards(reviews):
    '<div class="feed-empty">'+(cloud()&&!cloud().user?'<a href="#profile">Войти, чтобы читать рецензии →</a>':'<p class="muted">Рецензий пока нет. Открой релиз и напиши первую.</p>')+'</div>');
  const error=homeState.feedErrors.get(region);
  const status=error?'<div class="feed-empty"><p role="status">'+esc(error)+'</p>'+button('Обновить подборки','home-retry')+'</div>':
    !feed?'<div class="feed-loading" role="status">Загружаю релизы…</div>':'';
  target.innerHTML=status+'<div class="home-columns"><div>'+top+fresh+indieShelf+'</div><aside>'+tracksShelf+community+globalShelf+'</aside></div>';
}
function hydrateHome() {
  paintHome();
  const country=homeState.region;
  if(homeState.feeds.has(country)||homeState.feedRequests.has(country)||homeState.feedErrors.has(country))return;
  const request=musicRequest('discovery',{country}).then(feed=>homeState.feeds.set(country,feed))
    .catch(()=>homeState.feedErrors.set(country,'Не удалось обновить подборки. Проверь, запущен ли локальный API.'))
    .finally(()=>{homeState.feedRequests.delete(country);if(homeState.region===country)paintHome()});
  homeState.feedRequests.set(country,request);
}
document.addEventListener('input',event=>{
  if(event.target.id==='home-music-query')homeState.query=event.target.value;
});
async function runHomeSearch(query, extra=false) {
  homeState.searchRequest?.abort();
  const request=new AbortController();
  homeState.searchRequest=request;
  homeState.submittedQuery=query;
  if(!extra)homeState.results=null;
  homeState.searchError='';
  paintHome();
  try{
    const results=await musicRequest('search',{q:query,country:homeState.region,scope:extra?'extra':'primary'},request.signal);
    if(homeState.searchRequest===request)homeState.results=extra?
      {...results,sources:{...homeState.results.sources,...results.sources}}:results;
  }catch(error){
    if(!request.signal.aborted)homeState.searchError=error.message;
  }finally{
    if(homeState.searchRequest===request){homeState.searchRequest=null;paintHome()}
  }
}
document.addEventListener('submit',event=>{
  if(event.target.id!=='home-music-search')return;
  event.preventDefault();
  homeState.query=new FormData(event.target).get('q').trim();
  void runHomeSearch(homeState.query);
});
document.addEventListener('click',event=>{
  const regionButton=event.target.closest('[data-feed-region]');
  if(regionButton){
    const country=regionButton.dataset.feedRegion;
    if(country===homeState.region||!Object.hasOwn(regions,country))return;
    homeState.region=country;
    homeState.searchRequest?.abort();
    Object.assign(homeState,{searchRequest:null,results:null,searchError:''});
    document.querySelectorAll('[data-feed-region]').forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.feedRegion===country))
    );
    hydrateHome();
    return;
  }
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='home-search-extra')void runHomeSearch(homeState.submittedQuery,true);
  if(action==='home-retry'){
    homeState.feedErrors.delete(homeState.region);
    homeState.feeds.delete(homeState.region);
    hydrateHome();
  }
  if(action==='home-reset'){
    homeState.searchRequest?.abort();
    Object.assign(homeState,{searchRequest:null,results:null,searchError:'',query:''});
    document.querySelector('#home-music-query').value='';
    paintHome();
  }
});
