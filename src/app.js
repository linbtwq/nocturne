const statuses=['Идея','В работе','Проверено','Готово'];
const priorities=['Высокий','Средний','Низкий'];
const seeds=[
['Концепция','Гибрид музыкального каталога и социальной сети.','Описать основной сценарий от поиска релиза до первой оценки.',''],
['Каталог музыки','Широкая база с гибридным импортом и ручным добавлением.','Сопоставить три издания одного релиза и определить правила дублей.','1,13'],
['Страница альбома','Обложка, метаданные, треклист, оценка альбома и рецензии.','Собрать макет с оценкой альбома и ссылками на треки.','2,5,12'],
['Страница трека','Отдельная страница песни с собственной оценкой и связями с релизами.','Пройти сценарий перехода из треклиста к оценке песни.','2,5,12'],
['Оценки','Альбом и трек оцениваются отдельно по шкале 1,0–10,0.','Проверить границы шкалы, шаг 0,1 и изменение оценки.','1'],
['Рецензии','Текстовые отзывы к альбомам и трекам.','Описать сценарий от черновика до публикации и редактирования.','5,9'],
['Рейтинги','Отдельные чарты альбомов и треков.','Определить поведение чартов при равном балле и отсутствии голосов.','2,11'],
['Статистика','История оценок и распределение баллов по типам объектов.','Определить показатели профиля и проверить расчёт на пяти оценках.','5,9'],
['Профили','Профиль пользователя, его оценки, рецензии и коллекции.','Описать поля профиля и настройки видимости коллекций.','1,13'],
['Социальные функции','Коллекции, подписки и лента активности.','Составить последовательность событий от подписки до записи в ленте.','9'],
['Алгоритм рейтинга','Собственная формула с отдельно настраиваемыми параметрами для релизов и треков.','Сравнить формулы на редких и массовых релизах в лаборатории.','5'],
['Дизайн','Главная в collage/asymmetric, внутренние страницы в Dark Editorial × Underground Webzine.','Сопоставить коллаж главной со спокойным макетом альбома, трека и рецензии.','1'],
['Техническая реализация','Модель каталога, хранение оценок и связь с социальным слоем.','Набросать связи исполнитель → издание → трек и пользователь → оценка.','1']
];
const initial={items:seeds.map(([title,brief,next,deps],i)=>({id:i+1,title,brief,next,deps:deps?deps.split(',').map(Number):[],status:0,priority:[0,1,4,10,12].includes(i)?0:1,approved:true,decision:'',notes:'',result:''})),journal:[],decisions:[],demo:{rates:{},reviews:{},saved:[]}};
const key='nocturne-web-v1';let db;try{db=JSON.parse(localStorage.getItem(key))||initial}catch{db=initial}
db.demo.criteria ??= {};
const app=document.querySelector('#app'), editor=document.querySelector('#editor');
const views=[['','Главная'],['catalog','Каталог'],['charts','Чарты'],['reviews','Рецензии'],['feed','Лента']];
const studioViews=[['plan','План'],['focus','Одна задача'],['lab','Формулы'],['decisions','Решения'],['journal','Журнал']];
const byId=id=>db.items.find(item=>item.id===id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(x,d=1)=>x.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
const options=(values,selected)=>values.map((v,i)=>'<option value="'+i+'" '+(i===selected?'selected':'')+'>'+esc(v)+'</option>').join('');
const go=view=>location.hash=view;
const button=(label,action,id='',cls='')=>'<button type="button" class="'+cls+'" data-action="'+action+'" data-id="'+id+'">'+label+'</button>';
const filters={q:'',status:'',priority:'',approval:''};
function save(message){if(message)db.journal.unshift({message,at:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(db));render()}
const stamp=at=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Kyiv'}).format(new Date(at));
const blocked=i=>i.deps.some(id=>byId(id)?.status!==3);
const nextItem=()=>db.items.filter(i=>i.approved&&i.status<3&&i.next.trim()&&!blocked(i)).sort((a,b)=>a.priority-b.priority||b.status-a.status||a.id-b.id)[0];
function badges(i){return '<span class="badge '+(i.status>=2?'ok':'')+'">'+statuses[i.status]+'</span><span class="badge">'+priorities[i.priority]+' приоритет</span>'+(!i.approved?'<span class="badge">Ждёт подтверждения</span>':blocked(i)?'<span class="badge">Есть зависимости</span>':'')}
function focus(){const i=nextItem();return '<div class="kicker accent">ОДНА СЛЕДУЮЩАЯ ЗАДАЧА</div>'+(i?'<h2>'+esc(i.title)+'</h2><p>'+esc(i.next)+'</p>'+button('Открыть задачу','edit',i.id,'primary'):'<p>Сейчас нет доступных задач. Проверь зависимости и следующие шаги в плане.</p>')}
function plan(){
const done=db.items.filter(i=>i.status===3).length;
app.innerHTML='<div class="hero"><section class="poster"><div class="kicker">МУЗЫКАЛЬНАЯ ПЛАТФОРМА / РАБОЧИЙ КАБИНЕТ</div><h1>NOCTURNE</h1><p>Каталог, оценки и музыкальное сообщество. Готово '+done+' из '+db.items.length+' разделов.</p></section><section class="focus">'+focus()+'</section></div><div class="section-head"><h2>Дорожная карта</h2>'+button('+ Новая идея','new','','primary')+'</div><div class="filters"><input type="search" id="q" aria-label="Поиск по дорожной карте" placeholder="Поиск по задачам и заметкам" value="'+esc(filters.q)+'"><select id="status" aria-label="Статус"><option value="">Все статусы</option>'+options(statuses,Number(filters.status||-1))+'</select><select id="priority" aria-label="Приоритет"><option value="">Все приоритеты</option>'+options(priorities,Number(filters.priority||-1))+'</select><select id="approval" aria-label="Подтверждение"><option value="">Все записи</option><option value="yes">Подтверждённые</option><option value="no">Ждут подтверждения</option></select></div><div id="rows"></div>';
document.querySelector('#approval').value=filters.approval;rows();
}
function rows(){const found=db.items.filter(i=>[i.title,i.brief,i.notes,i.next,i.decision,i.result].join(' ').toLowerCase().includes(filters.q.trim().toLowerCase())&&(filters.status===''||i.status===Number(filters.status))&&(filters.priority===''||i.priority===Number(filters.priority))&&(filters.approval===''||i.approved===(filters.approval==='yes')));
document.querySelector('#rows').innerHTML=found.map(i=>'<article class="card"><span class="num">'+String(i.id).padStart(2,'0')+'</span><div><h3>'+esc(i.title)+'</h3><p class="muted">'+esc(i.brief)+'</p>'+badges(i)+'</div>'+button('Открыть','edit',i.id)+'</article>').join('')||'<p class="muted">Совпадений нет.</p>'}
function openItem(id){const i=byId(id)||{title:'',brief:'',next:'',deps:[],status:0,priority:1,decision:'',notes:'',result:'',approved:false};const field=(name,title,tag='textarea')=>'<label>'+title+(tag==='textarea'?'<textarea name="'+name+'">'+esc(i[name])+'</textarea>':'<input required name="'+name+'" value="'+esc(i[name])+'">')+'</label>';
editor.innerHTML='<form id="item-form" data-id="'+(id||'')+'"><div class="section-head"><h2>'+(id?esc(i.title):'Новая идея')+'</h2>'+button('Закрыть','close')+'</div>'+badges(i)+field('title','Название','input')+field('brief','Описание')+'<div class="grid"><label>Статус<select name="status" '+(!i.approved?'disabled':'')+'>'+options(statuses,i.status)+'</select></label><label>Приоритет<select name="priority">'+options(priorities,i.priority)+'</select></label></div><fieldset><legend>Зависимости</legend><div class="checks">'+db.items.filter(x=>x.id!==id).map(x=>'<label><input type="checkbox" name="deps" value="'+x.id+'" '+(i.deps.includes(x.id)?'checked':'')+'> '+esc(x.title)+'</label>').join('')+'</div></fieldset>'+field('decision','Решения')+field('notes','Заметки')+field('next','Следующий конкретный шаг')+field('result','Результат проверки')+'<p class="error" role="alert"></p><div class="actions"><button class="primary">Сохранить</button>'+(id&&!i.approved?'<button name="confirm" value="yes">Подтвердить идею и сохранить</button>':'')+'</div></form>';editor.showModal()}
function decisions(){app.innerHTML='<span class="kicker">ПРОЕКТНЫЕ РЕШЕНИЯ</span><h1>Решения</h1><p class="muted">Фиксируй контекст, выбор и его статус.</p>'+button('+ Добавить решение','decision','','primary')+db.decisions.map(d=>'<article class="entry"><h3>'+esc(d.title)+'</h3><span class="badge">'+esc(d.type)+'</span><span class="badge '+(d.approved?'ok':'')+'">'+(d.approved?'Подтверждено':'Предложение')+'</span><p>'+esc(d.text)+'</p><small>'+stamp(d.at)+'</small><div class="actions">'+button('Редактировать','decision',d.id)+(!d.approved?button('Подтвердить','approve-decision',d.id):'')+'</div></article>').join('')}
function openDecision(id){const d=db.decisions.find(x=>x.id===id);editor.innerHTML='<form id="decision-form" data-id="'+(id||'')+'"><div class="section-head"><h2>Решение</h2>'+button('Закрыть','close')+'</div><label>Название<input name="title" required value="'+esc(d?.title)+'"></label><label>Тип<select name="type">'+options(['Архитектура','Дизайн','Алгоритм рейтинга'],d?['Архитектура','Дизайн','Алгоритм рейтинга'].indexOf(d.type):0)+'</select></label><label>Контекст и решение<textarea name="text" required>'+esc(d?.text)+'</textarea></label><button class="primary">Сохранить предложение</button></form>';editor.showModal()}
const cases={albums:[['Редкий релиз',3,9.6],['Культовый альбом',120,8.8],['Массовый релиз',850,8.3],['Без оценок',0,0]],tracks:[['Редкий трек',2,10],['Любимый трек фанатов',36,9.1],['Популярный сингл',540,8.4],['Без оценок',0,0]]};
let labState={kind:'albums',m:20,c:7,a:0.35,n:5};
function calculate(v,r,{m,c,a,n}){return v?[r,(v*r+m*c)/(v+m),r-a/Math.sqrt(v),v>=n?r:null]:[null,null,null,null]}
function lab(){app.innerHTML='<span class="kicker">ЛАБОРАТОРИЯ РЕЙТИНГА</span><h1>Сравнение формул</h1><p class="muted">Демонстрационные данные. Меняй параметры, чтобы увидеть, как меняется порядок позиций.</p><div class="grid"><label>Тип объектов<select id="kind"><option value="albums">Альбомы</option><option value="tracks">Треки</option></select></label>'+[['m','Вес среднего по каталогу',0,10000,1],['c','Среднее по каталогу',1,10,.1],['a','Сила штрафа',0,5,.05],['n','Порог голосов',1,10000,1]].map(([k,t,min,max,step])=>'<label>'+t+'<input type="number" id="'+k+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+labState[k]+'"></label>').join('')+'</div><div id="comparison"></div>'+button('Сохранить параметры как предложение','lab-proposal');document.querySelector('#kind').value=labState.kind;comparison()}
function compareRubric() {
  const weights=[0,.2,.35];
  const examples=[['Сильная база',9,6],['Сильная атмосфера',7.5,9.5],['Ровная оценка',8,8]];
  return '<section class="rubric"><h2>Из критериев в итоговый балл</h2><p class="muted">Вес атмосферы влияет на итог одного слушателя. Ниже сравниваются формулы общего чарта.</p><div class="scroll"><table><thead><tr><th>Сценарий</th><th>База</th><th>Атмосфера</th><th>0%</th><th>20% · предложение</th><th>35%</th></tr></thead><tbody>'+examples.map(([title,base,mood])=>'<tr><td>'+title+'</td><td>'+fmt(base)+'</td><td>'+fmt(mood)+'</td>'+weights.map(w=>'<td>'+fmt(estimate({text:base,form:base,style:base,voice:base,mood},w))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>';
}
function comparison(){const target=document.querySelector('#comparison');const scenario=cases[labState.kind].map(([name,v,r])=>({name,v,r,s:calculate(v,r,labState)}));const labels=['Среднее','Байесовское','Штраф за малую выборку','Среднее с порогом'];target.innerHTML=compareRubric()+'<h2>Место в общем чарте</h2><div class="scroll"><table><thead><tr><th>Объект</th><th>Голосов</th>'+labels.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+scenario.map(row=>'<tr><td>'+row.name+'</td><td>'+row.v+'</td>'+row.s.map(s=>'<td>'+(s===null?'—':fmt(s,2))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><div class="grid">'+labels.map((x,i)=>'<section class="entry"><strong>'+x+'</strong><ol>'+scenario.filter(r=>r.s[i]!==null).sort((a,b)=>b.s[i]-a.s[i]).map(r=>'<li>'+r.name+'</li>').join('')+'</ol></section>').join('')+'</div><p class="muted">R — средняя оценка, v — число голосов. Байесовская формула (v×R + m×C)/(v+m) приближает редкие оценки к среднему по каталогу. Штраф R − a/√v понижает балл при малой выборке. Порог пропускает в чарт только позиции с v ≥ n.</p>'}
const scoring = {
  text: ['Текст и образы', 'Какие строки, образы или формулировки делают работу сильнее?'],
  form: ['Движение трека', 'Как работают вступление, развитие, повторы и финал?'],
  style: ['Реализация стиля', 'Насколько убедительно сошлись звук, аранжировка и подача?'],
  voice: ['Почерк', 'По каким решениям узнаётся артист?'],
  mood: ['Атмосфера', 'Какое ощущение остаётся после прослушивания и насколько оно сильное?']
};
function rubricEntry(key, page) {
  return key==='form' && page==='album'
    ? ['Драматургия альбома', 'Что дают порядок треков, переходы, контрасты и финал?']
    : scoring[key];
}
function estimate(scores, moodWeight=.2) {
  const base = Object.keys(scoring).filter(key=>key!=='mood' && scores[key]!==null);
  if (!base.length || ![...base,'mood'].every(key=>Number.isFinite(scores[key]))) return null;
  return (1-moodWeight)*base.reduce((sum,key)=>sum+scores[key],0)/base.length+moodWeight*scores.mood;
}
function readScores(form) {
  return Object.fromEntries(Object.keys(scoring).map(key=>{
    const input=form.elements['criterion-'+key];
    return [key,input.disabled?null:input.value!=='' && input.validity.valid?input.valueAsNumber:undefined];
  }));
}
function refreshScore(form) {
  const textField=form.elements['criterion-text'];
  textField.disabled=form.elements.instrumental.checked;
  const scores=readScores(form), suggestion=estimate(scores);
  form.querySelectorAll('[data-meter]').forEach(meter=>meter.style.setProperty('--fill',((scores[meter.dataset.meter]??0)*10)+'%'));
  form.querySelector('output').textContent=suggestion===null?'—':fmt(suggestion);
  form.querySelector('[data-action=use-estimate]').disabled=suggestion===null;
}
function rubric(page, values={}) {
  return '<section class="rubric"><div class="rubric-head"><h2>Разбор оценки</h2><span class="kicker">1,0–10,0</span></div>'+
    Object.keys(scoring).map(key=>{
      const [title,hint]=rubricEntry(key,page);
      return '<div class="criterion"><label><strong>'+title+'</strong><small>'+hint+'</small><input type="number" min="1" max="10" step="0.1" placeholder="—" name="criterion-'+key+'" value="'+(values[key]??'')+'" aria-label="'+title+'"></label><div class="meter" data-meter="'+key+'"></div>'+
        (key==='text'?'<label class="skip"><input type="checkbox" name="instrumental" '+(values.text===null?'checked':'')+'> Текст не применим</label>':'')+'</div>';
    }).join('')+
    '<div class="estimate"><div><span class="kicker">ПРОБНАЯ ФОРМУЛА 80/20</span><small>80% средней базы + 20% атмосферы</small></div><output aria-live="polite">—</output>'+button('Применить к моему баллу','use-estimate')+'</div></section>';
}
function render(){const [view,...path]=location.hash.slice(1).split('/');document.querySelector('#nav').innerHTML=views.map(([key,label])=>'<a href="#'+key+'"'+(view===key?' aria-current="page"':'')+'>'+label+'</a>').join('');
if(view==='focus')app.innerHTML='<section class="quiet">'+focus()+'</section>';
else if(view==='lab')lab();
else if(view==='decisions')decisions();
else if(view==='journal')app.innerHTML='<span class="kicker">ИСТОРИЯ ПРОЕКТА</span><h1>Журнал изменений</h1>'+(db.journal.map(j=>'<article class="entry"><small>'+stamp(j.at)+'</small><p>'+esc(j.message)+'</p></article>').join('')||'<p class="muted">Изменения появятся здесь после первого сохранения.</p>');
else if(view==='plan')plan();else musicView(view==='prototype'?path.join('/'):[view,...path].join('/'));
if(studioViews.some(([key])=>key===view)){
  app.insertAdjacentHTML('afterbegin','<nav class="studio-nav" aria-label="Кабинет проекта">'+studioViews.map(([key,label])=>'<a href="#'+key+'"'+(view===key?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>');
}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const {action,id}=b.dataset;
if(action==='nav')go(id);
if(action==='edit'||action==='new')openItem(Number(id));
if(action==='close')editor.close();
if(action==='decision')openDecision(Number(id));
if(action==='approve-decision'){const d=db.decisions.find(x=>x.id===Number(id));d.approved=true;save('Подтверждено решение «'+d.title+'».')}
if(action==='lab-proposal'){openDecision(0);const form=editor.querySelector('form');form.elements.type.value='2';form.elements.title.value='Параметры рейтинга: '+(labState.kind==='albums'?'альбомы':'треки');form.elements.text.value='Вес среднего m = '+labState.m+', среднее C = '+labState.c+', штраф a = '+labState.a+', порог n = '+labState.n+'. Формулу предстоит выбрать.'}
if(action==='use-estimate'){const form=b.form;const score=estimate(readScores(form));if(score!==null)form.elements.rate.value=score.toFixed(1)}
});
document.addEventListener('input',e=>{const {id,value}=e.target;if(e.target.form?.id==='music-score')refreshScore(e.target.form);if(Object.hasOwn(filters,id)){filters[id]=value;rows()}if(Object.hasOwn(labState,id)&&e.target.validity.valid&&value!==''){labState[id]=id==='kind'?value:Number(value);comparison()}});
function reaches(from,target,seen=new Set()){if(from===target)return true;if(seen.has(from))return false;seen.add(from);return (byId(from)?.deps||[]).some(id=>reaches(id,target,seen))}
function beforeAfter(old,value){const fields={title:'Название',brief:'Описание',next:'Следующий шаг',decision:'Решения',notes:'Заметки',result:'Результат проверки',deps:'Зависимости',status:'Статус',priority:'Приоритет',approved:'Подтверждение'};return Object.keys(fields).filter(k=>JSON.stringify(old[k])!==JSON.stringify(value[k])).map(k=>fields[k]+(k==='status'?' ('+statuses[old[k]]+' → '+statuses[value[k]]+')':'')).join(', ')}
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target,data=new FormData(f),id=Number(f.dataset.id);
if(f.id==='item-form'){const old=byId(id),deps=data.getAll('deps').map(Number),status=Number(data.get('status')||0);
const error=f.querySelector('.error');if(!String(data.get('title')).trim()){error.textContent='Введи название.';return}if(deps.some(dep=>reaches(dep,id))){error.textContent='Эта зависимость создаёт цикл.';return}
if(status>=2&&!String(data.get('result')).trim()){error.textContent='Добавь результат проверки.';return}
const item={id:id||Math.max(0,...db.items.map(x=>x.id))+1,deps,status,priority:Number(data.get('priority')),approved:!!old?.approved||e.submitter?.value==='yes'};for(const field of ['title','brief','next','decision','notes','result'])item[field]=String(data.get(field)).trim();
if(old)db.items=db.items.map(x=>x.id===id?item:x);else db.items.push(item);
editor.close();const edits=old?beforeAfter(old,item):'';save(old?(edits?'«'+item.title+'» — '+edits+'.':null):'Добавлена идея «'+item.title+'».')}
if(f.id==='decision-form'){const val={id:id||Date.now(),at:new Date().toISOString(),title:String(data.get('title')).trim(),text:String(data.get('text')).trim(),type:['Архитектура','Дизайн','Алгоритм рейтинга'][Number(data.get('type'))],approved:false};if(!val.title||!val.text)return;if(id)db.decisions=db.decisions.map(x=>x.id===id?val:x);else db.decisions.unshift(val);editor.close();go('decisions');save('Сохранено предложение «'+val.title+'».')}
});
window.addEventListener('hashchange',()=>{
  if(location.hash==='#app')return;
  render();
  window.scrollTo(0,0);
});
