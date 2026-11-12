'use client';

import { useState, useEffect, useRef } from 'react';

/* Koreksi jam database (sama dengan halaman Admin): diambil dari /api/waktu, 0 = tanpa koreksi. */
let KOREKSI_DB_MS = 0;
const tglDb = (v:any) => { const d = new Date(v); return isNaN(d.getTime()) ? d : new Date(d.getTime() - KOREKSI_DB_MS); };

const emojiMap: Record<string,string> = {
  'Lambert':'🔧','Mold':'🔩','Molding':'⚙️','AOKI':'💨','Arburg':'🏭',
  'Slitting':'✂️','Tampon Printing':'🖨️','Fartech':'🤖','Gaia Auto':'🦾',
  'Barcode':'📦','Mold LSR':'💧','Machine':'⚡','Electrical':'⚡',
  'Hydraulic':'🔧','Pneumatic':'💨','Mechanical':'⚙️','Heater':'🔥',
};

// ===== Cek versi baru (setelah rebuild di panel) =====
// Versi saat halaman dibuka dicatat; tiap 60 detik dicek lagi ke /api/versi.
function useVersiBaru(): boolean {
  const [baru,setBaru]=useState(false);
  useEffect(()=>{
    let awal:string|null=null, batal=false;
    const cek=()=>fetch('/api/versi',{cache:'no-store'}).then(r=>r.json()).then(d=>{
      if(batal||!d?.versi)return;
      if(awal===null)awal=d.versi; else if(d.versi!==awal)setBaru(true);
    }).catch(()=>{});
    cek(); const iv=setInterval(cek,60000);
    return()=>{batal=true;clearInterval(iv);};
  },[]);
  return baru;
}

const MESIN_MOLDING = [
  { nama:'Soother B2', emoji:'🧸', color:'#0b5ed7', img:null,             matchMesin:['Soother B2'], matchKat:[] },
  { nama:'Aoki',       emoji:'💨', color:'#8a5a00', img:'/AOKI.png',      matchMesin:['AOKI'],       matchKat:['AOKI','Electrical','Heater','Hydraulic','Mechanical','Pneumatic'] },
  { nama:'Haitian 1K', emoji:'🏭', color:'#6d28d9', img:'/HATIAN 1K.png', matchMesin:['Haitian 1K'], matchKat:[] },
  { nama:'Haitian 2K', emoji:'🏭', color:'#6d28d9', img:'/HATIAN 2K.png', matchMesin:['Haitian 2K'], matchKat:[] },
  { nama:'AURBUGH',    emoji:'⚙️', color:'#8a5a00', img:'/AURBUGH.png',   matchMesin:['AURBUGH','Hot Runner','General Machine'], matchKat:['Mold'] },
];

const MESIN_NONMOLDING_GROUPED = [
  { nama:'Flowthrough', emoji:'🔧', color:'#0b5ed7', img:null, sub:[], matchMesin:['Flowthrough'], matchKat:[] },
  { nama:'External Siliting', emoji:'✂️', color:'#0f766e', img:'/External Siliting.png', sub:[
    { nama:'External Siliting 1', emoji:'✂️', color:'#0f766e', matchMesin:['External Siliting 1'], matchKat:[] },
    { nama:'External Siliting 2', emoji:'✂️', color:'#0f766e', matchMesin:['External Siliting 2'], matchKat:[] },
    { nama:'External Siliting 3', emoji:'✂️', color:'#0f766e', matchMesin:['External Siliting 3'], matchKat:[] },
    { nama:'External Siliting 4', emoji:'✂️', color:'#0f766e', matchMesin:['External Siliting 4'], matchKat:[] },
    { nama:'External Siliting 5', emoji:'✂️', color:'#0f766e', matchMesin:['External Siliting 5'], matchKat:[] },
  ], matchMesin:['External Siliting'], matchKat:[] },
  { nama:'Semi Auto Assembly Soother', emoji:'🧸', color:'#c2410c', img:null, sub:[
    { nama:'Semi Auto Assembly Soother 1 (Lambert)', emoji:'🧸', color:'#c2410c', matchMesin:['Semi Auto Assembly Soother 1'], matchKat:[] },
    { nama:'Semi Auto Assembly Soother 2 (Fartech)', emoji:'🧸', color:'#c2410c', matchMesin:['Semi Auto Assembly Soother 2'], matchKat:[] },
    { nama:'Semi Auto Assembly Soother 3 (Fartech)', emoji:'🧸', color:'#c2410c', matchMesin:['Semi Auto Assembly Soother 3'], matchKat:[] },
    { nama:'Semi Auto Assembly Soother 4 (Fartech)', emoji:'🧸', color:'#c2410c', matchMesin:['Semi Auto Assembly Soother 4'], matchKat:[] },
    { nama:'Full Auto Assembly Soother (Lambert)',   emoji:'🧸', color:'#c2410c', matchMesin:['Full Auto Assembly Soother'],   matchKat:[] },
  ], matchMesin:['Semi Auto Assembly','Full Auto Assembly'], matchKat:[] },
  { nama:'CMYK', emoji:'🖨️', color:'#c2410c', img:'/CMYK.png', sub:[
    { nama:'CMYK 1', emoji:'🖨️', color:'#c2410c', matchMesin:['CMYK 1'], matchKat:[] },
    { nama:'CMYK 2', emoji:'🖨️', color:'#c2410c', matchMesin:['CMYK 2'], matchKat:[] },
  ], matchMesin:['CMYK'], matchKat:[] },
  { nama:'GAIYA', emoji:'🤖', color:'#0e7490', img:'/GAIYA.png', sub:[
    { nama:'GAIYA MANUAL 1', emoji:'🤖', color:'#0e7490', matchMesin:['GAIYA MANUAL 1'], matchKat:[] },
    { nama:'GAIYA MANUAL 2', emoji:'🤖', color:'#0e7490', matchMesin:['GAIYA MANUAL 2'], matchKat:[] },
    { nama:'GAIYA AUTO',     emoji:'🤖', color:'#0e7490', matchMesin:['GAIYA AUTO'],     matchKat:[] },
  ], matchMesin:['GAIYA'], matchKat:[] },
  { nama:'TAMPON', emoji:'🖱️', color:'#6d28d9', img:'/TAMPON.png', sub:[
    { nama:'TAMPON 1',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 1'],  matchKat:[] },
    { nama:'TAMPON 2',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 2'],  matchKat:[] },
    { nama:'TAMPON 3',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 3'],  matchKat:[] },
    { nama:'TAMPON 4',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 4'],  matchKat:[] },
    { nama:'TAMPON 5',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 5'],  matchKat:[] },
    { nama:'TAMPON 6',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 6'],  matchKat:[] },
    { nama:'TAMPON 7',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 7'],  matchKat:[] },
    { nama:'TAMPON 8',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 8'],  matchKat:[] },
    { nama:'TAMPON 9',  emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 9'],  matchKat:[] },
    { nama:'TAMPON 10', emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 10'], matchKat:[] },
    { nama:'TAMPON 11', emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 11'], matchKat:[] },
    { nama:'TAMPON 12', emoji:'🖱️', color:'#6d28d9', matchMesin:['TAMPON 12'], matchKat:[] },
  ], matchMesin:['TAMPON'], matchKat:['Tampon Printing'] },
  { nama:'PRINTER BARCODE',       emoji:'📦', color:'#4d7c0f', img:null,                  sub:[], matchMesin:['PRINTER BARCODE'], matchKat:['Barcode'] },
  { nama:'RECYCLE SOFLEN',        emoji:'♻️', color:'#1e7e34', img:null,                  sub:[], matchMesin:['RECYCLE SOFLEN'],  matchKat:[] },
  { nama:'MLP Robot',             emoji:'🦾', color:'#6d28d9', img:'/MLP Robot.png',      sub:[], matchMesin:['MLP Robot'],       matchKat:[] },
  { nama:'Seer Carry AGV',        emoji:'🚗', color:'#5b6b80', img:'/Seer Carry AGV.png', sub:[], matchMesin:['Seer Carry'],      matchKat:[] },
  { nama:'Conveyor',              emoji:'📦', color:'#0b5ed7', img:'/conveyor.png',        sub:[], matchMesin:['Conveyor'],        matchKat:[] },
  { nama:'Cable Car',             emoji:'🚡', color:'#8a5a00', img:'/Cable Car.png',       sub:[], matchMesin:['Cable Car'],       matchKat:[] },
  { nama:'Panel Conveyor Hairou', emoji:'🖥️', color:'#6d28d9', img:null,                  sub:[], matchMesin:['Panel Conveyor'],  matchKat:[] },
];
const MESIN_NONMOLDING = MESIN_NONMOLDING_GROUPED;

const NM_MESIN_KEYS = ['Cable Car','Conveyor','MLP Robot','Panel Conveyor','Seer Carry','TAMPON','CMYK','GAIYA','External Siliting','Semi Auto Assembly','Full Auto Assembly','Flowthrough','PRINTER BARCODE','RECYCLE SOFLEN'];
const getJenis = (mesin:string, kategori:string): 'molding'|'nonmolding' => {
  const m = (mesin||'').toLowerCase();
  if (NM_MESIN_KEYS.some(k => m.includes(k.toLowerCase()))) return 'nonmolding';
  if ((kategori||'').toLowerCase() === 'tampon printing') return 'nonmolding';
  return 'molding';
};
const partMatchesMesin = (p:any, mesin:{matchMesin:string[];matchKat:string[]}) => {
  const pm=(p.mesin||'').toLowerCase(), pk=(p.kategori||'').toLowerCase();
  return mesin.matchMesin.some(m=>pm.includes(m.toLowerCase())||pm===m.toLowerCase())||mesin.matchKat.some(k=>pk===k.toLowerCase());
};

type Teknisi={id:number;nama:string;employee_id:string;role:string;rfid_tag:string;gender:string;foto:string;bagian?:string;nomor_mesin?:string;mesin_tambahan?:{id:number;nama:string}[];};
type Part={id:number;kode:string;nama:string;kategori:string;mesin:string;bin:string;stok:number;reorder:number;gambar:string;is_critical:boolean;foto_url?:string|null;};
type Page='scan'|'jenis'|'mesin'|'sub_mesin'|'catalog'|'cart'|'success'|'waiting'|'verification'|'verify_detail'|'verify_done'|'selesai'|'mold_mesin'|'mold_unit'|'mold_pilih'|'mold_template'|'pm_checklist'|'pm_item';
type Mode='dark'|'light';
type Jenis='molding'|'nonmolding';

// ===== Tema Teknisi (desain baru): satu tema biru Philips untuk semua teknisi. =====
const BRAND_THEME={
  dark:{overlay:'#0f1b2d',cardBg:'#16253d',navBg:'#13213a',border:'#2a4066',accent:'#0b5ed7',accentLight:'#7fb0f5',text:'#f1f5fb',textMuted:'#a9b8cc',inputBg:'#1b2d4a',tag:'rgba(127,176,245,0.16)',filterActive:'rgba(127,176,245,0.24)'},
  light:{overlay:'#f3f5f8',cardBg:'#ffffff',navBg:'#ffffff',border:'#d9dee5',accent:'#0b5ed7',accentLight:'#0b5ed7',text:'#13294b',textMuted:'#5b6b80',inputBg:'#f8f9fb',tag:'rgba(11,94,215,0.08)',filterActive:'rgba(11,94,215,0.14)'},
};
const themes={male:BRAND_THEME,female:BRAND_THEME};

const tkIcon={width:20,height:20,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.75,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
const IconSun=()=> <svg {...tkIcon}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
const IconMoon=()=> <svg {...tkIcon}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>;
const IconCart=()=> <svg {...tkIcon}><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11L21 7H7"/></svg>;
const IconClock=()=> <svg {...tkIcon}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
const IconLogout=()=> <svg {...tkIcon}><path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg>;

// Grup mold: unit dengan nama dasar sama (mis. "BLOOM TEAT MOLD 1..5") tampil jadi 1 kartu + daftar unit. Hanya tampilan, data tidak diubah.
const namaDasarMold=(n:any)=>{const s=String(n||'').trim();const b=s.replace(/\s*\(([^()]*)\)\s*$/,(x:string,isi:string)=>/[\d,]/.test(isi)?'':x).replace(/\s+#?\d+\s*$/,'').trim();return b||s;};
const labelUnitMold=(m:any)=>{const s=String(m?.nama_mold||'').trim();const r=s.slice(namaDasarMold(s).length).trim();const no=r.match(/^#?(\d+)/);if(no)return `Unit ${no[1]}`;const t=r.replace(/^\(\s*/,'').replace(/\s*\)$/,'').trim();return t||'Unit 1';};
type GrupMold={key:string;nama:string;units:any[]};
const grupkanMold=(list:any[]):GrupMold[]=>{const peta=new Map<string,GrupMold>();list.forEach(m=>{const nama=namaDasarMold(m.nama_mold);const key=nama.toLowerCase().replace(/\s+/g,' ');const g=peta.get(key);if(g)g.units.push(m);else peta.set(key,{key,nama,units:[m]});});return Array.from(peta.values());};
function LiveClock({color,size=15}:{color:string;size?:number}) {
  const [time,setTime]=useState('');
  useEffect(()=>{
    const tick=()=>setTime(new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
    tick();
    const id=setInterval(tick,1000);
    return()=>clearInterval(id);
  },[]);
  return <span style={{fontSize:`${size}px`,fontWeight:700,color,fontVariantNumeric:'tabular-nums'}}>{time}</span>;
}

// ===== Dialog konfirmasi & pemberitahuan (pengganti confirm()/alert() bawaan browser) =====
type DialogOpsi = { judul?:string; pesan:string; oke?:string; batal?:string|null; bahaya?:boolean };
let __setDialog: ((d:(DialogOpsi & { selesai:(v:boolean)=>void })|null)=>void) | null = null;
function tanya(isi:string|DialogOpsi):Promise<boolean> {
  const o:DialogOpsi = typeof isi==='string' ? { pesan:isi } : isi;
  const bahaya = o.bahaya ?? /\b(hapus|lepas|permanen)\b/i.test(o.pesan);
  return new Promise(res=>{
    if(!__setDialog){ res(window.confirm(o.pesan)); return; }
    __setDialog({ judul:o.judul||(bahaya?'Yakin?':'Konfirmasi'), pesan:o.pesan, oke:o.oke||(bahaya?'Ya, lanjutkan':'Lanjutkan'), batal:o.batal===undefined?'Batal':o.batal, bahaya,
      selesai:(v:boolean)=>{ __setDialog&&__setDialog(null); res(v); } });
  });
}
function beritahu(pesan:string, judul='Informasi'){ return tanya({ judul, pesan, oke:'OK', batal:null, bahaya:false }); }
// ===== Keyboard layar sentuh =====
// Monitor teknisi layar sentuh: saat kotak teks disentuh dengan jari, keyboard ini muncul di bawah layar.
// Tidak bergantung pada keyboard bawaan Windows (yang sering tidak muncul karena reader RFID dianggap keyboard fisik).
// Kalau kotak teks diklik pakai mouse, keyboard ini tidak muncul.
function KeyboardLayar({ t }:{ t:any }) {
  const [el,setEl]=useState<HTMLInputElement|HTMLTextAreaElement|null>(null);
  const [besar,setBesar]=useState(false);
  const sentuh=useRef(false);
  const bisaKetik=(x:any):x is HTMLInputElement|HTMLTextAreaElement=>{
    if(x instanceof HTMLTextAreaElement)return !x.readOnly&&!x.disabled;
    if(x instanceof HTMLInputElement)return ['text','search','number','tel','email','password',''].includes(x.type)&&!x.readOnly&&!x.disabled;
    return false;
  };
  useEffect(()=>{
    const down=(e:PointerEvent)=>{
      sentuh.current=e.pointerType==='touch'||e.pointerType==='pen';
      // Cegah keyboard bawaan OS ikut muncul (dobel) saat memakai keyboard layar
      if(sentuh.current&&bisaKetik(e.target))(e.target as HTMLElement).setAttribute('inputmode','none');
    };
    const masuk=(e:FocusEvent)=>{ if(bisaKetik(e.target)&&sentuh.current){setEl(e.target);setTimeout(()=>(e.target as HTMLElement).scrollIntoView({block:'center',behavior:'smooth'}),60);} };
    const keluar=(e:FocusEvent)=>{ const ke=e.relatedTarget as HTMLElement|null; if(ke&&bisaKetik(ke))return; setTimeout(()=>{ if(!bisaKetik(document.activeElement))setEl(null); },0); };
    document.addEventListener('pointerdown',down,true);
    document.addEventListener('focusin',masuk);
    document.addEventListener('focusout',keluar);
    return()=>{document.removeEventListener('pointerdown',down,true);document.removeEventListener('focusin',masuk);document.removeEventListener('focusout',keluar);};
  },[]);
  useEffect(()=>{document.body.style.paddingBottom=el?'320px':'';return()=>{document.body.style.paddingBottom='';};},[el]);
  if(!el)return null;
  // Tulis nilai lewat setter bawaan + event input, supaya state React (onChange) ikut berubah
  const tulis=(nilai:string,caret:number)=>{
    const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(el,nilai);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    try{el.setSelectionRange(caret,caret);}catch{}
  };
  const posisi=()=>{try{const a=el.selectionStart,b=el.selectionEnd;if(a!=null&&b!=null)return [a,b];}catch{}return [el.value.length,el.value.length];};
  const ketik=(s:string)=>{
    const max=(el as HTMLInputElement).maxLength; const [a,b]=posisi();
    let v=el.value.slice(0,a)+s+el.value.slice(b);
    if(max>0&&v.length>max)return;
    if(el instanceof HTMLInputElement&&el.type==='number'&&!/^-?\d*\.?\d*$/.test(v))return;
    tulis(v,a+s.length);
  };
  const hapus=()=>{const [a,b]=posisi();if(a!==b)tulis(el.value.slice(0,a)+el.value.slice(b),a);else if(a>0)tulis(el.value.slice(0,a-1)+el.value.slice(a),a-1);};
  const enter=()=>{
    if(el instanceof HTMLTextAreaElement){ketik('\n');return;}
    el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
    el.blur();setEl(null);
  };
  const baris=['1234567890','QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
  const tekan=(fn:()=>void)=>(e:React.PointerEvent)=>{e.preventDefault();fn();}; // preventDefault: kotak teks tidak kehilangan fokus
  const k:React.CSSProperties={flex:1,minWidth:0,height:'52px',border:`1px solid ${t.border}`,borderRadius:'8px',background:t.cardBg,color:t.text,fontSize:'20px',fontWeight:600,fontFamily:'inherit',cursor:'pointer',touchAction:'manipulation',userSelect:'none'};
  const kAksi:React.CSSProperties={...k,background:t.inputBg,fontSize:'15px'};
  return (
    <div role="group" aria-label="Keyboard layar" onPointerDown={e=>e.preventDefault()} style={{position:'fixed',left:0,right:0,bottom:0,zIndex:3000,background:t.navBg,borderTop:`1px solid ${t.border}`,boxShadow:'0 -8px 24px rgba(0,0,0,0.18)',padding:'10px 12px 14px',display:'flex',flexDirection:'column',gap:'8px'}}>
      {baris.map((r,i)=>(
        <div key={r} style={{display:'flex',gap:'6px',padding:i===2?'0 3%':i===3?'0 8%':0}}>
          {r.split('').map(c=>{const ch=/[A-Z]/.test(c)&&!besar?c.toLowerCase():c;return <button key={c} type="button" onPointerDown={tekan(()=>ketik(ch))} style={k}>{ch}</button>;})}
          {i===3&&<button type="button" onPointerDown={tekan(hapus)} aria-label="Hapus" style={{...kAksi,flex:1.6}}>⌫</button>}
        </div>
      ))}
      <div style={{display:'flex',gap:'6px'}}>
        <button type="button" onPointerDown={tekan(()=>setBesar(b=>!b))} aria-pressed={besar} style={{...kAksi,flex:1.4,color:besar?t.accentLight:t.text}}>{besar?'ABC':'abc'}</button>
        {['-','.','/'].map(c=><button key={c} type="button" onPointerDown={tekan(()=>ketik(c))} style={k}>{c}</button>)}
        <button type="button" onPointerDown={tekan(()=>ketik(' '))} aria-label="Spasi" style={{...k,flex:4}}>spasi</button>
        <button type="button" onPointerDown={tekan(()=>{tulis('',0);})} style={{...kAksi,flex:1.4}}>Kosongkan</button>
        <button type="button" onPointerDown={tekan(enter)} style={{...kAksi,flex:1.6,background:t.accent,color:'#fff',border:'none'}}>Selesai</button>
        <button type="button" onPointerDown={tekan(()=>{el.blur();setEl(null);})} aria-label="Tutup keyboard" style={{...kAksi,flex:0.9}}>✕</button>
      </div>
    </div>
  );
}

function DialogHost() {
  const [d,setD]=useState<(DialogOpsi & { selesai:(v:boolean)=>void })|null>(null);
  const okRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{ __setDialog=setD; return ()=>{ if(__setDialog===setD)__setDialog=null; }; },[]);
  useEffect(()=>{
    if(!d)return;
    setTimeout(()=>okRef.current?.focus(),0);
    const k=(e:KeyboardEvent)=>{ if(e.key==='Escape'){e.preventDefault();d.selesai(false);} };
    window.addEventListener('keydown',k); return ()=>window.removeEventListener('keydown',k);
  },[d]);
  if(!d)return null;
  const warna=d.bahaya?'#c62828':'#0b5ed7';
  return (
    <div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)d.selesai(false);}} style={{position:'fixed',inset:0,zIndex:5000,background:'rgba(15,25,45,0.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',animation:'mccDlgFade .15s ease'}}>
      <style>{`@keyframes mccDlgFade{from{opacity:0}to{opacity:1}}@keyframes mccDlgPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div role="alertdialog" aria-modal="true" aria-labelledby="mcc-dlg-judul" style={{width:'100%',maxWidth:'460px',background:'#fff',borderRadius:'12px',boxShadow:'0 20px 50px rgba(15,25,45,0.25)',overflow:'hidden',animation:'mccDlgPop .18s ease',fontFamily:'inherit'}}>
        <div style={{display:'flex',gap:'14px',padding:'20px 20px 8px'}}>
          <div aria-hidden="true" style={{width:'40px',height:'40px',borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:d.bahaya?'#fdecec':'#e7f0fd',color:warna,fontSize:'20px',fontWeight:800}}>{d.bahaya?'!':d.batal===null?'i':'?'}</div>
          <div style={{minWidth:0}}>
            <div id="mcc-dlg-judul" style={{fontSize:'17px',fontWeight:700,color:'#13294b',marginBottom:'6px'}}>{d.judul}</div>
            <div style={{fontSize:'14px',lineHeight:1.55,color:'#3d4b5f',whiteSpace:'pre-line'}}>{d.pesan}</div>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',padding:'14px 20px 18px'}}>
          {d.batal!==null&&<button type="button" onClick={()=>d.selesai(false)} style={{padding:'9px 16px',borderRadius:'8px',border:'1px solid #d9dee5',background:'#fff',color:'#13294b',fontSize:'14px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{d.batal}</button>}
          <button ref={okRef} type="button" onClick={()=>d.selesai(true)} style={{padding:'9px 18px',borderRadius:'8px',border:'none',background:warna,color:'#fff',fontSize:'14px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{d.oke}</button>
        </div>
      </div>
    </div>
  );
}

export default function RFIDPage() {
  const [page,setPage]=useState<Page>('scan');
  const [, setVersiJam]=useState(0);
  useEffect(()=>{fetch('/api/waktu').then(x=>x.json()).then(d=>{const k=Number(d?.koreksi_ms)||0;if(k!==KOREKSI_DB_MS){KOREKSI_DB_MS=k;setVersiJam(v=>v+1);}}).catch(()=>{});},[]);
  const [teknisi,setTeknisi]=useState<Teknisi|null>(null);
  const [rfidInput,setRfidInput]=useState('');
  const [error,setError]=useState('');
  const [scanning,setScanning]=useState(false);
  const [failCount,setFailCount]=useState(0);
  const [showManual,setShowManual]=useState(false);
  const [search,setSearch]=useState('');
  const [filterKat,setFilterKat]=useState('Semua');
  const [selectedJenis,setSelectedJenis]=useState<Jenis>('molding');
  const [selectedMesin,setSelectedMesin]=useState<any|null>(null);
  const [selectedGroup,setSelectedGroup]=useState<any|null>(null);
  const versiBaru=useVersiBaru();
  // ── Master Data dari database (Tahap 2). Kalau gagal dimuat, daftar lama di atas tetap dipakai. ──
  const [masterMesin,setMasterMesin]=useState<{molding:any[];nonmolding:any[];jenisArea:Record<number,'molding'|'nonmolding'>}|null>(null);
  const [partJenis,setPartJenis]=useState<Record<number,number>>({});
  const [partCons,setPartCons]=useState<Set<number>>(new Set()); // consumable part (migrasi 16)
  const [partPakai,setPartPakai]=useState<Record<number,number[]>>({});
  // Apa adanya dari Admin: jumlah part/warning per mesin dan daftar part per mesin diambil dari API yang sama dengan Kelola part
  const [jumlahMesin,setJumlahMesin]=useState<Record<number,{part:number;warn:number}>>({});
  const [partsMesin,setPartsMesin]=useState<{jenisId:number;list:Part[]}|null>(null);
  const keJumlah=(jenis:any[])=>{const j:Record<number,{part:number;warn:number}>={};(jenis||[]).forEach((x:any)=>{j[x.id]={part:Number(x.jumlah_part)||0,warn:Number(x.jumlah_warning)||0};});setJumlahMesin(j);};
  const kePart=(p:any):Part=>({id:p.id,kode:p.kode_12nc||'',nama:p.nama_part,kategori:p.kategori,mesin:p.mesin||'',bin:p.nomor_bin,stok:Number(p.stok_saat_ini)||0,reorder:Number(p.reorder_point)||0,gambar:emojiMap[p.kategori]||'🔩',is_critical:!!p.is_critical,foto_url:p.foto_url||null}); // semua mesin pemakai part ("Dipakai di mesin")
  const [partBersama,setPartBersama]=useState<Record<number,{id:number;jatah:number}[]>>({}); // part dipakai banyak mesin + jatah (migrasi 18)
  const sudahInfoJatah=useRef<Set<string>>(new Set());
  const [asalKatalog,setAsalKatalog]=useState<'jenis'|'mold_mesin'>('jenis'); // asal masuk katalog (untuk tombol Kembali)
  // ── Maintenance Mold (template ganti mold) ──
  const [moldMesin,setMoldMesin]=useState<any[]|null>(null);
  const [moldMesinErr,setMoldMesinErr]=useState('');
  const [moldMesinAktif,setMoldMesinAktif]=useState<any|null>(null);
  const [moldList,setMoldList]=useState<any[]|null>(null);
  const [moldGrup,setMoldGrup]=useState<string|null>(null);
  const [moldAktif,setMoldAktif]=useState<{mold:any;items:any[]}|null>(null);
  const [moldPilih,setMoldPilih]=useState<Record<number,{on:boolean;qty:number}>>({});
  const [dariMold,setDariMold]=useState(false);
  const [dariPm,setDariPm]=useState(false);
  // Ambil part dari mesin yang bukan tanggung jawabnya -> wajib alasan, admin konfirmasi
  const [luarTugas,setLuarTugas]=useState<{nama:string;alasan:string}|null>(null);
  const [luarCek,setLuarCek]=useState<{m:any;go:()=>void}|null>(null);
  const [alasanLuar,setAlasanLuar]=useState('');
  const [pmData,setPmData]=useState<any[]|null>(null);
  const [pmItemId,setPmItemId]=useState<number|null>(null);
  const [cart,setCart]=useState<{part:Part;qty:number;urgent:boolean}[]>([]);
  const [partWO,setPartWO]=useState('');
  const [alasanAmbil,setAlasanAmbil]=useState(''); // alasan pengambilan (wajib untuk Non-molding)
  const [moldUnit,setMoldUnit]=useState<{id:number;nama:string}|null>(null); // unit mesin di alur Maintenance Mold / Machine
  const [partArea,setPartArea]=useState('');
  const [showHistory,setShowHistory]=useState(false);
  const [historyData,setHistoryData]=useState<any[]>([]);
  const [mode,setMode]=useState<Mode>('light');
  const [spareParts,setSpareParts]=useState<Part[]>([]);
  const [loadingParts,setLoadingParts]=useState(true);
  const [zooming,setZooming]=useState(false);
  const [mesinImages,setMesinImages]=useState<Record<string,string>>(()=>{
    try{const s=localStorage.getItem('mcc_mesinImages');return s?JSON.parse(s):{}}catch{return {};
    }
  });

  // ═══ STAGE 3 — VERIFICATION STATE ═══
  const [preparedRequests, setPreparedRequests] = useState<any[]>([]);
  const [currentVerifyRequest, setCurrentVerifyRequest] = useState<any|null>(null);
  const [adminPreparedPhoto, setAdminPreparedPhoto] = useState<string>('');
  const [verifyPhotoBase64, setVerifyPhotoBase64] = useState<string>('');
  const [verifyStatus, setVerifyStatus] = useState<'sesuai'|'tidak'|null>(null);
  const [verifyNotes, setVerifyNotes] = useState<string>('');
  const [verifying, setVerifying] = useState(false);

  const inputRef=useRef<HTMLInputElement>(null);
  const rfidBuf=useRef('');
  const rfidTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const gender=teknisi?.gender==='female'?'female':'male';
  const t=themes[gender][mode];
  const isFemale=gender==='female';
  const accentGrad='#0b5ed7';

  // Daftar part dimuat ulang setiap kali teknisi login, kembali ke layar tap, dan setelah kirim/verifikasi,
  // supaya angka stok selalu terbaru (dulu hanya dimuat sekali saat halaman dibuka).
  const muatParts=async()=>{
    try{
      // Daftar lengkap part aktif dari master (sama dengan Kelola part). Cadangan: API lama /api/parts.
      let d:any=await fetch('/api/mesin?parts=all',{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
      if(!d?.success||!Array.isArray(d.data))d=await fetch('/api/parts',{cache:'no-store'}).then(r=>r.json());
      if(d.success&&d.data.length>0){
        setSpareParts(d.data.map((p:any)=>({id:p.id,kode:p.kode_12nc||'',nama:p.nama_part,kategori:p.kategori,mesin:p.mesin||'',bin:p.nomor_bin,stok:p.stok_saat_ini,reorder:p.reorder_point,gambar:emojiMap[p.kategori]||'🔩',is_critical:p.is_critical||false,foto_url:p.foto_url||null})));
      }
    }catch{}
    try{
      fetch('/api/mesin',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d?.success)keJumlah(d.jenis||[]);}).catch(()=>{});
      const j=await fetch('/api/jatah?peta=1',{cache:'no-store'}).then(r=>r.json());
      if(j.success){const m:Record<number,{id:number;jatah:number}[]>={};(j.data||[]).forEach((x:any)=>{m[x.part_id]=x.mesin;});setPartBersama(m);}
    }catch{}
    setLoadingParts(false);
  };
  useEffect(()=>{muatParts();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const jid=selectedMesin?.jenisId;
    if(page!=='catalog'||!jid||selectedMesin?.consumable)return;
    let batal=false;
    fetch(`/api/mesin?parts=${jid}`,{cache:'no-store'}).then(r=>r.json()).then(d=>{if(!batal&&d?.success&&Array.isArray(d.data))setPartsMesin({jenisId:jid,list:d.data.map(kePart)});}).catch(()=>{});
    return ()=>{batal=true;};
  },[page,selectedMesin?.jenisId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(teknisi)muatParts();},[teknisi?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(page==='scan'||page==='selesai'||page==='verify_done')muatParts();},[page]); // eslint-disable-line react-hooks/exhaustive-deps
  // Angka part per mesin selalu ikut Admin: muat ulang saat masuk layar pilih mesin + tiap 30 detik selama di layar itu
  useEffect(()=>{
    if(page!=='jenis'&&page!=='mesin'&&page!=='sub_mesin'&&page!=='mold_mesin')return;
    // angka part + daftar unit mesin (unit yang dihapus / disembunyikan admin langsung hilang)
    muatMaster(); const iv=setInterval(muatMaster,30000);
    return ()=>clearInterval(iv);
  },[page]); // eslint-disable-line react-hooks/exhaustive-deps

  const muatMaster=async()=>{
      try{
        const [m,pt0]=await Promise.all([fetch('/api/mesin',{cache:'no-store'}).then(r=>r.json()),fetch('/api/mesin?peta=1',{cache:'no-store'}).then(r=>r.json()).catch(()=>null)]);
        if(!m?.success)return;
        const pt:any=pt0||{}; // peta gagal -> daftar mesin & unit tetap diperbarui, peta part lama dipertahankan
        const units:any[]=m.unit||[];
        const jenisArea:Record<number,'molding'|'nonmolding'>={};
        const ubah=(j:any)=>{
          jenisArea[j.id]=j.area==='Molding'?'molding':'nonmolding';
          const warna=j.warna||'#0b5ed7', emoji=j.emoji||'⚙️';
          return {nama:j.nama,emoji,color:warna,img:j.foto_url,jenisId:j.id,matchMesin:[],matchKat:[],
            sub:units.filter(u=>u.jenis_id===j.id).map(u=>({nama:`${j.nama} ${u.nomor_unit}`,emoji,color:warna,jenisId:j.id,unitId:u.id,matchMesin:[],matchKat:[]}))};
        };
        const jenis:any[]=m.jenis||[];
        keJumlah(jenis);
        setMasterMesin({molding:jenis.filter(j=>j.area==='Molding').map(ubah),nonmolding:jenis.filter(j=>j.area!=='Molding').map(ubah),jenisArea});
        if(pt0?.success){const peta:Record<number,number>={}; const cons=new Set<number>(); (pt.data||[]).forEach((r:any)=>{if(r.mesin_jenis_id)peta[r.id]=r.mesin_jenis_id;if(r.is_consumable)cons.add(r.id);}); setPartJenis(peta); setPartCons(cons); const pk:Record<number,number[]>={}; (pt.pakai||[]).forEach((x:any)=>{(pk[x.spare_part_id]??=[]).push(Number(x.mesin_jenis_id));}); setPartPakai(pk);}
      }catch{}
  };
  useEffect(()=>{muatMaster();},[]); // eslint-disable-line react-hooks/exhaustive-deps

  // Versi baru + tidak ada yang sedang login (layar tap badge) -> muat ulang otomatis
  useEffect(()=>{ if(versiBaru&&page==='scan'&&!teknisi) window.location.reload(); },[versiBaru,page,teknisi]);

  // ═══ POLLING FOR PREPARED REQUESTS (STAGE 3) ═══
  useEffect(() => {
    if (!teknisi || page !== 'waiting') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/requests?status=Prepared&teknisi_id=${teknisi.id}`);
        const data = await res.json();
        const requests = Array.isArray(data) ? data : data.data || [];
        const prepared = requests.filter((r:any) => r.status === 'Prepared' && Number(r.teknisi_id) === Number(teknisi.id));
        setPreparedRequests(prepared);
        if (prepared.length > 0) {
          setPage('verification');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [teknisi, page]);

  useEffect(()=>{if(!teknisi)return;fetch('/api/partout').then(r=>r.json()).then(d=>{if(d.success)setHistoryData(d.data.filter((r:any)=>r.teknisi_id===teknisi.id||r.teknisi_nama===teknisi.nama).slice(0,10));}).catch(()=>{});},[teknisi]);
  useEffect(() => {
    if (!currentVerifyRequest?.id) {
      setAdminPreparedPhoto('');
      return;
    }

    const loadAdminPhoto = async () => {
      try {
        const res = await fetch(`/api/request-foto?request_id=${currentVerifyRequest.id}`);
        const data = await res.json();
        const photos = Array.isArray(data) ? data : data.data || [];
        const adminPhoto = photos.find((p: any) => String(p.tipe_foto || '').toLowerCase() === 'siapkan');
        setAdminPreparedPhoto(adminPhoto?.foto_base64 || '');
      } catch {
        setAdminPreparedPhoto('');
      }
    };

    loadAdminPhoto();
  }, [currentVerifyRequest?.id]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(page!=='scan')return;
      if(e.key==='Enter'){const rfid=rfidBuf.current.trim();if(rfid)processRFID(rfid);rfidBuf.current='';setScanning(false);}
      else if(e.key.length===1){rfidBuf.current+=e.key;setScanning(true);if(rfidTimer.current)clearTimeout(rfidTimer.current);rfidTimer.current=setTimeout(()=>{rfidBuf.current='';setScanning(false);},500);}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[page]);

  const processRFID=async(rfid:string)=>{
    setScanning(false);
    try{
      const res=await fetch('/api/rfid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rfid})});
      const data=await res.json();
      if(data.success){
        const u=data.user;
        setTeknisi({id:u.id,nama:u.nama,employee_id:u.employee_id,role:u.role,rfid_tag:u.rfid_tag,gender:u.gender||'male',foto:u.nama.split(' ').map((n:string)=>n[0]).join('').toUpperCase().slice(0,2),bagian:u.bagian||'',nomor_mesin:u.nomor_mesin||'',mesin_tambahan:Array.isArray(u.mesin_tambahan)?u.mesin_tambahan:[]});
        setError('');setFailCount(0);setShowManual(false);
        if(u.bagian)setPartArea(u.nomor_mesin||u.bagian||'');
        const keMold=isMoldUser(u.bagian); if(keMold)muatMoldMesin(katTim(u.bagian));
        setZooming(true);setTimeout(()=>{setPage(keMold?'mold_mesin':'jenis');setZooming(false);},2600);
      }else{const nf=failCount+1;setFailCount(nf);setError(data.error||'Badge tidak dikenali!');if(nf>=3)setShowManual(true);setTimeout(()=>setError(''),6000);}
    }catch{setError('Gagal terhubung ke server!');setTimeout(()=>setError(''),3000);}
  };

  const logout=()=>{sudahInfoJatah.current=new Set();setPage('scan');setTeknisi(null);setCart([]);setRfidInput('');setShowHistory(false);setFailCount(0);setShowManual(false);setSelectedMesin(null);setSelectedGroup(null);setSearch('');setFilterKat('Semua');setPreparedRequests([]);setCurrentVerifyRequest(null);setVerifyPhotoBase64('');setVerifyStatus(null);setVerifyNotes('');};
  // ===== Layar "Apakah sudah selesai?": pesan lagi, atau keluar otomatis setelah 30 detik tanpa aktivitas =====
  const [idleLeft,setIdleLeft]=useState(30);
  const pesanLagi=()=>{setCart([]);setPartWO('');setAlasanAmbil('');setMoldUnit(null);setSelectedMesin(null);setSelectedGroup(null);setSearch('');setFilterKat('Semua');setCurrentVerifyRequest(null);setVerifyPhotoBase64('');setVerifyStatus(null);setVerifyNotes('');setDariMold(false);setDariPm(false);setLuarTugas(null);setMoldAktif(null);if(isMoldUser(teknisi?.bagian)){muatMoldMesin();setPage('mold_mesin');}else setPage('jenis');};
  useEffect(()=>{
    if(page!=='selesai')return;
    setIdleLeft(30);
    const reset=()=>setIdleLeft(v=>v===30?v:30);
    const ev=['pointerdown','pointermove','keydown','touchstart'];
    ev.forEach(e=>window.addEventListener(e,reset,{passive:true}));
    const timer=setInterval(()=>setIdleLeft(v=>v-1),1000);
    return()=>{clearInterval(timer);ev.forEach(e=>window.removeEventListener(e,reset));};
  },[page]);
  useEffect(()=>{if(page==='selesai'&&idleLeft<=0)logout();},[idleLeft,page]);

  const addToCart=(part:Part)=>{cekJatah(part,1);setCart(prev=>prev.find(c=>c.part.id===part.id)?prev:[...prev,{part,qty:1,urgent:false}]);};
  const updateQty=(id:number,d:number)=>{const c0=cart.find(c=>c.part.id===id);if(c0&&d>0)cekJatah(c0.part,c0.qty+d);setQty0(id,d);};
  const setQty0=(id:number,d:number)=>setCart(prev=>prev.map(c=>c.part.id===id?{...c,qty:Math.max(0,c.qty+d)}:c).filter(c=>c.qty>0));
  const toggleUrgent=(id:number)=>setCart(prev=>prev.map(c=>c.part.id===id?{...c,urgent:!c.urgent}:c));
  const getQty=(id:number)=>cart.find(c=>c.part.id===id)?.qty||0;
  const totalItem=cart.reduce((a,c)=>a+c.qty,0);
  const hasUrgent=cart.some(c=>c.urgent);
  // Part cocok dengan mesin: pakai Master Data (jenis mesin) kalau ada, kalau tidak pakai aturan lama
  const cocok=(p:any,m:any)=>m&&m.consumable?partCons.has(p.id):m&&m.jenisId?(partJenis[p.id]===m.jenisId||!!partBersama[p.id]?.some(x=>x.id===m.jenisId)||!!partPakai[p.id]?.includes(m.jenisId)):partMatchesMesin(p,m);
  // Jatah part bersama untuk mesin yang sedang dibuka (null = bukan part bersama)
  const jatahDi=(partId:number,jenisId?:number)=>{const b=partBersama[partId];if(!b||!jenisId)return null;return b.find(x=>x.id===jenisId)?.jatah??0;};
  const namaJenis=(id:number)=>masterMesin?[...masterMesin.molding,...masterMesin.nonmolding].find((m:any)=>m.jenisId===id)?.nama||'mesin lain':'mesin lain';
  const cekJatah=(part:Part,qtyBaru:number)=>{
    const jid=selectedMesin?.jenisId;const j=jatahDi(part.id,jid);
    if(j==null||qtyBaru<=j)return;
    const kunci=`${part.id}|${jid}`;if(sudahInfoJatah.current.has(kunci))return;sudahInfoJatah.current.add(kunci);
    const lain=(partBersama[part.id]||[]).filter(x=>x.id!==jid&&x.jatah>0).sort((a,b)=>b.jatah-a.jatah).map(x=>`${namaJenis(x.id)} (${x.jatah})`).join(', ');
    beritahu(`Jatah ${selectedMesin?.nama} untuk ${part.nama} tinggal ${j} pcs. Kelebihannya akan diambil dari jatah ${lain||'mesin lain'} dan tercatat di riwayat pinjam jatah.`,'Jatah mesin habis');
  };
  // Kotak "Consumable part": part habis pakai lintas mesin
  const MESIN_CONS={nama:'Consumable part',emoji:'🧴',color:'#b45309',consumable:true,matchMesin:[],matchKat:[]};
  const bukaConsumable=(asal:'jenis'|'mold_mesin')=>{setAsalKatalog(asal);setLuarTugas(null);setSelectedGroup(null);setSelectedMesin(MESIN_CONS);setSearch('');setFilterKat('Semua');const bg=String(teknisi?.bagian||'').trim();setPartArea(`${bg&&bg!=='-'?bg+' · ':''}Consumable`);setPage('catalog');};
  const jumlahCons=spareParts.filter(p=>partCons.has(p.id)).length;
  // Pintasan "Mesin saya": bagian utama + mesin tambahan (Kelola Pengguna)
  const mesinSaya:{m:any;jenis:Jenis}[]=(()=>{
    if(!teknisi||!masterMesin)return [];
    const semua:{m:any;jenis:Jenis}[]=[...masterMesin.molding.map((m:any)=>({m,jenis:'molding' as Jenis})),...masterMesin.nonmolding.map((m:any)=>({m,jenis:'nonmolding' as Jenis}))];
    const hasil:{m:any;jenis:Jenis}[]=[];
    const tambah=(x?:{m:any;jenis:Jenis})=>{if(x&&!hasil.some(h=>h.m.jenisId===x.m.jenisId))hasil.push(x);};
    const bg=String(teknisi.bagian||'').trim().toLowerCase();
    if(bg)tambah(semua.find(x=>String(x.m.nama).trim().toLowerCase()===bg));
    (teknisi.mesin_tambahan||[]).forEach(t=>tambah(semua.find(x=>x.m.jenisId===t.id)));
    return hasil;
  })();
  const tugasIds=new Set<number>(mesinSaya.map(x=>x.m.jenisId));
  const cekTugas=(m:any,go:()=>void)=>{
    // Belum diatur mesinnya oleh admin, atau mesin ini memang tugasnya -> langsung lanjut
    if(!tugasIds.size||!m?.jenisId||tugasIds.has(m.jenisId)){setLuarTugas(null);go();return;}
    setAlasanLuar('');setLuarCek({m,go});
  };
  const bukaMesinSaya=(x:{m:any;jenis:Jenis},asal:'jenis'|'mold_mesin'='jenis')=>{setAsalKatalog(asal);setSelectedJenis(x.jenis);if(x.m.sub&&x.m.sub.length>0){setSelectedGroup(x.m);setSelectedMesin(null);setPage('sub_mesin');}else{setSelectedGroup(null);setSelectedMesin(x.m);setSearch('');setFilterKat('Semua');setPartArea(x.m.nama);setPage('catalog');}};
  const areaPart=(p:any):Jenis=>masterMesin&&partJenis[p.id]?masterMesin.jenisArea[partJenis[p.id]]:getJenis(p.mesin,p.kategori);
  const daftarMolding:any[]=masterMesin?masterMesin.molding:MESIN_MOLDING;
  const daftarNonMolding:any[]=masterMesin?masterMesin.nonmolding:MESIN_NONMOLDING;
  const mesinParts=selectedMesin?(selectedMesin.jenisId&&partsMesin&&partsMesin.jenisId===selectedMesin.jenisId?partsMesin.list:spareParts.filter(p=>cocok(p,selectedMesin))):[];
  // Kategori yang sebenarnya nama mesin ini (mis. "TAMPON" dan "Tampon Printing" data lama) disatukan jadi nama mesin
  const namaMesinAktif=String((selectedMesin?.jenisId&&namaJenis(selectedMesin.jenisId)!=='mesin lain')?namaJenis(selectedMesin.jenisId):(selectedMesin?.nama||'')).trim();
  const katLabel=(k:any)=>{const a=String(k||'').trim();const x=a.toLowerCase(),m=namaMesinAktif.toLowerCase();
    if(!a)return namaMesinAktif||'Lainnya';if(m&&(x===m||x.includes(m)||m.includes(x)))return namaMesinAktif;return a;};
  // Kategori part = Critical / Normal (sama dengan Admin)
  const katCN=(p:any)=>p?.is_critical?'Critical':'Normal';
  const kategoriList=['Semua',...['Critical','Normal'].filter(k=>mesinParts.some((p:any)=>katCN(p)===k))];
  const filtered=mesinParts.filter((p:any)=>(p.nama.toLowerCase().includes(search.toLowerCase())||p.kode.toLowerCase().includes(search.toLowerCase()))&&(filterKat==='Semua'||katCN(p)===filterKat));
  // Tim dengan template: Maintenance Mold (jenis mold) & Maintenance Machine (jenis pekerjaan)
  const katTim=(b?:string):'mold'|'mesin'|null=>{const x=String(b||'').trim().toLowerCase();return x==='maintenance mold'?'mold':x==='maintenance machine'?'mesin':null;};
  const isMoldUser=(b?:string)=>katTim(b)!==null;
  const LT = katTim(teknisi?.bagian)==='mesin'
    ? { header:'Maintenance mesin', badge:'MAINTENANCE MACHINE', warna:'#6d28d9', judul:'PM mesin: pilih mesin', item:'item PM berisi part', pilih:'Pilih pekerjaan', alat:'Siapkan alat kerja', memuat:'Memuat template maintenance mesin...', area:'Pekerjaan', ikon:'🔧' }
    : { header:'Ganti mold', badge:'MAINTENANCE MOLD', warna:'#0f766e', judul:'Ganti mold: pilih mesin', item:'jenis mold', pilih:'Pilih mold', alat:'Siapkan alat ganti mold', memuat:'Memuat template ganti mold...', area:'Mold', ikon:'🧩' };
  const muatMoldMesin=(kat?:'mold'|'mesin'|null)=>{setMoldMesin(null);setMoldMesinErr('');const k=kat||katTim(teknisi?.bagian)||'mold';fetch(k==='mesin'?'/api/pm':`/api/mold?kategori=${k}`).then(r=>r.json()).then(d=>{setMoldMesin(d.success?(d.data||[]):[]);if(!d.success)setMoldMesinErr(d.error||'Gagal memuat data');}).catch(()=>{setMoldMesin([]);setMoldMesinErr('Tidak bisa menghubungi server');});};
  // Unit mesin dari Master Data (sama seperti AOKI 1, AOKI 2 ... di alur biasa)
  const unitMesinDari=(m:any):any[]=>{if(!masterMesin||!m)return [];const semua=[...masterMesin.molding,...masterMesin.nonmolding];
    const j=semua.find((x:any)=>x.jenisId===m.id)||semua.find((x:any)=>String(x.nama).trim().toLowerCase()===String(m.nama||'').trim().toLowerCase());return j?.sub||[];};
  // Mold: mesin yang punya template. Maintenance Machine: mesin yang punya kegiatan PM (spare part boleh kosong)
  const tampilMoldMesin=(m:any)=>katTim(teknisi?.bagian)==='mesin'?(Number(m.total_item)||0)>0:m.jumlah_mold>0;
  const pilihMoldMesin=(m:any)=>{const u=unitMesinDari(m);setMoldUnit(null);if(u.length>0){setMoldMesinAktif(m);setPage('mold_unit');return;}bukaMoldMesin(m);};
  const bukaMoldMesin=(m:any)=>{if(katTim(teknisi?.bagian)==='mesin'){setMoldMesinAktif(m);setPmData(null);setPage('pm_checklist');fetch(`/api/pm?mesin=${m.id}`).then(r=>r.json()).then(d=>{const data=d.success?(d.data||[]):[];setPmData(data);const awal:Record<number,{on:boolean;qty:number}>={};data.forEach((it:any)=>it.parts.forEach((p:any)=>{awal[p.id]={on:false,qty:Math.max(1,Math.min(p.qty,p.stok_saat_ini||p.qty))};}));setMoldPilih(awal);}).catch(()=>setPmData([]));return;}setMoldMesinAktif(m);setMoldList(null);setMoldGrup(null);setPage('mold_pilih');fetch(`/api/mold?mesin=${m.id}&kategori=${katTim(teknisi?.bagian)||'mold'}`).then(r=>r.json()).then(d=>setMoldList(d.success?(d.data||[]):[])).catch(()=>setMoldList([]));};
  const bukaMold=(id:number)=>{setMoldAktif(null);setPage('mold_template');fetch(`/api/mold?mold=${id}`).then(r=>r.json()).then(d=>{if(!d.success)return;setMoldAktif({mold:d.mold,items:d.items||[]});const awal:Record<number,{on:boolean;qty:number}>={};(d.items||[]).filter((i:any)=>i.tipe==='part').forEach((i:any)=>{awal[i.id]={on:i.stok_saat_ini>0,qty:Math.max(1,Math.min(i.qty,i.stok_saat_ini||i.qty))};});setMoldPilih(awal);}).catch(()=>{});};
  const masukkanTemplate=(items:any[])=>{
    const baru=items.map((it:any)=>{
      const p=spareParts.find(x=>x.id===it.spare_part_id)||{id:it.spare_part_id,kode:it.kode_12nc||'',nama:it.nama_part,kategori:it.kategori||'',mesin:'',bin:it.nomor_bin||'',stok:it.stok_saat_ini,reorder:it.reorder_point,gambar:'🔩',is_critical:!!it.is_critical,foto_url:it.foto_url||null};
      return {part:p as Part,qty:moldPilih[it.id]?.qty||it.qty,urgent:false};
    });
    setCart(prev=>{const sisa=prev.filter(c=>!baru.some(b=>b.part.id===c.part.id));return [...sisa,...baru];});
    if(moldAktif)setPartArea(`${moldUnit?.nama||moldAktif.mold.mesin_nama} · ${LT.area} ${moldAktif.mold.nama_mold}`);
    setDariMold(true);setPage('cart');
  };
  const masukkanPm=(items:any[])=>{
    const baru=items.map((it:any)=>{
      const p=spareParts.find(x=>x.id===it.spare_part_id)||{id:it.spare_part_id,kode:it.kode_12nc||'',nama:it.nama_part,kategori:it.kategori||'',mesin:'',bin:it.nomor_bin||'',stok:it.stok_saat_ini,reorder:it.reorder_point,gambar:'🔩',is_critical:!!it.is_critical,foto_url:it.foto_url||null};
      return {part:p as Part,qty:moldPilih[it.id]?.qty||it.qty,urgent:false};
    });
    setCart(prev=>{const sisa=prev.filter(c=>!baru.some(b=>b.part.id===c.part.id));return [...sisa,...baru];});
    setPartArea(`${moldUnit?.nama||moldMesinAktif?.nama||''} · PM`);
    setDariMold(false);setDariPm(true);setPage('cart');
  };
  const areaKirim=()=>luarTugas&&!dariMold&&!dariPm&&!selectedMesin?.consumable?`${partArea||luarTugas.nama} · Luar tugas: ${luarTugas.alasan}`:partArea;
  const handleSubmit=async()=>{if(!cart.length||!teknisi)return;if(wajibAlasan&&!alasanAmbil.trim()){beritahu('Isi dulu alasan pengambilan (wajib untuk area Non-molding).','Alasan wajib diisi');return;}try{for(const c of cart)await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({teknisi_id:teknisi.id,teknisi_nama:teknisi.nama,spare_part_id:c.part.id,part_nama:c.part.nama,jumlah:c.qty,nomor_wo:partWO,mesin_area:areaKirim().slice(0,100),mesin_id:selectedMesin?.unitId||moldUnit?.id||null,alasan_ambil:alasanAmbil.trim()||null,mold_id:dariMold&&moldAktif?moldAktif.mold.id:null,is_urgent:c.urgent})});setPage('waiting');setTimeout(()=>{setCart([]);setPartWO('');setAlasanAmbil('');},2000);}catch{beritahu('Gagal mengirim request!');}};

  const gc:React.CSSProperties={background:t.cardBg,border:`1px solid ${t.border}`,borderRadius:'8px'};
  const gn:React.CSSProperties={background:t.navBg,borderBottom:`1px solid ${t.border}`};
  // Non-molding: maintenance digabung, jadi alasan pengambilan wajib (tidak berlaku untuk alur Maintenance Mold / PM)
  const wajibAlasan=!dariMold&&!dariPm&&!selectedMesin?.consumable&&(selectedMesin?.jenisId&&masterMesin?masterMesin.jenisArea[selectedMesin.jenisId]==='nonmolding':selectedJenis==='nonmolding');
  const inp:React.CSSProperties={background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',padding:'10px 12px',color:t.text,fontSize:'15px',outline:'none',fontFamily:'inherit',width:'100%',boxSizing:'border-box'};
  const iconBtn:React.CSSProperties={height:'44px',minWidth:'44px',padding:'0 12px',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'8px',border:`1px solid ${t.border}`,borderRadius:'8px',background:t.cardBg,color:t.text,fontFamily:'inherit',fontSize:'15px',fontWeight:600,cursor:'pointer'};
  // Total per area = jumlah part semua mesin di area itu, sama dengan angka di Kelola part (Admin)
  const totalArea=(a:'molding'|'nonmolding')=>{const l:any[]=masterMesin?(a==='molding'?masterMesin.molding:masterMesin.nonmolding):[];
    if(l.length&&l.every((m:any)=>jumlahMesin[m.jenisId]))return l.reduce((s:number,m:any)=>s+(jumlahMesin[m.jenisId]?.part||0),0);
    return spareParts.filter(p=>areaPart(p)===a).length;};
  const countM=(m:any)=>m?.jenisId&&jumlahMesin[m.jenisId]?jumlahMesin[m.jenisId].part:spareParts.filter(p=>cocok(p,m)).length;
  const lowM=(m:any)=>m?.jenisId&&jumlahMesin[m.jenisId]?jumlahMesin[m.jenisId].warn:spareParts.filter(p=>cocok(p,m)&&p.stok<=p.reorder).length;

  const getMesinImg=(m:any)=>m.jenisId?(m.img||null):(mesinImages[m.nama]||m.img||null); // Master Data: gambar dari database

  const MesinCard=({m,onClick,delay=0}:{m:any;onClick:()=>void;delay?:number})=>{
    // Master Data: part milik jenis mesin (dipakai bersama semua unit), jadi tidak dijumlah per unit
    const count=m.jenisId?countM(m):m.sub&&m.sub.length>0?m.sub.reduce((a:number,s:any)=>a+countM(s),0):countM(m);
    const low=m.jenisId?lowM(m):m.sub&&m.sub.length>0?m.sub.reduce((a:number,s:any)=>a+lowM(s),0):lowM(m);
    const imgSrc=getMesinImg(m);
    return(
      <div onClick={onClick} style={{...gc,padding:'20px',cursor:'pointer',border:`1px solid ${m.color}33`,transition:'all 0.25s',textAlign:'center',animation:`cardPop 0.4s ease both`,animationDelay:`${delay}ms`}}
        onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=m.color;e.currentTarget.style.boxShadow=`0 12px 40px ${m.color}25`;}}
        onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=`${m.color}33`;e.currentTarget.style.boxShadow='none';}}>
        {imgSrc
          ?<img src={imgSrc} style={{width:'80px',height:'80px',objectFit:'contain',marginBottom:'10px'}}/>
          :<div style={{fontSize:'40px',marginBottom:'10px'}}>{m.emoji}</div>
        }
        <div style={{fontSize:'13px',fontWeight:700,color:t.text,marginBottom:'4px'}}>{m.nama}</div>
        {m.sub&&m.sub.length>0&&<div style={{fontSize:'10px',color:m.color,marginBottom:'3px'}}>{m.sub.length} unit ›</div>}
        <div style={{fontSize:'12px',fontWeight:700,color:m.color,marginBottom:'3px'}}>{count} part</div>
        {low>0&&<div style={{fontSize:'10px',color:'#c62828',fontWeight:600}}>⚠ {low} low stock</div>}
      </div>
    );
  };

  return(
    <main className="mcc-tk" style={{minHeight:'100vh',fontFamily:'var(--mcc-font)',position:'relative',overflow:'hidden',color:t.text,background:t.overlay,transition:'background-color 200ms, color 200ms'}}>
      <DialogHost/>
      <KeyboardLayar t={t}/>
      {luarCek&&(<div role="dialog" aria-modal="true" aria-labelledby="luar-judul" style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(8,15,28,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
        <div style={{...gc,width:'100%',maxWidth:'460px',padding:'22px',display:'flex',flexDirection:'column',gap:'12px',color:t.text}}>
          <div id="luar-judul" style={{fontSize:'18px',fontWeight:800}}>⚠ Bukan mesin tanggung jawab kamu</div>
          <div style={{fontSize:'14px',color:t.textMuted,lineHeight:1.5}}>Kamu tidak tercatat menangani <b style={{color:t.text}}>{luarCek.m.nama}</b>. Kenapa ambil part di sini? Permintaan tetap bisa dikirim, tapi admin akan mengonfirmasi dulu.</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
            {['Stok di mesin saya habis','Bantu mesin lain','Ditugaskan leader'].map(a=>(<button key={a} type="button" onClick={()=>setAlasanLuar(a)} style={{...iconBtn,height:'34px',fontSize:'13px',borderColor:alasanLuar===a?t.accent:t.border,color:alasanLuar===a?t.accentLight:t.text}}>{a}</button>))}
          </div>
          <input value={alasanLuar} onChange={e=>setAlasanLuar(e.target.value)} maxLength={60} placeholder="Tulis alasan singkat..." style={inp} autoFocus/>
          <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
            <button type="button" onClick={()=>setLuarCek(null)} style={iconBtn}>Batal</button>
            <button type="button" disabled={!alasanLuar.trim()} onClick={()=>{const c=luarCek;setLuarTugas({nama:c.m.nama,alasan:alasanLuar.trim()});setLuarCek(null);c.go();}} style={{...iconBtn,background:alasanLuar.trim()?t.accent:t.inputBg,color:alasanLuar.trim()?'#fff':t.textMuted,border:'none',cursor:alasanLuar.trim()?'pointer':'not-allowed'}}>Lanjut, minta konfirmasi admin</button>
          </div>
        </div>
      </div>)}
      <div style={{position:'fixed',inset:0,zIndex:0,background:t.overlay}}/>
      <div style={{position:'fixed',inset:0,zIndex:1,background:t.overlay,transition:'background 0.5s'}}/>
      <div style={{position:'relative',zIndex:10,minHeight:'100vh',display:'flex',flexDirection:'column'}}>

        {teknisi&&(<nav style={{...gn,padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px',height:'72px',position:'sticky',top:0,zIndex:100}}>
          <div style={{display:'flex',alignItems:'center',gap:'16px',minWidth:0}}>
            <div style={{fontSize:'20px',fontWeight:700,letterSpacing:'1px',color:t.text}}>PHILIPS</div>
            <div style={{width:'1px',height:'24px',background:t.border}}/>
            <div style={{fontSize:'15px',color:t.textMuted,whiteSpace:'nowrap'}}>{isMoldUser(teknisi.bagian)?LT.header:'Permintaan spare part'}</div>
            {isMoldUser(teknisi.bagian)&&<span style={{fontSize:'12px',fontWeight:700,letterSpacing:'0.5px',padding:'4px 10px',borderRadius:'12px',background:LT.warna,color:'#ffffff',whiteSpace:'nowrap'}}>{LT.badge}</span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            {totalItem>0&&page!=='cart'&&page!=='waiting'&&(<button onClick={()=>setPage('cart')} style={{...iconBtn,border:'none',background:hasUrgent?'var(--mcc-danger)':'var(--mcc-blue)',color:'#ffffff'}}>
              <IconCart/> Keranjang <span style={{background:'#ffffff',color:hasUrgent?'var(--mcc-danger)':'var(--mcc-blue)',borderRadius:'10px',padding:'0 8px',fontSize:'13px',fontWeight:700,lineHeight:'20px'}}>{totalItem}</span>
            </button>)}
            <button onClick={()=>setShowHistory(!showHistory)} aria-expanded={showHistory} style={{...iconBtn,background:showHistory?t.tag:t.cardBg,color:showHistory?t.accentLight:t.text}}><IconClock/> Riwayat</button>
            <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'0 12px',height:'44px',borderLeft:`1px solid ${t.border}`,marginLeft:'4px'}}>
              <div style={{width:'32px',height:'32px',borderRadius:'16px',background:'var(--mcc-blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,color:'#ffffff'}}>{teknisi.foto}</div>
              <div style={{display:'flex',flexDirection:'column'}}>
                <span style={{fontSize:'15px',fontWeight:600,color:t.text}}>{teknisi.nama}</span>
                {teknisi.bagian&&teknisi.bagian.trim()!=='-'&&<span style={{fontSize:'13px',color:t.textMuted}}>{teknisi.bagian}</span>}
              </div>
            </div>
            <LiveClock color={t.text}/>
            <button onClick={()=>setMode(m=>m==='dark'?'light':'dark')} style={iconBtn} aria-label={mode==='dark'?'Ganti ke mode terang':'Ganti ke mode gelap'}>{mode==='dark'?<IconSun/>:<IconMoon/>}</button>
            <button onClick={logout} style={{...iconBtn,color:'var(--mcc-danger)'}}><IconLogout/> Keluar</button>
          </div>
        </nav>)}

        {showHistory&&teknisi&&(<div style={{...gn,padding:'12px 24px'}}>
          <div style={{fontSize:'15px',fontWeight:600,color:t.text,marginBottom:'10px'}}>Riwayat pengambilan {teknisi.nama}</div>
          <div style={{display:'flex',gap:'10px',overflowX:'auto'}}>
            {historyData.length===0?<div style={{fontSize:'12px',color:t.textMuted,padding:'10px 0'}}>Belum ada riwayat</div>
              :historyData.map((r:any,i:number)=>(<div key={i} style={{...gc,padding:'10px 14px',minWidth:'240px',flexShrink:0,borderRadius:'10px'}}>
                <div style={{fontSize:'11px',fontWeight:600,color:t.text,marginBottom:'4px'}}>{r.nama_part}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'9px',color:t.textMuted,fontFamily:'inherit'}}>{r.nomor_wo||'-'} · {tglDb(r.tanggal_keluar).toLocaleDateString('id-ID')}</span>
                  <span style={{fontSize:'11px',fontWeight:700,color:t.accentLight}}>x{r.jumlah_keluar}</span>
                </div>
              </div>))}
          </div>
        </div>)}

        {zooming&&(<div role="status" style={{position:'fixed',inset:0,zIndex:999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'10px',background:'var(--mcc-blue)',color:'#ffffff',animation:'fadeIn 250ms var(--mcc-ease) both',pointerEvents:'none'}}>
          <div style={{position:'absolute',inset:0,background:'var(--mcc-blue)',animation:'fadeOut 0.6s ease forwards',animationDelay:'2s'}}/>
          <div className="mcc-fade-in" style={{position:'relative',fontSize:'32px',fontWeight:700,animationDelay:'150ms'}}>Halo, {teknisi?.nama}</div>
          <div style={{position:'relative',fontSize:'18px',color:'#dce8fb'}}>{isMoldUser(teknisi?.bagian)?LT.memuat:'Memuat katalog spare part...'}</div>
        </div>)}

        {page==='scan'&&(<div style={{flex:1,display:'flex',flexDirection:'column',minHeight:'100vh'}}>
          <header style={{...gn,height:'80px',display:'flex',alignItems:'center',gap:'20px',padding:'0 40px',boxSizing:'border-box'}}>
            <div style={{fontSize:'24px',fontWeight:700,letterSpacing:'1px',color:t.text}}>PHILIPS</div>
            <div style={{width:'1px',height:'28px',background:t.border}}/>
            <div style={{fontSize:'18px',color:t.textMuted,flex:1}}>Permintaan spare part Store MCC</div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
              <LiveClock color={t.text} size={24}/>
              <span style={{fontSize:'14px',color:t.textMuted}}>{new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span>
            </div>
            <button onClick={()=>setMode(m=>m==='dark'?'light':'dark')} style={{...iconBtn,width:'48px',height:'48px'}} aria-label={mode==='dark'?'Ganti ke mode terang':'Ganti ke mode gelap'}>{mode==='dark'?<IconSun/>:<IconMoon/>}</button>
          </header>

          <div className="mcc-tk-scan" style={{flex:1,display:'flex',gap:'32px',padding:'40px',boxSizing:'border-box'}}>
            <section aria-live="polite" style={{flex:1,background:'var(--mcc-blue)',borderRadius:'12px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'28px',padding:'48px',boxSizing:'border-box',color:'#ffffff',textAlign:'center'}}>
              <svg width="220" height="220" viewBox="0 0 220 220" fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={scanning?'mcc-tk-reading':undefined}>
                <circle cx="110" cy="110" r="106" strokeOpacity="0.14" strokeWidth="1.5"/>
                <circle cx="110" cy="110" r="84" strokeOpacity="0.22" strokeWidth="1.5"/>
                <circle cx="110" cy="110" r="62" strokeOpacity="0.32" strokeWidth="1.5"/>
                <rect x="72" y="84" width="76" height="52" rx="6" strokeWidth="3"/>
                <circle cx="94" cy="106" r="8" strokeWidth="3"/>
                <path d="M86 126c2-6 14-6 16 0" strokeWidth="3"/>
                <path d="M112 102h24M112 114h16" strokeWidth="3"/>
              </svg>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                <h1 style={{margin:0,fontSize:'44px',lineHeight:1.1,fontWeight:700}}>{scanning?'Membaca kartu...':'Tempelkan kartu ID Anda'}</h1>
                <div style={{fontSize:'20px',color:'#dce8fb'}}>{scanning?'Tahan kartu sebentar.':'Dekatkan kartu ke pembaca RFID sampai terdengar bunyi.'}</div>
              </div>
              {error
                ?<div role="alert" style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 18px',borderRadius:'8px',background:'#ffffff',color:'var(--mcc-danger)',fontSize:'17px',fontWeight:600}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>
                  {error}
                </div>
                :<div style={{display:'flex',alignItems:'center',gap:'10px',height:'40px',padding:'0 18px',borderRadius:'20px',background:'rgba(255,255,255,0.14)',fontSize:'16px',fontWeight:600}}>
                  <span style={{width:'10px',height:'10px',borderRadius:'5px',background:scanning?'#ffd666':'#7fe0a0'}}/>
                  {scanning?'Membaca...':'Pembaca siap'}
                </div>}
                            {/* ===== [DEBUG-LOGIN-MANUAL] MULAI — hanya tampil jika .env.local berisi NEXT_PUBLIC_DEBUG_MANUAL_LOGIN=true ===== */}
              {process.env.NEXT_PUBLIC_DEBUG_MANUAL_LOGIN==='true'&&(
                <div style={{width:'100%',maxWidth:'420px',display:'flex',flexDirection:'column',gap:'8px',padding:'14px',border:'1px dashed rgba(255,255,255,0.6)',borderRadius:'8px',textAlign:'left'}}>
                  <label htmlFor="debug-rfid-input" style={{fontSize:'14px',fontWeight:600,color:'#ffffff'}}>Debug: login tanpa kartu</label>
                  <div style={{display:'flex',gap:'8px'}}>
                    <input id="debug-rfid-input" defaultValue="0002912555" placeholder="RFID tag"
                      onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')processRFID(e.currentTarget.value.trim());}}
                      style={{flex:1,height:'44px',padding:'0 12px',border:'none',borderRadius:'6px',background:'#ffffff',color:'#13294b',fontFamily:'inherit',fontSize:'15px',outline:'none'}}/>
                    <button type="button"
                      onClick={()=>{const el=document.getElementById('debug-rfid-input') as HTMLInputElement|null;if(el)processRFID(el.value.trim());}}
                      style={{height:'44px',padding:'0 18px',border:'2px solid #ffffff',borderRadius:'6px',background:'transparent',color:'#ffffff',fontFamily:'inherit',fontSize:'15px',fontWeight:600,cursor:'pointer'}}>Masuk</button>
                  </div>
                </div>
              )}
              {/* ===== [DEBUG-LOGIN-MANUAL] SELESAI ===== */}
              {showManual&&(<div className="mcc-fade-in" style={{width:'100%',maxWidth:'420px',display:'flex',flexDirection:'column',gap:'10px',textAlign:'left'}}>
                <label htmlFor="rfid-manual" style={{fontSize:'15px',color:'#dce8fb'}}>Kartu tidak terbaca? Ketik Employee ID Anda</label>
                <div style={{display:'flex',gap:'8px'}}>
                  <input id="rfid-manual" ref={inputRef} value={rfidInput} onChange={e=>setRfidInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&processRFID(rfidInput.trim())} placeholder="Employee ID" style={{flex:1,height:'48px',padding:'0 14px',border:'none',borderRadius:'6px',background:'#ffffff',color:'#13294b',fontFamily:'inherit',fontSize:'16px',outline:'none'}}/>
                  <button onClick={()=>processRFID(rfidInput.trim())} style={{height:'48px',padding:'0 20px',border:'2px solid #ffffff',borderRadius:'6px',background:'transparent',color:'#ffffff',fontFamily:'inherit',fontSize:'16px',fontWeight:600,cursor:'pointer'}}>Masuk</button>
                </div>
              </div>)}
            </section>

            <aside style={{...gc,width:'400px',flexShrink:0,borderRadius:'12px',padding:'32px',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:'24px'}}>
              <h2 style={{margin:0,fontSize:'22px',fontWeight:700,color:t.text}}>Cara meminta part</h2>
              <ol style={{margin:0,padding:0,listStyle:'none',display:'flex',flexDirection:'column',gap:'20px'}}>
                {[
                  ['Tempelkan kartu','Sistem mengenali nama dan area kerja Anda.'],
                  ['Pilih area mesin','Molding atau non-molding, lalu mesinnya.'],
                  ['Pilih part dan jumlah','Stok yang tersedia langsung terlihat.'],
                  ['Kirim permintaan','Admin menyiapkan part dan mengambil foto bukti.'],
                ].map(([judul,ket],i)=>(
                  <li key={judul} style={{display:'flex',gap:'16px'}}>
                    <div style={{width:'36px',height:'36px',flexShrink:0,borderRadius:'18px',background:i===0?'var(--mcc-blue)':t.tag,color:i===0?'#ffffff':t.accentLight,fontSize:'17px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{i+1}</div>
                    <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                      <div style={{fontSize:'18px',fontWeight:600,color:t.text}}>{judul}</div>
                      <div style={{fontSize:'16px',color:t.textMuted}}>{ket}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <div style={{marginTop:'auto',paddingTop:'20px',borderTop:`1px solid ${t.border}`,fontSize:'15px',color:t.textMuted}}>Kartu tidak terbaca? Hubungi admin Store MCC.</div>
            </aside>
          </div>
        </div>)}

        {/* ═══ MAINTENANCE MOLD: pilih mesin -> pilih mold -> template ═══ */}
        {page==='mold_mesin'&&teknisi&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',marginBottom:'20px',flexWrap:'wrap'}}>
            <div>
              <div style={{fontSize:'14px',color:t.textMuted}}>Halo, {teknisi.nama}</div>
              <div style={{fontSize:'26px',fontWeight:800,color:t.text}}>{LT.judul}</div>
            </div>
            {jumlahCons>0&&<button type="button" onClick={()=>bukaConsumable('mold_mesin')} style={{...iconBtn,borderColor:'rgba(180,83,9,0.45)',color:'#b45309'}}>🧴 Consumable part ({jumlahCons})</button>}
          </div>
          {moldMesin===null?<div style={{color:t.textMuted}}>Memuat...</div>:moldMesin.filter(tampilMoldMesin).length===0
            ?<div style={{...gc,padding:'24px',color:t.textMuted,display:'flex',flexDirection:'column',gap:'6px'}}>
              {moldMesinErr
                ?<><div style={{color:'#c62828',fontWeight:700}}>Gagal memuat: {moldMesinErr}</div><div>Laporkan ke admin.</div></>
                :LT.badge==='MAINTENANCE MACHINE'
                  ?<><div style={{fontWeight:700,color:t.text}}>Belum ada mesin yang punya checklist PM.</div><div>Minta admin mengisi: Kelola part → Master Data → Maintenance Machine.</div></>
                  :<><div style={{fontWeight:700,color:t.text}}>Belum ada template mold.</div><div>Minta admin mengisi di Kelola part → Master Data → Maintenance Mold.</div></>}
            </div>
            :<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
              {moldMesin.filter(tampilMoldMesin).map((m:any,i:number)=>(
                <button key={m.id} type="button" onClick={()=>pilihMoldMesin(m)} style={{...gc,padding:'20px',cursor:'pointer',textAlign:'center',font:'inherit',color:t.text,animation:'cardPop 0.4s ease both',animationDelay:`${i*40}ms`}}>
                  {m.foto_url?<img src={m.foto_url} alt="" style={{width:'80px',height:'80px',objectFit:'contain',marginBottom:'10px'}}/>:<div style={{fontSize:'40px',marginBottom:'10px'}}>{m.emoji||'⚙️'}</div>}
                  <div style={{fontSize:'15px',fontWeight:700}}>{m.nama}</div>
                  <div style={{fontSize:'12px',color:t.textMuted,marginTop:'4px'}}>{katTim(teknisi?.bagian)==='mesin'?`${m.total_item} kegiatan PM`:`${m.jumlah_mold} ${LT.item}`}</div>
                </button>
              ))}
            </div>}
        </div>)}

        {page==='mold_unit'&&teknisi&&moldMesinAktif&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'20px'}}>
            <button onClick={()=>setPage('mold_mesin')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'13px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <span style={{fontSize:'15px',color:t.textMuted}}>{LT.header} › {moldMesinAktif.nama} › Pilih unit</span>
          </div>
          <div style={{fontSize:'22px',fontWeight:800,color:t.text,marginBottom:'14px'}}>{moldMesinAktif.nama} · {unitMesinDari(moldMesinAktif).length} unit</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
            {unitMesinDari(moldMesinAktif).map((u:any,i:number)=>(
              <button key={u.unitId||u.nama} type="button" onClick={()=>{setMoldUnit({id:u.unitId,nama:u.nama});bukaMoldMesin(moldMesinAktif);}} style={{...gc,padding:'20px',cursor:'pointer',textAlign:'center',font:'inherit',color:t.text,animation:'cardPop 0.4s ease both',animationDelay:`${i*30}ms`}}>
                {moldMesinAktif.foto_url?<img src={moldMesinAktif.foto_url} alt="" style={{width:'64px',height:'64px',objectFit:'contain',marginBottom:'8px'}}/>:<div style={{fontSize:'34px',marginBottom:'8px'}}>{moldMesinAktif.emoji||'⚙️'}</div>}
                <div style={{fontSize:'16px',fontWeight:700}}>{u.nama}</div>
              </button>
            ))}
          </div>
          <div style={{fontSize:'13px',color:t.textMuted,marginTop:'14px'}}>Unit mesin diatur admin di Kelola part → mesin → Unit mesin (+ Unit).</div>
        </div>)}

        {page==='mold_pilih'&&teknisi&&moldMesinAktif&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'20px'}}>
            <button onClick={()=>{if(moldGrup){setMoldGrup(null);return;}setPage(moldUnit?'mold_unit':'mold_mesin');}} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'13px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <span style={{fontSize:'15px',color:t.textMuted}}>{LT.header} › {moldUnit?.nama||moldMesinAktif.nama} › {LT.pilih}</span>
          </div>
          {moldList===null?<div style={{color:t.textMuted}}>Memuat...</div>:(()=>{
            const grupList=grupkanMold(moldList);
            const grupAktif=moldGrup?(grupList.find(g=>g.key===moldGrup&&g.units.length>1)||null):null;
            const kartu=(key:any,i:number,foto:string|null,judul:string,sub:string,kurang:string|null,onClick:()=>void,unit?:number)=>(
              <button key={key} type="button" onClick={onClick} style={{...gc,padding:'16px',cursor:'pointer',textAlign:'left',font:'inherit',color:t.text,display:'flex',flexDirection:'column',gap:'8px',animation:'cardPop 0.4s ease both',animationDelay:`${i*30}ms`}}>
                <div style={{width:'100%',height:'110px',borderRadius:'8px',overflow:'hidden',background:t.tag,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {foto?<img src={foto} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'36px'}}>{LT.ikon}</span>}
                </div>
                <div style={{fontSize:'15px',fontWeight:700}}>{judul}</div>
                {unit?<div style={{fontSize:'13px',fontWeight:700,color:'#0b5ed7'}}>{unit} mold</div>:null}
                {sub&&<div style={{fontSize:'12px',color:t.textMuted}}>{sub}</div>}
                {kurang&&<div style={{fontSize:'12px',color:'#c62828',fontWeight:600}}>{kurang}</div>}
              </button>
            );
            return(<>
              {grupAktif&&<div style={{fontSize:'18px',fontWeight:700,marginBottom:'12px'}}>{grupAktif.nama} <span style={{fontSize:'14px',fontWeight:500,color:t.textMuted}}>· {grupAktif.units.length} mold</span></div>}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
                {grupAktif
                  ?grupAktif.units.map((m:any,i:number)=>kartu(m.id,i,m.foto_url,m.nama_mold,`${m.kode_mold?`${m.kode_mold} · `:''}${m.jumlah_part} spare part`,m.jumlah_kurang>0?`${m.jumlah_kurang} part stoknya kurang`:null,()=>bukaMold(m.id)))
                  :grupList.map((g,i)=>g.units.length>1
                    ?kartu('g-'+g.key,i,(g.units.find((u:any)=>u.foto_url)||{}).foto_url||null,g.nama,'',g.units.some((u:any)=>u.jumlah_kurang>0)?'Ada part yang stoknya kurang':null,()=>setMoldGrup(g.key),g.units.length)
                    :kartu(g.units[0].id,i,g.units[0].foto_url,g.units[0].nama_mold,`${g.units[0].kode_mold?`${g.units[0].kode_mold} · `:''}${g.units[0].jumlah_part} spare part`,g.units[0].jumlah_kurang>0?`${g.units[0].jumlah_kurang} part stoknya kurang`:null,()=>bukaMold(g.units[0].id)))}
              </div>
            </>);
          })()}
        </div>)}

        {(page==='pm_checklist'||page==='pm_item')&&teknisi&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          {(()=>{
            const itemPm=page==='pm_item'&&pmData?pmData.find((it:any)=>it.id===pmItemId):null;
            return (
              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
                <button onClick={()=>setPage(page==='pm_item'?'pm_checklist':moldUnit?'mold_unit':'mold_mesin')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'13px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
                <span style={{fontSize:'15px',color:t.textMuted}}>{LT.header} › {moldMesinAktif?.nama} › PM{itemPm?` › ${itemPm.no_urut}. ${itemPm.nama_bagian}`:''}</span>
              </div>
            );
          })()}
          {!pmData?<div style={{color:t.textMuted}}>Memuat checklist PM...</div>:(()=>{
            const semuaPart=pmData.flatMap((it:any)=>it.parts);
            const dipilih=semuaPart.filter((p:any)=>moldPilih[p.id]?.on&&(moldPilih[p.id]?.qty||0)>0);
            const ringkas=(
              <div style={{...gc,padding:'16px',display:'flex',flexDirection:'column',gap:'10px',position:'sticky',top:'16px'}}>
                <div style={{fontSize:'15px',fontWeight:700,color:t.text}}>Part yang akan diambil</div>
                <div style={{fontSize:'13px',color:t.textMuted}}>{dipilih.length} part · {dipilih.reduce((s:number,p:any)=>s+(moldPilih[p.id]?.qty||0),0)} pcs</div>
                {dipilih.length===0&&<div style={{fontSize:'13px',color:t.textMuted}}>Belum ada. Tap kotak item, lalu centang part yang perlu diganti.</div>}
                {dipilih.map((p:any)=><div key={p.id} style={{fontSize:'13px',color:t.text}}>• {p.nama_part} ×{moldPilih[p.id]?.qty}</div>)}
                <button type="button" disabled={!dipilih.length} onClick={()=>masukkanPm(dipilih)} style={{width:'100%',background:dipilih.length?accentGrad:t.inputBg,border:'none',borderRadius:'8px',padding:'12px',color:dipilih.length?'#fff':t.textMuted,fontSize:'15px',fontWeight:700,cursor:dipilih.length?'pointer':'not-allowed'}}>Masukkan ke keranjang</button>
              </div>
            );
            if(page==='pm_checklist') return (
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,3fr) minmax(240px,1fr)',gap:'16px',alignItems:'start'}}>
                <div>
                  <div style={{fontSize:'22px',fontWeight:800,color:t.text}}>PM {moldMesinAktif?.nama}</div>
                  <div style={{fontSize:'13px',color:t.textMuted,marginBottom:'14px'}}>Tap item yang spare part-nya perlu diganti</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px'}}>
                    {pmData.map((it:any,i:number)=>{
                      const n=it.parts.length; const pilihN=it.parts.filter((p:any)=>moldPilih[p.id]?.on).length;
                      return (
                        <button key={it.id} type="button" disabled={!n} onClick={()=>{setPmItemId(it.id);setPage('pm_item');}} style={{...gc,padding:'14px',textAlign:'left',font:'inherit',color:t.text,display:'flex',flexDirection:'column',gap:'6px',minHeight:'120px',cursor:n?'pointer':'default',opacity:n?1:0.5,border:`${pilihN?2:1}px solid ${pilihN?LT.warna:t.border}`,animation:'cardPop 0.4s ease both',animationDelay:`${i*20}ms`}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={{width:'28px',height:'28px',borderRadius:'50%',background:pilihN?LT.warna:t.tag,color:pilihN?'#fff':t.text,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700}}>{it.no_urut}</span>
                            <span style={{flex:1}}/>
                            <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:t.tag,color:LT.warna}}>{it.frekuensi}</span>
                          </div>
                          <div style={{fontSize:'15px',fontWeight:700,lineHeight:1.3}}>{it.nama_bagian}</div>
                          <div style={{fontSize:'12px',color:t.textMuted,flex:1}}>{it.requirement}</div>
                          <div style={{fontSize:'12px',fontWeight:600,color:pilihN?LT.warna:t.textMuted}}>{!n?'Cek / clean saja':pilihN?`${pilihN} dari ${n} part dipilih`:`${n} spare part`}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {ringkas}
              </div>
            );
            const it=pmData.find((x:any)=>x.id===pmItemId);
            if(!it) return null;
            const idx=pmData.indexOf(it);
            const berikut=pmData.slice(idx+1).find((x:any)=>x.parts.length>0);
            return (
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,3fr) minmax(240px,1fr)',gap:'16px',alignItems:'start'}}>
                <div style={{...gc,padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
                  <div>
                    <div style={{fontSize:'20px',fontWeight:800,color:t.text}}>{it.no_urut}. {it.nama_bagian}</div>
                    <div style={{fontSize:'13px',color:t.textMuted}}>{it.requirement} · {moldMesinAktif?.nama} · centang part yang diganti</div>
                  </div>
                  {it.parts.map((p:any)=>{
                    const sel=moldPilih[p.id]||{on:false,qty:p.qty};
                    const habis=p.stok_saat_ini<=0;
                    return (
                      <label key={p.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px',borderRadius:'8px',border:`1px solid ${sel.on?LT.warna:t.border}`,background:sel.on?t.tag:'transparent',opacity:habis?0.55:1,cursor:habis?'not-allowed':'pointer'}}>
                        <input type="checkbox" disabled={habis} checked={sel.on&&!habis} onChange={e=>setMoldPilih(s=>({...s,[p.id]:{...sel,on:e.target.checked}}))} style={{width:'22px',height:'22px'}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:'15px',fontWeight:600,color:t.text}}>{p.nama_part}</div>
                          <div style={{fontSize:'12px',color:t.textMuted}}>{p.nomor_bin||'-'}{p.rak_kode?` · Rak ${p.rak_kode}${p.rak_tingkat?` susun ${p.rak_tingkat}`:''}`:''} · Stok {p.stok_saat_ini}{habis?' · stok habis':''}</div>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}} onClick={e=>e.preventDefault()}>
                          <button type="button" disabled={habis} onClick={()=>setMoldPilih(s=>({...s,[p.id]:{...sel,qty:Math.max(1,sel.qty-1)}}))} style={{width:'34px',height:'34px',borderRadius:'6px',border:`1px solid ${t.border}`,background:t.inputBg,color:t.text,fontSize:'18px',cursor:'pointer'}}>−</button>
                          <span style={{minWidth:'28px',textAlign:'center',fontSize:'17px',fontWeight:700,color:t.text}}>{sel.qty}</span>
                          <button type="button" disabled={habis} onClick={()=>setMoldPilih(s=>({...s,[p.id]:{...sel,qty:Math.min(Math.max(1,p.stok_saat_ini),sel.qty+1)}}))} style={{width:'34px',height:'34px',borderRadius:'6px',border:`1px solid ${t.border}`,background:t.inputBg,color:t.text,fontSize:'18px',cursor:'pointer'}}>+</button>
                        </div>
                      </label>
                    );
                  })}
                  <div style={{display:'flex',gap:'8px',marginTop:'6px'}}>
                    <button type="button" onClick={()=>setPage('pm_checklist')} style={{...iconBtn,flex:1,justifyContent:'center'}}>Selesai, kembali ke daftar</button>
                    {berikut&&<button type="button" onClick={()=>setPmItemId(berikut.id)} style={{...iconBtn,flex:1,justifyContent:'center'}}>Item berikutnya: {berikut.nama_bagian} →</button>}
                  </div>
                </div>
                {ringkas}
              </div>
            );
          })()}
        </div>)}

        {page==='mold_template'&&teknisi&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px'}}>
            <button onClick={()=>setPage('mold_pilih')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'13px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <span style={{fontSize:'15px',color:t.textMuted}}>{LT.header} › {moldMesinAktif?.nama} › {moldAktif?.mold.nama_mold||'...'}</span>
          </div>
          {!moldAktif?<div style={{color:t.textMuted}}>Memuat template...</div>:(()=>{
            const partItems=moldAktif.items.filter((i:any)=>i.tipe==='part');
            const dipilih=partItems.filter((i:any)=>moldPilih[i.id]?.on&&(moldPilih[i.id]?.qty||0)>0);
            return (
              <div style={{display:'grid',gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)',gap:'16px',alignItems:'start'}}>
                <div style={{...gc,padding:'16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'14px',marginBottom:'14px'}}>
                    <div style={{width:'64px',height:'64px',borderRadius:'10px',overflow:'hidden',background:t.tag,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      {moldAktif.mold.foto_url?<img src={moldAktif.mold.foto_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'28px'}}>{LT.ikon}</span>}
                    </div>
                    <div>
                      <div style={{fontSize:'20px',fontWeight:800,color:t.text}}>{moldAktif.mold.nama_mold}</div>
                      <div style={{fontSize:'13px',color:t.textMuted}}>{moldAktif.mold.mesin_nama}{moldAktif.mold.kode_mold?` · ${moldAktif.mold.kode_mold}`:''} · centang part yang mau diambil</div>
                    </div>
                  </div>
                  {partItems.length===0&&<div style={{color:t.textMuted,fontSize:'14px'}}>Template ini belum punya spare part.</div>}
                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    {partItems.map((it:any)=>{
                      const sel=moldPilih[it.id]||{on:false,qty:it.qty};
                      const habis=it.stok_saat_ini<=0;
                      return (
                        <label key={it.id} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',borderRadius:'8px',border:`1px solid ${sel.on?'var(--mcc-blue)':t.border}`,background:sel.on?t.tag:'transparent',opacity:habis?0.55:1,cursor:habis?'not-allowed':'pointer'}}>
                          <input type="checkbox" disabled={habis} checked={sel.on&&!habis} onChange={e=>setMoldPilih(s=>({...s,[it.id]:{...sel,on:e.target.checked}}))} style={{width:'20px',height:'20px'}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:'15px',fontWeight:600,color:t.text}}>{it.nama_part}</div>
                            <div style={{fontSize:'12px',color:t.textMuted}}>{it.nomor_bin||'-'}{it.rak_kode?` · Rak ${it.rak_kode}${it.rak_tingkat?` susun ${it.rak_tingkat}`:''}`:''} · Stok {it.stok_saat_ini}{habis?' · stok habis':it.stok_saat_ini<it.qty?' · stok kurang dari template':''}</div>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:'6px'}} onClick={e=>e.preventDefault()}>
                            <button type="button" disabled={habis} onClick={()=>setMoldPilih(s=>({...s,[it.id]:{...sel,qty:Math.max(1,sel.qty-1)}}))} style={{width:'32px',height:'32px',borderRadius:'6px',border:`1px solid ${t.border}`,background:t.inputBg,color:t.text,fontSize:'18px',cursor:'pointer'}}>−</button>
                            <span style={{minWidth:'28px',textAlign:'center',fontSize:'17px',fontWeight:700,color:t.text}}>{sel.qty}</span>
                            <button type="button" disabled={habis} onClick={()=>setMoldPilih(s=>({...s,[it.id]:{...sel,qty:Math.min(Math.max(1,it.stok_saat_ini),sel.qty+1)}}))} style={{width:'32px',height:'32px',borderRadius:'6px',border:`1px solid ${t.border}`,background:t.inputBg,color:t.text,fontSize:'18px',cursor:'pointer'}}>+</button>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                  <div style={{...gc,padding:'16px',display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div style={{fontSize:'14px',color:t.textMuted}}>{dipilih.length} part dipilih · {dipilih.reduce((s:number,i:any)=>s+(moldPilih[i.id]?.qty||0),0)} pcs</div>
                    <button type="button" disabled={!dipilih.length} onClick={()=>masukkanTemplate(dipilih)} style={{width:'100%',background:dipilih.length?accentGrad:t.inputBg,border:'none',borderRadius:'8px',padding:'12px',color:dipilih.length?'#fff':t.textMuted,fontSize:'15px',fontWeight:700,cursor:dipilih.length?'pointer':'not-allowed'}}>Masukkan ke keranjang</button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>)}

        {page==='jenis'&&teknisi&&(<div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{textAlign:'center',marginBottom:'40px'}}>
            <div style={{fontSize:'14px',color:t.textMuted,marginBottom:'8px'}}>Halo, {teknisi.nama} 👋</div>
            <div style={{fontSize:'28px',fontWeight:800,color:t.text}}>Pilih Area Mesin</div>
            {isMoldUser(teknisi.bagian)&&<button type="button" onClick={()=>{muatMoldMesin();setPage('mold_mesin');}} style={{...iconBtn,marginTop:'14px'}}>← Kembali ke template {LT.item}</button>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',width:'100%',maxWidth:'600px'}}>
            {([
              {jenis:'molding' as Jenis,label:'Molding',color:'#4338ca',bg:'rgba(67,56,202,0.15)',border:'rgba(67,56,202,0.35)',desc:`${totalArea('molding')} spare part`,img:'/parts/logo%20molding%20.png'},
              {jenis:'nonmolding' as Jenis,label:'Non Molding',color:'#0f766e',bg:'rgba(15,118,110,0.15)',border:'rgba(15,118,110,0.35)',desc:`${totalArea('nonmolding')} spare part`,img:'/parts/logo%20non-molding%20.png'},
            ]).map(opt=>(<div key={opt.jenis} onClick={()=>{setAsalKatalog('jenis');setSelectedJenis(opt.jenis);setSelectedMesin(null);setSelectedGroup(null);setPage('mesin');}} style={{...gc,padding:'36px 28px',cursor:'pointer',border:`1px solid ${opt.border}`,background:`linear-gradient(135deg,${opt.bg},transparent)`,transition:'all 0.25s',textAlign:'center'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 20px 60px ${opt.color}30`;}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
              <div style={{width:'250px',height:'250px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
                <img src={opt.img} alt="" style={{width:'100%',height:'100%',objectFit:'contain',mixBlendMode:'screen',transform:'scale(2.5)',transformOrigin:'center',pointerEvents:'none'}}/>
              </div>
              <div style={{fontSize:'20px',fontWeight:800,color:opt.color,marginBottom:'8px'}}>{opt.label}</div>
              <div style={{fontSize:'12px',color:t.textMuted}}>{opt.desc}</div>
            </div>))}
            {jumlahCons>0&&<button type="button" onClick={()=>bukaConsumable('jenis')} style={{...gc,position:'relative',zIndex:2,gridColumn:'1/-1',padding:'20px 24px',cursor:'pointer',border:'1px solid rgba(180,83,9,0.35)',background:'linear-gradient(135deg,rgba(180,83,9,0.12),transparent)',display:'flex',alignItems:'center',gap:'16px',textAlign:'left',font:'inherit',color:t.text}}>
              <span style={{fontSize:'40px'}}>🧴</span>
              <span style={{display:'flex',flexDirection:'column',gap:'4px',flex:1}}>
                <span style={{fontSize:'20px',fontWeight:800,color:'#b45309'}}>Consumable part</span>
                <span style={{fontSize:'12px',color:t.textMuted}}>Part habis pakai yang sering diambil · {jumlahCons} part</span>
              </span>
              <span style={{fontSize:'22px',color:'#b45309'}}>›</span>
            </button>}
          </div>
        </div>)}

        {page==='mesin'&&teknisi&&selectedJenis==='molding'&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'24px'}}>
            <button onClick={()=>setPage('jenis')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'11px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <span style={{fontSize:'13px',color:t.textMuted}}>› 🏭 Molding › Pilih Mesin</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
            {daftarMolding.map((m:any,i:number)=>(
              <MesinCard key={m.nama} m={m} delay={i*50} onClick={()=>{
                cekTugas(m,()=>{if(m.sub&&m.sub.length>0){setSelectedGroup(m);setPage('sub_mesin');}
                else{setSelectedGroup(null);setSelectedMesin(m);setSearch('');setFilterKat('Semua');setPartArea(m.nama);setPage('catalog');}});
              }}/>
            ))}
          </div>
        </div>)}

        {page==='mesin'&&teknisi&&selectedJenis==='nonmolding'&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'24px'}}>
            <button onClick={()=>setPage('jenis')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'11px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <span style={{fontSize:'13px',color:t.textMuted}}>› ⚙️ Non Molding › Pilih Mesin</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
            {daftarNonMolding.map((m:any,i:number)=>(
              <MesinCard key={m.nama} m={m} delay={i*40} onClick={()=>{
                cekTugas(m,()=>{if(m.sub&&m.sub.length>0){setSelectedGroup(m);setPage('sub_mesin');}
                else{setSelectedGroup(null);setSelectedMesin(m);setSearch('');setFilterKat('Semua');setPartArea(m.nama);setPage('catalog');}});
              }}/>
            ))}
          </div>
        </div>)}

        {page==='sub_mesin'&&teknisi&&selectedGroup&&(<div style={{flex:1,padding:'24px',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'20px'}}>
            <button onClick={()=>asalKatalog==='mold_mesin'?(muatMoldMesin(),setPage('mold_mesin')):setPage('mesin')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'11px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <span style={{fontSize:'13px',color:t.textMuted}}>› {selectedJenis==='molding'?'🏭 Molding':'⚙️ Non Molding'} › {selectedGroup.nama}</span>
          </div>
          <div style={{marginBottom:'20px',display:'flex',alignItems:'center',gap:'12px',padding:'14px 20px',background:`${selectedGroup.color}12`,borderRadius:'12px',border:`1px solid ${selectedGroup.color}33`}}>
            {getMesinImg(selectedGroup)?<img src={getMesinImg(selectedGroup)!} style={{width:'48px',height:'48px',objectFit:'contain'}}/>:<span style={{fontSize:'28px'}}>{selectedGroup.emoji}</span>}
            <div><div style={{fontSize:'16px',fontWeight:700,color:t.text}}>{selectedGroup.nama}</div><div style={{fontSize:'12px',color:t.textMuted}}>{selectedGroup.sub.length} unit — pilih unit mesin</div></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
            {selectedGroup.sub.map((sm:any,i:number)=>{
              const count=countM(sm);const low=lowM(sm);
              return(<div key={sm.nama} onClick={()=>{setSelectedMesin(sm);setSearch('');setFilterKat('Semua');setPartArea(sm.nama);setPage('catalog');}} style={{...gc,padding:'18px',cursor:'pointer',border:`1px solid ${sm.color}33`,transition:'all 0.25s',textAlign:'center',animation:`cardPop 0.4s ease both`,animationDelay:`${i*35}ms`}}
                onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=sm.color;e.currentTarget.style.boxShadow=`0 8px 24px ${sm.color}25`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=`${sm.color}33`;e.currentTarget.style.boxShadow='none';}}>
                <div style={{fontSize:'28px',marginBottom:'8px'}}>{sm.emoji}</div>
                <div style={{fontSize:'11px',fontWeight:700,color:t.text,marginBottom:'5px',lineHeight:1.3}}>{sm.nama}</div>
                <div style={{fontSize:'11px',fontWeight:700,color:sm.color}}>{count} part</div>
                {low>0&&<div style={{fontSize:'9px',color:'#c62828',marginTop:'2px'}}>⚠ {low} low</div>}
              </div>);
            })}
          </div>
        </div>)}

        {page==='catalog'&&teknisi&&selectedMesin&&(<div style={{flex:1,display:'flex',flexDirection:'column',animation:'pageFadeIn 0.5s ease both'}}>
          <div style={{...gn,padding:'8px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <button onClick={()=>selectedGroup?setPage('sub_mesin'):(selectedMesin?.consumable||asalKatalog==='mold_mesin')?(asalKatalog==='mold_mesin'?(muatMoldMesin(),setPage('mold_mesin')):setPage('jenis')):setPage('mesin')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',padding:'4px 10px',color:t.textMuted,fontSize:'10px',cursor:'pointer'}}>← Kembali</button>
              <span style={{fontSize:'11px',color:selectedMesin.color,fontWeight:700}}>{selectedMesin.emoji} {selectedMesin.nama}</span>
              <span style={{fontSize:'11px',color:t.textMuted}}>· {filtered.length} part</span>
            </div>
            <span style={{fontSize:'10px',color:t.textMuted}}>✅ {teknisi.nama}</span>
          </div>
          {luarTugas&&!selectedMesin?.consumable&&<div role="status" style={{padding:'8px 24px',background:'rgba(178,106,0,0.14)',borderBottom:'1px solid rgba(178,106,0,0.35)',color:'#b26a00',fontSize:'13px',fontWeight:600}}>⚠ {luarTugas.nama} bukan mesin tanggung jawab kamu. Alasan: “{luarTugas.alasan}”. Permintaan akan dikonfirmasi admin.</div>}
          <div style={{...gn,padding:'10px 24px',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`🔍 Cari part di ${selectedMesin.nama}...`} style={{minWidth:'200px',flex:1,background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'8px 14px',color:t.text,fontSize:'12px',outline:'none',fontFamily:"inherit"}}/>
            <div style={{display:'flex',gap:'5px',overflowX:'auto',flexShrink:0}}>
              {kategoriList.length>2&&kategoriList.map(k=>(<button key={k} onClick={()=>setFilterKat(k)} style={{background:filterKat===k?t.filterActive:t.inputBg,border:`1px solid ${filterKat===k?t.accent:t.border}`,borderRadius:'7px',padding:'6px 11px',color:filterKat===k?t.accentLight:t.textMuted,fontSize:'10px',fontWeight:600,cursor:'pointer',fontFamily:"inherit",whiteSpace:'nowrap',flexShrink:0}}>{k}</button>))}
            </div>
            {totalItem>0&&(<button onClick={()=>setPage('cart')} style={{background:hasUrgent?'#dc2626':accentGrad,border:'none',borderRadius:'8px',padding:'7px 16px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap',fontFamily:"inherit",flexShrink:0}}>
              {hasUrgent?'🚨':'🛒'} <span style={{background:'#fff',color:t.accent,borderRadius:'10px',padding:'1px 6px',fontSize:'10px',fontWeight:700}}>{totalItem}</span>
            </button>)}
          </div>
          <div style={{flex:1,padding:'16px 24px',overflowY:'auto'}}>
            <div style={{fontSize:'11px',color:t.textMuted,marginBottom:'12px'}}>{loadingParts?'Memuat...':`${filtered.length} spare part`}</div>
            {filtered.length===0
              ?<div style={{textAlign:'center',padding:'60px 24px',color:t.textMuted}}><div style={{fontSize:'40px',marginBottom:'12px'}}>🔍</div><div style={{fontSize:'14px',fontWeight:600}}>Tidak ada part ditemukan</div></div>
              :<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
                {filtered.map((part:any,index:number)=>{
                  const qty=getQty(part.id);const isLow=part.stok<=part.reorder;const inCart=qty>0;const isUrgent=cart.find(c=>c.part.id===part.id)?.urgent||false;
                  return(<div key={part.id} style={{background:t.cardBg,backdropFilter:'none',WebkitBackdropFilter:'none',border:`1px solid ${isUrgent?'rgba(198,40,40,0.6)':inCart?t.accent:t.border}`,borderRadius:'16px',overflow:'hidden',transition:'all 0.2s',animation:`cardPop 0.4s ease both`,animationDelay:`${Math.min(index,16)*35}ms`,boxShadow:isUrgent?'none':inCart?`0 0 12px ${t.accent}33`:'none'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=isUrgent?'rgba(198,40,40,0.8)':t.accent;e.currentTarget.style.transform='none';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=isUrgent?'rgba(198,40,40,0.6)':inCart?t.accent:t.border;e.currentTarget.style.transform='translateY(0)';}}>
                    <div style={{height:'140px',background:mode==='dark'?'rgba(255,255,255,0.05)':'rgba(19,41,75,0.03)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
                      {part.foto_url?<img src={part.foto_url} alt={part.nama} style={{width:'100%',height:'100%',objectFit:'contain',padding:'6px',boxSizing:'border-box'}}/>:<span style={{fontSize:'52px'}}>{part.gambar}</span>}
                      <div style={{position:'absolute',top:'5px',right:'5px',display:'flex',gap:'4px'}}>
                        {part.is_critical&&<span style={{background:'rgba(198,40,40,0.85)',color:'#fff',fontSize:'7px',fontWeight:700,padding:'1px 5px',borderRadius:'4px'}}>🔴</span>}
                        <span style={{background:isLow?'rgba(198,40,40,0.25)':'rgba(34,197,94,0.2)',color:isLow?'#c62828':'#1e7e34',fontSize:'8px',fontWeight:700,padding:'2px 6px',borderRadius:'4px'}}>{isLow?'LOW':'OK'}</span>
                      </div>
                      <div style={{position:'absolute',top:'5px',left:'5px',background:'rgba(19,41,75,0.15)',color:'rgba(255,255,255,0.7)',fontSize:'8px',fontFamily:'inherit',padding:'2px 5px',borderRadius:'3px'}}>{part.kode}</div>
                      {isUrgent&&<div style={{position:'absolute',bottom:0,left:0,right:0,background:'rgba(198,40,40,0.85)',color:'#fff',fontSize:'8px',fontWeight:800,textAlign:'center',padding:'2px'}}>🚨 URGENT</div>}
                    </div>
                    <div style={{padding:'10px'}}>
                      <div style={{fontSize:'9px',color:part.is_critical?'#c62828':t.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'3px'}}>{katCN(part)}</div>
                      <div style={{fontSize:'11px',fontWeight:600,color:t.text,lineHeight:1.3,marginBottom:'6px',minHeight:'32px'}}>{part.nama}</div>
                      {(()=>{const j=jatahDi(part.id,selectedMesin?.jenisId);if(j==null)return null;return <div style={{fontSize:'10px',fontWeight:700,marginBottom:'6px',color:j>0?t.accentLight:'#b26a00'}}>{j>0?`Jatah ${selectedMesin.nama}: ${j} · dipakai bersama`:`Jatah ${selectedMesin.nama} habis · pinjam mesin lain`}</div>;})()}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                        <span style={{fontSize:'9px',color:t.textMuted,fontFamily:'inherit'}}>{part.bin}</span>
                        <span style={{fontSize:'11px',fontWeight:700,color:isLow?'#c62828':t.accentLight}}>Stok: {part.stok}</span>
                      </div>
                      {qty===0
                        ?<button onClick={()=>addToCart(part)} disabled={part.stok===0} style={{width:'100%',background:part.stok===0?'rgba(255,255,255,0.05)':accentGrad,border:'none',borderRadius:'7px',padding:'7px',color:part.stok===0?t.textMuted:'#fff',fontSize:'12px',fontWeight:700,cursor:part.stok===0?'not-allowed':'pointer',fontFamily:"inherit"}}>{part.stok===0?'Habis':'+ Tambah'}</button>
                        :<div>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:t.tag,borderRadius:'7px',padding:'4px 6px',border:`1px solid ${t.border}`,marginBottom:'5px'}}>
                            <button onClick={()=>updateQty(part.id,-1)} style={{width:'28px',height:'28px',background:t.inputBg,border:'none',borderRadius:'5px',color:t.accentLight,fontSize:'18px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                            <span style={{fontSize:'20px',fontWeight:700,color:t.accentLight}}>{qty}</span>
                            <button onClick={()=>updateQty(part.id,1)} disabled={qty>=part.stok} style={{width:'28px',height:'28px',background:t.inputBg,border:'none',borderRadius:'5px',color:qty>=part.stok?t.textMuted:t.accentLight,fontSize:'18px',fontWeight:700,cursor:qty>=part.stok?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                          </div>
                          <button onClick={()=>toggleUrgent(part.id)} style={{width:'100%',background:isUrgent?'rgba(198,40,40,0.2)':'rgba(255,255,255,0.05)',border:`1px solid ${isUrgent?'rgba(198,40,40,0.5)':'rgba(255,255,255,0.1)'}`,borderRadius:'6px',padding:'4px',color:isUrgent?'#c62828':'rgba(255,255,255,0.3)',fontSize:'9px',fontWeight:700,cursor:'pointer',fontFamily:"inherit"}}>
                            {isUrgent?'🚨 URGENT — Mesin Stop!':'⚡ Tandai Urgent'}
                          </button>
                        </div>
                      }
                    </div>
                  </div>);
                })}
              </div>
            }
          </div>
        </div>)}

        {page==='cart'&&teknisi&&(<div style={{flex:1,padding:'24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
            <button onClick={()=>setPage(dariPm&&pmData?'pm_checklist':dariMold&&moldAktif?'mold_template':selectedMesin?'catalog':isMoldUser(teknisi?.bagian)?'mold_mesin':'jenis')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'11px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <div style={{fontSize:'20px',fontWeight:700,color:t.text}}>🛒 Keranjang Request</div>
            {hasUrgent&&<span style={{background:'rgba(198,40,40,0.2)',border:'1px solid rgba(198,40,40,0.4)',borderRadius:'8px',padding:'4px 12px',color:'#c62828',fontSize:'11px',fontWeight:700}}>🚨 Ada Item URGENT</span>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:'16px',alignItems:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {cart.map(c=>(<div key={c.part.id} style={{background:t.cardBg,backdropFilter:'none',border:`1px solid ${c.urgent?'rgba(198,40,40,0.5)':t.border}`,borderRadius:'12px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'14px'}}>
                <div style={{width:'46px',height:'46px',background:t.tag,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'22px',flexShrink:0,overflow:'hidden'}}>
                  {c.part.foto_url?<img src={c.part.foto_url} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{c.part.gambar}</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>{c.urgent&&<span style={{background:'rgba(198,40,40,0.2)',color:'#c62828',fontSize:'8px',fontWeight:700,padding:'1px 5px',borderRadius:'4px'}}>🚨</span>}<div style={{fontSize:'12px',fontWeight:600,color:t.text}}>{c.part.nama}</div></div>
                  <div style={{fontSize:'10px',color:t.textMuted,fontFamily:'inherit'}}>{c.part.bin} · Stok: {c.part.stok}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <button onClick={()=>updateQty(c.part.id,-1)} style={{width:'30px',height:'30px',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',color:t.accentLight,fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                  <span style={{fontSize:'22px',fontWeight:700,color:t.accentLight,minWidth:'28px',textAlign:'center'}}>{c.qty}</span>
                  <button onClick={()=>updateQty(c.part.id,1)} style={{width:'30px',height:'30px',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',color:t.accentLight,fontSize:'18px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                </div>
                <button onClick={()=>toggleUrgent(c.part.id)} style={{background:c.urgent?'rgba(198,40,40,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${c.urgent?'rgba(198,40,40,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:'6px',padding:'5px 10px',color:c.urgent?'#c62828':'rgba(255,255,255,0.3)',fontSize:'10px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                  {c.urgent?'🚨 Urgent':'⚡ Urgent?'}
                </button>
              </div>))}
            </div>
            <div style={{background:t.cardBg,backdropFilter:'none',border:`1px solid ${t.border}`,borderRadius:'16px',padding:'18px'}}>
              <div style={{fontSize:'11px',fontWeight:700,color:t.textMuted,textTransform:'uppercase',marginBottom:'14px'}}>Detail Request</div>
              <div style={{marginBottom:'10px'}}><div style={{fontSize:'9px',fontWeight:700,color:t.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Teknisi</div><div style={{fontSize:'12px',color:t.text,fontWeight:600}}>{teknisi.nama}</div>{teknisi.bagian&&<div style={{fontSize:'10px',color:t.accentLight,marginTop:'2px'}}>📍 {teknisi.bagian}</div>}</div>
              <div style={{marginBottom:'10px'}}><div style={{fontSize:'9px',fontWeight:700,color:t.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Work Order</div><input value={partWO} onChange={e=>setPartWO(e.target.value)} placeholder="WO-2026-..." style={inp}/></div>
              <div style={{marginBottom:'10px'}}><div style={{fontSize:'9px',fontWeight:700,color:t.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Area / Mesin</div><input value={partArea} onChange={e=>setPartArea(e.target.value)} style={inp}/></div>
              <div style={{marginBottom:'16px'}}><div style={{fontSize:'9px',fontWeight:700,color:wajibAlasan&&!alasanAmbil.trim()?'#c62828':t.textMuted,textTransform:'uppercase',marginBottom:'4px'}}>Alasan pengambilan {wajibAlasan?'* (wajib Non-molding)':'(opsional)'}</div>
                <textarea value={alasanAmbil} onChange={e=>setAlasanAmbil(e.target.value)} maxLength={300} rows={2} placeholder="mis. Ganti bearing rusak, mesin bunyi" style={{...inp,resize:'none'}}/>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginTop:'6px'}}>{['Rusak / aus','Preventive maintenance','Breakdown mesin','Ganti model / setting','Cadangan di line'].map(a=>(<button key={a} type="button" onClick={()=>setAlasanAmbil(a)} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'6px',padding:'4px 8px',fontSize:'11px',color:t.textMuted,cursor:'pointer',fontFamily:'inherit'}}>{a}</button>))}</div>
              </div>
              {hasUrgent&&<div style={{background:'rgba(198,40,40,0.12)',border:'1px solid rgba(198,40,40,0.3)',borderRadius:'8px',padding:'10px 12px',marginBottom:'14px'}}><div style={{fontSize:'11px',fontWeight:700,color:'#c62828',marginBottom:'4px'}}>🚨 Request Urgent</div><div style={{fontSize:'10px',color:'rgba(255,255,255,0.5)'}}>Admin akan menerima notifikasi prioritas tinggi.</div></div>}
              <div style={{borderTop:`1px solid ${t.border}`,paddingTop:'12px',marginBottom:'14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:t.textMuted,marginBottom:'4px'}}><span>Total Item</span><span style={{color:t.accentLight,fontWeight:700}}>{totalItem} pcs</span></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:'12px',color:t.textMuted}}><span>Jenis Part</span><span style={{color:t.accentLight,fontWeight:700}}>{cart.length} jenis</span></div>
              </div>
              <button onClick={handleSubmit} style={{width:'100%',background:hasUrgent?'#dc2626':accentGrad,border:'none',borderRadius:'8px',padding:'12px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:"inherit"}}>
                {hasUrgent?'🚨 Kirim Request URGENT':'📋 Kirim Request Part OUT'}
              </button>
            </div>
          </div>
        </div>)}

        {page==='waiting'&&teknisi&&(<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh',flexDirection:'column'}}>
          <div style={{...gc,padding:'48px 60px',textAlign:'center'}}>
            <div style={{fontSize:'60px',marginBottom:'16px',animation:'spinSlow 2s linear infinite'}}>⏳</div>
            <div style={{fontSize:'22px',fontWeight:800,color:t.accentLight,marginBottom:'6px'}}>Menunggu Siapan Admin</div>
            <div style={{fontSize:'13px',color:t.textMuted,marginBottom:'20px'}}>Admin sedang menyiapkan barang yang diminta. Harap menunggu...</div>
            <div style={{fontSize:'12px',color:t.textMuted,marginTop:'16px',fontFamily:'inherit'}}>
              {totalItem} item • Total {cart.reduce((a,c)=>a+c.qty,0)} pcs
            </div>
          </div>
        </div>)}

        {page==='verification'&&teknisi&&(<div style={{flex:1,padding:'24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
            <div style={{fontSize:'20px',fontWeight:700,color:t.text}}>📋 Verifikasi Request Siapan</div>
          </div>
          {preparedRequests.length===0?
            <div style={{...gc,padding:'48px 60px',textAlign:'center'}}>
              <div style={{fontSize:'32px',marginBottom:'16px'}}>✅</div>
              <div style={{fontSize:'16px',fontWeight:700,color:t.text}}>Semua Request Sudah Diverifikasi</div>
              <button onClick={()=>setPage('selesai')} style={{marginTop:'20px',background:accentGrad,border:'none',borderRadius:'8px',padding:'10px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Lanjut</button>
            </div>
          :<div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {preparedRequests.map((req:any)=>(
              <div key={req.id} style={{...gc,padding:'16px',display:'flex',alignItems:'center',justifyContent:'space-between',border:`1px solid ${req.is_urgent?'rgba(198,40,40,0.3)':t.border}`}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',fontWeight:700,color:t.text}}>{req.part_nama}</div>
                  <div style={{fontSize:'10px',color:t.textMuted,marginTop:'4px'}}>Qty: {req.jumlah} pcs {req.is_urgent&&'🚨 URGENT'}</div>
                  <div style={{fontSize:'9px',color:t.textMuted,marginTop:'2px'}}>Prepared at: {tglDb(req.disiapkan_at).toLocaleTimeString('id-ID')}</div>
                </div>
                <button onClick={()=>{setCurrentVerifyRequest(req);setVerifyStatus(null);setVerifyPhotoBase64('');setVerifyNotes('');setPage('verify_detail');}} style={{background:accentGrad,border:'none',borderRadius:'8px',padding:'8px 16px',color:'#fff',fontSize:'11px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>Verifikasi</button>
              </div>
            ))}
          </div>}
        </div>)}

        {page==='verify_detail'&&currentVerifyRequest&&(<div style={{flex:1,padding:'24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
            <button onClick={()=>setPage('verification')} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'6px 14px',color:t.textMuted,fontSize:'11px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            <div style={{fontSize:'18px',fontWeight:700,color:t.text}}>Verifikasi: {currentVerifyRequest.part_nama}</div>
          </div>
          <div style={{...gc,padding:'24px',marginBottom:'20px'}}>
            <div style={{marginBottom:'20px'}}>
              <div style={{fontSize:'12px',fontWeight:700,color:t.text,marginBottom:'8px'}}>📷 Foto Admin Saat Siapkan</div>
              {adminPreparedPhoto ? (
                <img src={adminPreparedPhoto} alt="Foto persiapan admin" style={{width:'100%',height:'auto',maxHeight:'60vh',objectFit:'contain',background:mode==='dark'?'#0b1424':'#eef1f5',borderRadius:'8px',border:`1px solid ${t.border}`,display:'block'}} />
              ) : (
                <div style={{padding:'24px',border:`2px dashed ${t.border}`,borderRadius:'8px',background:t.inputBg,color:t.textMuted,textAlign:'center',fontSize:'11px'}}>
                  Tidak ada foto admin untuk request ini.
                </div>
              )}
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontSize:'12px',fontWeight:700,color:t.text,display:'block',marginBottom:'8px'}}>Status Verifikasi</label>
              <select value={verifyStatus || ''} onChange={e => setVerifyStatus(e.target.value === 'sesuai' ? 'sesuai' : e.target.value === 'tidak' ? 'tidak' : null)} style={{width:'100%',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'10px 12px',color:t.text,fontSize:'12px',outline:'none'}}>
                <option value="">-- Pilih hasil verifikasi --</option>
                <option value="sesuai">✅ Sesuai</option>
                <option value="tidak">❌ Tidak Sesuai</option>
              </select>
            </div>

            {verifyStatus === 'tidak' && (
              <div style={{marginBottom:'20px'}}>
                <label style={{fontSize:'11px',fontWeight:700,color:t.text,display:'block',marginBottom:'8px'}}>Catatan ketidaksesuaian (opsional)</label>
                <textarea value={verifyNotes} onChange={e=>setVerifyNotes(e.target.value)} placeholder="Contoh: label rusak, qty tidak sesuai, part berbeda..." style={{width:'100%',background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:'8px',padding:'10px',color:t.text,fontSize:'11px',fontFamily:"inherit",height:'80px',resize:'none' as const}}/>

                <div style={{marginTop:'12px'}}>
                  <div style={{fontSize:'11px',fontWeight:700,color:t.text,marginBottom:'8px'}}>📷 Foto Verifikasi (opsional)</div>
                  {verifyPhotoBase64 ? (
                    <div style={{position:'relative'}}>
                      <img src={verifyPhotoBase64} alt="Foto verifikasi teknisi" style={{width:'100%',height:'180px',objectFit:'cover',borderRadius:'8px',border:`1px solid ${t.border}`}} />
                      <button onClick={()=>setVerifyPhotoBase64('')} style={{position:'absolute',top:'6px',right:'6px',background:'rgba(198,40,40,0.2)',border:'none',borderRadius:'4px',padding:'4px 8px',color:'#c62828',fontSize:'11px',cursor:'pointer',fontWeight:700}}>Ganti</button>
                    </div>
                  ) : (
                    <div style={{position:'relative',border:`2px dashed ${t.border}`,borderRadius:'8px',padding:'20px',textAlign:'center',cursor:'pointer',background:t.inputBg}}>
                      <input type="file" accept="image/*" onChange={async(e)=>{const f=e.target.files?.[0];if(!f)return;const reader=new FileReader();reader.onload=(ev:any)=>setVerifyPhotoBase64(ev.target.result);reader.readAsDataURL(f);}} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer'}}/>
                      <div style={{fontSize:'24px',marginBottom:'6px'}}>📷</div>
                      <div style={{fontSize:'11px',color:t.textMuted}}>Upload foto ketidaksesuaian (opsional)</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button onClick={async()=>{if(!verifyStatus){beritahu('Status verifikasi wajib dipilih');return;}setVerifying(true); try { const res = await fetch('/api/request-verifikasi', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ request_id: currentVerifyRequest.id, status: verifyStatus === 'sesuai' ? 'sesuai' : 'tidak', catatan: verifyNotes, foto_verifikasi: verifyPhotoBase64 || '' }) }); const data = await res.json(); if (res.ok) { setPage('verify_done'); setPreparedRequests(preparedRequests.filter(r => r.id !== currentVerifyRequest.id)); } else { beritahu('Error: ' + (data?.error || 'Gagal mengirim verifikasi')); } setVerifying(false); } catch (err) { beritahu('Error: ' + String(err)); setVerifying(false); } }} disabled={verifying || !verifyStatus} style={{width:'100%',background:verifying || !verifyStatus ? 'rgba(255,255,255,0.1)' : accentGrad,border:'none',borderRadius:'8px',padding:'12px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:verifying || !verifyStatus ? 0.5 : 1}}>
              {verifying ? '⏳ Mengirim...' : verifyStatus === 'sesuai' ? '✅ Konfirmasi SESUAI' : verifyStatus === 'tidak' ? '❌ Kirim Ketidaksesuaian' : 'Kirim Verifikasi'}
            </button>
          </div>
        </div>)}

        {page==='selesai'&&teknisi&&(<div className="mcc-fade-in" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh',padding:'24px'}}>
          <div style={{...gc,padding:'40px',width:'100%',maxWidth:'560px',textAlign:'center',display:'flex',flexDirection:'column',gap:'24px'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              <h1 style={{margin:0,fontSize:'30px',fontWeight:700,color:t.text}}>Apakah sudah selesai?</h1>
              <p style={{margin:0,fontSize:'17px',color:t.textMuted}}>Kalau masih ada part yang terlupa, Anda bisa langsung memesan lagi tanpa tap badge ulang.</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <button type="button" onClick={pesanLagi} style={{height:'64px',border:`1px solid ${t.border}`,borderRadius:'8px',background:t.cardBg,color:t.text,fontFamily:'inherit',fontSize:'18px',fontWeight:600,cursor:'pointer'}}>Belum, pesan lagi</button>
              <button type="button" onClick={logout} style={{height:'64px',border:'none',borderRadius:'8px',background:'var(--mcc-blue)',color:'#ffffff',fontFamily:'inherit',fontSize:'18px',fontWeight:600,cursor:'pointer'}}>Sudah selesai</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              <div style={{height:'4px',borderRadius:'2px',background:t.inputBg,overflow:'hidden'}}>
                <div style={{height:'4px',width:`${(idleLeft/30)*100}%`,background:'var(--mcc-blue)',transition:'width 1s linear'}}/>
              </div>
              <div aria-live="polite" style={{fontSize:'15px',color:t.textMuted}}>Kembali ke halaman tap badge dalam {idleLeft} detik</div>
            </div>
          </div>
        </div>)}

        {page==='verify_done'&&(<div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
          <div style={{...gc,padding:'48px 60px',textAlign:'center'}}>
            <div style={{fontSize:'60px',marginBottom:'16px',animation:'bounceIn 0.6s ease'}}>✅</div>
            <div style={{fontSize:'22px',fontWeight:700,color:t.accentLight,marginBottom:'6px'}}>Verifikasi Berhasil!</div>
            <div style={{fontSize:'12px',color:t.textMuted,marginBottom:'20px'}}>
              {currentVerifyRequest&&(verifyStatus==='sesuai'?'Barang sesuai, stok telah berkurang':'Tolakan tercatat, admin akan siapkan ulang')}
            </div>
            <button onClick={()=>{if(preparedRequests.length>0)setPage('verification');else setPage('selesai');setCurrentVerifyRequest(null);setAdminPreparedPhoto('');setVerifyPhotoBase64('');setVerifyStatus(null);setVerifyNotes('');}} style={{background:accentGrad,border:'none',borderRadius:'8px',padding:'10px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
              {preparedRequests.length>0?'Verifikasi berikutnya':'Lanjut'}
            </button>
          </div>
        </div>)}

      </div>
      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeOut{0%{opacity:1}100%{opacity:0}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes pageFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes cardPop{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        @keyframes bounceIn{from{opacity:0}to{opacity:1}}
        @keyframes rippleAnim{from{opacity:0}to{opacity:0}}
        @keyframes pulseRing{0%,100%{transform:none}}
        @keyframes spinSlow{0%,100%{transform:none}}
        @keyframes logoBreathe{0%,100%{transform:none}}
        @keyframes logoPulse{0%,100%{transform:none}}
        @keyframes idlePulse{0%,100%{transform:none}}
        @keyframes logoZoomBig{from{opacity:1}to{opacity:1}}
        @keyframes mccTkRead{0%,100%{opacity:1}50%{opacity:0.55}}
        .mcc-tk-reading{animation:mccTkRead 1s var(--mcc-ease) infinite;}
        .mcc-tk input::placeholder{color:${t.textMuted};opacity:0.8;}
        .mcc-tk button:focus-visible{outline:2px solid var(--mcc-blue);outline-offset:2px;}
        @media (max-width: 1000px){.mcc-tk-scan{flex-direction:column;}.mcc-tk-scan aside{width:auto!important;}}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-thumb{background:${t.border};border-radius:4px;}
      `}</style>
    </main>
  );
}
