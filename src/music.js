db.music ??= {
  catalog:[],
  profiles:[{name:'Мой профиль',scores:{},reviews:{},collection:[],following:[]}],active:0
};
let model=db.music;
const guest={name:"Гость",scores:{},reviews:{},collection:[],following:[]};
const cloud=()=>window.nocturneFirebase;
const profileIndex=key=>cloud()?model.profiles.findIndex(p=>p.uid===key):Number(key);
const current=()=>model.profiles[model.active]??guest;
const lookup=id=>model.catalog.find(r=>r.id===Number(id));
const href=r=>'#'+r.kind+'/'+r.id;
const scoreLabel=n=>n==null?'—':fmt(n);
const artistHref=name=>'#artist/'+encodeURIComponent(name);
const artistLink=name=>'<a class="artist-link" href="'+esc(artistHref(name))+'">'+esc(name)+'</a>';
const cover=r=>{
  const image=r.cover||lookup(r.album)?.cover;
  const safeImage=typeof image==='string'&&/^https?:\/\//i.test(image);
  return '<div class="cover art-'+r.id%3+'" aria-hidden="true">'+(safeImage?'<img src="'+esc(image)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span>◉</span>')+'</div>';
};
const totals=id=>model.profiles.map(p=>p.scores[id]?.total).filter(Number.isFinite);
const average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
const kindLabel=r=>r.kind==='album'?'Альбом':'Трек';
const records=items=>'<div class="record-grid">'+items.map(r=>{
  const votes=totals(r.id);
  return '<article class="record"><a class="record-cover" href="'+href(r)+'" aria-label="'+esc(r.title)+'">'+cover(r)+'<span class="record-score" aria-label="Средний балл">'+scoreLabel(average(votes))+'</span></a><small>'+kindLabel(r)+' · '+esc(r.genre)+'</small><h3><a href="'+href(r)+'">'+esc(r.title)+'</a></h3><p>'+artistLink(r.artist)+'</p></article>';
}).join('')+'</div>';
function releasePage(r){
  const p=current(), value=p.scores[r.id];
  const votes=model.profiles.map(x=>x.scores[r.id]?.total).filter(Number.isFinite);
  const mean=votes.length?votes.reduce((a,b)=>a+b,0)/votes.length:null;
  const related=r.kind==='album'?'<h2>Треклист</h2>'+model.catalog.filter(x=>x.album===r.id).sort((a,b)=>(a.trackOrder??0)-(b.trackOrder??0)).map((x,i)=>'<p><a href="'+href(x)+'">'+(i+1)+' · '+esc(x.title)+' ↗</a> <small>'+durationLabel(x.duration)+'</small></p>').join(''):(lookup(r.album)?'<p><a href="'+href(lookup(r.album))+'">Из альбома «'+esc(lookup(r.album).title)+'» ↗</a></p>':'');

  return '<div class="release-page"><section class="release">'+cover(r)+'<div class="release-title"><span class="kicker">'+(r.kind==='album'?'АЛЬБОМ':'ТРЕК')+'</span><h1>'+esc(r.title)+'</h1><p>'+artistLink(r.artist)+' · '+(r.year??'Год неизвестен')+' · '+esc(r.genre)+'</p>'+sourceLink(r.sourceUrl,sourceLabels[r.provider]??'Источник')+'</div><div class="verdict"><span class="kicker">СООБЩЕСТВО</span><div class="score">'+scoreLabel(mean)+'</div><small>Голосов: '+votes.length+'</small></div></section><div class="release-columns"><div><section class="quiet">'+related+button(p.collection.includes(r.id)?'Убрать из коллекции':'В коллекцию','music-collect',r.id)+'</section><h2>Рецензии</h2>'+reviewCards(reviewRows().filter(x=>x.id===r.id))+'</div><form id="music-score" data-id="'+r.id+'">'+rubric(r.kind,value?.details)+'<section class="review-box"><label>Мой итоговый балл<input type="number" name="rate" min="1" max="10" step=".1" value="'+(value?.total??'')+'"></label><label>Моя рецензия<textarea name="review" maxlength="12000">'+esc(p.reviews[r.id])+'</textarea></label><button class="primary">Сохранить</button><p class="error" role="alert"></p></section></form></div></div>';
}
function reviewRows(){
  return model.profiles.flatMap((p,author)=>Object.entries(p.reviews).map(([id,body])=>({
    author,id:Number(id),body,score:p.scores[id]?.total,updatedAt:p.scores[id]?.updatedAt??0
  }))).sort((a,b)=>b.updatedAt-a.updatedAt);
}
function reviewCards(rows){
  return rows.map(x=>'<article class="entry"><div class="review-heading"><h3><a href="#review/'+encodeURIComponent(model.profiles[x.author].uid??x.author)+'/'+x.id+'">'+esc(lookup(x.id).title)+'</a></h3>'+(Number.isFinite(x.score)?'<span class="review-score">'+scoreLabel(x.score)+'</span>':'')+'</div><p>'+esc(x.body.slice(0,180))+'</p><a href="#profile/'+encodeURIComponent(model.profiles[x.author].uid??x.author)+'">'+esc(model.profiles[x.author].name)+'</a></article>').join('')||'<p class="muted">Рецензий пока нет. <a href="#">Выбрать релиз ↗</a></p>';
}
function authPanel(){
  return '<h1>Профиль</h1><form id="firebase-auth" class="quiet"><label>Имя для регистрации<input name="name" maxlength="40" autocomplete="nickname"></label><label>Почта<input type="email" name="email" required autocomplete="email"></label><label>Пароль<input type="password" name="password" minlength="6" required autocomplete="current-password"></label><div class="actions"><button class="primary" value="login">Войти</button><button value="register">Зарегистрироваться</button>'+button('Войти через Google','firebase-google')+'</div><p id="firebase-status" role="status"></p></form>';
}
function profiles(index){
  const p=model.profiles[index];
  if(index===-1&&cloud()&&!cloud().user)return authPanel();
  if(!p)return '<h1>Профиль не найден</h1>';
  const own=index===model.active;
  const stats=['album','track'].map(kind=>{
    const values=Object.entries(p.scores).filter(([id,v])=>lookup(id)?.kind===kind&&Number.isFinite(v.total)).map(([,v])=>v.total);
    return '<div class="entry"><strong>'+(kind==='album'?'Альбомы':'Треки')+'</strong><p>'+values.length+' оценок · средний балл '+scoreLabel(values.length?values.reduce((a,b)=>a+b,0)/values.length:null)+'</p></div>';
  }).join('');
  return '<h1>'+esc(p.name)+'</h1><div class="actions">'+(own?'':button(current().following.includes(index)?'Отписаться':'Подписаться','music-follow',index))+'</div>'+(cloud()?(own?'<div class="quiet">'+button('Выйти','firebase-logout')+' <span id="firebase-status" role="status"></span></div>':''):'<div class="quiet"><label>Активный локальный профиль<select id="music-user">'+options(model.profiles.map(x=>x.name),model.active)+'</select></label><form id="music-profile"><label>Имя нового профиля<input name="name" required maxlength="40"></label><button>Создать профиль</button></form></div>')+'<h2>Статистика</h2><div class="grid">'+stats+'</div><h2>Коллекция</h2>'+(p.collection.length?records(p.collection.map(lookup)):'<p>Коллекция пуста.</p>')+'<h2>Рецензии</h2>'+reviewCards(reviewRows().filter(x=>x.author===index));
}
let chartKind='album',chartMethod='bayes';
function chartRows(){
  const rows=model.catalog.filter(r=>r.kind===chartKind).flatMap(r=>{
    const scores=model.profiles.map(p=>p.scores[r.id]?.total).filter(Number.isFinite);
    return scores.length?[{r,n:scores.length,sum:scores.reduce((a,b)=>a+b,0)}]:[];
  });
  const total=rows.reduce((n,x)=>n+x.n,0);
  const prior=total?rows.reduce((s,x)=>s+x.sum,0)/total:0;
  return rows.filter(x=>chartMethod!=='threshold'||x.n>=5).map(x=>({...x,score:chartMethod==='bayes'?(x.sum+10*prior)/(x.n+10):x.sum/x.n})).sort((a,b)=>b.score-a.score||b.n-a.n||a.r.id-b.r.id);
}
function chartTable(){
  document.querySelector('#music-chart').innerHTML='<div class="scroll"><table><thead><tr><th>#</th><th>Релиз</th><th>Голосов</th><th>Среднее</th><th>Рейтинг</th></tr></thead><tbody>'+chartRows().map(({r,n,sum,score},i)=>'<tr><td>'+(i+1)+'</td><td><a href="'+href(r)+'">'+esc(r.title)+'</a></td><td>'+n+'</td><td>'+fmt(sum/n)+'</td><td>'+fmt(score)+'</td></tr>').join('')+'</tbody></table></div>'+(chartRows().length?'':'<p>Для этого чарта пока нет оценок. <a href="#catalog">Выбрать релиз ↗</a></p>');
}
function catalogRows(){
  const q=document.querySelector('#music-query').value.toLowerCase().trim(), k=document.querySelector('#music-kind').value;
  const found=model.catalog.filter(r=>(!k||r.kind===k)&&[r.title,r.artist,r.genre,r.year].join(' ').toLowerCase().includes(q));
  document.querySelector('#music-results').innerHTML=found.length?records(found):'<p>Совпадений нет.</p>';
}
function musicView(path){
  const [page,raw,second]=path.split('/');
  const r=lookup(raw);
  let body='';
  if(page==='release')body='<div id="external-release"><p role="status" class="muted">Загружаю релиз…</p></div>';
  else if(page==='album'||page==='track')body=r&&r.kind===page?releasePage(r):'<h1>Релиз не найден</h1>';
  else if(page==='catalog')body='<div class="section-head"><h1>Каталог</h1>'+button('Добавить вручную','music-add')+'</div><div class="filters"><input id="music-query" type="search" placeholder="Релиз, артист или жанр" aria-label="Поиск по каталогу"><select id="music-kind" aria-label="Тип"><option value="">Всё</option><option value="album">Альбомы</option><option value="track">Треки</option></select></div><div id="music-results"></div>';
  else if(page==='charts')body='<h1>Чарты</h1><div class="filters"><select id="chart-kind" aria-label="Тип релиза"><option value="album">Альбомы</option><option value="track">Треки</option></select><select id="chart-method" aria-label="Формула"><option value="bayes">С поправкой на число голосов</option><option value="mean">Среднее</option><option value="threshold">Среднее от 5 голосов</option></select><a href="#lab">Сравнение формул ↗</a></div><div id="music-chart"></div>';
  else if(page==='artist'){
    let name='';
    try{name=decodeURIComponent(raw??'')}catch{}
    const releases=model.catalog.filter(r=>r.artist===name);
    body=releases.length?'<h1>'+esc(name)+'</h1>'+records(releases):'<h1>Артист не найден</h1>';
  }
  else if(page==='profile')body=profiles(raw===undefined?model.active:profileIndex(raw));
  else if(page==='reviews'||page==='feed')body='<h1>'+(page==='feed'?'Лента подписок':'Рецензии')+'</h1>'+reviewCards(reviewRows().filter(x=>page!=='feed'||current().following.includes(x.author)));
  else if(page==='review'){
    const item=lookup(second),p=model.profiles[profileIndex(raw)],content=p?.reviews[Number(second)];
    body=item&&content?'<article class="quiet"><span class="kicker">РЕЦЕНЗИЯ</span><h1>'+esc(item.title)+'</h1><a href="#profile/'+encodeURIComponent(model.profiles[profileIndex(raw)].uid??raw)+'">'+esc(p.name)+'</a> · <a href="'+href(item)+'">К релизу ↗</a><blockquote>'+esc(content)+'</blockquote></article>':'<h1>Рецензия не найдена</h1>';
  } else {
    body=homeMusic();
  }
  app.innerHTML=(cloud()?.readError?'<p class="error" role="status">'+esc(cloud().readError)+'</p>':'')+body;
  if(page==='release')loadExternal(path);
  if(document.querySelector('#home-music-feed'))hydrateHome();
  if(page==='catalog'){
    if(raw==='album'||raw==='track')document.querySelector('#music-kind').value=raw;
    catalogRows();
  }
  if(page==='charts'){
    document.querySelector('#chart-kind').value=chartKind;
    document.querySelector('#chart-method').value=chartMethod;
    chartTable();
  }
  const f=document.querySelector('#music-score');
  if(f)refreshScore(f);
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');
  if(!b)return;
  const id=Number(b.dataset.id),action=b.dataset.action,p=current();
  if(action==='firebase-logout'){
    await cloudAction(b,()=>cloud().logout());
    return;
  }
  if(action==='firebase-google'){
    await cloudAction(b,()=>cloud().loginWithGoogle());
    return;
  }
  if(cloud()&&!cloud().user&&['music-collect','music-follow','music-add'].includes(action)){
    go('profile');
    return;
  }
  if(action==='music-collect'){
    if(cloud()){await cloudAction(b,()=>cloud().toggleCollection(id));return}
    p.collection=p.collection.includes(id)?p.collection.filter(x=>x!==id):[...p.collection,id];
    save();
  }
  if(action==='music-follow'){
    if(cloud()){await cloudAction(b,()=>cloud().toggleFollow(model.profiles[id].uid));return}
    p.following=p.following.includes(id)?p.following.filter(x=>x!==id):[...p.following,id];
    save();
  }
  if(action==='music-add'){
    editor.innerHTML='<form id="music-release"><div class="section-head"><h2>Новый релиз</h2>'+button('Закрыть','close')+'</div><label>Тип<select name="kind"><option value="album">Альбом</option><option value="track">Трек</option></select></label><label>Название<input name="title" maxlength="100" required></label><label>Артист<input name="artist" maxlength="100" required></label><label>Жанр<input name="genre" maxlength="50" required></label><label>Год<input type="number" min="1850" max="2100" name="year" required></label><label>Альбом для трека<select name="album"><option value="0">Отдельный трек</option>'+model.catalog.filter(x=>x.kind==='album').map(x=>'<option value="'+x.id+'">'+esc(x.artist+' · '+x.title)+'</option>').join('')+'</select></label><p class="error"></p><button class="primary">Добавить</button></form>';
    editor.showModal();
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='music-query'||e.target.id==='music-kind')catalogRows();
  if(e.target.id==='chart-kind'){chartKind=e.target.value;chartTable()}
  if(e.target.id==='chart-method'){chartMethod=e.target.value;chartTable()}
  if(e.target.id==='music-user'){model.active=Number(e.target.value);go('profile');save()}
});
document.addEventListener('submit',async e=>{
  const f=e.target,d=new FormData(f),p=current();
  if(f.id==='firebase-auth'){
    await cloudAction(e.submitter,()=>cloud().authenticate(d,e.submitter?.value==='register'));
    return;
  }
  if(f.id==='music-score'){
    const id=f.dataset.id,total=d.get('rate');
    const score={total:total===''?null:Number(total),details:readScores(f)};
    const review=String(d.get('review')).trim();
    if(cloud()){
      if(!cloud().user){go('profile');return}
      await cloudAction(e.submitter,()=>cloud().rate(Number(id),score,review));
      return;
    }
    p.scores[id]=score;
    if(review)p.reviews[id]=review;else delete p.reviews[id];
    save();
  }
  if(f.id==='music-profile'){
    const name=String(d.get('name')).trim();
    if(!name)return;
    model.profiles.push({name,scores:{},reviews:{},collection:[],following:[]});
    model.active=model.profiles.length-1;go('profile');save();
  }
  if(f.id==='music-release'){
    const title=d.get('title').trim(),artist=d.get('artist').trim(),genre=d.get('genre').trim(),kind=d.get('kind');
    if(!title||!artist||!genre){f.querySelector('.error').textContent='Заполни название, артиста и жанр.';return}
    const r={id:Math.max(0,...model.catalog.map(x=>x.id))+1,title,artist,genre,kind,year:Number(d.get('year')),album:kind==='track'?Number(d.get('album')):0};
    if(cloud()){
      await cloudAction(e.submitter,async()=>{
        await cloud().addRelease(r);
        editor.close();
        go(href(r).slice(1));
      });
      return;
    }
    model.catalog.push(r);editor.close();go(href(r).slice(1));save();
  }
});
async function cloudAction(button,action){
  if(!button||button.disabled)return;
  button.disabled=true;
  let status=button.closest('form')?.querySelector('[role=status],.error')??document.querySelector('#firebase-status');
  if(!status){
    status=document.createElement('p');
    status.setAttribute('role','status');
    button.after(status);
  }
  status.textContent='';
  try{await action()}
  catch(error){status.textContent=cloud().describeError(error)}
  finally{button.disabled=false}
}
