import { setTimeout as delay } from 'node:timers/promises';

const mb = 'https://musicbrainz.org/ws/2/';
const apple = 'https://itunes.apple.com/';
const deezer = 'https://api.deezer.com/';
const audius = 'https://api.audius.co/v1/';
const caa = 'https://coverartarchive.org/';
const appleCharts = 'https://rss.applemarketingtools.com/api/v2/';
const agent = 'NOCTURNE/0.1 (local music catalogue)';
export const providers = ['musicbrainz','apple','deezer','audius'];
export const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const cache = new Map();
const lastRegionalChart = new Map();
let mbQueue = Promise.resolve();
let nextMB = 0;

export class ApiError extends Error {
  constructor(status,message) { super(message); this.status=status; }
}
function endpoint(base,path,params={}) {
  const url = new URL(path,base);
  url.search = new URLSearchParams(params);
  return url.href;
}
function getJson(url) {
  const cached=cache.get(url);
  if(cached && cached.until>Date.now()) return cached.value;
  const request=async()=>{
    const response=await fetch(url,{headers:{'User-Agent':agent,Accept:'application/json'},signal:AbortSignal.timeout(8500)});
    if(!response.ok) throw new ApiError(response.status===404?404:502,'Источник вернул HTTP '+response.status+'.');
    const json=await response.json();
    if(json.error) throw new ApiError(json.error.code===800?404:502,'Источник отклонил запрос.');
    return json;
  };
  let value;
  if(url.startsWith(mb)){
    value=mbQueue.then(async()=>{
      await delay(Math.max(0,nextMB-Date.now()));
      nextMB=Date.now()+1050;
      return request();
    });
    mbQueue=value.catch(()=>{});
  }else value=request();
  if(cache.size>=200)cache.delete(cache.keys().next().value);
  cache.set(url,{until:Date.now()+5*60_000,value});
  value.catch(()=>{if(cache.get(url)?.value===value)cache.delete(url)});
  return value;
}
const credit = item => item['artist-credit']?.map(c=>(c.name??c.artist?.name??'')+(c.joinphrase??'')).join('');
const year = date => Number(String(date??'').slice(0,4)) || null;
const https = url => typeof url==='string' && /^https:\/\//.test(url) ? url : '';
export const storefront = country => /^[A-Z]{2}$/.test(country) ? country : 'US';
const duration = value => Number.isFinite(value)&&value>0?Math.round(value):null;
const mbCover = id => caa+'release/'+id+'/front-500';
const mbGroupCover = id => caa+'release-group/'+id+'/front-500';
function release(provider,id,title,artist,details={}){
  return {provider,id:String(id),kind:'album',title,artist:artist||'Неизвестный исполнитель',year:null,cover:'',url:'',genre:'',...details};
}
function mbRelease(r){
  return release('musicbrainz',r.id,r.title,credit(r),{
    year:year(r.date),country:r.country??'',format:r.media?.map(x=>x.format).filter(Boolean).join(' / ')??'',
    cover:r['cover-art-archive']?.front?mbCover(r.id):'',url:'https://musicbrainz.org/release/'+r.id,
    genre:r.genres?.sort((a,b)=>b.count-a.count)?.[0]?.name??'',
    group:r['release-group']?.['primary-type']??'',trackCount:r['track-count']??null
  });
}
function appleRelease(r){
  return release('apple',r.collectionId,r.collectionName,r.artistName,{
    year:year(r.releaseDate),cover:https(r.artworkUrl100),url:https(r.collectionViewUrl),storefront:r.country,
    genre:r.primaryGenreName??'',trackCount:r.trackCount??null
  });
}
function appleTrack(r){
  return release('apple',r.trackId,r.trackName,r.artistName,{
    kind:'track',year:year(r.releaseDate),cover:https(r.artworkUrl100),url:https(r.trackViewUrl),storefront:r.country,
    genre:r.primaryGenreName??'',duration:duration(r.trackTimeMillis)
  });
}
function deezerRelease(r){
  return release('deezer',r.id,r.title,r.artist?.name,{
    year:year(r.release_date),cover:https(r.cover_big||r.cover_medium),url:https(r.link),
    genre:r.genres?.data?.[0]?.name??'',trackCount:r.nb_tracks??null
  });
}
function deezerTrack(r){
  return release('deezer',r.id,r.title,r.artist?.name,{
    kind:'track',cover:https(r.album?.cover_medium),url:https(r.link),duration:duration(r.duration*1000)
  });
}
function audiusTrack(r){
  return release('audius',r.id,r.title,r.user?.name,{
    kind:'track',year:year(r.release_date),cover:https(r.artwork?.['480x480']||r.artwork?.['150x150']),
    url:r.permalink?.startsWith('/')?'https://audius.co'+r.permalink:'',
    genre:r.genre??'',duration:duration(r.duration*1000)
  });
}
export const search = {
  async musicbrainz(q) {
    const data=await getJson(endpoint(mb,'release',{query:q,limit:10,fmt:'json'}));
    const seen=new Set();
    return (data.releases??[]).flatMap(r=>{
      const group=r['release-group']?.id;
      const key=group??r.id;
      if(seen.has(key))return [];
      seen.add(key);
      return [{
        ...mbRelease(r),cover:mbCover(r.id),
        coverFallback:group?mbGroupCover(group):''
      }];
    });
  },
  async apple(q,country) {
    const [albums,tracks]=await Promise.allSettled(['album','song'].map(entity=>
      getJson(endpoint(apple,'search',{term:q,country,media:'music',entity,limit:6}))
    ));
    if(albums.status==='rejected'&&tracks.status==='rejected')throw albums.reason;
    return [
      ...(albums.value?.results??[]).filter(r=>r.wrapperType==='collection').map(appleRelease),
      ...(tracks.value?.results??[]).filter(r=>r.kind==='song').map(appleTrack)
    ];
  },
  async deezer(q) {
    const [albums,tracks]=await Promise.allSettled(['album','track'].map(kind=>
      getJson(endpoint(deezer,'search/'+kind,{q,limit:6}))
    ));
    if(albums.status==='rejected'&&tracks.status==='rejected')throw albums.reason;
    return [...(albums.value?.data??[]).map(deezerRelease),...(tracks.value?.data??[]).map(deezerTrack)];
  },
  async audius(q) {
    const data=await getJson(endpoint(audius,'tracks/search',{query:q,limit:8,app_name:'NOCTURNE'}));
    return (data.data??[]).slice(0,8).map(audiusTrack);
  }
};
export const details = {
  async musicbrainz(id) {
    const r=await getJson(endpoint(mb,'release/'+id,{inc:'recordings+artist-credits+genres',fmt:'json'}));
    const entry=mbRelease(r);
    if(!entry.cover && r['release-group']?.id) {
      entry.cover=mbGroupCover(r['release-group'].id);
    }
    entry.tracks=(r.media??[]).flatMap((medium,disc)=>(medium.tracks??[]).map((t,index)=>({
      id:t.id,title:t.title??t.recording?.title,artist:credit(t)||credit(t.recording??{})||entry.artist,
      disc:medium.position||disc+1,position:t.position||index+1,duration:duration(t.length??t.recording?.length)
    })));
    return entry;
  },
  async apple(id,country) {
    const data=await getJson(endpoint(apple,'lookup',{id,country,entity:'song',limit:200}));
    const r=data.results?.find(x=>x.wrapperType==='collection'&&String(x.collectionId)===id);
    if(!r)throw new ApiError(404,'Издание недоступно в выбранной стране Apple.');
    const entry=appleRelease(r);
    entry.tracks=data.results.filter(t=>t.kind==='song'&&String(t.collectionId)===id).map(t=>({
      id:String(t.trackId),title:t.trackName,artist:t.artistName||entry.artist,
      disc:t.discNumber||1,position:t.trackNumber,duration:duration(t.trackTimeMillis),
      url:https(t.trackViewUrl)
    }));
    return entry;
  },
  async deezer(id) {
    const r=await getJson(endpoint(deezer,'album/'+id));
    const entry=deezerRelease(r);
    const all=r.tracks?.data??[];
    for(let offset=all.length;offset<r.nb_tracks&&offset<500;) {
      const page=await getJson(endpoint(deezer,'album/'+id+'/tracks',{index:offset,limit:100}));
      if(!page.data?.length)break;
      all.push(...page.data);
      offset+=page.data.length;
    }
    entry.tracks=all.map((t,index)=>({
      id:String(t.id),title:t.title,artist:t.artist?.name||entry.artist,
      disc:t.disk_number||1,position:t.track_position||index+1,duration:duration(t.duration*1000),url:https(t.link)
    }));
    return entry;
  },
  async audius(id) {
    const data=await getJson(endpoint(audius,'tracks/'+id,{app_name:'NOCTURNE'}));
    if(!data.data?.id)throw new ApiError(404,'Трек не найден в Audius.');
    return audiusTrack(data.data);
  }
};

async function recentReleases() {
  const today = new Date().toISOString().slice(0,10);
  const since = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const query = 'date:['+since+' TO '+today+'] AND status:official AND primarytype:album AND format:"Digital Media"';
  const pages = await Promise.allSettled([0,100,200].map(offset =>
    getJson(endpoint(mb,'release',{query,offset,limit:100,fmt:'json'}))
  ));
  const seen = new Set();
  return pages.flatMap(page=>page.value?.releases??[])
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date??'') && r.date>=since && r.date<=today)
    .sort((a,b)=>b.date.localeCompare(a.date))
    .filter(r => {
      const key=r['release-group']?.id??r.id;
      if(seen.has(key))return false;
      seen.add(key);
      return true;
    })
    .slice(0,6)
    .map(r=>({...mbRelease(r),date:r.date,cover:mbCover(r.id)}));
}

async function regionalChart(country,kind){
  const key=country+':'+kind;
  const type=kind==='album'?'albums':'songs';
  const path=count=>country.toLowerCase()+'/music/most-played/'+count+'/'+type+'.json';
  const urls=[
    new URL(path(10),appleCharts).href,
    new URL(path(10),'https://rss.marketingtools.apple.com/api/v2/').href,
    new URL(path(50),appleCharts).href
  ];
  const results=await Promise.any(urls.map(async (url,index)=>{
    if(index)await delay(index*350);
    const data=await getJson(url);
    if(!data.feed?.results?.length)throw new ApiError(502,'Чарт Apple временно пуст.');
    return data.feed.results;
  })).catch(()=>null);
  if(!results){
    const previous=lastRegionalChart.get(key);
    return previous&&Date.now()-previous.at<86400000?
      previous.items.map(item=>({...item,stale:true})):[];
  }
  const items=results.slice(0,kind==='album'?6:10).map(r=>
    release('apple',r.id,r.name,r.artistName,{
      kind,storefront:country,cover:https(r.artworkUrl100),url:https(r.url),year:year(r.releaseDate)
    })
  );
  lastRegionalChart.set(key,{items,at:Date.now()});
  return items;
}

export async function discovery(country) {
  const [recent, albums, tracks, deezerTop, audiusTop] = await Promise.allSettled([
    recentReleases(),
    regionalChart(country,'album'),
    regionalChart(country,'track'),
    getJson(endpoint(deezer,'chart/0',{limit:8})),
    getJson(endpoint(audius,'tracks/trending',{limit:8,app_name:'NOCTURNE'}))
  ]);
  return {
    recent:recent.value??[],
    albums:albums.value??[],
    tracks:tracks.value??[],
    global:(deezerTop.value?.tracks?.data??[]).slice(0,6).map(deezerTrack),
    indie:(audiusTop.value?.data??[]).slice(0,6).map(audiusTrack)
  };
}


export async function getDeezerTrack(id) {
  return deezerTrack(await getJson(endpoint(deezer,'track/'+id)));
}
export async function getAppleTrack(id,country) {
  const data=await getJson(endpoint(apple,'lookup',{id,country}));
  const track=data.results?.find(r=>r.kind==='song'&&String(r.trackId)===id);
  if(!track)throw new ApiError(404,'Трек недоступен в выбранной стране Apple.');
  return appleTrack(track);
}
