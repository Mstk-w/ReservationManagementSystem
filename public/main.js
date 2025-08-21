import { isBusinessDay, genTimeSlots } from './common/time.js';

const els = {
  date:  document.getElementById('pickupDate'),
  time:  document.getElementById('pickupTime'),
  pm:    document.getElementById('paymentMethod'),
  list:  document.getElementById('productList'),
  total: document.getElementById('total'),
  name:  document.getElementById('custName'),
  email: document.getElementById('custEmail'),
  phone: document.getElementById('custPhone'),
  notes: document.getElementById('notes'),
  btn:   document.getElementById('submitBtn'),
  toast: document.getElementById('toast'),
};

let products = []; // {id,name,price,enabled,seasonal,sort_order}
let holidays = new Set();
let cart = {};     // {productId: qty}

const db = window.db;
const GAS_ENDPOINT = window.GAS_ENDPOINT;
const GAS_API_KEY  = window.GAS_API_KEY;

init().catch(e => showToast(e.message || String(e), true));

async function init() {
  // 休日取得
  const hs = await db.collection('holidays').get();
  hs.forEach(d => holidays.add(d.data().date));

  // 商品（有効のみ）
  const snap = await db.collection('products')
    .where('enabled','==', true).orderBy('sort_order','asc').get();
  products = snap.docs.map(d => ({id:d.id, ...d.data()}));
  renderProducts();

  els.date.addEventListener('change', onDateChange);
  els.pm.addEventListener('change', calcTotal);
  els.btn.addEventListener('click', onSubmit);
}

function renderProducts() {
  els.list.innerHTML = '';
  products.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${p.name}</h3>
      <div>${p.price} 円</div>
      <label>数量 <input type="number" min="0" max="20" value="0" class="qty" data-id="${p.id}"></label>
    `;
    els.list.appendChild(card);
  });
  els.list.querySelectorAll('.qty').forEach(inp => {
    inp.addEventListener('input', () => {
      const id = inp.dataset.id;
      const q = Math.max(0, Math.min(20, Number(inp.value || 0)));
      if (q === 0) delete cart[id]; else cart[id] = q;
      calcTotal();
    });
  });
}

function onDateChange() {
  const d = els.date.value;
  els.time.innerHTML = '';
  if (!d || !isBusinessDay(d, holidays)) {
    showToast('営業日（水・土）かつ臨時休業日以外を選択してください。', true);
    return;
  }
  genTimeSlots().forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    els.time.appendChild(opt);
  });
}

function calcTotal() {
  let total = 0;
  Object.entries(cart).forEach(([pid, qty]) => {
    const p = products.find(x => x.id === pid);
    total += (p?.price || 0) * qty;
  });
  els.total.textContent = total;
}

function validate() {
  if (!els.date.value || !isBusinessDay(els.date.value, holidays)) throw new Error('受取日が不正です。');
  if (!els.time.value) throw new Error('受取時間を選択してください。');

  // 過去日時禁止（JST）
  const now = new Date(new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
  const pick = new Date(`${els.date.value}T${els.time.value}:00+09:00`);
  if (!(pick > now)) throw new Error('過去の日時は選択できません。');

  if (!['cash','paypay'].includes(els.pm.value)) throw new Error('支払方法が不正です。');
  if (!els.name.value.trim()) throw new Error('氏名を入力してください。');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(els.email.value.trim())) throw new Error('メール形式が不正です。');
  if (Object.keys(cart).length === 0) throw new Error('商品数量を1点以上入力してください。');
}

async function onSubmit() {
  try {
    els.btn.disabled = true; els.btn.classList.add('loading'); els.btn.textContent = '送信中…';
    validate();

    // アイテム整形
    const items = Object.entries(cart).map(([pid, qty]) => {
      const p = products.find(x => x.id === pid);
      return { product_id: pid, name: p.name, unit_price: p.price, qty, line_total: p.price * qty };
    });
    const total = items.reduce((a,b)=>a+b.line_total,0);

    const pickupDate = els.date.value;
    const pickupTime = els.time.value;
    const pickupTs   = firebase.firestore.Timestamp.fromDate(new Date(`${pickupDate}T${pickupTime}:00+09:00`));

    // Firestore保存
    const payload = {
      items,
      subtotal: total, total,
      payment_method: els.pm.value,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      pickup_ts: pickupTs,
      status: 'reserved',
      customer: { name: els.name.value.trim(), email: els.email.value.trim(), phone: els.phone.value.trim() || null },
      notes: els.notes.value.trim() || null,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection('reservations').add(payload);
    const reserve_no = `R-${pickupDate.replace(/-/g,'')}-${ref.id.slice(0,5)}`;
    await ref.update({ reserve_no });

    // 予約確定メール
    await fetch(`${GAS_ENDPOINT}?path=mail&key=${encodeURIComponent(GAS_API_KEY)}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        reserve_no,
        customer: payload.customer,
        pickup: { date: pickupDate, time: pickupTime },
        items: items.map(i=>({name:i.name, qty:i.qty, unit_price:i.unit_price})),
        total, payment_method: payload.payment_method
      })
    });

    // 当日8:00 リマインド（同日キューに積む）
    await fetch(`${GAS_ENDPOINT}?path=remind&key=${encodeURIComponent(GAS_API_KEY)}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        reserve_no,
        customer: payload.customer,
        pickup: { date: pickupDate, time: pickupTime }
      })
    });

    showToast(`予約確定しました。予約番号: ${reserve_no}`);
    // 初期化
    cart = {}; document.querySelectorAll('.qty').forEach(i=>i.value=0); calcTotal();
  } catch (e) {
    showToast(e.message || String(e), true);
  } finally {
    els.btn.disabled = false; els.btn.classList.remove('loading'); els.btn.textContent = '予約する';
  }
}

function showToast(msg, isErr=false) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  els.toast.className = 'toast' + (isErr ? ' error' : '');
  setTimeout(()=>{ els.toast.hidden = true; }, 5000);
}
