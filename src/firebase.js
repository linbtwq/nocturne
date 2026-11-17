import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {
  arrayRemove, arrayUnion, collection, doc, getDoc, getFirestore, onSnapshot,
  runTransaction, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAFcU9NcZtzNUGSxZgFqPIANPBqPygkOiM',
  authDomain: 'musicnuc-210e8.firebaseapp.com',
  projectId: 'musicnuc-210e8',
  storageBucket: 'musicnuc-210e8.firebasestorage.app',
  messagingSenderId: '325996518245',
  appId: '1:325996518245:web:46dff857bddc57b3c91f8c'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const store = getFirestore(firebaseApp);
const data = { releases: [], profiles: [], ratings: [] };
const errors = new Map();
const activity = { dirty: false };
const userDoc = uid => doc(store, 'profiles', uid);
const releaseDoc = id => doc(store, 'releases', String(id));
let registering = false;
let listeners = [];

async function ensureProfile(user) {
  const profile = userDoc(user.uid);
  if (!(await getDoc(profile)).exists()) {
    const name = user.displayName?.trim().slice(0,40) || 'Мой профиль';
    await setDoc(profile, {name}, {merge:true});
  }
}

async function importedId(provider, kind, sourceId) {
  const bytes = new TextEncoder().encode([provider, kind, sourceId].join(':'));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return digest.slice(0,6).reduce((id, byte) => id * 256 + byte, 0) || 1;
}

async function importRows(entry) {
  const createRow = async (source, kind, sourceId, album, trackOrder) => ({
    id: await importedId(entry.provider, kind, sourceId),
    kind, sourceId, provider: entry.provider, album, trackOrder,
    title: source.title.trim().slice(0,100),
    artist: source.artist.trim().slice(0,100),
    genre: (entry.genre || 'Без жанра').trim().slice(0,50),
    year: entry.year >= 1850 && entry.year <= 2100 ? entry.year : null,
    duration: source.duration ?? null,
    cover: album ? '' : entry.cover.slice(0,1000),
    sourceUrl: (source.url ?? '').slice(0,1000)
  });
  const root = await createRow(entry,entry.kind,entry.id,0,0);
  const tracks = await Promise.all((entry.tracks ?? []).map((track,index) =>
    createRow(track,'track',entry.id+'-'+track.disc+'-'+track.position+'-'+track.id,root.id,index+1)
  ));
  return [root,...tracks];
}

function paint() {
  const user = auth.currentUser;
  const profiles = data.profiles.map(profile => ({
    ...profile, collection: profile.collection ?? [],
    following: profile.following ?? [], scores: {}, reviews: {}
  }));
  if (user && !profiles.some(profile => profile.uid === user.uid)) {
    profiles.push({ uid: user.uid, name: user.displayName || 'Мой профиль', collection: [], following: [], scores: {}, reviews: {} });
  }
  const index = new Map(profiles.map((profile, i) => [profile.uid, i]));
  for (const profile of profiles) {
    profile.following = profile.following.map(uid => index.get(uid)).filter(Number.isInteger);
  }
  const available = new Set(data.releases.map(release => release.id));
  for (const profile of profiles) {
    profile.collection = profile.collection.filter(id => available.has(id));
  }
  for (const rating of data.ratings) {
    const profile = profiles[index.get(rating.uid)];
    if (!profile || !available.has(rating.releaseId)) continue;
    profile.scores[rating.releaseId] = {total: rating.total, details: rating.details, updatedAt: rating.updatedAt?.seconds ?? 0};
    if (rating.review) profile.reviews[rating.releaseId] = rating.review;
  }
  model = {
    catalog: [...data.releases].sort((a,b) => (a.createdAt?.seconds ?? 0)-(b.createdAt?.seconds ?? 0)),
    profiles,
    active: index.get(user?.uid) ?? -1
  };
  if (!activity.dirty && !registering) render();
}

const integration = {
  get user() { return auth.currentUser; },
  get readError() { return [...errors.values()][0]; },
  async authenticate(fields, register) {
    const email = fields.get('email').trim();
    const password = fields.get('password');
    const name = fields.get('name').trim();
    if (register && !name) throw new Error('Введи имя для регистрации.');
    registering = true;
    try {
      const result = register
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      if (register) await updateProfile(result.user, {displayName: name});
      await ensureProfile(result.user);
    } finally {
      registering = false;
    }
    activity.dirty = false;
    paint();
  },
  async loginWithGoogle() {
    registering = true;
    try {
      const result = await signInWithPopup(auth,new GoogleAuthProvider());
      await ensureProfile(result.user);
    } finally {
      registering = false;
    }
    activity.dirty = false;
    paint();
  },
  async logout() {
    activity.dirty = false;
    await signOut(auth);
    go('profile');
  },
  async addRelease(release) {
    const bytes = crypto.getRandomValues(new Uint32Array(2));
    release.id = (bytes[0] & 0xffff) * 2 ** 32 + bytes[1] || 1;
    await setDoc(doc(store, 'releases', String(release.id)), {
      ...release, id: String(release.id), album: String(release.album),
      addedBy: auth.currentUser.uid, createdAt: serverTimestamp()
    });
  },
  async importRelease(entry) {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Войди, чтобы импортировать релиз.');
    const rows = await importRows(entry);
    // Chunk the transaction so Firestore rule lookups stay within its request limit.
    for (let start=0; start<rows.length; start+=15) {
      const chunk = rows.slice(start,start+15);
      await runTransaction(store,async tx => {
        const refs = chunk.map(row => releaseDoc(row.id));
        const existing = await Promise.all(refs.map(ref => tx.get(ref)));
        for (const [index,row] of chunk.entries()) {
          const old = existing[index].data();
          if (old) {
            if (old.provider !== row.provider || old.sourceId !== row.sourceId || old.kind !== row.kind) {
              throw new Error('Идентификатор релиза уже занят другой записью.');
            }
            continue;
          }
          tx.set(refs[index],{
            ...row,id:String(row.id),album:String(row.album),
            addedBy:uid,createdAt:serverTimestamp()
          });
        }
      });
    }
    return rows[0];
  },
  async rate(releaseId, score, review) {
    const uid = auth.currentUser.uid;
    const details = Object.fromEntries(Object.entries(score.details).filter(([, value]) => value !== undefined));
    await setDoc(doc(store, 'ratings', uid+'_'+releaseId), {
      uid, releaseId: String(releaseId), total: score.total, details, review, updatedAt: serverTimestamp()
    });
    activity.dirty = false;
    paint();
  },
  toggleCollection(id) {
    const operation = current().collection.includes(id) ? arrayRemove : arrayUnion;
    return setDoc(userDoc(auth.currentUser.uid), {collection: operation(id)}, {merge: true});
  },
  toggleFollow(uid) {
    const following = current().following.some(i => model.profiles[i]?.uid === uid);
    return setDoc(userDoc(auth.currentUser.uid), {following: (following ? arrayRemove : arrayUnion)(uid)}, {merge: true});
  },
  describeError(error) {
    const messages = {
      'auth/configuration-not-found': 'В Firebase нужно включить Authentication и способ входа Email/Password.',
      'auth/operation-not-allowed': 'В Firebase отключён способ входа Email/Password.',
      'auth/invalid-credential': 'Проверь почту и пароль.',
      'auth/email-already-in-use': 'Аккаунт с этой почтой уже зарегистрирован.',
      'auth/weak-password': 'Для пароля нужно не менее шести символов.',
      'auth/network-request-failed': 'Не удалось связаться с Firebase. Проверь подключение.',
      'auth/popup-closed-by-user': 'Окно входа Google закрыто.',
      'auth/popup-blocked': 'Разреши всплывающие окна для входа через Google.',
      'permission-denied': 'Нет доступа к Cloud Firestore. Проверь базу и правила NOCTURNE.'
    };
    return messages[error.code] ?? (error.code ? 'Firebase: '+error.code : error.message);
  }
};

window.nocturneFirebase = integration;
document.addEventListener('input', event => {
  if (['firebase-auth','music-score'].includes(event.target.form?.id)) activity.dirty = true;
});
window.addEventListener('hashchange', () => { activity.dirty = false; });
onAuthStateChanged(auth, user => {
  listeners.forEach(stop => stop());
  errors.clear();
  for (const name of Object.keys(data)) data[name] = [];
  listeners = user ? Object.keys(data).map(name =>
    onSnapshot(collection(store, name), snapshot => {
      errors.delete(name);
      data[name] = snapshot.docs.map(item => {
        const value = item.data();
        if (name === 'profiles') return {...value,uid:item.id};
        if (name === 'releases') return {...value,id:Number(value.id),album:Number(value.album)};
        return {...value,releaseId:Number(value.releaseId)};
      });
      paint();
    }, error => {
      errors.set(name,integration.describeError(error));
      paint();
    })
  ) : [];
  paint();
});
paint();
