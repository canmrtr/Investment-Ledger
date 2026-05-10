// ── CONFIG ──────────────────────────────────────────────────────
const SUPA_URL  = "https://jfetubcilmuthpddkodg.supabase.co";
const SUPA_ANON = "sb_publishable_fB2va7QAJaGjwdn0ULNr9g_SbO2fCPy";
// Debug logging — production'da false. Console'a edge function hatalarını
// loglamak istersen true yap.
const DEBUG = false;

const CFG = {
  RATE_LIMIT_MS:    7500,   // fiyat çekme arası bekleme (edge function rate limit)
  DUST_THRESHOLD:   0.0001, // pozisyon sayılacak minimum shares
  CSV_BATCH_SIZE:   50,     // CSV import'ta supabase insert batch
  FLASH_MS:         3500,   // flash mesaj görünüm süresi
  CSV_PROGRESS_MS:  5000,   // CSV bitişi sonrası progress reset
};
// ────────────────────────────────────────────────────────────────

const sb = supabase.createClient(SUPA_URL, SUPA_ANON, {
  auth:{persistSession:true,autoRefreshToken:true}
});

const {useState,useEffect,useRef} = React;

const TL = {US_STOCK:"Hisse",FUND:"ETF/Fon",CRYPTO:"Kripto",BIST:"BIST",GOLD:"Altın",FX:"Döviz"};
// Pie chart slice + legend renkleri. Sabit — dashboard yeniden açıldığında değişmez.
const TYPE_COLORS = {
  US_STOCK: "#8B5CF6",  // brand kit: --category-us-stock
  FUND:     "#3B82F6",  // brand kit: --category-etf
  CRYPTO:   "#06B6D4",  // brand kit: --category-crypto
  BIST:     "#F97316",  // brand kit: --category-bist
  GOLD:     "#C9A84C",  // brand kit: --category-gold
  FX:       "#10B981",  // brand kit: --category-fx
};
const LS = {
  get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
};
const fmt  = (n,d=2)=>n==null?"—":n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtD = n=>n==null?"—":(n>=0?"+$":"-$")+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
// Currency-aware signed format — fmtD'nin parametrik versiyonu (TRY/EUR tabloları için).
const fmtSign = (n, sym="$") => n==null?"—":(n>=0?"+":"-")+sym+Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtP = n=>n==null?"—":(n>=0?"+":"")+n.toFixed(1)+"%";
const pc   = n=>n==null?"":n>=0?" ok":" err";
const today= ()=>new Date().toISOString().split("T")[0];
const dago = n=>new Date(Date.now()-n*86400000).toISOString().split("T")[0];
// ISO date "YYYY-MM-DD" → display "DD/MM/YYYY". null/empty/invalid → orijinal döner.
const fmtDateTR = (s)=>{
  if(!s||typeof s!=="string")return s||"";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};
// Adet formatı — tam sayıyı integer, kesirli olanı trailing-sıfırsız ondalıklı.
// 8 → "8", 255.4200 → "255.42", 1.234567 → "1.2346" (4 haneye yuvarla)
const fmtShares = (n, maxDec=4)=>{
  if(n==null||isNaN(+n))return "—";
  const num=+n;
  if(num%1===0)return String(num);
  return String(+num.toFixed(maxDec));
};
const fmtAge = (ts)=>{
  if(!ts)return null;
  const sec=Math.floor((Date.now()-ts)/1000);
  if(sec<60)return "az önce";
  const min=Math.floor(sec/60);
  if(min<60)return `${min} dk önce`;
  const hr=Math.floor(min/60);
  if(hr<24)return `${hr} sa önce`;
  return `${Math.floor(hr/24)} gün önce`;
};
