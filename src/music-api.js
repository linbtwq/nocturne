const sourceLabels = {musicbrainz:'MusicBrainz',apple:'Apple Music',deezer:'Deezer',audius:'Audius'};
const musicApiBase = location.port === '8787' ? '' : 'http://127.0.0.1:8787';
const durationLabel = ms => ms ? Math.floor(ms/60000)+':'+String(Math.floor(ms/1000)%60).padStart(2,'0') : '';
const safeHttps = url => typeof url==='string'&&/^https:\/\//.test(url);
const artwork = (url,fallback) => safeHttps(url) ? '<img src="'+esc(url)+'"'+
  (safeHttps(fallback)?' data-cover-fallback="'+esc(fallback)+'"':'')+' alt="" loading="lazy" referrerpolicy="no-referrer">' : '';
const sourceLink = (url,label) => safeHttps(url) ? '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>' : '';
document.addEventListener('error',event=>{
  const image=event.target;
  if(!(image instanceof HTMLImageElement)||!image.closest('.cover,.feed-art'))return;
  const fallback=image.dataset.coverFallback;
  if(!fallback){image.remove();return}
  delete image.dataset.coverFallback;
  image.src=fallback;
},true);

async function musicRequest(path,params={},signal) {
  const response=await fetch(musicApiBase+'/api/music/'+path+'?'+new URLSearchParams(params),{signal});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error || 'Не удалось загрузить данные.');
  return result;
}
function externalHref(item) {
  const region=/^[A-Z]{2}$/.test(item.storefront??'')?'/'+item.storefront:'';
  return '#release/'+item.provider+'/'+item.kind+'/'+encodeURIComponent(item.id)+region;
}
