import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { ApiError, details, discovery, getAppleTrack, getDeezerTrack, providers, search, storefront, uuid } from './server/music-sources.mjs';

const port = Number(process.env.NOCTURNE_PORT || 8787);
const files = new Set(['index.html','src/styles/base.css','src/styles/discovery.css',
  'src/app.js','src/music.js','src/firebase.js','src/music-api.js','src/home.js','src/external-release.js','assets/cloudscape.png']);
const mime={html:'text/html',css:'text/css',js:'text/javascript',png:'image/png'};
function send(res,status,payload){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(payload));
}
createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){
    send(res,403,{error:'Доступ только с localhost.'});return;
  }
  if(origin){
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
  }
  if(req.method!=='GET'){send(res,405,{error:'Поддерживается GET.'});return}
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(files.has(file)){
      const content=await readFile(new URL(file,import.meta.url));
      res.writeHead(200,{'Content-Type':mime[file.split('.').at(-1)],'Cache-Control':'no-cache'});
      res.end(content);
      return;
    }
    const country=storefront(url.searchParams.get('country'));
    if(url.pathname==='/api/music/discovery'){
      const feed=await discovery(country==='US'?'US':'RU');
      const available=Object.values(feed).some(items=>items.length);
      send(res,available?200:502,available?feed:{error:'Внешние подборки временно недоступны.'});
      return;
    }
    if(url.pathname==='/api/music/search'){
      const q=url.searchParams.get('q')?.trim();
      if(!q||q.length<2||q.length>180)throw new ApiError(400,'Введи от 2 до 180 символов.');
      const scope=url.searchParams.get('scope');
      const extras=['apple','musicbrainz','audius'];
      if(scope!=='extra'){
        try{
          const items=await search.deezer(q,country);
          if(items.length){send(res,200,{sources:{deezer:items},unavailable:[],canExpand:true});return}
        }catch{}
      }
      const result=await Promise.allSettled(extras.map(p=>search[p](q,country)));
      const sources=Object.fromEntries(extras.map((p,i)=>[p,result[i].status==='fulfilled'?result[i].value:[]]));
      const unavailable=extras.filter((p,i)=>result[i].status==='rejected');
      send(res,unavailable.length===extras.length?502:200,{sources,unavailable,canExpand:false,error:'Дополнительные каталоги временно недоступны.'});
      return;
    }
    const [,provider,id]=url.pathname.match(/^\/api\/music\/(musicbrainz|apple|deezer|audius)\/([a-z0-9-]+)$/i)??[];
    if(!provider || !providers.includes(provider))throw new ApiError(404,'Страница не найдена.');
    const valid=provider==='musicbrainz'?uuid.test(id):provider==='audius'?/^[a-zA-Z0-9]{3,30}$/.test(id):/^\d{1,16}$/.test(id);
    if(!valid)throw new ApiError(400,'Некорректный идентификатор.');
    if(provider==='deezer'&&url.searchParams.get('kind')==='track'){
      send(res,200,await getDeezerTrack(id));
      return;
    }
    if(provider==='apple'&&url.searchParams.get('kind')==='track'){
      send(res,200,await getAppleTrack(id,country));
      return;
    }
    send(res,200,await details[provider](id,country));
  }catch(error){
    send(res,error.status||502,{error:error.status?error.message:'Источник временно недоступен. Попробуй ещё раз.'});
  }
}).listen(port,'127.0.0.1',()=>console.log('NOCTURNE: http://127.0.0.1:'+port));
