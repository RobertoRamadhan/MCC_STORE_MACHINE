'use client';
import { useState, useEffect, useRef } from 'react';
import CameraCapture from './components/CameraCapture';

/* Koreksi jam database. Kolom DATETIME berisi jam lokal Panel PC; kalau server membacanya sebagai UTC,
   jam tampil maju 7 jam. Selisihnya diambil dari /api/waktu saat halaman dibuka (0 = tidak ada koreksi). */
let KOREKSI_DB_MS = 0;

/* Notifikasi saat aplikasi di-minimize / tab lain: notifikasi Windows (kalau diizinkan) + judul tab berkedip. */
const JUDUL_ASLI = { v: '' };
let kedip: ReturnType<typeof setInterval> | null = null;
function notifDesktop(judul:string, isi:string, tag:string){
  try{
    if(typeof window==='undefined')return;
    if('Notification' in window && Notification.permission==='granted'){
      const n=new Notification(judul,{body:isi,tag,requireInteraction:true} as any);
      n.onclick=()=>{try{window.focus();n.close();}catch{}};
    }
    if(document.hidden){
      if(!JUDUL_ASLI.v)JUDUL_ASLI.v=document.title;
      if(kedip)clearInterval(kedip);
      let on=false; kedip=setInterval(()=>{on=!on;document.title=on?`🔔 ${judul}`:JUDUL_ASLI.v;},1000);
      const pulih=()=>{if(!document.hidden){if(kedip)clearInterval(kedip);kedip=null;document.title=JUDUL_ASLI.v;document.removeEventListener('visibilitychange',pulih);}};
      document.addEventListener('visibilitychange',pulih);
    }
  }catch{}
}
const tglDb = (v:any) => { const d = new Date(v); return isNaN(d.getTime()) ? d : new Date(d.getTime() - KOREKSI_DB_MS); };

const usersData: any[] = [];

const ACCOUNTS = [
  { username: 'admin',       password: 'philips2026', nama: 'Admin Store MCC', role: 'admin',    permissions: ['all'] },
  { username: 'supervisor',  password: 'super2026',   nama: 'Supervisor MCC',  role: 'supervisor', permissions: ['dashboard','catalog','partin','partout','monitoring','order','laporan','return','parts'] },
  { username: 'tl_soother',  password: 'tl2026',      nama: 'TL Soother B2',   role: 'TL',       permissions: ['dashboard','catalog','partout','monitoring','return'], mesin: 'Soother B2' },
  { username: 'tl_aoki',     password: 'tl2026',      nama: 'TL AOKI',         role: 'TL',       permissions: ['dashboard','catalog','partout','monitoring','return'], mesin: 'AOKI' },
  { username: 'tl_mold',     password: 'tl2026',      nama: 'TL Maintenance Mold', role: 'TL',   permissions: ['dashboard','catalog','partout','monitoring','return'], mesin: 'Mold' },
];

const canAccess = (loginRole: string, permissions: string[], page: string) => {
  if (loginRole === 'admin') return true;
  if (permissions.includes('all')) return true;
  return permissions.includes(page);
};

const menuItems = [
  { id:'dashboard', label:'Dashboard',  icon:'/icon-home.svg' },
  { id:'catalog',   label:'Catalog',    icon:'/icon-catalog.svg' },
  { id:'partin',    label:'Part IN',    icon:'/icon-partin.svg' },
  { id:'partout',   label:'Part OUT',   icon:'/icon-partout.svg' },
  { id:'monitoring',label:'Monitoring', icon:'/monitoring.svg' },
  { id:'order',     label:'Order',      icon:'🛒' },
  { id:'laporan',   label:'Laporan',    icon:'📋' },
  { id:'return',    label:'Return',     icon:'/Return.svg' },
  { id:'parts',     label:'Kelola Part',icon:'/kelola part.svg' },
  { id:'users',     label:'Kelola User',icon:'/kelola user.svg' },
  { id:'history',   label:'History',    icon:'📜' },
  { id:'lokasi',    label:'Lokasi rak', icon:'' },
];

// ===== Navigasi sidebar (desain baru) =====
const NAV_GROUPS: {label:string; ids:string[]}[] = [
  { label:'',           ids:['dashboard'] },
  { label:'Inventori',  ids:['catalog','monitoring'] },
  { label:'Transaksi',  ids:['partin','partout','order','return'] },
  { label:'Laporan',    ids:['laporan','history'] },
  { label:'Pengaturan', ids:['parts','lokasi','users'] },
];
const NAV_LABEL: Record<string,string> = {
  dashboard:'Dashboard', catalog:'Katalog', parts:'Kelola part', monitoring:'Monitoring',
  partin:'Part In', partout:'Part Out', order:'Order', return:'Return',
  laporan:'Laporan', history:'Riwayat', users:'Kelola user', lokasi:'Lokasi rak',
};
function NavIcon({ id }: { id: string }) {
  const p = { width:18, height:18, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.75, strokeLinecap:'round' as const, strokeLinejoin:'round' as const, 'aria-hidden':true };
  switch (id) {
    case 'dashboard':  return <svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>;
    case 'catalog':    return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'parts':      return <svg {...p}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></svg>;
    case 'monitoring': return <svg {...p}><path d="M3 12h4l3 7 4-14 3 7h4"/></svg>;
    case 'partin':     return <svg {...p}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v3h16v-3"/></svg>;
    case 'partout':    return <svg {...p}><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M4 17v3h16v-3"/></svg>;
    case 'order':      return <svg {...p}><circle cx="9" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/><path d="M3 4h2l2.5 11h11L21 7H7"/></svg>;
    case 'return':     return <svg {...p}><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>;
    case 'laporan':    return <svg {...p}><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h6"/></svg>;
    case 'history':    return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'lokasi':     return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M12 3v18"/></svg>;
    case 'users':      return <svg {...p}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/></svg>;
    default:           return <svg {...p}><circle cx="12" cy="12" r="3"/></svg>;
  }
}

// ===== Komponen kecil yang dipakai bersama (desain baru) =====
const STATUS_INFO: Record<string,{label:string; tone:string}> = {
  Pending:{label:'Menunggu',tone:'warning'}, Approved:{label:'Disetujui',tone:'success'},
  Rejected:{label:'Ditolak',tone:'danger'}, Prepared:{label:'Disiapkan',tone:'info'},
};
const REJECT_REASONS=['Stok habis','Part tidak sesuai / salah pilih','Jumlah tidak wajar','Permintaan duplikat','Lainnya'];
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_INFO[status] || { label: status || '-', tone: 'neutral' };
  return <span className={`mcc-badge mcc-badge-${s.tone}`}>{s.label}</span>;
}
const iconProps = { width:16, height:16, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.75, strokeLinecap:'round' as const, strokeLinejoin:'round' as const, 'aria-hidden':true };
const IconEdit    = () => <svg {...iconProps}><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>;
const IconTrash   = () => <svg {...iconProps}><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>;
const IconMail    = () => <svg {...iconProps}><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></svg>;
const IconChevron = () => <svg {...iconProps}><path d="m9 6 6 6-6 6"/></svg>;

const kategoriList = ['AOKI','Arburg','Barcode','Fartech','Gaia Auto','Lambert','Mold','Mold LSR','Molding','Slitting','Tampon Printing','Machine'];
const KC: Record<string,string> = { 'Lambert':'#8a5a00','Mold':'#0b5ed7','Molding':'#4338ca','AOKI':'#1e7e34','Arburg':'#be185d','Slitting':'#0f766e','Tampon Printing':'#c2410c','Fartech':'#6d28d9','Gaia Auto':'#0e7490','Barcode':'#4d7c0f','Mold LSR':'#be123c','Machine':'#5b6b80' };

type User = typeof usersData[0];

// ── Return: bentuk form kosong + pengecil foto (Fase B) ──
const RETURN_EMPTY = { nomor_do:'', spare_part_id:'', nama_part:'', nama_supplier:'', jumlah:'', alasan:'Barang rusak / cacat', catatan:'', foto:'' };
const partLabel = (p:any) => `${p.nama_part} [${p.kode_12nc || ('#' + p.id)}]`;
// Perkecil foto (maks 1280 px sisi terpanjang, JPEG 0.7) supaya database tidak cepat penuh.
function kecilkanFoto(dataUrl:string, maxSisi=1280, kualitas=0.7):Promise<string>{
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const skala=Math.min(1, maxSisi/Math.max(img.width, img.height));
      const c=document.createElement('canvas');
      c.width=Math.round(img.width*skala); c.height=Math.round(img.height*skala);
      const ctx=c.getContext('2d'); if(!ctx){resolve(dataUrl);return;}
      ctx.drawImage(img,0,0,c.width,c.height);
      resolve(c.toDataURL('image/jpeg',kualitas));
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

const G = {
  card: { background:'var(--mcc-surface)', border:'1px solid var(--mcc-border)', borderRadius:'8px' } as React.CSSProperties,
  nav:  { background:'var(--mcc-surface)', borderBottom:'1px solid var(--mcc-border)' } as React.CSSProperties,
  inp:  { width:'100%', background:'var(--mcc-surface)', border:'1px solid var(--mcc-border)', borderRadius:'6px', padding:'9px 12px', color:'var(--mcc-text)', fontSize:'14px', outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' },
  lbl:  { fontSize:'13px', fontWeight:600 as const, color:'var(--mcc-text-muted)', marginBottom:'6px', display:'block' as const },
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

function toArr(d: any): any[] {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && Array.isArray(d.result)) return d.result;
  return [];
}

function LoginModal({ onLogin }: { onLogin: (nama: string, role: string, perms: string[], mesin: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      setError('Username dan password wajib diisi!');
      return;
    }

    setLoading(true);
    setError('');

    try {
            const apiUrl = '/api/auth/login';
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Username atau password salah!');
      }

      const token = data?.token || data?.accessToken || data?.data?.token || data?.access_token;
      if (token) {
        localStorage.setItem('mcc_token', token);
      }

      const user = data?.user || data?.data?.user || data?.profile || data?.data || {};
      const userName = user.nama || user.name || user.username || username;
      const userRole = user.role || 'admin';
      const permissions = user.permissions || ['all'];
      const mesin = user.mesin || '';

      onLogin(userName, userRole, permissions, mesin);
    } catch (err: any) {
      setError(err?.message || 'Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // ===== Tampilan login (desain baru). Logika di atas tidak diubah. =====
  const inputStyle: React.CSSProperties = {
    width: '100%', height: '48px', padding: '0 14px', boxSizing: 'border-box',
    border: '1px solid var(--mcc-border)', borderRadius: '6px', background: 'var(--mcc-surface)',
    color: 'var(--mcc-text)', fontFamily: 'inherit', fontSize: '16px', outline: 'none',
  };

  return (
    <div className="mcc-login" style={{position:'fixed',inset:0,zIndex:9999,display:'flex',background:'var(--mcc-surface)',color:'var(--mcc-text)',fontFamily:'var(--mcc-font)'}}>
      <aside className="mcc-login-brand" style={{width:'40%',maxWidth:'560px',minWidth:'360px',background:'var(--mcc-navy)',display:'flex',flexDirection:'column',padding:'56px',boxSizing:'border-box'}}>
        <div style={{fontSize:'26px',fontWeight:700,color:'#ffffff',letterSpacing:'1px'}}>PHILIPS</div>
        <div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:'16px'}}>
          <div style={{width:'48px',height:'4px',background:'var(--mcc-blue)'}}/>
          <h1 style={{margin:0,fontSize:'40px',lineHeight:1.15,fontWeight:700,color:'#ffffff'}}>Sistem Spare Part MCC</h1>
          <p style={{margin:0,fontSize:'18px',lineHeight:1.5,color:'#c3cfdf',maxWidth:'400px'}}>Pengelolaan stok, permintaan teknisi, dan dokumentasi pengambilan part di Store MCC.</p>
        </div>
        <div style={{marginTop:'64px',fontSize:'14px',color:'#9fb0c8'}}>PT Philips Industries Batam</div>
      </aside>

      <main style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'32px',boxSizing:'border-box'}}>
        <div className="mcc-fade-in" style={{width:'100%',maxWidth:'400px',display:'flex',flexDirection:'column',gap:'24px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            <h2 style={{margin:0,fontSize:'28px',fontWeight:700}}>Masuk sebagai admin</h2>
            <p style={{margin:0,fontSize:'16px',color:'var(--mcc-text-muted)'}}>Gunakan akun Store MCC Anda.</p>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <label htmlFor="login-username" style={{fontSize:'15px',fontWeight:600}}>Username</label>
            <input id="login-username" autoComplete="username" autoFocus style={inputStyle} placeholder="Masukkan username" value={username} onChange={e=>{setUsername(e.target.value);setError('');}} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <label htmlFor="login-password" style={{fontSize:'15px',fontWeight:600}}>Password</label>
            <div className="mcc-login-pass" style={{display:'flex',alignItems:'center',height:'48px',border:'1px solid var(--mcc-border)',borderRadius:'6px',padding:'0 6px 0 14px',boxSizing:'border-box',background:'var(--mcc-surface)'}}>
              <input id="login-password" autoComplete="current-password" style={{flex:1,minWidth:0,border:'none',outline:'none',background:'transparent',color:'var(--mcc-text)',fontFamily:'inherit',fontSize:'16px'}} type={showPass?'text':'password'} placeholder="Masukkan password" value={password} onChange={e=>{setPassword(e.target.value);setError('');}} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
              <button type="button" onClick={()=>setShowPass(!showPass)} aria-label={showPass?'Sembunyikan password':'Tampilkan password'} style={{width:'36px',height:'36px',border:'none',borderRadius:'4px',background:'transparent',color:'var(--mcc-text-muted)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                {showPass
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>
          </div>

          {error&&(
            <div role="alert" className="mcc-fade-in" style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'12px 14px',borderRadius:'6px',background:'var(--mcc-danger-soft)',color:'var(--mcc-danger)',fontSize:'15px'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:'2px'}}><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>
              <span>{error}</span>
            </div>
          )}

          <button type="button" onClick={handleLogin} disabled={loading} className="mcc-login-btn" style={{height:'48px',border:'none',borderRadius:'6px',background:'var(--mcc-blue)',color:'#ffffff',fontFamily:'inherit',fontSize:'16px',fontWeight:600,cursor:loading?'wait':'pointer',opacity:loading?0.75:1}}>
            {loading?'Memeriksa...':'Masuk'}
          </button>
        </div>
      </main>

      <style>{`
        .mcc-login input::placeholder{color:#8a97a8;}
        .mcc-login input#login-username:focus,.mcc-login-pass:focus-within{border-color:var(--mcc-blue)!important;box-shadow:0 0 0 3px var(--mcc-blue-soft);}
        .mcc-login input:focus-visible{outline:none;}
        .mcc-login-btn{transition:background var(--mcc-dur-fast) var(--mcc-ease);}
        .mcc-login-btn:hover:not(:disabled){background:var(--mcc-blue-hover)!important;}
        @media (max-width: 900px){.mcc-login-brand{display:none!important;}}
      `}</style>
    </div>
  );
}

function PartImageUpload({onUrl,awal}:{onUrl?:(url:string)=>void;awal?:string|null}={}) {
  const [preview, setPreview] = useState<string|null>(awal||null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const localUrl = URL.createObjectURL(file); setPreview(localUrl); setUploading(true);
    try { const fd = new FormData(); fd.append('file', file); fd.append('partId', String(Date.now())); const res = await fetch('/api/upload',{method:'POST',body:fd}); const data=await res.json(); if(data.success&&onUrl){onUrl(data.url);setPreview(data.url);} } catch {} setUploading(false);
  };
  return (
    <div style={{display:'flex',gap:'16px',alignItems:'flex-start'}}>
      <div onClick={()=>fileRef.current?.click()} style={{width:'120px',height:'120px',borderRadius:'10px',border:'2px dashed rgba(11,94,215,0.3)',background:'rgba(11,94,215,0.06)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden',flexShrink:0}}>
        {preview?<img src={preview} style={{width:'100%',height:'100%',objectFit:'cover'}} alt="preview"/>:<div style={{textAlign:'center'}}><div style={{fontSize:'28px',marginBottom:'4px'}}>📷</div><div style={{fontSize:'10px',color:'#5b6b80'}}>Klik upload foto</div></div>}
      </div>
      <div style={{flex:1}}>
        <div style={{fontSize:'12px',color:'#5b6b80',marginBottom:'8px',lineHeight:1.5}}>Upload foto spare part. Format: JPG, PNG — Maks 5MB</div>
        <div style={{display:'flex',gap:'8px'}}>
          <button type="button" onClick={()=>fileRef.current?.click()} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.3)',borderRadius:'7px',padding:'7px 14px',color:'#0b5ed7',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>📷 Pilih Foto</button>
          {preview&&<button type="button" onClick={()=>{setPreview(null);onUrl?.('');}} style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.2)',borderRadius:'7px',padding:'7px 14px',color:'#c62828',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>✕ Hapus</button>}
        </div>
        {preview&&<div style={{fontSize:'10px',color:uploading?'#8a5a00':'#1e7e34',marginTop:'8px'}}>{uploading?'⏳ Mengupload...':'✅ Foto berhasil diupload'}</div>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleChange}/>
    </div>
  );
}

function PartCard({p,c,onEdit,onHapus,onImageUpload}:{p:any;c:string;onEdit:()=>void;onHapus:()=>void;onImageUpload:(id:number,url:string)=>void}) {
  const isLow = p.stok_saat_ini <= p.reorder_point;
  const fileRef = useRef<HTMLInputElement>(null);
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file); fd.append('partId', String(p.id));
    try { const res = await fetch('/api/upload',{method:'POST',body:fd}); const data=await res.json(); if(data.success)onImageUpload(p.id,data.url); } catch {}
  };
  return (
    <div style={{background:'#f8f9fb',border:`1px solid ${isLow?'rgba(154,103,0,0.3)':p.is_critical?'rgba(198,40,40,0.2)':'#e6eaf0'}`,borderRadius:'12px',overflow:'hidden',transition:'all 0.2s'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 12px 40px ${c}22`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
      <div style={{height:'100px',background:`linear-gradient(135deg,${c}15,#f8f9fb)`,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden'}} onClick={()=>fileRef.current?.click()}>
        {p.foto_url?<img src={p.foto_url} alt={p.nama_part} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div style={{textAlign:'center'}}><div style={{fontSize:'28px',opacity:0.5}}>{emojiPart(p.kategori)}</div><div style={{fontSize:'9px',color:'#8a97a8'}}>Klik untuk upload foto</div></div>}
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageChange}/>
        <div style={{position:'absolute',top:'6px',left:'6px'}}>{p.is_critical&&<span style={{background:'rgba(198,40,40,0.85)',color:'#13294b',fontSize:'8px',fontWeight:700,padding:'1px 5px',borderRadius:'6px'}}>🔴</span>}</div>
        <div style={{position:'absolute',top:'6px',right:'6px'}}><span style={{background:isLow?'rgba(154,103,0,0.85)':'rgba(30,126,52,0.85)',color:'#fff',fontSize:'8px',fontWeight:700,padding:'1px 6px',borderRadius:'6px'}}>{isLow?'⚠️':'✅'}</span></div>
      </div>
      <div style={{padding:'10px 12px'}}>
        <div style={{fontSize:'10px',color:'#8a97a8',fontFamily:'inherit',marginBottom:'3px'}}>{p.kode_12nc||''}</div>
        <div style={{fontSize:'11px',fontWeight:600,color:'#13294b',lineHeight:1.3,marginBottom:'8px',minHeight:'28px'}}>{p.nama_part}</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <span style={{fontSize:'9px',color:'#8a97a8',fontFamily:'inherit'}}>{p.nomor_bin}</span>
          <div style={{display:'flex',alignItems:'baseline',gap:'3px'}}><span style={{fontSize:'15px',fontWeight:700,color:isLow?'#8a5a00':c}}>{p.stok_saat_ini}</span><span style={{fontSize:'9px',color:'#8a97a8'}}>/{p.reorder_point}</span></div>
        </div>
        <div style={{display:'flex',gap:'5px'}}>
          <button onClick={onEdit} style={{flex:1,background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'6px',padding:'5px',color:'#5b6b80',fontSize:'10px',fontWeight:600,cursor:'pointer'}}>Edit</button>
          <button onClick={onHapus} style={{background:'rgba(198,40,40,0.08)',border:'1px solid rgba(198,40,40,0.15)',borderRadius:'6px',padding:'5px 7px',color:'#c62828',fontSize:'10px',cursor:'pointer'}}>🗑️</button>
        </div>
      </div>
    </div>
  );
}

function emojiPart(kategori: string) {
  const map: Record<string,string> = { 'Lambert':'🔧','Mold':'🔩','Molding':'⚙️','AOKI':'💨','Arburg':'🏭','Slitting':'✂️','Tampon Printing':'🖨️','Fartech':'🤖','Gaia Auto':'🦾','Barcode':'📦','Mold LSR':'💧','Machine':'⚡' };
  return map[kategori] || '🔩';
}

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => { start += step; if (start >= target) { setCount(target); clearInterval(timer); } else setCount(start); }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

function StatCard({num, label, color, icon, imgIcon}: {num:number; label:string; color:string; icon:string; imgIcon?:string}) {
  const count = useCountUp(num);
  return (
    <div style={{background:'#f8f9fb',backdropFilter:'none',WebkitBackdropFilter:'none',border:'1px solid #d9dee5',borderRadius:'14px',padding:'16px 20px',animation:'cardPop 0.5s cubic-bezier(0.2,0,0,1) both'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
        {imgIcon?<img src={imgIcon} alt="" style={{width:'22px',height:'22px',objectFit:'contain'}}/>:<span style={{fontSize:'20px'}}>{icon}</span>}
        <span style={{fontSize:'9px',fontWeight:700,color:'#8a97a8',textTransform:'uppercase',letterSpacing:'0.5px',textAlign:'right'}}>{label}</span>
      </div>
      <div style={{fontSize:'34px',fontWeight:800,color,letterSpacing:'-1px',lineHeight:1}}>{count}</div>
    </div>
  );
}

function CircleGauge({num, total, label, color, icon, imgIcon, duration=1400}: {num:number; total:number; label:string; color:string; icon:string; imgIcon?:string; duration?:number}) {
  const count = useCountUp(num, duration);
  const [pct, setPct] = useState(0);
  const radius = 54, stroke = 7, circ = 2 * Math.PI * radius;
  const rawPct = total > 0 ? Math.min((num / total) * 100, 100) : 0;
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (hasAnimated.current) { setPct(rawPct); return; }
    hasAnimated.current = true;
    const t = setTimeout(() => {
      let start = 0; const steps = duration / 16;
      const interval = setInterval(() => { start++; const ease = 1 - Math.pow(2, -10 * (start / steps)); setPct(ease * rawPct); if (start >= steps) { setPct(rawPct); clearInterval(interval); } }, 16);
    }, 100);
    return () => clearTimeout(t);
  }, [rawPct, duration]);
  const dash = (pct / 100) * circ, gap = circ - dash, size = (radius + stroke) * 2 + 4;
  return (
    <div style={{background:'#f8f9fb',backdropFilter:'none',WebkitBackdropFilter:'none',border:'1px solid #e6eaf0',borderRadius:'16px',padding:'20px',animation:'cardPop 0.6s cubic-bezier(0.2,0,0,1) both',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'12px',transition:'all 0.25s'}}
      onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 16px 48px ${color}22`;}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';}}>
      <div style={{position:'relative',width:`${size}px`,height:`${size}px`}}>
        <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#8a97a8" strokeWidth={stroke}/>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={stroke+4} opacity={0.08} strokeDasharray={`${dash} ${gap}`} strokeLinecap="round"/>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`url(#grad-${label.replace(/\s/g,'')})`} strokeWidth={stroke} strokeDasharray={`${dash} ${gap}`} strokeLinecap="round" style={{filter:`drop-shadow(0 0 6px ${color}88)`}}/>
          <defs><linearGradient id={`grad-${label.replace(/\s/g,'')}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={color} stopOpacity="1"/><stop offset="100%" stopColor={color} stopOpacity="0.5"/></linearGradient></defs>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'2px'}}>
          {imgIcon?<img src={imgIcon} alt="" style={{width:'20px',height:'20px',objectFit:'contain',marginBottom:'2px'}}/>:<span style={{fontSize:'18px'}}>{icon}</span>}
          <div style={{fontSize:'22px',fontWeight:800,color,letterSpacing:'-1px',lineHeight:1}}>{count}</div>
          <div style={{fontSize:'9px',fontWeight:700,color,opacity:0.7}}>{Math.round(pct)}%</div>
        </div>
      </div>
      <div style={{fontSize:'10px',fontWeight:700,color:'#5b6b80',textTransform:'uppercase',letterSpacing:'0.8px',textAlign:'center'}}>{label}</div>
    </div>
  );
}

function AccessDenied({ page, onBack }: { page: string; onBack: () => void }) {
  return (
    <div style={{padding:'60px 24px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center'}}>
      <div style={{fontSize:'64px',marginBottom:'20px'}}>🔒</div>
      <div style={{fontSize:'22px',fontWeight:700,color:'#13294b',marginBottom:'8px'}}>Akses Ditolak</div>
      <div style={{fontSize:'13px',color:'#5b6b80',marginBottom:'24px'}}>Anda tidak memiliki izin untuk mengakses halaman <strong style={{color:'#c62828'}}>{page}</strong></div>
      <button onClick={onBack} style={{background:'#0b5ed7',border:'none',borderRadius:'8px',padding:'10px 24px',color:'#fff',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>← Kembali ke Dashboard</button>
    </div>
  );
}

// ===== Laporan periode 4 halaman A4 (Ringkasan · Per mesin & tim · Biaya pemakaian · Stok & persetujuan), siap cetak / simpan PDF =====
const STATUS_ORDER_LABEL:Record<string,string>={request:'Request',approval:'Approval',submit:'Submit',menunggu_buyer:'Menunggu buyer',pilih_supplier:'Pilih supplier',pr:'PR',admin_order:'Admin order',po:'PO / dikirim',selesai:'Diterima',batal:'Batal'};
function LaporanPeriode({ dari, sampai }:{ dari:string; sampai:string }) {
  const [d,setD]=useState<any>(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState('');
  const [catatan,setCatatan]=useState('');
  const baca=(k:string,def:string)=>{try{return localStorage.getItem(k)||def;}catch{return def;}};
  const [ttd,setTtd]=useState(()=>({admin:baca('mcc_ttd_admin',''),leader:baca('mcc_ttd_leader',''),spv:baca('mcc_ttd_spv','')}));
  const ubahTtd=(k:'admin'|'leader'|'spv',v:string)=>{setTtd(t=>({...t,[k]:v}));try{localStorage.setItem('mcc_ttd_'+k,v);}catch{}};
  useEffect(()=>{let batal=false;setLoading(true);setErr('');
    fetch(`/api/laporan-v2?jenis=periode&dari=${dari}&sampai=${sampai}`).then(r=>r.json()).then(x=>{if(batal)return;if(x.success)setD(x);else{setD(null);setErr(x.error||'Gagal memuat laporan');}})
      .catch(e=>{if(!batal){setD(null);setErr(e.message);}}).finally(()=>{if(!batal)setLoading(false);});
    return()=>{batal=true;};},[dari,sampai]);
  const fmtTgl=(s:string)=>new Date(s+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});
  const periode=`${fmtTgl(dari)} – ${fmtTgl(sampai)}`;
  const cetakPada=new Date().toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
  const angka=(v:any)=>Number(v||0).toLocaleString('id-ID');
  const NAVY='#13294b', BIRU='#0b5ed7', MUTED='#5b6b80', GARIS='#dfe4ec', MERAH='#c62828', HIJAU='#1e7e34', KUNING='#b26a00';
  const delta=(now:number,lalu:number)=>{if(!lalu)return null;const p=Math.round(((now-lalu)/lalu)*100);return p;};
  const Hal=({no,children}:{no:number;children:any})=>(
    <section className="lap-hal" style={{width:'210mm',minHeight:'297mm',boxSizing:'border-box',padding:'12mm 12mm 10mm',background:'#fff',color:NAVY,display:'flex',flexDirection:'column',gap:'5mm',boxShadow:'0 2px 12px rgba(19,41,75,0.12)',fontFamily:"Inter, 'Segoe UI', Arial, sans-serif",fontSize:'10pt'}}>
      <header style={{display:'flex',alignItems:'center',gap:'5mm',borderBottom:`2px solid ${NAVY}`,paddingBottom:'3mm'}}>
        <div style={{fontWeight:800,fontSize:'18pt',letterSpacing:'2px',color:NAVY}}>PHILIPS</div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:'13pt'}}>LAPORAN SPARE PART – STORE MCC</div>
          <div style={{fontSize:'8.5pt',color:MUTED}}>Periode: {periode} · Tgl cetak: {cetakPada}</div>
        </div>
        <div style={{fontSize:'8.5pt',color:MUTED,whiteSpace:'nowrap'}}>Hal {no}/4</div>
      </header>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:'5mm'}}>{children}</div>
      <footer style={{borderTop:`1px solid ${GARIS}`,paddingTop:'2mm',fontSize:'7.5pt',color:MUTED,display:'flex',justifyContent:'space-between'}}>
        <span>PT Philips Industries Batam · MCC Spare Part System</span><span>Dicetak dari sistem, {cetakPada}</span>
      </footer>
    </section>
  );
  const Judul=({children}:{children:any})=><div style={{fontSize:'10.5pt',fontWeight:800,letterSpacing:'0.4px',textTransform:'uppercase',color:NAVY,borderLeft:`3px solid ${BIRU}`,paddingLeft:'2.5mm'}}>{children}</div>;
  const th:React.CSSProperties={textAlign:'left',padding:'1.6mm 2mm',background:'#eef2f8',color:NAVY,fontSize:'8pt',fontWeight:700,borderBottom:`1px solid ${GARIS}`};
  const td:React.CSSProperties={padding:'1.4mm 2mm',fontSize:'8.5pt',borderBottom:`1px solid ${GARIS}`,verticalAlign:'top'};
  const Kosong=({kolom,teks}:{kolom:number;teks:string})=><tr><td colSpan={kolom} style={{...td,textAlign:'center',color:MUTED,padding:'4mm'}}>{teks}</td></tr>;
  const Kartu=({judul,nilai,sub,warna,tanda}:{judul:string;nilai:string;sub:string;warna?:string;tanda?:any})=>(
    <div style={{border:`1px solid ${GARIS}`,borderTop:`3px solid ${warna||BIRU}`,borderRadius:'2mm',padding:'3mm 3.5mm',display:'flex',flexDirection:'column',gap:'1mm'}}>
      <div style={{fontSize:'8pt',fontWeight:700,color:MUTED,textTransform:'uppercase',letterSpacing:'0.4px'}}>{judul}</div>
      <div style={{fontSize:'17pt',fontWeight:800,color:warna||NAVY,lineHeight:1.1}}>{nilai}</div>
      <div style={{fontSize:'8pt',color:MUTED,display:'flex',justifyContent:'space-between',gap:'2mm'}}><span>{sub}</span>{tanda}</div>
    </div>
  );
  const Delta=({p,naikBuruk}:{p:number|null;naikBuruk?:boolean})=>p===null?<span>–</span>:<span style={{fontWeight:700,color:p===0?MUTED:(p>0)===!!naikBuruk?MERAH:HIJAU}}>{p>0?'▲':p<0?'▼':'■'}{Math.abs(p)}%</span>;

  // Tren harian -> SVG garis
  const Tren=()=>{
    const hari:string[]=[];const a=new Date(dari+'T00:00:00'),b=new Date(sampai+'T00:00:00');
    for(let t=new Date(a);t<=b&&hari.length<93;t.setDate(t.getDate()+1))hari.push(tglInput(t));
    const map:Record<string,{k:number;m:number}>={};hari.forEach(h=>map[h]={k:0,m:0});
    (d?.tren||[]).forEach((r:any)=>{const k=String(r.tgl).slice(0,10);if(map[k]){map[k].k+=Number(r.keluar)||0;map[k].m+=Number(r.masuk)||0;}});
    const W=680,H=170,pl=34,pr=8,pt=10,pb=22;const maks=Math.max(1,...hari.map(h=>Math.max(map[h].k,map[h].m)));
    const x=(i:number)=>pl+(hari.length<=1?0:(i*(W-pl-pr))/(hari.length-1));const y=(v:number)=>pt+(H-pt-pb)*(1-v/maks);
    const garis=(f:'k'|'m')=>hari.map((h,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(map[h][f]).toFixed(1)}`).join(' ');
    const ticks=[0,Math.round(maks/2),maks];
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'auto'}} role="img" aria-label="Grafik tren harian part keluar dan masuk">
        {ticks.map(t=><g key={t}><line x1={pl} x2={W-pr} y1={y(t)} y2={y(t)} stroke={GARIS} strokeWidth="1"/><text x={pl-5} y={y(t)+3} fontSize="9" textAnchor="end" fill={MUTED}>{t}</text></g>)}
        {hari.map((h,i)=>(i%Math.ceil(hari.length/10)===0||i===hari.length-1)&&<text key={h} x={x(i)} y={H-6} fontSize="9" textAnchor="middle" fill={MUTED}>{Number(h.slice(8,10))}</text>)}
        <path d={garis('m')} fill="none" stroke={BIRU} strokeWidth="2" strokeLinejoin="round"/>
        <path d={garis('k')} fill="none" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round"/>
      </svg>
    );
  };

  const k=d?.kpi;
  const b=d?.biaya;
  const rupiah=(v:any)=>'Rp '+Math.round(Number(v)||0).toLocaleString('id-ID');
  const unduhBiaya=()=>{if(!b?.rows)return;unduhCSV(`biaya-pemakaian_${dari}_${sampai}.csv`,['No','Nama part','12NC','Mesin','Kategori','Consumable','Qty','Harga satuan','Subtotal'],
    [...b.rows.map((r:any,i:number)=>[i+1,r.nama_part,r.kode_12nc,r.mesin,r.is_critical?'Critical':'Normal',r.is_consumable?'Ya':'Tidak',r.qty,r.harga_satuan,r.subtotal]),['','TOTAL','','','','','','',Math.round(b.total)]]);};
  const maksMesin=Math.max(1,...(d?.mesin||[]).map((m:any)=>m.pcs||0));
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden !important; }
          .lap-cetak, .lap-cetak * { visibility: visible !important; }
          .lap-cetak { position: absolute; left: 0; top: 0; gap: 0 !important; background: #fff !important; padding: 0 !important; }
          .lap-hal { box-shadow: none !important; page-break-after: always; break-after: page; margin: 0 !important; }
          .lap-hal:last-child { page-break-after: auto; break-after: auto; }
          .lap-noprint { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div className="lap-noprint" style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr)) auto',gap:'12px',alignItems:'end',background:'var(--mcc-surface)',border:'1px solid var(--mcc-border)',borderRadius:'8px',padding:'14px 16px'}}>
        {(['admin','leader','spv'] as const).map(kk=>(
          <label key={kk} style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>
            {kk==='admin'?'Nama pembuat (Admin Store)':kk==='leader'?'Nama pemeriksa (Leader Maintenance)':'Nama penyetuju (Supervisor / Manager)'}
            <input style={G.inp} value={ttd[kk]} onChange={e=>ubahTtd(kk,e.target.value)} placeholder="boleh kosong"/>
          </label>
        ))}
        <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
          <button type="button" className="mcc-btn-primary" disabled={!d||loading} onClick={()=>window.print()}>Cetak / Simpan PDF</button>
          <button type="button" className="mcc-btn-secondary" disabled={!b?.ada_harga||!b?.rows?.length} onClick={unduhBiaya}>Unduh biaya (Excel)</button>
        </div>
        <label style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>
          Catatan admin / evaluasi (tampil di halaman 3)
          <textarea style={{...G.inp,minHeight:'60px',resize:'vertical'}} value={catatan} onChange={e=>setCatatan(e.target.value)} placeholder="mis. Stok Suction Filter Aoki habis karena PM mendadak. PR/PO sudah diajukan ke Procurement."/>
        </label>
        <div style={{gridColumn:'1/-1',fontSize:'12px',color:'var(--mcc-text-muted)'}}>Tips: di jendela cetak pilih <b>Save as PDF</b>, ukuran <b>A4</b>, dan centang <b>Background graphics</b> supaya warna ikut tercetak.</div>
      </div>
      {err&&<div role="alert" className="lap-noprint" style={{color:'var(--mcc-danger)',fontSize:'15px'}}>{err}</div>}
      {loading&&!d&&<div className="lap-noprint" style={{color:'var(--mcc-text-muted)'}}>Menyusun laporan...</div>}
      {d&&k&&(
        <div className="lap-cetak" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'18px',background:'#e9edf3',padding:'18px',borderRadius:'8px',opacity:loading?0.6:1}}>
          {/* ===== HALAMAN 1 ===== */}
          <Hal no={1}>
            <Judul>Ringkasan performa / KPI</Judul>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'3mm'}}>
              <Kartu judul="Part keluar" nilai={`${angka(k.keluar.pcs)} pcs`} sub={`${angka(k.keluar.req)} request`} tanda={<Delta p={delta(k.keluar.pcs,k.keluar.pcs_lalu)} naikBuruk/>}/>
              <Kartu judul="Part masuk" nilai={`${angka(k.masuk.pcs)} pcs`} sub={`${angka(k.masuk.trx)} transaksi`} tanda={<Delta p={delta(k.masuk.pcs,k.masuk.pcs_lalu)}/>}/>
              <Kartu judul="Order" nilai={`${angka(k.order.total)} dipesan`} sub={`${angka(k.order.diterima)} diterima · ${angka(k.order.proses)} proses${k.order.batal?` · ${k.order.batal} batal`:''}`}/>
              <Kartu judul="Return supplier" nilai={`${angka(k.retur.pcs)} pcs`} sub={`${angka(k.retur.trx)} transaksi`}/>
              <Kartu judul="Part warning" nilai={`${angka(k.warning)} item`} sub="stok ≤ min stok" warna={k.warning?KUNING:HIJAU}/>
              <Kartu judul="Critical habis" nilai={`${angka(k.critical_habis)} item`} sub="part critical, stok = 0" warna={k.critical_habis?MERAH:HIJAU} tanda={k.critical_habis?<span style={{color:MERAH,fontWeight:700}}>⚠</span>:null}/>
            </div>
            <div style={{fontSize:'7.5pt',color:MUTED,marginTop:'-2mm'}}>▲▼ dibanding periode sebelumnya dengan panjang yang sama ({d.periode.lama_hari} hari). Warning & critical = kondisi stok saat laporan dicetak.</div>
            <Judul>Tren harian: part keluar vs part masuk</Judul>
            <div style={{border:`1px solid ${GARIS}`,borderRadius:'2mm',padding:'3mm'}}>
              <Tren/>
              <div style={{display:'flex',gap:'6mm',fontSize:'8pt',color:MUTED,justifyContent:'center'}}>
                <span><span style={{display:'inline-block',width:'6mm',height:'2px',background:NAVY,verticalAlign:'middle',marginRight:'1.5mm'}}/>Part keluar</span>
                <span><span style={{display:'inline-block',width:'6mm',height:'2px',background:BIRU,verticalAlign:'middle',marginRight:'1.5mm'}}/>Part masuk</span>
                <span>Sumbu bawah: tanggal</span>
              </div>
            </div>
            <Judul>Top 10 part paling banyak keluar</Judul>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr><th style={{...th,width:'8mm'}}>No</th><th style={th}>Nama part</th><th style={th}>12NC</th><th style={th}>Mesin</th><th style={{...th,textAlign:'right'}}>Qty out</th><th style={{...th,textAlign:'right'}}>Sisa stok</th></tr></thead>
              <tbody>
                {d.top.length===0&&<Kosong kolom={6} teks="Tidak ada part keluar pada periode ini."/>}
                {d.top.map((r:any,i:number)=>{const w=r.stok!=null&&r.min_stok>0&&r.stok<=r.min_stok;return(
                  <tr key={i}><td style={td}>{i+1}</td><td style={{...td,fontWeight:600}}>{r.nama_part}</td><td style={td}>{r.kode_12nc||'-'}</td><td style={td}>{r.mesin||'-'}</td>
                    <td style={{...td,textAlign:'right'}}>{angka(r.qty)} pcs</td>
                    <td style={{...td,textAlign:'right',color:w?MERAH:undefined,fontWeight:w?700:400}}>{r.stok==null?'-':`${angka(r.stok)} pcs${w?' ⚠':''}`}</td></tr>);})}
              </tbody>
            </table>
          </Hal>

          {/* ===== HALAMAN 2 ===== */}
          <Hal no={2}>
            <Judul>Total pemakaian part per mesin</Judul>
            <div style={{border:`1px solid ${GARIS}`,borderRadius:'2mm',padding:'3mm',display:'flex',flexDirection:'column',gap:'1.6mm'}}>
              {d.mesin.length===0&&<div style={{color:MUTED,fontSize:'9pt',textAlign:'center',padding:'4mm'}}>Belum ada pemakaian pada periode ini.</div>}
              {d.mesin.slice(0,12).map((m:any)=>(
                <div key={m.mesin} style={{display:'grid',gridTemplateColumns:'32mm 1fr 18mm',alignItems:'center',gap:'2mm',fontSize:'8.5pt'}}>
                  <span style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.mesin}</span>
                  <span style={{background:'#eef2f8',borderRadius:'1mm',height:'4mm',overflow:'hidden'}}><span style={{display:'block',height:'100%',width:`${Math.max(2,(m.pcs/maksMesin)*100)}%`,background:m.status==='Alert'?MERAH:NAVY}}/></span>
                  <span style={{textAlign:'right',fontWeight:700}}>{angka(m.pcs)} pcs</span>
                </div>
              ))}
            </div>
            <Judul>Ringkasan aktivitas mesin</Judul>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr><th style={th}>Mesin</th><th style={th}>Area</th><th style={{...th,textAlign:'right'}}>Request</th><th style={{...th,textAlign:'right'}}>Total pcs</th><th style={{...th,textAlign:'right'}}>% part warning</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {d.mesin.length===0&&<Kosong kolom={6} teks="Tidak ada data."/>}
                {d.mesin.slice(0,14).map((m:any)=>(
                  <tr key={m.mesin}><td style={{...td,fontWeight:600}}>{m.mesin}</td><td style={td}>{m.area}</td><td style={{...td,textAlign:'right'}}>{angka(m.req)}</td><td style={{...td,textAlign:'right'}}>{angka(m.pcs)}</td>
                    <td style={{...td,textAlign:'right'}}>{m.persen_warning==null?'-':`${m.persen_warning}%`}</td>
                    <td style={td}><span style={{fontWeight:700,color:m.status==='Alert'?MERAH:HIJAU}}>{m.status}</span></td></tr>
                ))}
              </tbody>
            </table>
            <div style={{fontSize:'7.5pt',color:MUTED,marginTop:'-2mm'}}>% part warning = part milik mesin itu yang stoknya ≤ min stok, dibagi total part mesin itu. Status Alert jika ≥ 10% atau ada part critical habis.</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4mm'}}>
              {[{judul:'Maintenance Mold',total:`Total ganti mold: ${angka(d.mold.batch)}x · ${angka(d.mold.pcs)} pcs`,sub:'Top 5 mold paling boros part',list:d.mold.top.map((m:any)=>`${m.nama_mold}${m.mesin?` – ${m.mesin}`:''} (${angka(m.pcs)} pcs)`),kosong:d.info.ada_mold?'Belum ada request dari template mold.':'Fitur mold belum aktif.'},
                {judul:'Maintenance Machine (PM)',total:`Total request PM: ${angka(d.pm.batch)}x · ${angka(d.pm.pcs)} pcs`,sub:'Part PM paling sering diganti',list:d.pm.top.map((p:any)=>`${p.nama_part} – ${p.mesin} (${angka(p.pcs)} pcs)`),kosong:'Belum ada request dari checklist PM.'}].map(b=>(
                <div key={b.judul} style={{border:`1px solid ${GARIS}`,borderRadius:'2mm',padding:'3mm 3.5mm',display:'flex',flexDirection:'column',gap:'1.5mm'}}>
                  <div style={{fontWeight:800,fontSize:'9.5pt',textTransform:'uppercase'}}>{b.judul}</div>
                  <div style={{fontSize:'8.5pt'}}>• {b.total}</div>
                  <div style={{fontSize:'8.5pt'}}>• {b.sub}:</div>
                  {b.list.length===0?<div style={{fontSize:'8pt',color:MUTED,paddingLeft:'4mm'}}>{b.kosong}</div>:
                    <ol style={{margin:0,paddingLeft:'8mm',fontSize:'8.5pt',display:'flex',flexDirection:'column',gap:'0.8mm'}}>{b.list.map((t:string,i:number)=><li key={i}>{t}</li>)}</ol>}
                </div>
              ))}
            </div>
          </Hal>

          {/* ===== HALAMAN 3: BIAYA PEMAKAIAN ===== */}
          <Hal no={3}>
            <Judul>Biaya pemakaian spare part</Judul>
            {!b?.ada_harga?(
              <div style={{border:`1px dashed ${GARIS}`,borderRadius:'2mm',padding:'5mm',color:MUTED,fontSize:'9pt'}}>Kolom harga belum ada di database. Jalankan migrasi 16, lalu isi harga part di Master Data atau saat Part In.</div>
            ):(<>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'3mm'}}>
                <Kartu judul="Total biaya pemakaian" nilai={rupiah(b.total)} sub={`${angka(b.rows.length)} jenis part · ${d.periode.lama_hari} hari`} tanda={<Delta p={delta(b.total,b.total_lalu)} naikBuruk/>}/>
                <Kartu judul="Consumable part" nilai={rupiah(b.consumable)} sub={b.total?`${Math.round((b.consumable/b.total)*100)}% dari total`:'-'} warna={KUNING}/>
                <Kartu judul="Part tanpa harga" nilai={`${angka(b.tanpa_harga)} part`} sub="belum dihitung di total" warna={b.tanpa_harga?MERAH:HIJAU}/>
              </div>
              {b.per_mesin?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'2mm',fontSize:'8.5pt'}}>
                {b.per_mesin.slice(0,8).map((m:any)=><span key={m.mesin} style={{border:`1px solid ${GARIS}`,borderRadius:'1.5mm',padding:'1mm 2.5mm'}}><b>{m.mesin}</b> · {rupiah(m.total)}</span>)}
              </div>}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th style={{...th,width:'8mm'}}>No</th><th style={th}>Nama part</th><th style={th}>Mesin</th><th style={{...th,textAlign:'right'}}>Qty</th><th style={{...th,textAlign:'right'}}>Harga satuan</th><th style={{...th,textAlign:'right'}}>Subtotal</th></tr></thead>
                <tbody>
                  {b.rows.length===0&&<Kosong kolom={6} teks="Tidak ada part keluar pada periode ini."/>}
                  {b.rows.map((r:any,i:number)=>(
                    <tr key={i}><td style={td}>{i+1}</td>
                      <td style={{...td,fontWeight:600}}>{r.nama_part}{r.is_consumable?<span style={{marginLeft:'1.5mm',fontSize:'7pt',fontWeight:700,color:KUNING}}>CONSUMABLE</span>:null}{r.kode_12nc?<div style={{fontWeight:400,fontSize:'7.5pt',color:MUTED}}>{r.kode_12nc}</div>:null}</td>
                      <td style={td}>{r.mesin||'-'}</td>
                      <td style={{...td,textAlign:'right'}}>{angka(r.qty)} pcs</td>
                      <td style={{...td,textAlign:'right',color:r.harga_satuan==null?MERAH:undefined}}>{r.harga_satuan==null?'belum ada':rupiah(r.harga_satuan)}</td>
                      <td style={{...td,textAlign:'right',fontWeight:700}}>{r.subtotal==null?'-':rupiah(r.subtotal)}</td></tr>
                  ))}
                  {b.rows.length>0&&<tr><td colSpan={5} style={{...td,textAlign:'right',fontWeight:800,borderBottom:'none'}}>TOTAL</td><td style={{...td,textAlign:'right',fontWeight:800,fontSize:'10pt',borderBottom:'none'}}>{rupiah(b.total)}</td></tr>}
                </tbody>
              </table>
              <div style={{fontSize:'7.5pt',color:MUTED}}>Biaya = qty part keluar (request disetujui) × harga satuan part yang tercatat saat laporan dibuat. ▲▼ dibanding {d.periode.lama_hari} hari sebelumnya.</div>
            </>)}
          </Hal>

          {/* ===== HALAMAN 4 ===== */}
          <Hal no={4}>
            <Judul>Part perlu dipesan (reorder needed)</Judul>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr><th style={th}>Nama part</th><th style={th}>12NC</th><th style={th}>Bin / rak</th><th style={{...th,textAlign:'right'}}>Stok</th><th style={{...th,textAlign:'right'}}>Min</th><th style={th}>Mesin</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {d.reorder.length===0&&<Kosong kolom={7} teks="Semua part di atas min stok. 👍"/>}
                {d.reorder.slice(0,18).map((r:any,i:number)=>{const habis=r.stok<=0;return(
                  <tr key={i}><td style={{...td,fontWeight:600}}>{r.nama_part}</td><td style={td}>{r.kode_12nc||'-'}</td>
                    <td style={td}>{r.nomor_bin||'-'}{r.rak_kode?` · ${r.rak_kode}${r.rak_tingkat?`-${r.rak_tingkat}`:''}`:''}</td>
                    <td style={{...td,textAlign:'right',fontWeight:700,color:habis?MERAH:KUNING}}>{angka(r.stok)}</td><td style={{...td,textAlign:'right'}}>{angka(r.min_stok)}</td>
                    <td style={td}>{r.mesin||'-'}</td>
                    <td style={td}><span style={{fontWeight:700,color:habis?MERAH:KUNING}}>{habis?'CRITICAL':'WARNING'}</span></td></tr>);})}
              </tbody>
            </table>
            {d.reorder.length>18&&<div style={{fontSize:'7.5pt',color:MUTED,marginTop:'-3mm'}}>+{d.reorder.length-18} part lain. Daftar lengkap ada di Laporan → Stok kritis & reorder.</div>}
            <Judul>Status order & return</Judul>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr><th style={th}>No PO / order</th><th style={th}>Part</th><th style={{...th,textAlign:'right'}}>Qty</th><th style={th}>Status</th><th style={th}>Catatan supplier / tanggal</th></tr></thead>
              <tbody>
                {d.orders.length===0&&d.returns.length===0&&<Kosong kolom={5} teks="Tidak ada order maupun return pada periode ini."/>}
                {d.orders.slice(0,10).map((o:any)=>(
                  <tr key={'o'+o.id}><td style={td}>{o.nomor_po||o.nomor_order||`ORD-${o.id}`}</td><td style={td}>{o.part_pertama||'-'}{o.jumlah_item>1?` +${o.jumlah_item-1} lainnya`:''}</td>
                    <td style={{...td,textAlign:'right'}}>{angka(o.qty)}</td><td style={{...td,fontWeight:700,color:o.status==='selesai'?HIJAU:o.status==='batal'?MERAH:BIRU}}>{STATUS_ORDER_LABEL[o.status]||o.status}</td>
                    <td style={td}>{[o.supplier_nama,o.eta?`ETA: ${tglDb(o.eta).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}`:'',`dibuat ${tglDb(o.created_at).toLocaleDateString('id-ID')}`].filter(Boolean).join(' · ')}</td></tr>
                ))}
                {d.returns.slice(0,6).map((r:any)=>(
                  <tr key={'r'+r.id}><td style={td}>{r.nomor_do||`RET-${r.id}`}</td><td style={td}>{r.nama_part||'-'}</td><td style={{...td,textAlign:'right'}}>{angka(r.qty)}</td>
                    <td style={{...td,fontWeight:700,color:KUNING}}>Returned</td>
                    <td style={td}>{[r.alasan,r.nama_supplier,tglDb(r.tanggal_return).toLocaleDateString('id-ID')].filter(Boolean).join(' · ')}</td></tr>
                ))}
              </tbody>
            </table>
            <Judul>Catatan admin / evaluasi</Judul>
            <div style={{border:`1px solid ${GARIS}`,borderRadius:'2mm',padding:'3mm',minHeight:'22mm',fontSize:'9pt',whiteSpace:'pre-line'}}>{catatan||<span style={{color:'#a0a9b6'}}>(kosong)</span>}</div>
            <div style={{flex:1}}/>
            <Judul>Lembar pengesahan</Judul>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8mm',textAlign:'center',fontSize:'9pt',marginTop:'2mm'}}>
              {[['Dibuat oleh,',ttd.admin,'Admin Store MCC'],['Diperiksa oleh,',ttd.leader,'Leader Maintenance'],['Disetujui oleh,',ttd.spv,'Supervisor / Manager']].map(([a,n,j])=>(
                <div key={j} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                  <div>{a}</div><div style={{height:'20mm'}}/>
                  <div style={{borderTop:`1px solid ${NAVY}`,width:'85%',paddingTop:'1.5mm',fontWeight:700}}>{n?`( ${n} )`:'( .............................. )'}</div>
                  <div style={{color:MUTED,fontSize:'8.5pt'}}>{j}</div>
                </div>
              ))}
            </div>
          </Hal>
        </div>
      )}
    </div>
  );
}

// ===== Halaman Laporan (versi baru). Data dari /api/laporan-v2 (hanya membaca). =====
// ===== Lokasi rak (Opsi A: lokasi disimpan per BIN) =====
type RakInfo = { id:number; kode:string; warna_peta:string; orientasi:string; pos_x:number; pos_y:number; lebar:number; tinggi:number; jumlah_tingkat:number|null; jumlah_bin:number; jumlah_part:number; jumlah_warning:number };
type BinInfo = { nomor_bin:string; jumlah_part:number; jumlah_warning:number; contoh_part:string; rak_id:number|null; rak_kode:string|null; tingkat:number|null };
const POLA_BIN = [
  { id:'semua', label:'Semua pola' }, { id:'WH', label:'WH-###' }, { id:'TP', label:'TP-###' },
  { id:'AK', label:'AK-*' }, { id:'lain', label:'BIN / MC / lainnya' },
];
const polaDari = (bin:string) => bin.startsWith('WH-') ? 'WH' : bin.startsWith('TP-') ? 'TP' : bin.startsWith('AK-') ? 'AK' : 'lain';
const PETA_KOLOM = 24, PETA_BARIS = 14;

// ===== Editor tata letak rak: tambah ke kiri/kanan/atas/bawah, geser, ubah ukuran, hapus =====
function kodeRakBerikut(rak:RakInfo[]){const pakai=new Set(rak.map(r=>r.kode.toUpperCase()));for(let i=0;i<26;i++){const k=String.fromCharCode(65+i);if(!pakai.has(k))return k;}for(let i=1;i<1000;i++){const k='R'+i;if(!pakai.has(k))return k;}return 'X';}
function RakEditor({ rak, terpilih, onPilih, onBerubah, kabar }:{ rak:RakInfo[]; terpilih:RakInfo|null; onPilih:(id:number|null)=>void; onBerubah:()=>void; kabar:(t:'ok'|'err',s:string)=>void }) {
  const [f,setF]=useState<any>(null); const [sibuk,setSibuk]=useState(false);
  useEffect(()=>{setF(terpilih?{id:terpilih.id,kode:terpilih.kode,warna_peta:terpilih.warna_peta,orientasi:terpilih.orientasi,pos_x:terpilih.pos_x,pos_y:terpilih.pos_y,lebar:terpilih.lebar,tinggi:terpilih.tinggi,jumlah_tingkat:terpilih.jumlah_tingkat??''}:null);},[terpilih?.id,terpilih?.pos_x,terpilih?.pos_y,terpilih?.lebar,terpilih?.tinggi,terpilih?.kode,terpilih?.warna_peta,terpilih?.orientasi,terpilih?.jumlah_tingkat]); // eslint-disable-line react-hooks/exhaustive-deps
  const kirim=async(body:any,pesanOk?:string)=>{
    setSibuk(true);
    try{const d=await fetch('/api/lokasi-rak',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
      if(d.success){kabar('ok',pesanOk||d.message);onBerubah();return d;}kabar('err',d.error||'Gagal menyimpan');return null;
    }catch{kabar('err','Gagal menyimpan');return null;}finally{setSibuk(false);}
  };
  const simpan=(obj:any,pesan?:string)=>kirim({aksi:'rak_simpan',...obj},pesan);
  const dari=(r:RakInfo)=>({id:r.id,kode:r.kode,warna_peta:r.warna_peta,orientasi:r.orientasi,pos_x:r.pos_x,pos_y:r.pos_y,lebar:r.lebar,tinggi:r.tinggi,jumlah_tingkat:r.jumlah_tingkat});
  const geser=(dx:number,dy:number)=>{if(!terpilih)return;const nx=terpilih.pos_x+dx,ny=terpilih.pos_y+dy;if(nx<0||ny<0)return kabar('err','Sudah di tepi peta');simpan({...dari(terpilih),pos_x:nx,pos_y:ny},`Rak ${terpilih.kode} digeser`);};
  const ukur=(dw:number,dh:number)=>{if(!terpilih)return;const w=terpilih.lebar+dw,h=terpilih.tinggi+dh;if(w<1||h<1)return;simpan({...dari(terpilih),lebar:w,tinggi:h},`Ukuran rak ${terpilih.kode} diubah`);};
  const tambahDi=async(arah:'kiri'|'kanan'|'atas'|'bawah')=>{
    if(!terpilih)return;const r=terpilih;const w=r.lebar,h=r.tinggi;
    const pos=arah==='kanan'?{x:r.pos_x+w,y:r.pos_y}:arah==='kiri'?{x:r.pos_x-w,y:r.pos_y}:arah==='atas'?{x:r.pos_x,y:r.pos_y-h}:{x:r.pos_x,y:r.pos_y+h};
    if(pos.x<0||pos.y<0)return kabar('err',`Tidak ada ruang di ${arah} rak ${r.kode}. Geser rak ${r.kode} dulu.`);
    const kode=kodeRakBerikut(rak);
    const d=await simpan({kode,warna_peta:r.warna_peta,orientasi:r.orientasi,pos_x:pos.x,pos_y:pos.y,lebar:w,tinggi:h,jumlah_tingkat:r.jumlah_tingkat},`Rak ${kode} ditambahkan di ${arah} rak ${r.kode}`);
    if(d?.id)onPilih(d.id);
  };
  const rakBaru=async()=>{
    const terisi=(x:number,y:number,w:number,h:number)=>rak.some(r=>r.pos_x<x+w&&x<r.pos_x+r.lebar&&r.pos_y<y+h&&y<r.pos_y+r.tinggi);
    const maxY=Math.max(PETA_BARIS,...rak.map(r=>r.pos_y+r.tinggi));let tempat:{x:number;y:number}|null=null;
    for(let y=0;y<=maxY&&!tempat;y++)for(let x=0;x<=PETA_KOLOM-2;x++)if(!terisi(x,y,2,2)){tempat={x,y};break;}
    if(!tempat)tempat={x:0,y:maxY};
    const kode=kodeRakBerikut(rak);
    const d=await simpan({kode,warna_peta:'biru',orientasi:'vertikal',pos_x:tempat.x,pos_y:tempat.y,lebar:2,tinggi:2,jumlah_tingkat:null},`Rak ${kode} ditambahkan`);
    if(d?.id)onPilih(d.id);
  };
  // Putar rak: Horizontal <-> Vertikal. Lebar & tinggi ditukar, tulisan ikut berputar.
  const putar=()=>{if(!terpilih)return;const ori=terpilih.orientasi==='vertikal'?'horizontal':'vertikal';
    simpan({...dari(terpilih),orientasi:ori,lebar:terpilih.tinggi,tinggi:terpilih.lebar},`Rak ${terpilih.kode} diputar jadi ${ori==='vertikal'?'Vertikal':'Horizontal'}`);};
  const simpanForm=()=>{if(!f||!terpilih)return;
    // Kalau arah diganti lewat pilihan, bentuk rak ikut diputar (lebar <-> tinggi) bila ukurannya belum diubah manual.
    const ganti=f.orientasi!==terpilih.orientasi&&Number(f.lebar)===terpilih.lebar&&Number(f.tinggi)===terpilih.tinggi;
    simpan(ganti?{...f,lebar:f.tinggi,tinggi:f.lebar}:{...f});};
  const hapus=async()=>{if(!terpilih)return;if(!await tanya(`Hapus Rak ${terpilih.kode} dari peta?`))return;const d=await kirim({aksi:'rak_hapus',id:terpilih.id});if(d)onPilih(null);};
  const lbl={display:'flex',flexDirection:'column' as const,gap:'4px',fontSize:'12px',fontWeight:600,color:'var(--mcc-text-muted)'};
  const kotak=(label:string,onClick:()=>void,judul:string)=><button type="button" className="mcc-btn-secondary" disabled={sibuk} onClick={onClick} title={judul} aria-label={judul} style={{minWidth:'42px',padding:'8px 10px',fontWeight:700}}>{label}</button>;
  return (
    <div style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'14px',border:'1px solid rgba(11,94,215,0.35)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
        <div style={{fontSize:'16px',fontWeight:700}}>{terpilih?`Atur Rak ${terpilih.kode}`:'Mode ubah tata letak'}</div>
        <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={rakBaru}>+ Rak baru</button>
      </div>
      {!terpilih?<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Klik rak di peta untuk menggeser, mengubah ukuran, menambah rak di sebelahnya, atau menghapusnya. Atau klik <b>+ Rak baru</b>.</div>:(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,auto)',gap:'18px',alignItems:'start',justifyContent:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'6px',alignItems:'center'}}>
              <div style={lbl}>Geser</div>
              {kotak('↑',()=>geser(0,-1),'Geser ke atas')}
              <div style={{display:'flex',gap:'6px'}}>{kotak('←',()=>geser(-1,0),'Geser ke kiri')}{kotak('→',()=>geser(1,0),'Geser ke kanan')}</div>
              {kotak('↓',()=>geser(0,1),'Geser ke bawah')}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              <div style={lbl}>Ukuran ({terpilih.lebar} × {terpilih.tinggi})</div>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}><span style={{fontSize:'12px',width:'42px'}}>Lebar</span>{kotak('−',()=>ukur(-1,0),'Kurangi lebar')}{kotak('+',()=>ukur(1,0),'Tambah lebar')}</div>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}><span style={{fontSize:'12px',width:'42px'}}>Tinggi</span>{kotak('−',()=>ukur(0,-1),'Kurangi tinggi')}{kotak('+',()=>ukur(0,1),'Tambah tinggi')}</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'6px',alignItems:'center'}}>
              <div style={lbl}>Tambah rak di</div>
              {kotak('+ Atas',()=>tambahDi('atas'),'Tambah rak di atas')}
              <div style={{display:'flex',gap:'6px'}}>{kotak('+ Kiri',()=>tambahDi('kiri'),'Tambah rak di kiri')}{kotak('+ Kanan',()=>tambahDi('kanan'),'Tambah rak di kanan')}</div>
              {kotak('+ Bawah',()=>tambahDi('bawah'),'Tambah rak di bawah')}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
            <button type="button" className="mcc-btn-secondary" disabled={sibuk} onClick={putar} style={{fontWeight:700}}>⟳ Putar rak</button>
            <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Sekarang: <b>{terpilih.orientasi==='vertikal'?'Vertikal (tegak)':'Horizontal (mendatar)'}</b> · {terpilih.lebar} × {terpilih.tinggi} kotak. Putar = tukar lebar & tinggi, tulisan ikut berputar.</span>
          </div>
          {f&&(
            <div style={{borderTop:'1px solid var(--mcc-border)',paddingTop:'12px',display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:'10px',alignItems:'end'}}>
              <label style={lbl}>Kode / nama rak<input style={G.inp} value={f.kode} maxLength={30} onChange={e=>setF((x:any)=>({...x,kode:e.target.value.toUpperCase()}))}/></label>
              <label style={lbl}>Warna<select style={G.inp} value={f.warna_peta} onChange={e=>setF((x:any)=>({...x,warna_peta:e.target.value}))}><option value="biru">Biru</option><option value="abu">Abu-abu</option></select></label>
              <label style={lbl}>Arah rak<select style={G.inp} value={f.orientasi} onChange={e=>setF((x:any)=>({...x,orientasi:e.target.value}))}><option value="vertikal">Vertikal</option><option value="horizontal">Horizontal</option></select></label>
              <label style={lbl}>Jumlah susun<input type="number" min={1} max={20} style={G.inp} value={f.jumlah_tingkat} onChange={e=>setF((x:any)=>({...x,jumlah_tingkat:e.target.value}))} placeholder="opsional"/></label>
              <label style={lbl}>Posisi kolom (X)<input type="number" min={0} style={G.inp} value={f.pos_x} onChange={e=>setF((x:any)=>({...x,pos_x:e.target.value}))}/></label>
              <label style={lbl}>Posisi baris (Y)<input type="number" min={0} style={G.inp} value={f.pos_y} onChange={e=>setF((x:any)=>({...x,pos_y:e.target.value}))}/></label>
              <label style={lbl}>Lebar (kotak)<input type="number" min={1} style={G.inp} value={f.lebar} onChange={e=>setF((x:any)=>({...x,lebar:e.target.value}))}/></label>
              <label style={lbl}>Tinggi (kotak)<input type="number" min={1} style={G.inp} value={f.tinggi} onChange={e=>setF((x:any)=>({...x,tinggi:e.target.value}))}/></label>
              <div style={{gridColumn:'1/-1',display:'flex',justifyContent:'space-between',gap:'8px',flexWrap:'wrap'}}>
                <button type="button" className="mcc-btn-secondary" style={{color:'#c62828'}} disabled={sibuk} onClick={hapus}>Hapus rak</button>
                <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanForm}>Simpan perubahan</button>
              </div>
            </div>
          )}
        </>
      )}
      <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Peta memakai kotak-kotak kecil (1 kotak = 1 satuan). Rak tidak boleh menumpuk dengan rak lain. Rak yang masih berisi bin tidak bisa dihapus.</div>
    </div>
  );
}

/** Rak vertikal (tegak) = tulisan diputar 90°. Rak vertikal yang masih lebar dari tinggi tetap mendatar supaya tidak aneh. */
const rakTegak=(r:{orientasi:string;lebar:number;tinggi:number})=>(r.orientasi==='vertikal'&&r.tinggi>=r.lebar)||(r.lebar<=1&&r.tinggi>=2);
const gayaArah=(r:{orientasi:string;lebar:number;tinggi:number}):React.CSSProperties=>rakTegak(r)?{writingMode:'vertical-rl',flexDirection:'row'}:{flexDirection:r.orientasi==='horizontal'?'row':'column'};
/** Ukuran huruf kode rak menyesuaikan panjang nama & ukuran kotak; nama panjang boleh turun baris. */
const gayaKode=(r:{kode:string;lebar:number;tinggi:number;orientasi:string}):React.CSSProperties=>{
  const n=String(r.kode||'').length, sisi=rakTegak(r)?r.tinggi:r.lebar;
  const per=n/Math.max(1,sisi); const size=per<=1.5?15:per<=2.5?13:per<=3.5?11:10;
  return {fontSize:`${size}px`,fontWeight:700,lineHeight:1.1,textAlign:'center',overflowWrap:'anywhere',maxWidth:'100%',maxHeight:'100%',overflow:'hidden'};
};
function PetaRak({ rak, terpilih, onPilih, modeDashboard=false, sorot, ruangEkstra=0 }:{ rak:RakInfo[]; terpilih:number|null; onPilih:(id:number)=>void; modeDashboard?:boolean; sorot?:Record<number,{jumlah:number;urgent:boolean}>; ruangEkstra?:number }) {
  const kolom=Math.max(PETA_KOLOM,...rak.map(r=>r.pos_x+r.lebar))+ruangEkstra, baris=Math.max(PETA_BARIS,...rak.map(r=>r.pos_y+r.tinggi))+ruangEkstra;
  return (
    <div role="group" aria-label="Peta rak" style={{display:'grid',gridTemplateColumns:`repeat(${kolom},minmax(0,1fr))`,gridTemplateRows:`repeat(${baris},26px)`,outline:ruangEkstra?'2px dashed rgba(11,94,215,0.35)':undefined,outlineOffset:ruangEkstra?'-2px':undefined,gap:'4px',background:'#f8f9fb',border:'1px solid var(--mcc-border)',borderRadius:'8px',padding:'12px'}}>
      {rak.map(r=>{
        const aktif = terpilih===r.id;
        const biru = r.warna_peta==='biru';
        const s = sorot?.[r.id];
        if (s) {
          const warna = s.urgent ? '#c62828' : 'var(--mcc-blue)';
          return (
            <button key={r.id} type="button" onClick={()=>onPilih(r.id)} aria-pressed={aktif}
              title={`Rak ${r.kode}: ${s.jumlah} part diminta`} className={s.urgent?'mcc-rak-sorot mcc-rak-sorot-urgent':'mcc-rak-sorot'}
              style={{gridColumn:`${r.pos_x+1} / span ${r.lebar}`,gridRow:`${r.pos_y+1} / span ${r.tinggi}`,position:'relative',
                border:`2px solid ${aktif?'#13294b':warna}`,borderRadius:'6px',background:warna,color:'#ffffff',font:'inherit',cursor:'pointer',
                display:'flex',...gayaArah(r),alignItems:'center',justifyContent:'center',gap:'6px',padding:'2px',overflow:'hidden',minWidth:0}}>
              <span style={gayaKode(r)}>{r.kode}</span>
              <span style={{fontSize:'11px',fontWeight:600,background:'rgba(255,255,255,0.22)',borderRadius:'10px',padding:'1px 7px'}}>{s.jumlah}</span>
            </button>
          );
        }
        return (
          <button key={r.id} type="button" onClick={()=>onPilih(r.id)} aria-pressed={aktif}
            title={`Rak ${r.kode}: ${r.jumlah_bin} bin, ${r.jumlah_part} part, ${r.jumlah_warning} warning`}
            style={{gridColumn:`${r.pos_x+1} / span ${r.lebar}`,gridRow:`${r.pos_y+1} / span ${r.tinggi}`,position:'relative',
              border:`${aktif?2:1}px solid ${aktif?'var(--mcc-blue)':biru?'#9cc0f0':'#c4ccd6'}`,borderRadius:'6px',
              background:aktif?'var(--mcc-blue-soft)':biru?'#e8f1fd':'#eef1f5',color:'var(--mcc-text)',font:'inherit',cursor:'pointer',
              display:'flex',...gayaArah(r),alignItems:'center',justifyContent:'center',gap:'6px',padding:'2px',overflow:'hidden',minWidth:0,transition:'border-color .15s, background .15s'}}>
            <span style={gayaKode(r)}>{r.kode}</span>
            {!modeDashboard&&<span style={{fontSize:'11px',color:'var(--mcc-text-muted)'}}>{r.jumlah_bin} bin</span>}
            {!modeDashboard&&r.jumlah_warning>0&&<span aria-label={`${r.jumlah_warning} part warning`} style={{position:'absolute',top:'3px',right:'3px',width:'8px',height:'8px',borderRadius:'50%',background:'#c62828'}}/>}
            {modeDashboard&&!sorot&&r.jumlah_warning>0&&(
              <span aria-label={`${r.jumlah_warning} part warning`} style={{display:'flex',flexWrap:'wrap',justifyContent:'center',alignItems:'center',gap:'4px',maxWidth:'100%'}}>
                {Array.from({length:Math.min(r.jumlah_warning,r.orientasi==='horizontal'?10:4)}).map((_,i)=>(
                  <span key={i} className="mcc-rak-dot" style={{animationDelay:`${(i%5)*0.35}s`}}/>
                ))}
                {r.jumlah_warning>(r.orientasi==='horizontal'?10:4)&&<span style={{fontSize:'11px',fontWeight:700,color:'#c62828'}}>+{r.jumlah_warning-(r.orientasi==='horizontal'?10:4)}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}


// ===== Dashboard: peta rak (Fase E) =====
// Mode "Permintaan": rak yang berisi part dari permintaan teknisi (status Pending) otomatis berwarna.
// Mode "Stok warning": titik merah = part di bawah reorder point.
type PermintaanRak = { id:number; part_nama:string; jumlah:number; teknisi_nama:string; mesin_area:string|null; nomor_wo:string|null; is_urgent:boolean|number; created_at:string; spare_part_id:number|null; kode_12nc:string|null; nomor_bin:string|null; stok_saat_ini:number; rak_id:number|null; rak_kode:string|null; tingkat:number|null };
function DashboardRak({ onBukaLokasi }:{ onBukaLokasi:()=>void }) {
  const [rak,setRak]=useState<RakInfo[]>([]);
  const [bins,setBins]=useState<BinInfo[]>([]);
  const [permintaan,setPermintaan]=useState<PermintaanRak[]>([]);
  const [mode,setMode]=useState<'permintaan'|'warning'>('permintaan');
  const [siap,setSiap]=useState(false);
  const [error,setError]=useState('');
  const [aktif,setAktif]=useState<number|null>(null);
  const [isi,setIsi]=useState<any[]|null>(null);

  // Peta + stok: tiap 30 detik
  useEffect(()=>{
    let batal=false;
    const muat=()=>fetch('/api/lokasi-rak').then(r=>r.json()).then(d=>{
      if(batal)return;
      if(d.success){setRak(d.rak||[]);setBins(d.bins||[]);setError('');}else setError(d.error||'Gagal memuat peta rak');
    }).catch(()=>{if(!batal)setError('Gagal memuat peta rak');}).finally(()=>{if(!batal)setSiap(true);});
    muat();
    const iv=setInterval(muat,30000);
    return()=>{batal=true;clearInterval(iv);};
  },[]);
  // Permintaan aktif: tiap 5 detik (sama dengan notifikasi permintaan)
  useEffect(()=>{
    let batal=false;
    const muat=()=>fetch('/api/lokasi-rak?permintaan=1').then(r=>r.json()).then(d=>{if(!batal&&d.success)setPermintaan(d.data||[]);}).catch(()=>{});
    muat();
    const iv=setInterval(muat,5000);
    return()=>{batal=true;clearInterval(iv);};
  },[]);
  useEffect(()=>{
    if(mode!=='warning'||!aktif){setIsi(null);return;}
    let batal=false; setIsi(null);
    fetch(`/api/lokasi-rak?rak_id=${aktif}`).then(r=>r.json()).then(d=>{if(!batal)setIsi(d.success?(d.data||[]):[]);}).catch(()=>{if(!batal)setIsi([]);});
    return()=>{batal=true;};
  },[aktif,mode]);

  if(!siap)return null;
  if(error)return <div style={{...G.card,padding:'16px 24px',marginBottom:'32px',fontSize:'14px',color:'var(--mcc-text-muted)'}}>Peta rak belum tersedia ({error}).</div>;

  const sorot:Record<number,{jumlah:number;urgent:boolean}>={};
  permintaan.forEach(p=>{if(!p.rak_id)return;const s=sorot[p.rak_id]||{jumlah:0,urgent:false};s.jumlah+=1;s.urgent=s.urgent||!!p.is_urgent;sorot[p.rak_id]=s;});
  const tanpaLokasi=permintaan.filter(p=>!p.rak_id);
  const totalBin=bins.length, binTerpetakan=bins.filter(b=>b.rak_id).length;
  const warningDiRak=rak.reduce((a,r)=>a+(r.jumlah_warning||0),0);
  const warningTanpaRak=bins.filter(b=>!b.rak_id).reduce((a,b)=>a+(b.jumlah_warning||0),0);
  const rakAktif=rak.find(r=>r.id===aktif)||null;
  const warningList=(isi||[]).filter((p:any)=>p.is_warning);
  const permintaanTampil=rakAktif?permintaan.filter(p=>p.rak_id===rakAktif.id):permintaan;

  const tabStyle=(on:boolean)=>({padding:'6px 12px',border:`1px solid ${on?'var(--mcc-blue)':'var(--mcc-border)'}`,background:on?'var(--mcc-blue-soft)':'var(--mcc-surface)',color:on?'var(--mcc-blue)':'var(--mcc-text-muted)',borderRadius:'6px',font:'inherit',fontSize:'13px',fontWeight:600,cursor:'pointer'} as React.CSSProperties);

  return (
    <section aria-label="Peta rak" style={{...G.card,marginBottom:'32px'}}>
      <div style={{padding:'16px 24px',borderBottom:'1px solid #e6eaf0',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
        <h2 style={{margin:0,fontSize:'17px',fontWeight:700,flex:1}}>Peta rak</h2>
        <div role="group" aria-label="Tampilan peta" style={{display:'flex',gap:'6px'}}>
          <button type="button" style={tabStyle(mode==='permintaan')} aria-pressed={mode==='permintaan'} onClick={()=>setMode('permintaan')}>Permintaan aktif ({permintaan.length})</button>
          <button type="button" style={tabStyle(mode==='warning')} aria-pressed={mode==='warning'} onClick={()=>setMode('warning')}>Stok warning ({warningDiRak})</button>
        </div>
        <span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{binTerpetakan}/{totalBin} bin terpetakan</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,3fr) minmax(0,2fr)',gap:'20px',padding:'20px 24px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          <PetaRak rak={rak} terpilih={aktif} onPilih={id=>setAktif(a=>a===id?null:id)} modeDashboard sorot={mode==='permintaan'?sorot:undefined}/>
          <div style={{display:'flex',gap:'16px',flexWrap:'wrap',fontSize:'12px',color:'var(--mcc-text-muted)'}}>
            {mode==='permintaan'?(<>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{width:'12px',height:'12px',borderRadius:'3px',background:'var(--mcc-blue)'}}/>Ada part yang diminta</span>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{width:'12px',height:'12px',borderRadius:'3px',background:'#c62828'}}/>Ada permintaan urgent</span>
            </>):(
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><span className="mcc-rak-dot" style={{animation:'none'}}/>Satu titik = satu part warning</span>
            )}
            <span>Klik rak untuk melihat detail</span>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'10px',minWidth:0}}>
          {mode==='permintaan'?(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontSize:'16px',fontWeight:700}}>{rakAktif?`Ambil dari Rak ${rakAktif.kode}`:'Daftar ambil part'}</div>
                {rakAktif&&<button type="button" className="mcc-link-btn" onClick={()=>setAktif(null)}>Semua rak</button>}
              </div>
              {permintaanTampil.length===0?(
                <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{rakAktif?'Tidak ada permintaan untuk rak ini.':'Tidak ada permintaan yang menunggu.'}</div>
              ):(
                <div style={{maxHeight:'320px',overflowY:'auto',display:'flex',flexDirection:'column'}}>
                  {permintaanTampil.map(p=>(
                    <div key={p.id} style={{padding:'8px 0',borderBottom:'1px solid #eef1f5',display:'flex',justifyContent:'space-between',gap:'12px'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:'14px',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {!!p.is_urgent&&<span style={{color:'#c62828',fontWeight:700}}>URGENT · </span>}{p.part_nama}
                        </div>
                        <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>
                          {p.rak_kode?`Rak ${p.rak_kode}${p.tingkat?` · susun ${p.tingkat}`:''} · `:'Lokasi belum diatur · '}{p.nomor_bin||'tanpa bin'} · {p.teknisi_nama}{p.mesin_area?` · ${p.mesin_area}`:''}
                        </div>
                      </div>
                      <div style={{fontSize:'14px',fontWeight:700,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>{p.jumlah} pcs</div>
                    </div>
                  ))}
                </div>
              )}
              {!rakAktif&&tanpaLokasi.length>0&&(
                <div style={{fontSize:'13px',color:'var(--mcc-text-muted)',background:'#f8f9fb',border:'1px solid var(--mcc-border)',borderRadius:'6px',padding:'10px 12px'}}>
                  {tanpaLokasi.length} permintaan belum bisa ditandai di peta karena bin-nya belum punya rak. <button type="button" className="mcc-link-btn" onClick={onBukaLokasi}>Atur lokasi rak</button>
                </div>
              )}
            </>
          ):!rakAktif?(
            <>
              <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Pilih rak di peta untuk melihat part yang perlu diisi ulang.</div>
              {warningTanpaRak>0&&(
                <div style={{fontSize:'13px',color:'var(--mcc-text-muted)',background:'#f8f9fb',border:'1px solid var(--mcc-border)',borderRadius:'6px',padding:'10px 12px'}}>
                  {warningTanpaRak} part warning ada di bin yang belum dipetakan ke rak, jadi belum tampil di peta. <button type="button" className="mcc-link-btn" onClick={onBukaLokasi}>Atur lokasi rak</button>
                </div>
              )}
            </>
          ):(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontSize:'16px',fontWeight:700}}>Rak {rakAktif.kode}</div>
                <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{rakAktif.jumlah_part} part · <span style={{color:rakAktif.jumlah_warning?'var(--mcc-danger)':undefined}}>{rakAktif.jumlah_warning} warning</span></div>
              </div>
              {isi===null?<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Memuat...</div>
              :warningList.length===0?<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Tidak ada part warning di rak ini.</div>
              :(
                <div style={{maxHeight:'300px',overflowY:'auto',display:'flex',flexDirection:'column'}}>
                  {warningList.map((p:any)=>(
                    <div key={p.id} style={{padding:'8px 0',borderBottom:'1px solid #eef1f5',display:'flex',justifyContent:'space-between',gap:'12px'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:'14px',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.nama_part}</div>
                        <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{p.nomor_bin}{p.tingkat?` · susun ${p.tingkat}`:''}{p.kode_12nc?` · ${p.kode_12nc}`:''}</div>
                      </div>
                      <div style={{fontSize:'14px',fontWeight:700,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',color:p.stok_saat_ini===0?'var(--mcc-danger)':'var(--mcc-warning)'}}>{p.stok_saat_ini} / {p.reorder_point}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}


// ===== Field "Lokasi rak" untuk form Kelola Part & Part In (Tahap 1) =====
// Lokasi disimpan per BIN: kalau bin sudah punya rak, rak terisi otomatis.
function RakField({ idList, rakList, binInfo, nomorBin, nilai, onUbah }:{
  idList:string; rakList:RakInfo[]; binInfo:BinInfo|undefined; nomorBin:string;
  nilai:{kode:string;tingkat:string}; onUbah:(v:{kode:string;tingkat:string})=>void;
}) {
  const rakDipilih = rakList.find(r=>r.kode.toLowerCase()===nilai.kode.trim().replace(/^rak\s*/i,'').toLowerCase());
  const pindah = binInfo?.rak_kode && rakDipilih && rakDipilih.kode!==binInfo.rak_kode;
  return (
    <div>
      <label style={G.lbl}>Lokasi rak</label>
      <div style={{display:'grid',gridTemplateColumns:'1fr 90px',gap:'8px'}}>
        <input list={idList} style={G.inp} value={nilai.kode} placeholder="Ketik rak, mis. D"
          onChange={e=>onUbah({...nilai,kode:e.target.value.toUpperCase()})}/>
        <input type="number" min={1} max={20} style={G.inp} value={nilai.tingkat} placeholder="Susun"
          onChange={e=>onUbah({...nilai,tingkat:e.target.value})}/>
      </div>
      <datalist id={idList}>{rakList.map(r=><option key={r.id} value={r.kode}>{`Rak ${r.kode}${r.jumlah_tingkat?` · ${r.jumlah_tingkat} susun`:''}`}</option>)}</datalist>
      <div style={{fontSize:'11px',marginTop:'5px',color:pindah?'#8a5a00':'var(--mcc-text-muted)'}}>
        {!nomorBin.trim()?'Isi nomor bin dulu.'
          :pindah?`Bin ${nomorBin.trim()} sekarang di Rak ${binInfo!.rak_kode}. Saat disimpan, semua part di bin ini pindah ke Rak ${rakDipilih!.kode}.`
          :binInfo?.rak_kode?`Bin ${nomorBin.trim()} sudah di Rak ${binInfo.rak_kode}${binInfo.tingkat?` · susun ${binInfo.tingkat}`:''}.`
          :nilai.kode&&!rakDipilih?'Rak tidak ditemukan. Pilih dari daftar (A-O).'
          :'Bin ini belum punya rak. Pilih rak supaya langsung tercatat.'}
      </div>
    </div>
  );
}

// ===== Master Data Mesin (Tahap 2): induk data mesin untuk Admin & Teknisi =====
type JenisMesin = { id:number; area:'Molding'|'Non-molding'; nama:string; foto_url:string|null; emoji:string|null; warna:string|null; leader_nama:string|null; keterangan:string|null; urutan:number; is_active:boolean; jumlah_part:number; jumlah_warning:number };
type UnitMesin = { id:number; jenis_id:number; nomor_unit:string; kode_aset:string|null; leader_nama:string|null; keterangan:string|null; is_active:boolean };
type PartMesin = { id:number; kode_12nc:string|null; nama_part:string; kategori:string; mesin:string|null; mesin_jenis_id:number|null; nomor_bin:string|null; stok_saat_ini:number; reorder_point:number; is_critical:boolean|number; rak_kode:string|null; rak_tingkat:number|null; foto_url?:string|null; harga_satuan?:number|null; is_consumable?:boolean|number; mesin_jenis_nama?:string|null; jumlah_mesin_pakai?:number; merk?:string|null };
const PART_KOSONG = { nama_part:'', kode_12nc:'', kategori:'', nomor_bin:'', stok_saat_ini:'', reorder_point:'', is_critical:false, foto_url:'', harga_satuan:'', is_consumable:false, mesin_jenis_id:'', merk:'' };
// Kategori part = Critical / Normal (kolom is_critical). Kolom kategori lama tetap disimpan untuk sistem.
const KatBadge=({critical}:{critical:boolean})=><span style={{display:'inline-block',padding:'2px 10px',borderRadius:'10px',fontSize:'12px',fontWeight:700,background:critical?'#fdecec':'#eef2f6',color:critical?'#c62828':'#4a5a70',border:`1px solid ${critical?'#f3c2c2':'#d9dee5'}`}}>{critical?'Critical':'Normal'}</span>;
const fmtHarga=(v:any)=>v==null||v===''?'-':'Rp '+Number(v).toLocaleString('id-ID',{maximumFractionDigits:2});

// ===== Pencarian spare part: ketik sebagian nama / 12NC, lalu klik dari daftar =====
function PartPicker({ parts, pilihan, setPilihan, disabled, placeholder }:{ parts:any[]; pilihan:any|null; setPilihan:(p:any|null)=>void; disabled?:boolean; placeholder?:string }) {
  const [teks,setTeks]=useState(''); const [buka,setBuka]=useState(false);
  useEffect(()=>{if(!pilihan)setTeks('');},[pilihan]);
  const k=teks.trim().toLowerCase();
  const hasil=(k?parts.filter((p:any)=>String(p.nama_part||'').toLowerCase().includes(k)||String(p.kode_12nc||'').toLowerCase().includes(k)):parts).slice(0,12);
  return (
    <div style={{position:'relative'}}>
      <input style={{...G.inp,width:'100%',boxSizing:'border-box',borderColor:pilihan?'var(--mcc-blue)':undefined}} value={teks} disabled={disabled} placeholder={placeholder}
        onChange={e=>{setTeks(e.target.value);setPilihan(null);setBuka(true);}} onFocus={()=>setBuka(true)} onBlur={()=>setTimeout(()=>setBuka(false),150)}
        onKeyDown={e=>{if(e.key==='Enter'&&!pilihan&&hasil.length===1){setPilihan(hasil[0]);setTeks(partLabel(hasil[0]));setBuka(false);}}}/>
      {buka&&!pilihan&&!disabled&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:50,background:'#fff',border:'1px solid var(--mcc-border)',borderRadius:'6px',boxShadow:'0 6px 18px rgba(19,41,75,0.12)',maxHeight:'280px',overflowY:'auto',marginTop:'4px'}}>
          {hasil.length===0&&<div style={{padding:'10px 12px',fontSize:'13px',color:'var(--mcc-text-muted)'}}>Tidak ada part yang cocok dengan "{teks}"</div>}
          {hasil.map((p:any)=>(
            <button key={p.id} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setPilihan(p);setTeks(partLabel(p));setBuka(false);}}
              style={{display:'flex',justifyContent:'space-between',gap:'10px',width:'100%',padding:'8px 12px',border:'none',borderBottom:'1px solid #eef1f5',background:'transparent',font:'inherit',textAlign:'left',cursor:'pointer'}}>
              <span><span style={{fontWeight:600,fontSize:'14px'}}>{p.nama_part}</span><span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}> · {p.kode_12nc||'-'}</span></span>
              <span style={{fontSize:'12px',color:(p.stok_saat_ini??0)>0?'var(--mcc-text-muted)':'#c62828',whiteSpace:'nowrap'}}>stok {p.stok_saat_ini??'-'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Impor checklist PM dari PDF / Excel form resmi (dibaca di browser, tidak perlu install apa-apa di server) =====
type PmImporItem = { no_urut:number; nama_bagian:string; requirement:string; frekuensi:string };
type PmImporHasil = { kode_dokumen:string|null; judul:string|null; mesin:string|null; items:PmImporItem[] };
const PM_FREK=['W','M','2M','Q','4M','SA','A'];

function parsePmPdfItems(pages:{items:{s:string;x:number;y:number;w:number}[]}[]):PmImporHasil {
  const out:PmImporItem[]=[]; let dok:string|null=null, judul:string|null=null, grup:string|null=null;
  const all=pages.flatMap(p=>p.items);
  for(const it of all){const m=/D00\d{7}/.exec(it.s);if(m&&!dok)dok=m[0];}
  for(const it of all){if(/preventive maintenance/i.test(it.s)&&it.s.length<120&&!/;/.test(it.s)){judul=it.s.replace(/^document name:\s*/i,'').trim();break;}}
  for(const pg of pages){
    const its=pg.items.filter(i=>i.s.trim());
    const pgGrup=its.find(i=>/^:\s*\S/.test(i.s)&&its.some(k=>/process group/i.test(k.s)&&Math.abs(k.y-i.y)<3));
    if(pgGrup&&!grup)grup=pgGrup.s.replace(/^:\s*/,'').replace(/\b(no\.?|machine)\b.*$/i,'').replace(/[_()]/g,'').trim()||null;
    const hPart=its.find(i=>/part\s*description/i.test(i.s));
    if(!hPart)continue;
    const hNo=its.find(i=>/^no\.?$/i.test(i.s.trim())&&Math.abs(i.y-hPart.y)<15);
    const freqH=its.filter(i=>PM_FREK.includes(i.s.trim())&&i.y<hPart.y+5&&i.y>hPart.y-30);
    const fStart=freqH.length?Math.min(...freqH.map(f=>f.x)):Infinity;
    const review=its.find(i=>/review by/i.test(i.s)&&i.y<hPart.y);
    const yBawah=review?review.y:-Infinity;
    const yAtas=Math.min(hPart.y,...freqH.map(f=>f.y))-3;
    const body=its.filter(i=>i.y<yAtas&&i.y>yBawah+2);
    const noX=hNo?hNo.x:hPart.x-140;
    const anchors=body.filter(i=>/^\d{1,3}$/.test(i.s.trim())&&i.x<hPart.x&&Math.abs(i.x-noX)<40).map(i=>({no:+i.s.trim(),y:i.y}));
    if(!anchors.length)continue;
    const ys=anchors.map(a=>a.y).sort((a,b)=>b-a);
    const gaps=ys.slice(1).map((y,i)=>ys[i]-y).filter(g=>g>0).sort((a,b)=>a-b);
    const gapMed=gaps.length?gaps[Math.floor(gaps.length/2)]:30;
    const yMin=ys[ys.length-1]-Math.max(gapMed*0.9,14);
    const teks=body.filter(i=>i.y>yMin&&!/printed copies|uncontrolled|D00\d{7}|template (id|used)|philips (internal|information)/i.test(i.s))
      .filter(i=>i.x<fStart-4&&!/^\d{1,3}$/.test(i.s.trim())&&i.x>noX+5);
    const hist=new Map<number,number>();teks.forEach(t=>{const k=Math.round(t.x/4);hist.set(k,(hist.get(k)||0)+1);});
    const pusat:{k:number;n:number}[]=[];
    for(const [k,n] of [...hist.entries()].sort((a,b)=>b[1]-a[1])){if(pusat.every(p=>Math.abs(p.k-k)>6))pusat.push({k,n});if(pusat.length>=3)break;}
    const top2=pusat.slice(0,2).sort((a,b)=>a.k-b.k);
    if(top2.length<2)continue;
    const partX=top2[0].k*4, reqX=top2[1].k*4;
    const rows=anchors.map(a=>({no:a.no,y:a.y,part:[] as any[],req:[] as any[],frek:''}));
    const dekat=(y:number)=>rows.reduce((b,r)=>Math.abs(r.y-y)<Math.abs(b.y-y)?r:b,rows[0]);
    for(const t of teks){if(t.x<partX-8)continue;const r=dekat(t.y);(t.x<reqX-8?r.part:r.req).push(t);}
    for(const c of body.filter(i=>/[\u221A\u2713\u2714vVxX]/.test(i.s.trim())&&i.s.trim().length<=2&&i.x>=fStart-6)){
      const r=dekat(c.y); const cx=c.x+c.w/2;
      const f=freqH.reduce((b,h)=>Math.abs(h.x+h.w/2-cx)<Math.abs(b.x+b.w/2-cx)?h:b,freqH[0]);
      if(f&&Math.abs(f.x+f.w/2-cx)<14&&!r.frek)r.frek=f.s.trim();
    }
    const gab=(a:any[])=>a.sort((p,q)=>(q.y-p.y)||(p.x-q.x)).map(i=>i.s.trim()).join(' ').replace(/\s+/g,' ').trim();
    for(const r of rows.sort((a,b)=>a.no-b.no))out.push({no_urut:r.no,nama_bagian:gab(r.part),requirement:gab(r.req),frekuensi:r.frek||'4M'});
  }
  return {kode_dokumen:dok,judul,mesin:grup,items:out};
}

function parsePmSheet(sheets:{nama:string;rows:any[][]}[]):PmImporHasil {
  let dok:string|null=null, judul:string|null=null, grup:string|null=null; const out:PmImporItem[]=[];
  const s=(v:any)=>String(v??'').replace(/\s+/g,' ').trim();
  for(const sh of sheets){
    for(const row of sh.rows)for(let c=0;c<row.length;c++){const v=s(row[c]);const m=/D00\d{7}/.exec(v);if(m&&!dok)dok=m[0];
      if(!judul&&/preventive maintenance/i.test(v)&&v.length<120)judul=v.replace(/^document name:\s*/i,'');
      if(!grup&&/process group/i.test(v)){const nxt=row.slice(c+1).map(s).find(x=>x&&x!==':');if(nxt)grup=nxt.replace(/^:\s*/,'').replace(/\b(no\.?|machine)\b.*$/i,'').replace(/[_()]/g,'').trim()||null;}}
    const hr=sh.rows.findIndex(r=>r.some(v=>/part\s*description/i.test(s(v))));
    if(hr<0)continue;
    const H=sh.rows[hr].map(s);
    const cPart=H.findIndex(v=>/part\s*description/i.test(v));
    const cReq=H.findIndex(v=>/requirement/i.test(v));
    let cNo=H.findIndex(v=>/^no\.?$/i.test(v)); if(cNo<0)cNo=0;
    const fcol:Record<number,string>={}; let mulai=hr+1;
    for(let k=hr;k<=Math.min(hr+3,sh.rows.length-1);k++){const r=sh.rows[k].map(s);let n=0;r.forEach((v,ci)=>{if(PM_FREK.includes(v)&&ci>Math.max(cPart,cReq)){fcol[ci]=v;n++;}});if(n>=4)mulai=Math.max(mulai,k+1);}
    let cur:PmImporItem|null=null;
    for(let k=mulai;k<sh.rows.length;k++){
      const r=sh.rows[k]; if(r.some(v=>/review by/i.test(s(v))))break;
      const no=s(r[cNo]); const part=s(r[cPart]); const req=cReq>=0?s(r[cReq]):'';
      const frek=Object.keys(fcol).map(Number).find(ci=>s(r[ci])!=='');
      if(/^\d{1,3}$/.test(no)){cur={no_urut:+no,nama_bagian:part,requirement:req,frekuensi:frek!==undefined?fcol[frek]:'4M'};out.push(cur);}
      else if(cur&&(part||req)){if(part)cur.nama_bagian=(cur.nama_bagian+' '+part).trim();if(req)cur.requirement=(cur.requirement+' '+req).trim();if(frek!==undefined&&cur.frekuensi==='4M')cur.frekuensi=fcol[frek];}
    }
    if(out.length)break;
  }
  return {kode_dokumen:dok,judul,mesin:grup,items:out};
}

async function bacaFormPm(file:File):Promise<PmImporHasil>{
  const buf=await file.arrayBuffer();
  if(/\.pdf$/i.test(file.name)){
    const w:any=window as any;
    if(!w.__pdfjsMcc){const m=await (new Function('u','return import(u)'))('/api/pdfjs?f=pdf.min.js');m.GlobalWorkerOptions.workerSrc='/api/pdfjs?f=pdf.worker.min.js';w.__pdfjsMcc=m;}
    const doc=await w.__pdfjsMcc.getDocument({data:new Uint8Array(buf)}).promise;
    const pages=[];for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const tc=await pg.getTextContent();pages.push({items:tc.items.filter((i:any)=>'str' in i).map((i:any)=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width}))});}
    return parsePmPdfItems(pages);
  }
  const XLSX:any=await import('xlsx');
  const wb=XLSX.read(buf,{type:'array'});
  return parsePmSheet(wb.SheetNames.map((n:string)=>({nama:n,rows:XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:'',raw:false})})));
}

const ringkasNama=(s:string)=>String(s||'').toLowerCase().replace(/preventive maintenance|machine|mesin|for|form|thermoplastic|\.xlsx?|\.pdf/g,' ').replace(/[^a-z0-9]/g,'');
function jarakLev(a:string,b:string){const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[a.length][b.length];}
function tebakMesin(mesin:any[],petunjuk:(string|null)[]){
  let best:any=null,skor=99;
  for(const p of petunjuk){const q=ringkasNama(p||'');if(!q)continue;
    for(const m of mesin){const n=ringkasNama(m.nama);if(!n)continue;
      const sk=q===n?0:(q.includes(n)||n.includes(q))?Math.abs(q.length-n.length)/10+0.5:jarakLev(q,n);
      if(sk<skor){skor=sk;best=m;}}}
  return skor<=2?best:null;
}

function PmImpor({ mesin, onSelesai, onBatal, mesinTetap }:{ mesin:any[]; onSelesai:(mesinId:number)=>void; onBatal:()=>void; mesinTetap?:number }) {
  const [hasil,setHasil]=useState<PmImporHasil|null>(null);
  const [items,setItems]=useState<PmImporItem[]>([]);
  const [mesinId,setMesinId]=useState<number|''>(mesinTetap||'');
  const [tebakan,setTebakan]=useState<any|null>(null);
  const [namaFile,setNamaFile]=useState('');
  const [sibuk,setSibuk]=useState(false); const [err,setErr]=useState(''); const [info,setInfo]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const pilihFile=async(f?:File)=>{
    if(!f)return; setErr('');setInfo('');setHasil(null);setItems([]);setNamaFile(f.name);
    if(!/\.(pdf|xlsx|xls)$/i.test(f.name))return setErr('Format tidak didukung. Pakai PDF atau Excel (.xlsx / .xls).');
    setSibuk(true);
    try{
      const h=await bacaFormPm(f);
      if(!h.items.length)setErr('Tabel checklist tidak ditemukan di file ini. Pastikan file-nya form PM (ada kolom PART DESCRIPTION dan REQUIREMENT).');
      setHasil(h);setItems(h.items);
      const t=tebakMesin(mesin,[h.mesin,h.judul,f.name]);setTebakan(t);if(!mesinTetap)setMesinId(t?t.id:'');
    }catch(e:any){setErr('Gagal membaca file: '+(e?.message||e));}finally{setSibuk(false);}
  };
  const ubah=(i:number,k:keyof PmImporItem,v:string)=>setItems(a=>a.map((x,j)=>j===i?{...x,[k]:k==='no_urut'?(parseInt(v)||0):v}:x));
  const mesinPilih=mesin.find(m=>m.id===mesinId);
  const kosong=items.filter(i=>!i.nama_bagian.trim()).length;
  const simpan=async()=>{
    if(!mesinId)return setErr('Pilih mesin tujuan dulu.');
    if(mesinPilih?.sumber==='mesin'&&!await tanya({judul:`Perbarui checklist ${mesinPilih.nama}?`,pesan:`${mesinPilih.nama} sudah punya checklist (${mesinPilih.total_item} item). Isinya akan diperbarui sesuai file ini.\n\n• Item dengan nama sama tetap menyimpan spare part-nya.\n• Item yang tidak ada di file disembunyikan (kalau sudah ada part) atau dihapus.`,oke:'Perbarui checklist',bahaya:false}))return;
    setSibuk(true);setErr('');
    try{
      const d=await fetch('/api/pm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aksi:'template_impor',mesin_jenis_id:mesinId,kode_dokumen:hasil?.kode_dokumen||null,items:items.filter(i=>i.nama_bagian.trim())})}).then(r=>r.json());
      if(!d.success)return setErr(d.error||'Gagal menyimpan');
      setInfo(d.message);onSelesai(Number(mesinId));
    }catch{setErr('Gagal menyimpan');}finally{setSibuk(false);}
  };
  const lbl={display:'flex',flexDirection:'column' as const,gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'};
  return (
    <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'14px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
        <div>
          <h3 style={{margin:0,fontSize:'16px',fontWeight:700}}>Impor checklist dari form PM{mesinTetap&&mesinPilih?` · ${mesinPilih.nama}`:''}</h3>
          <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Upload PDF atau Excel form PM resmi. Isinya dibaca otomatis, dicek dulu di sini, baru disimpan.</div>
        </div>
        <button type="button" className="mcc-btn-secondary" onClick={onBatal}>Tutup</button>
      </div>
      <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();pilihFile(e.dataTransfer.files?.[0]);}}
        style={{border:'2px dashed rgba(11,94,215,0.35)',borderRadius:'10px',padding:'22px',textAlign:'center',cursor:'pointer',background:'rgba(11,94,215,0.04)'}}>
        <div style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-blue)'}}>{sibuk?'Membaca file...':namaFile?`📄 ${namaFile} · klik untuk ganti file`:'Klik atau tarik file PDF / Excel ke sini'}</div>
        <div style={{fontSize:'12px',color:'var(--mcc-text-muted)',marginTop:'4px'}}>Contoh: 8102003820_Preventive_Maintenance_for_Machine_Nissei_Form.pdf</div>
        <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls" style={{display:'none'}} onChange={e=>{pilihFile(e.target.files?.[0]);e.target.value='';}}/>
      </div>
      {err&&<div style={{fontSize:'13px',fontWeight:600,color:'#c62828'}}>{err}</div>}
      {info&&<div style={{fontSize:'13px',fontWeight:600,color:'#1e7e34'}}>{info}</div>}
      {hasil&&items.length>0&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)',gap:'12px',alignItems:'end'}}>
            <div style={{fontSize:'13px',color:'var(--mcc-text-muted)',lineHeight:1.6}}>
              <div><b style={{color:'var(--mcc-text)'}}>{hasil.judul||'Form PM'}</b></div>
              <div>Dokumen: {hasil.kode_dokumen||'-'} · terbaca {items.length} item{hasil.mesin?` · mesin di form: ${hasil.mesin}`:''}</div>
              {kosong>0&&<div style={{color:'#b26a00'}}>{kosong} item tanpa nama bagian, akan dilewati kalau tidak diisi.</div>}
            </div>
            {mesinTetap?<div style={{fontSize:'14px',fontWeight:700,textAlign:'right'}}>Disimpan ke: {mesinPilih?.nama}</div>:<label style={lbl}>Simpan ke mesin *
              <select style={G.inp} value={mesinId} onChange={e=>setMesinId(e.target.value?Number(e.target.value):'')}>
                <option value="">Pilih mesin...</option>
                {mesin.map(m=><option key={m.id} value={m.id}>{m.nama}{m.sumber==='mesin'?` (sudah ada checklist ${m.total_item} item)`:''}</option>)}
              </select>
            </label>}
          </div>
          {mesinTetap&&tebakan&&tebakan.id!==mesinTetap&&<div style={{fontSize:'13px',fontWeight:600,color:'#c62828'}}>Perhatian: form ini sepertinya untuk mesin {tebakan.nama}, bukan {mesinPilih?.nama}. Pastikan file-nya benar sebelum menyimpan.</div>}
          {!mesinId&&<div style={{fontSize:'12px',color:'#b26a00'}}>Mesin di form tidak cocok otomatis dengan Master Data. Pilih manual, atau tambahkan dulu jenis mesinnya di Master Data → Molding.</div>}
          <div style={{border:'1px solid var(--mcc-border)',borderRadius:'6px',maxHeight:'460px',overflowY:'auto'}}>
            <table className="mcc-table" style={{width:'100%'}}>
              <thead><tr><th style={{width:'60px'}}>No</th><th>Bagian / part description</th><th>Requirement</th><th style={{width:'90px'}}>Frek.</th><th style={{width:'40px'}}></th></tr></thead>
              <tbody>
                {items.map((it,i)=>(
                  <tr key={i}>
                    <td><input style={{...G.inp,padding:'6px 8px'}} value={it.no_urut} onChange={e=>ubah(i,'no_urut',e.target.value)} aria-label="No"/></td>
                    <td><input style={{...G.inp,padding:'6px 8px',borderColor:it.nama_bagian.trim()?undefined:'#e0a100'}} value={it.nama_bagian} onChange={e=>ubah(i,'nama_bagian',e.target.value)} aria-label="Bagian"/></td>
                    <td><input style={{...G.inp,padding:'6px 8px'}} value={it.requirement} onChange={e=>ubah(i,'requirement',e.target.value)} aria-label="Requirement"/></td>
                    <td><select style={{...G.inp,padding:'6px 8px'}} value={it.frekuensi} onChange={e=>ubah(i,'frekuensi',e.target.value)} aria-label="Frekuensi">{PM_FREK.map(f=><option key={f}>{f}</option>)}</select></td>
                    <td><button type="button" className="mcc-link-btn" style={{color:'#c62828'}} onClick={()=>setItems(a=>a.filter((_,j)=>j!==i))} aria-label="Hapus baris">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
            <button type="button" className="mcc-link-btn" onClick={()=>setItems(a=>[...a,{no_urut:(a.length?Math.max(...a.map(x=>x.no_urut)):0)+1,nama_bagian:'',requirement:'',frekuensi:'4M'}])}>+ Tambah baris</button>
            <span style={{display:'flex',gap:'8px'}}>
              <button type="button" className="mcc-btn-secondary" onClick={onBatal}>Batal</button>
              <button type="button" className="mcc-btn-primary" disabled={sibuk||!mesinId||!items.some(i=>i.nama_bagian.trim())} onClick={simpan}>{sibuk?'Menyimpan...':`Simpan ${items.filter(i=>i.nama_bagian.trim()).length} item ke ${mesinPilih?.nama||'mesin'}`}</button>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

// ===== Maintenance Machine: checklist PM (template sama untuk semua mesin Molding) + spare part per mesin =====
function PmMaster({ onKembali }:{ onKembali:()=>void }) {
  const [mesin,setMesin]=useState<any[]|null>(null); const [totalItem,setTotalItem]=useState(0);
  const [mesinId,setMesinId]=useState<number|null>(null);
  const [items,setItems]=useState<any[]|null>(null);
  const [parts,setParts]=useState<any[]>([]);
  const [lihatTemplate,setLihatTemplate]=useState(false);
  const [infoMesin,setInfoMesin]=useState<{sumber:string;kode_dokumen:string|null}|null>(null);
  const [impor,setImpor]=useState(false);
  const [semuaItem,setSemuaItem]=useState<any[]>([]);
  const [formItem,setFormItem]=useState<null|{id?:number;no_urut:string;nama_bagian:string;requirement:string;frekuensi:string}>(null);
  const [itemId,setItemId]=useState<number|null>(null);
  const [formBaru,setFormBaru]=useState<null|{nama_part:string;kode_12nc:string;kategori:string;nomor_bin:string;stok_saat_ini:string;qty:string;foto_url?:string}>(null);
  const [pilih,setPilih]=useState<any|null>(null); const [qty,setQty]=useState('1');
  const [ubahPart,setUbahPart]=useState<any|null>(null);
  const [pesan,setPesan]=useState<{type:'ok'|'err';text:string}|null>(null);
  const [sibuk,setSibuk]=useState(false);
  const kabar=(type:'ok'|'err',text:string)=>{setPesan({type,text});setTimeout(()=>setPesan(null),3500);};
  const muatMesin=()=>fetch('/api/pm').then(r=>r.json()).then(d=>{if(d.success){setMesin(d.data||[]);setTotalItem(d.total_item||0);}else{setMesin([]);kabar('err',d.error||'Gagal memuat');}}).catch(()=>setMesin([]));
  const muatItems=(id:number)=>fetch(`/api/pm?mesin=${id}`).then(r=>r.json()).then(d=>{setItems(d.success?(d.data||[]):[]);setInfoMesin(d.success?{sumber:d.sumber||'umum',kode_dokumen:d.kode_dokumen||null}:null);}).catch(()=>setItems([]));
  const muatTemplate=()=>fetch(`/api/pm?items=1&semua=1${mesinId?`&mesin=${mesinId}`:''}`).then(r=>r.json()).then(d=>{if(d.success)setSemuaItem(d.data||[]);}).catch(()=>{});
  useEffect(()=>{muatMesin();},[]);
  useEffect(()=>{setItems(null);setInfoMesin(null);setParts([]);setItemId(null);setLihatTemplate(false);setImpor(false);if(mesinId){muatItems(mesinId);fetch(`/api/mesin?parts=${mesinId}`).then(r=>r.json()).then(d=>setParts(d.success?toArr(d.data):[])).catch(()=>{});}},[mesinId]);
  useEffect(()=>{if(lihatTemplate){setSemuaItem([]);setFormItem(null);muatTemplate();}},[lihatTemplate]);
  useEffect(()=>{setPilih(null);setQty('1');setFormBaru(null);setUbahPart(null);},[itemId]);
  const kirim=async(body:any)=>{
    setSibuk(true);
    try{const d=await fetch('/api/pm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
      if(d.success)kabar('ok',d.message);else kabar('err',d.error||'Gagal menyimpan');return d;
    }catch{kabar('err','Gagal menyimpan');return {success:false};}finally{setSibuk(false);}
  };
  const mesinAktif=mesin?.find(m=>m.id===mesinId)||null;
  const itemAktif=items?.find(i=>i.id===itemId)||null;
  const idxItem=items&&itemAktif?items.indexOf(itemAktif):-1;
  const crumb=(teks:string,onClick?:()=>void)=>onClick?<button type="button" className="mcc-link-btn" onClick={onClick}>{teks}</button>:<span style={{fontWeight:700,color:'var(--mcc-text)'}}>{teks}</span>;
  const lbl={display:'flex',flexDirection:'column' as const,gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'};
  const simpanItem=async()=>{if(!formItem)return;const d=await kirim({aksi:'item_simpan',...formItem,mesin_jenis_id:mesinId||null});if(d.success){setFormItem(null);muatTemplate();muatMesin();if(mesinId)muatItems(mesinId);}};
  const buatKhusus=async()=>{if(!mesinId)return;if(!await tanya(`Buat checklist khusus ${mesinAktif?.nama} dari template umum? Setelah itu checklist ${mesinAktif?.nama} bisa diubah sendiri tanpa memengaruhi mesin lain.`))return;const d=await kirim({aksi:'template_salin',mesin_jenis_id:mesinId});if(d.success){muatItems(mesinId);muatMesin();setLihatTemplate(true);}};
  const tambahPart=async(itemId:number)=>{if(!pilih||!mesinId)return kabar('err','Pilih spare part dari daftar');const d=await kirim({aksi:'part_tambah',pm_item_id:itemId,mesin_jenis_id:mesinId,spare_part_id:pilih.id,qty});if(d.success){setPilih(null);setQty('1');muatItems(mesinId);muatMesin();}};
  const simpanPartBaru=async(itemIdNya:number)=>{
    if(!formBaru||!mesinId)return;
    setSibuk(true);
    try{
      const d=await fetch('/api/mesin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aksi:'part_baru',mesin_jenis_id:mesinId,nama_part:formBaru.nama_part,kode_12nc:formBaru.kode_12nc,kategori:formBaru.kategori,nomor_bin:formBaru.nomor_bin,stok_saat_ini:formBaru.stok_saat_ini,foto_url:formBaru.foto_url||''})}).then(r=>r.json());
      if(!d.success){kabar('err',d.error||'Gagal membuat part');return;}
      const d2=await fetch('/api/pm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aksi:'part_tambah',pm_item_id:itemIdNya,mesin_jenis_id:mesinId,spare_part_id:d.id,qty:formBaru.qty})}).then(r=>r.json());
      if(d2.success)kabar('ok',`${formBaru.nama_part} dibuat (milik ${mesinAktif?.nama}) dan masuk ke item ini`);else kabar('err',d2.error||'Part dibuat, tapi gagal dimasukkan ke item');
      setFormBaru(null);
      fetch(`/api/mesin?parts=${mesinId}`).then(r=>r.json()).then(x=>setParts(x.success?toArr(x.data):[])).catch(()=>{});
      muatItems(mesinId);muatMesin();
    }catch{kabar('err','Gagal menyimpan');}finally{setSibuk(false);}
  };
  const ubahQty=async(p:any,v:string)=>{const n=parseInt(v);if(!n||n<1||n===p.qty)return;await kirim({aksi:'part_ubah',id:p.id,qty:n});if(mesinId)muatItems(mesinId);};
  const hapusBanyakPart=async(list:any[])=>{if(!list.length||!await tanya(`Lepas ${list.length} part dari item ini?`))return;for(const p of list)await kirim({aksi:'part_hapus',id:p.id});if(mesinId){muatItems(mesinId);muatMesin();}};
  const hapusPart=async(p:any)=>{if(!await tanya(`Lepas "${p.nama_part}" dari item ini?`))return;const d=await kirim({aksi:'part_hapus',id:p.id});if(d.success&&mesinId){muatItems(mesinId);muatMesin();}};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      {pesan&&<div role="status" className="mcc-fade-in" style={{position:'fixed',top:'20px',right:'24px',zIndex:1000,padding:'10px 16px',borderRadius:'8px',fontSize:'14px',fontWeight:600,background:pesan.type==='ok'?'#e8f4ec':'#fdecec',color:pesan.type==='ok'?'#1e7e34':'#c62828',border:`1px solid ${pesan.type==='ok'?'#b9dcc4':'#f3c2c2'}`}}>{pesan.text}</div>}
      <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',fontSize:'15px',color:'var(--mcc-text-muted)'}}>
        {crumb('Master Data',onKembali)}<span>›</span>
        {crumb('Maintenance Machine (PM)',(mesinId||lihatTemplate)?()=>{setMesinId(null);setLihatTemplate(false);}:undefined)}
        {mesinAktif&&<><span>›</span>{crumb(mesinAktif.nama,(itemId||lihatTemplate)?()=>{setItemId(null);setLihatTemplate(false);}:undefined)}</>}
        {itemAktif&&<><span>›</span>{crumb(`${itemAktif.no_urut}. ${itemAktif.nama_bagian}`)}</>}
        {lihatTemplate&&<><span>›</span>{crumb(mesinId?'Ubah checklist':'Template umum')}</>}
      </div>

      {!mesinId&&!lihatTemplate&&(
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
            <div style={{fontSize:'14px',color:'var(--mcc-text-muted)',maxWidth:'760px'}}>Tiap mesin memakai checklist dari form PM-nya sendiri. Mesin yang belum punya form memakai template umum ({totalItem} item). Pilih mesin untuk mengatur spare part tiap item.</div>
            <button type="button" className="mcc-btn-secondary" onClick={()=>setLihatTemplate(true)}>Ubah template umum</button>
          </div>
          {mesin===null?<div style={{color:'var(--mcc-text-muted)'}}>Memuat...</div>:(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'14px'}}>
              {mesin.map(m=>(
                <button key={m.id} type="button" onClick={()=>setMesinId(m.id)} style={{...G.card,padding:'14px',font:'inherit',cursor:'pointer',display:'flex',gap:'12px',alignItems:'center',textAlign:'left'}}>
                  <div style={{width:52,height:52,borderRadius:'10px',overflow:'hidden',background:'#eef3fb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {m.foto_url?<img src={m.foto_url} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span style={{fontSize:'26px'}}>{m.emoji||'⚙️'}</span>}
                  </div>
                  <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                    <span style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-text)'}}>{m.nama}</span>
                    <span style={{fontSize:'12px',color:m.jumlah_mold>=(m.total_item??totalItem)&&(m.total_item??totalItem)>0?'#1e7e34':'var(--mcc-text-muted)'}}>{m.jumlah_mold}/{m.total_item??totalItem} item sudah ada part · {m.jumlah_part} part</span>
                    <span style={{fontSize:'11px',fontWeight:600,color:m.sumber==='mesin'?'var(--mcc-blue)':'#8a97a8'}}>{m.sumber==='mesin'?(m.kode_dokumen?`Form ${m.kode_dokumen}`:'Checklist khusus'):'Template umum'}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {lihatTemplate&&(
        <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px'}}>
            <h3 style={{margin:0,fontSize:'16px',fontWeight:700}}>{mesinId?`Checklist PM ${mesinAktif?.nama||''}${infoMesin?.kode_dokumen?` · Form ${infoMesin.kode_dokumen}`:''}`:'Template umum (mesin yang belum punya form PM sendiri)'}</h3>
            <button type="button" className="mcc-btn-primary" onClick={()=>setFormItem({no_urut:'',nama_bagian:'',requirement:'',frekuensi:'4M'})}>+ Tambah item</button>
          </div>
          {formItem&&(
            <div style={{display:'grid',gridTemplateColumns:'70px 2fr 3fr 90px auto auto',gap:'8px',alignItems:'end'}}>
              <label style={lbl}>No<input style={G.inp} value={formItem.no_urut} onChange={e=>setFormItem(f=>f&&({...f,no_urut:e.target.value}))} placeholder="auto"/></label>
              <label style={lbl}>Bagian / part description<input style={G.inp} value={formItem.nama_bagian} onChange={e=>setFormItem(f=>f&&({...f,nama_bagian:e.target.value}))} placeholder="mis. Suction filter"/></label>
              <label style={lbl}>Requirement<input style={G.inp} value={formItem.requirement} onChange={e=>setFormItem(f=>f&&({...f,requirement:e.target.value}))} placeholder="mis. Ensure the condition is clean"/></label>
              <label style={lbl}>Frekuensi<select style={G.inp} value={formItem.frekuensi} onChange={e=>setFormItem(f=>f&&({...f,frekuensi:e.target.value}))}>{['W','M','2M','Q','4M','SA','A'].map(f=><option key={f}>{f}</option>)}</select></label>
              <button type="button" className="mcc-btn-secondary" onClick={()=>setFormItem(null)}>Batal</button>
              <button type="button" className="mcc-btn-primary" disabled={sibuk||!formItem.nama_bagian.trim()} onClick={simpanItem}>Simpan</button>
            </div>
          )}
          <table className="mcc-table" style={{width:'100%'}}>
            <thead><tr><th style={{width:'50px'}}>No</th><th>Bagian</th><th>Requirement</th><th style={{width:'70px'}}>Frek.</th><th style={{width:'200px'}}></th></tr></thead>
            <tbody>
              {semuaItem.map(it=>(
                <tr key={it.id} style={{opacity:it.is_active?1:0.45}}>
                  <td>{it.no_urut}</td><td style={{fontWeight:600}}>{it.nama_bagian}</td><td>{it.requirement||'-'}</td><td>{it.frekuensi}</td>
                  <td style={{whiteSpace:'nowrap'}}>
                    <button type="button" className="mcc-link-btn" onClick={()=>setFormItem({id:it.id,no_urut:String(it.no_urut),nama_bagian:it.nama_bagian,requirement:it.requirement||'',frekuensi:it.frekuensi})}>Ubah</button>
                    {' · '}
                    <button type="button" className="mcc-link-btn" disabled={sibuk} onClick={async()=>{const d=await kirim({aksi:'item_nonaktif',id:it.id,aktif:!it.is_active});if(d.success){muatTemplate();muatMesin();}}}>{it.is_active?'Sembunyikan':'Tampilkan lagi'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {mesinId&&!itemId&&!lihatTemplate&&impor&&mesin&&(
        <PmImpor mesin={mesin} mesinTetap={mesinId} onBatal={()=>setImpor(false)} onSelesai={id=>{setImpor(false);muatMesin();muatItems(id);}}/>
      )}

      {mesinId&&!itemId&&!lihatTemplate&&!impor&&(
        <section style={{...G.card,padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:'260px'}}>
            <div style={{fontSize:'16px',fontWeight:700}}>Checklist PM {mesinAktif?.nama}</div>
            <div style={{fontSize:'13px',color:infoMesin?.sumber==='mesin'?'var(--mcc-text-muted)':'#8a5a00'}}>{infoMesin?.sumber==='mesin'?`${infoMesin.kode_dokumen?`Form ${infoMesin.kode_dokumen} · `:''}${items?.length??0} item`:`Belum punya checklist sendiri, sementara memakai template umum (${items?.length??0} item).`}</div>
          </div>
          <button type="button" className="mcc-btn-primary" onClick={()=>setImpor(true)}>Impor dari PDF / Excel</button>
          <button type="button" className="mcc-btn-secondary" onClick={()=>setLihatTemplate(true)}>{infoMesin?.sumber==='mesin'?'Tambah / ubah manual':'Isi manual (mulai kosong)'}</button>
          {infoMesin?.sumber!=='mesin'&&<button type="button" className="mcc-btn-secondary" disabled={sibuk} onClick={buatKhusus}>Salin template umum</button>}
        </section>
      )}

      {mesinId&&!itemId&&!lihatTemplate&&!impor&&(
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'12px',flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
              <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Klik kotak item checklist untuk mengisi spare part <b>{mesinAktif?.nama}</b>.</div>

            </div>
            <span style={{fontSize:'12px',color:parts.length?'var(--mcc-text-muted)':'#c62828'}}>{parts.length>0?`${parts.length} part milik ${mesinAktif?.nama} tersedia untuk dipilih`:`Belum ada part milik ${mesinAktif?.nama}. Tambahkan dulu di Master Data → ${mesinAktif?.nama}.`}</span>
          </div>
          {items===null?<div style={{color:'var(--mcc-text-muted)'}}>Memuat...</div>:(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:'14px'}}>
              {items.map(it=>{
                const n=it.parts.length; const kurang=it.parts.filter((p:any)=>p.stok_saat_ini<p.qty).length;
                return (
                  <button key={it.id} type="button" onClick={()=>setItemId(it.id)} style={{...G.card,padding:'14px',font:'inherit',cursor:'pointer',textAlign:'left',display:'flex',flexDirection:'column',gap:'8px',minHeight:'138px',borderColor:n?'#b9dcc4':'var(--mcc-border)',background:n?'#fbfefc':'#fff'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <span style={{width:'28px',height:'28px',borderRadius:'50%',background:n?'#1e7e34':'#eef3fb',color:n?'#fff':'var(--mcc-blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:700,flexShrink:0}}>{it.no_urut}</span>
                      <span style={{flex:1}}/>
                      <span style={{fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',background:'#eef3fb',color:'var(--mcc-blue)'}}>{it.frekuensi}</span>
                    </div>
                    <span style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-text)',lineHeight:1.3}}>{it.nama_bagian}</span>
                    <span style={{fontSize:'12px',color:'var(--mcc-text-muted)',lineHeight:1.35,flex:1}}>{it.requirement}</span>
                    <span style={{fontSize:'12px',fontWeight:600,color:n?'#1e7e34':'#b26a00'}}>{n?`${n} spare part`:'Belum ada spare part'}{kurang?<span style={{color:'#c62828'}}> · {kurang} stok kurang</span>:null}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {mesinId&&itemAktif&&!lihatTemplate&&(
        <>
          <section style={{...G.card,padding:'16px',display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap'}}>
            <span style={{width:'44px',height:'44px',borderRadius:'50%',background:'#eef3fb',color:'var(--mcc-blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:800}}>{itemAktif.no_urut}</span>
            <div style={{flex:1,minWidth:'220px'}}>
              <div style={{fontSize:'20px',fontWeight:700}}>{itemAktif.nama_bagian} <span style={{fontSize:'14px',fontWeight:400,color:'var(--mcc-text-muted)'}}>· {mesinAktif?.nama}</span></div>
              <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{itemAktif.requirement} · frekuensi {itemAktif.frekuensi}</div>
            </div>
            <button type="button" className="mcc-btn-secondary" disabled={idxItem<=0} onClick={()=>items&&setItemId(items[idxItem-1].id)}>← Item sebelumnya</button>
            <button type="button" className="mcc-btn-secondary" disabled={!items||idxItem>=items.length-1} onClick={()=>items&&setItemId(items[idxItem+1].id)}>Item berikutnya →</button>
          </section>
          <TabelPartTemplate judul={`Spare part ${itemAktif.nama_bagian} untuk ${mesinAktif?.nama||''}`} items={itemAktif.parts} parts={parts} labelJumlah="Jumlah / PM"
            kosong="Belum ada spare part. Kalau item ini cuma cek / clean, biarkan kosong."
            onUbahQty={ubahQty} onHapus={hapusPart} onHapusBanyak={hapusBanyakPart} onUbah={p=>{setFormBaru(null);setUbahPart(p);}}
            aksiKanan={!formBaru?<button type="button" className="mcc-btn-primary" onClick={()=>{setUbahPart(null);setFormBaru({nama_part:'',kode_12nc:'',kategori:'',nomor_bin:'',stok_saat_ini:'0',qty:'1'});}}>+ Part baru</button>:null}
            keterangan={<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{parts.length>0?`Tambah dari part milik ${mesinAktif?.nama} (${parts.length} part) di kotak bawah, atau klik "+ Part baru" kalau belum terdaftar.`:`Belum ada part milik ${mesinAktif?.nama}. Klik "+ Part baru" untuk membuatnya langsung di sini.`}</div>}>
            {ubahPart&&mesinId&&(
              <FormPartBaru key={'u'+ubahPart.id} awal={ubahPart} mesinId={mesinId} mesinNama={mesinAktif?.nama||'mesin ini'} tujuan="" onBatal={()=>setUbahPart(null)}
                onSelesai={async(_pid,_q,nama)=>{kabar('ok',`${nama} diperbarui`);setUbahPart(null);muatItems(mesinId);
                  fetch(`/api/mesin?parts=${mesinId}`).then(r=>r.json()).then(x=>setParts(x.success?toArr(x.data):[])).catch(()=>{});}}/>
            )}
            {formBaru&&mesinId&&(
              <FormPartBaru mesinId={mesinId} mesinNama={mesinAktif?.nama||'mesin ini'} tujuan={`${itemAktif.no_urut}. ${itemAktif.nama_bagian}`} labelJumlah="Jumlah per PM" hintJumlah="Berapa pcs diambil teknisi setiap kali PM item ini."
                onBatal={()=>setFormBaru(null)}
                onSelesai={async(pid,q,nama)=>{
                  const d2=await fetch('/api/pm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aksi:'part_tambah',pm_item_id:itemAktif.id,mesin_jenis_id:mesinId,spare_part_id:pid,qty:q})}).then(r=>r.json()).catch(()=>({success:false}));
                  if(d2.success)kabar('ok',`${nama} dibuat (milik ${mesinAktif?.nama}) dan masuk ke item ini`);else kabar('err',d2.error||'Part dibuat, tapi gagal dimasukkan ke item');
                  setFormBaru(null);
                  fetch(`/api/mesin?parts=${mesinId}`).then(r=>r.json()).then(x=>setParts(x.success?toArr(x.data):[])).catch(()=>{});
                  muatItems(mesinId);muatMesin();
                }}/>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 150px auto',gap:'8px',alignItems:'end'}}>
              <label style={lbl}>Tambah part yang sudah terdaftar<PartPicker parts={parts} pilihan={pilih} setPilihan={setPilih} disabled={!parts.length} placeholder={`Cari part ${mesinAktif?.nama||''}`}/></label>
              <label style={lbl}>Jumlah per PM<input type="number" min={1} style={G.inp} value={qty} onChange={e=>setQty(e.target.value)}/></label>
              <button type="button" className="mcc-btn-primary" disabled={sibuk||!pilih} onClick={()=>tambahPart(itemAktif.id)}>Tambah</button>
            </div>
          </TabelPartTemplate>
        </>
      )}
    </div>
  );
}

// ===== Tabel spare part template (Maintenance Mold / Maintenance Machine), tampilan sama dengan tabel Kelola part =====
function TabelPartTemplate({ judul, keterangan, items, parts, labelJumlah, onUbahQty, onUbah, onHapus, onHapusBanyak, aksiKanan, children, kosong }:{
  judul:string; keterangan?:any; items:any[]; parts:any[]; labelJumlah:string;
  onUbahQty:(it:any,v:string)=>void; onUbah?:(part:any)=>void; onHapus:(it:any)=>void; onHapusBanyak:(list:any[])=>void; aksiKanan?:any; children?:any; kosong?:string }) {
  const [cari,setCari]=useState(''); const [dipilih,setDipilih]=useState<Set<number>>(new Set());
  const peta=new Map<number,any>(); parts.forEach((p:any)=>peta.set(Number(p.id),p));
  const baris=items.map((it:any)=>{const p=peta.get(Number(it.spare_part_id))||{};return {...p,...it,merk:p.merk??it.merk,harga_satuan:p.harga_satuan??it.harga_satuan,reorder_point:it.reorder_point??p.reorder_point,kategori:it.kategori||p.kategori,foto_url:it.foto_url||p.foto_url,is_consumable:p.is_consumable};});
  const q=cari.trim().toLowerCase();
  const tampil=q?baris.filter((b:any)=>[b.nama_part,b.kode_12nc,b.nomor_bin,b.merk,b.is_critical?'critical':'normal'].some(x=>String(x||'').toLowerCase().includes(q))):baris;
  const semua=tampil.length>0&&tampil.every((b:any)=>dipilih.has(b.id));
  const toggle=(id:number)=>setDipilih(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else n.add(id);return n;});
  return (
    <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
        <h3 style={{margin:0,fontSize:'16px',fontWeight:700,flex:1}}>{judul} ({items.length})</h3>
        <input style={{...G.inp,width:'240px'}} placeholder="Cari nama, 12NC, bin, kategori" value={cari} onChange={e=>setCari(e.target.value)}/>
        {aksiKanan}
      </div>
      {keterangan}
      {children}
      <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',fontSize:'13px',color:'var(--mcc-text-muted)'}}>
        <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer'}}><input type="checkbox" checked={semua} onChange={()=>setDipilih(semua?new Set():new Set(tampil.map((b:any)=>b.id)))}/>Pilih semua yang tampil ({tampil.length})</label>
        <span>· {dipilih.size} dipilih</span>
        <div style={{flex:1}}/>
        <button type="button" className="mcc-btn-secondary" style={{color:'#c62828',borderColor:'rgba(198,40,40,0.4)'}} disabled={!dipilih.size} onClick={()=>{onHapusBanyak(baris.filter((b:any)=>dipilih.has(b.id)));setDipilih(new Set());}}>Hapus terpilih</button>
      </div>
      <div style={{maxHeight:'560px',overflowY:'auto',border:'1px solid var(--mcc-border)',borderRadius:'6px'}}>
        <table className="mcc-table" style={{width:'100%'}}>
          <thead><tr><th style={{width:'32px'}}></th><th>Nama part</th><th>12NC</th><th>Merk</th><th>Kategori</th><th>Bin · rak</th><th style={{textAlign:'right'}}>Stok / min</th><th style={{textAlign:'right'}}>Harga</th><th style={{width:'120px'}}>{labelJumlah}</th><th></th></tr></thead>
          <tbody>
            {tampil.length===0&&<tr><td colSpan={10} style={{padding:'20px',textAlign:'center',color:'var(--mcc-text-muted)'}}>{items.length?'Tidak ada part yang cocok':(kosong||'Belum ada spare part')}</td></tr>}
            {tampil.map((b:any)=>{
              const warn=Number(b.stok_saat_ini)<=Number(b.reorder_point||0); const kurang=Number(b.stok_saat_ini)<Number(b.qty);
              return (
                <tr key={b.id} style={{background:dipilih.has(b.id)?'var(--mcc-blue-soft)':undefined}}>
                  <td><input type="checkbox" checked={dipilih.has(b.id)} onChange={()=>toggle(b.id)} aria-label={`Pilih ${b.nama_part}`}/></td>
                  <td style={{fontWeight:600}}><span style={{display:'flex',alignItems:'center',gap:'10px'}}>{b.foto_url?<img src={b.foto_url} alt="" style={{width:'36px',height:'36px',objectFit:'cover',borderRadius:'6px',flexShrink:0}}/>:<span style={{width:'36px',height:'36px',borderRadius:'6px',background:'#eef3fb',flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>🔩</span>}<span>{b.nama_part}{!!b.is_consumable&&<span style={{marginLeft:'6px',fontSize:'11px',color:'#b45309'}}>consumable</span>}</span></span></td>
                  <td>{b.kode_12nc||'-'}</td>
                  <td style={{color:b.merk?undefined:'var(--mcc-text-muted)'}}>{b.merk||'-'}</td>
                  <td><KatBadge critical={!!b.is_critical}/></td>
                  <td style={{whiteSpace:'nowrap'}}>{b.nomor_bin||'-'}{b.rak_kode?` · Rak ${b.rak_kode}${b.rak_tingkat?` S${b.rak_tingkat}`:''}`:''}</td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:warn||kurang?'#c62828':undefined,fontWeight:warn||kurang?700:400}}>{b.stok_saat_ini} / {b.reorder_point??0}</td>
                  <td style={{textAlign:'right',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',color:b.harga_satuan==null?'var(--mcc-text-muted)':undefined}}>{fmtHarga(b.harga_satuan)}</td>
                  <td><input type="number" min={1} defaultValue={b.qty} key={b.id+'-'+b.qty} style={{...G.inp,padding:'6px 8px'}} onBlur={e=>onUbahQty(b,e.target.value)} aria-label={labelJumlah}/></td>
                  <td style={{whiteSpace:'nowrap'}}>{onUbah&&<><button type="button" className="mcc-link-btn" onClick={()=>onUbah({...b,id:Number(b.spare_part_id),_lengkap:peta.has(Number(b.spare_part_id))})}>Ubah</button><span style={{color:'#d0d6df'}}> · </span></>}<button type="button" className="mcc-link-btn" style={{color:'#c62828'}} onClick={()=>onHapus(b)}>Hapus</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ===== Form part baru milik satu mesin (dipakai di template Maintenance Mold) =====
// Isian sama dengan form standar "Part baru" di Kelola part, ditambah "Jumlah per ganti mold".
function FormPartBaru({ mesinId, mesinNama, tujuan, onSelesai, onBatal, labelJumlah='Jumlah per ganti mold', hintJumlah='Berapa pcs diambil teknisi setiap kali ganti 1 mold.', awal }:{ mesinId:number; mesinNama:string; tujuan:string; onSelesai:(partId:number,qty:string,nama:string)=>Promise<void>; onBatal:()=>void; labelJumlah?:string; hintJumlah?:string; awal?:any }) {
  const ubahMode=!!awal?.id;
  const [f,setF]=useState<any>(ubahMode?{...PART_KOSONG,nama_part:awal.nama_part||'',kode_12nc:awal.kode_12nc||'',kategori:awal.kategori||'',nomor_bin:awal.nomor_bin||'',reorder_point:String(awal.reorder_point??''),is_critical:!!awal.is_critical,foto_url:awal.foto_url||'',harga_satuan:awal.harga_satuan==null?'':String(awal.harga_satuan),is_consumable:!!awal.is_consumable,merk:awal.merk||'',qty:'1'}:{...PART_KOSONG,qty:'1'});
  const [bins,setBins]=useState<string[]>([]);
  const [sibuk,setSibuk]=useState(false); const [err,setErr]=useState<{pesan:string;kolom:string[]}|null>(null);
  useEffect(()=>{fetch('/api/lokasi-rak').then(r=>r.json()).then(d=>{if(d.success)setBins((d.bins||[]).map((b:any)=>String(b.nomor_bin)));}).catch(()=>{});},[]);
  const ubah=(k:string,v:any)=>setF((x:any)=>({...x,[k]:v}));
  const merah=(k:string)=>err?.kolom.includes(k)?{borderColor:'#c62828',background:'#fff5f5'}:{};
  const simpan=async()=>{
    const kurang:string[]=[];
    if(!f.nama_part.trim())kurang.push('nama_part');
    if(!String(f.nomor_bin||'').trim())kurang.push('nomor_bin');
    if(!ubahMode&&!(parseInt(f.qty)>0))kurang.push('qty');
    if(kurang.length){const label:Record<string,string>={nama_part:'Nama spare part',nomor_bin:'Rak',qty:labelJumlah};setErr({pesan:`Belum bisa disimpan. Lengkapi dulu: ${kurang.map(k=>label[k]).join(', ')}.`,kolom:kurang});return;}
    setSibuk(true);setErr(null);
    try{
      const {qty,stok_saat_ini,mesin_jenis_id,...isi}=f;
      // data part dari mesin lain tidak lengkap -> merk/harga/consumable tidak ikut dikirim supaya tidak terhapus
      if(ubahMode&&!awal._lengkap){delete isi.merk;delete isi.harga_satuan;delete isi.is_consumable;}
      const body=ubahMode?{aksi:'part_ubah',...isi,id:awal.id,kategori:(f.kategori||mesinNama).slice(0,50)}:{aksi:'part_baru',...f,kategori:mesinNama.slice(0,50),stok_saat_ini:0,mesin_jenis_id:mesinId};
      const d=await fetch('/api/mesin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
      if(!d.success){setErr({pesan:d.error||(ubahMode?'Gagal menyimpan':'Gagal membuat part'),kolom:[]});return;}
      await onSelesai(ubahMode?Number(awal.id):d.id,f.qty,f.nama_part);
    }catch{setErr({pesan:'Gagal menyimpan',kolom:[]});}finally{setSibuk(false);}
  };
  return (
    <div style={{border:'1px solid var(--mcc-blue)',borderRadius:'8px',padding:'16px',background:'#f8fbff',display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'12px'}}>
      <div style={{gridColumn:'1/-1',fontSize:'15px',fontWeight:700}}>{ubahMode?`Ubah part: ${awal.nama_part}`:`Part baru untuk ${mesinNama} → ${tujuan}`}</div>
      <div style={{gridColumn:'span 2'}}><label style={G.lbl}>Nama spare part *</label><input style={{...G.inp,...merah('nama_part')}} value={f.nama_part} onChange={e=>ubah('nama_part',e.target.value)}/></div>
      <div><label style={G.lbl}>Kode / 12NC</label><input style={G.inp} value={f.kode_12nc} onChange={e=>ubah('kode_12nc',e.target.value)}/></div>
      <div><label style={G.lbl}>Merk</label><input style={G.inp} list="fpb-merk" maxLength={200} placeholder="mis. SMC, Festo (pisahkan dengan koma)" value={f.merk||''} onChange={e=>ubah('merk',e.target.value)}/><datalist id="fpb-merk">{['Husky','Schneider','SMC','Omron','Misumi','Parker','Festo','Bosch','SKF','NSK','Keyence'].map(b=><option key={b} value={b}/>)}</datalist><div style={{fontSize:'11px',color:'var(--mcc-text-muted)',marginTop:'3px'}}>Nama sama beda merk = stok digabung, merk dicatat di sini.</div></div>
      <div><label style={G.lbl}>Rak *</label><input list="fpb-bin" style={{...G.inp,...merah('nomor_bin')}} placeholder="mis. VM2-212 (wajib)" value={f.nomor_bin} onChange={e=>ubah('nomor_bin',e.target.value)}/><datalist id="fpb-bin">{bins.map(b=><option key={b} value={b}/>)}</datalist></div>
      <div style={{fontSize:'12px',lineHeight:1.5,color:'var(--mcc-text-muted)',alignSelf:'end',paddingBottom:'6px'}}>{ubahMode?<>Perubahan berlaku di master data (Kelola part, Part In, Katalog, web Teknisi). Stok diubah lewat <b>Part In / Part Out</b>.</>:<>Stok part baru dimulai dari 0. Jumlah barangnya diisi lewat menu <b>Part In</b> supaya tercatat di kartu stok dan tidak terhitung dua kali.</>}</div>
      <div><label style={G.lbl}>Min stok (batas pesan ulang)</label><input type="number" min={0} style={G.inp} placeholder="Stok ≤ angka ini = warning" value={f.reorder_point} onChange={e=>ubah('reorder_point',e.target.value)}/></div>
      <div><label style={G.lbl}>Harga satuan (Rp / pcs)</label><input inputMode="decimal" style={G.inp} value={f.harga_satuan??''} onChange={e=>ubah('harga_satuan',e.target.value)} placeholder="mis. 125000"/></div>
      <div><label style={G.lbl}>Kategori</label><select style={{...G.inp,cursor:'pointer'}} value={f.is_critical?'critical':'normal'} onChange={e=>ubah('is_critical',e.target.value==='critical')}><option value="normal">Normal</option><option value="critical">Critical</option></select></div>
      {ubahMode?<div/>:<div><label style={G.lbl}>{labelJumlah} *</label><input type="number" min={1} style={{...G.inp,...merah('qty')}} value={f.qty} onChange={e=>ubah('qty',e.target.value)}/><div style={{fontSize:'11px',color:'var(--mcc-text-muted)',marginTop:'3px'}}>{hintJumlah}</div></div>}
      <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'14px',alignSelf:'end',paddingBottom:'10px'}}><input type="checkbox" checked={!!f.is_consumable} onChange={e=>ubah('is_consumable',e.target.checked)}/>Consumable part</label>
      <div/>
      <div style={{gridColumn:'1/-1'}}><label style={G.lbl}>Foto spare part</label><PartImageUpload awal={ubahMode?(awal.foto_url||null):null} onUrl={url=>ubah('foto_url',url)}/></div>
      {err&&<div role="alert" style={{gridColumn:'1/-1',padding:'10px 12px',borderRadius:'6px',background:'#fdecec',border:'1px solid #f3c2c2',color:'#c62828',fontSize:'14px',fontWeight:600}}>{err.pesan}</div>}
      <div style={{gridColumn:'1/-1',display:'flex',gap:'8px',justifyContent:'flex-end'}}>
        <button type="button" className="mcc-btn-secondary" onClick={onBatal}>Batal</button>
        <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpan}>{sibuk?'Menyimpan...':'Simpan part'}</button>
      </div>
    </div>
  );
}

// Grup mold: unit dengan nama dasar sama (mis. "BLOOM TEAT MOLD 1..5") tampil jadi 1 kartu + daftar unit. Hanya tampilan, data tidak diubah.
const namaDasarMold=(n:any)=>{const s=String(n||'').trim();const b=s.replace(/\s*\(([^()]*)\)\s*$/,(x:string,isi:string)=>/[\d,]/.test(isi)?'':x).replace(/\s+#?\d+\s*$/,'').trim();return b||s;};
const labelUnitMold=(m:any)=>{const s=String(m?.nama_mold||'').trim();const r=s.slice(namaDasarMold(s).length).trim();const no=r.match(/^#?(\d+)/);if(no)return `Unit ${no[1]}`;const t=r.replace(/^\(\s*/,'').replace(/\s*\)$/,'').trim();return t||'Unit 1';};
type GrupMold={key:string;nama:string;units:any[]};
const grupkanMold=(list:any[]):GrupMold[]=>{const peta=new Map<string,GrupMold>();list.forEach(m=>{const nama=namaDasarMold(m.nama_mold);const key=nama.toLowerCase().replace(/\s+/g,' ');const g=peta.get(key);if(g)g.units.push(m);else peta.set(key,{key,nama,units:[m]});});return Array.from(peta.values());};
// ===== Maintenance Mold (Master Data): mesin Molding -> jenis mold -> template spare part & alat =====
function MoldMaster({ onKembali, kirimMesin, kategori='mold' }:{ onKembali:()=>void; kirimMesin:(b:any)=>Promise<any>; kategori?:'mold'|'mesin' }) {
  const L = kategori==='mesin'
    ? { judul:'Maintenance Machine', item:'jenis pekerjaan', alat:'Alat kerja', contoh:'mis. PM bulanan / Ganti heater', kode:'Kode pekerjaan', ikon:'🔧',
        intro:'Template untuk tim maintenance mesin: pilih mesin, lalu atur jenis pekerjaan dan spare part yang dipakai.' }
    : { judul:'Maintenance Mold', item:'jenis mold', alat:'Alat ganti mold', contoh:'mis. Teat Soother 0-6m', kode:'Kode mold', ikon:'🧩',
        intro:'Template untuk tim ganti mold: pilih mesin, lalu atur jenis mold dan spare part yang dipakai.' };
  const [mesin,setMesin]=useState<any[]>([]);
  const [mesinId,setMesinId]=useState<number|null>(null);
  const [molds,setMolds]=useState<any[]|null>(null);
  const [moldId,setMoldId]=useState<number|null>(null);
  const [grup,setGrup]=useState<string|null>(null);
  const [detail,setDetail]=useState<{mold:any;items:any[]}|null>(null);
  const [parts,setParts]=useState<any[]>([]);
  const [lihatSembunyi,setLihatSembunyi]=useState(false);
  const [formMesin,setFormMesin]=useState<string|null>(null);
  const [formMold,setFormMold]=useState<null|{id?:number;nama_mold:string;kode_mold:string;keterangan:string}>(null);
  const [partDipilih,setPartDipilih]=useState<any|null>(null); const [qtyPart,setQtyPart]=useState('1');
  const [buatBaru,setBuatBaru]=useState(false);
  const [formUnit,setFormUnit]=useState<null|{jumlah:string;salin:boolean}>(null);
  const [ubahPart,setUbahPart]=useState<any|null>(null);
  const [pesan,setPesan]=useState<{type:'ok'|'err';text:string}|null>(null);
  const [sibuk,setSibuk]=useState(false);
  const fotoRef=useRef<HTMLInputElement>(null);
  const kabar=(type:'ok'|'err',text:string)=>{setPesan({type,text});setTimeout(()=>setPesan(null),3500);};

  const muatMesin=()=>fetch(`/api/mold?semua=1&kategori=${kategori}`).then(r=>r.json()).then(d=>{if(d.success)setMesin(d.data||[]);else kabar('err',d.error||'Gagal memuat (sudah jalankan migrasi 09?)');}).catch(()=>{});
  const muatMolds=(id:number)=>{setMolds(null);fetch(`/api/mold?mesin=${id}&semua=1&kategori=${kategori}`).then(r=>r.json()).then(d=>setMolds(d.success?(d.data||[]):[])).catch(()=>setMolds([]));};
  const muatDetail=(id:number)=>{setDetail(null);fetch(`/api/mold?mold=${id}`).then(r=>r.json()).then(d=>{if(d.success)setDetail({mold:d.mold,items:d.items||[]});}).catch(()=>{});};
  useEffect(()=>{muatMesin();},[]);
  useEffect(()=>{setMoldId(null);setGrup(null);setFormMold(null);setParts([]);if(mesinId){muatMolds(mesinId);fetch(`/api/mesin?parts=${mesinId}`).then(r=>r.json()).then(d=>setParts(d.success?toArr(d.data):[])).catch(()=>setParts([]));}},[mesinId]);
  useEffect(()=>{setPartDipilih(null);setBuatBaru(false);setFormUnit(null);setUbahPart(null);if(moldId)muatDetail(moldId);else setDetail(null);},[moldId]);

  const kirim=async(body:any)=>{
    setSibuk(true);
    try{const d=await fetch('/api/mold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
      if(d.success)kabar('ok',d.message);else kabar('err',d.error||'Gagal menyimpan');return d;
    }catch{kabar('err','Gagal menyimpan');return {success:false};}finally{setSibuk(false);}
  };
  const mesinAktif=mesin.find(m=>m.id===mesinId)||null;

  const tambahMesin=async()=>{if(!formMesin?.trim())return;const d=await kirimMesin({aksi:'jenis_simpan',area:'Molding',nama:formMesin.trim(),emoji:'⚙️',warna:'#0b5ed7'});if(d.success){setFormMesin(null);muatMesin();}};
  const simpanMold=async()=>{if(!formMold||!mesinId)return;const d=await kirim({aksi:'mold_simpan',mesin_jenis_id:mesinId,kategori,...formMold});if(d.success){setFormMold(null);muatMolds(mesinId);muatMesin();if(moldId)muatDetail(moldId);}};
  const gantiFoto=async(file:File|undefined)=>{
    if(!file||!moldId)return;
    const raw:string=await new Promise(res=>{const rd=new FileReader();rd.onload=e=>res(String(e.target?.result||''));rd.readAsDataURL(file);});
    const foto=await kecilkanFoto(raw,800,0.8);
    for(const id of idsSemua.length?idsSemua:[moldId])await kirim({aksi:'mold_foto',id,foto});
    muatDetail(moldId);if(mesinId)muatMolds(mesinId);
  };
  // Seperti unit AOKI: satu daftar spare part dipakai bersama oleh semua mold dalam kelompok (mis. BLOOM TEAT MOLD 1..12).
  const post=(body:any)=>fetch('/api/mold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json()).catch(()=>({success:false,error:'Gagal menghubungi server'}));
  const itemsMold=async(id:number):Promise<any[]>=>{const d=await fetch(`/api/mold?mold=${id}`,{cache:'no-store'}).then(r=>r.json()).catch(()=>null);return d?.items||[];};
  const cocokItem=(a:any,b:any)=>a.tipe===b.tipe&&(a.tipe==='part'?Number(a.spare_part_id)===Number(b.spare_part_id):String(a.nama_item||'')===String(b.nama_item||''));
  const keSemuaMold=async(it:any,aksi:(x:any)=>any)=>{for(const id of idsSemua.length?idsSemua:[Number(moldId)]){if(id===moldId){await post(aksi(it));continue;}const x=(await itemsMold(id)).find(y=>cocokItem(y,it));if(x)await post(aksi(x));}};
  const tambahKeSemua=async(pid:number,q:any)=>{let n=0;let err='';for(const id of idsSemua.length?idsSemua:[Number(moldId)]){const d=await post({aksi:'item_tambah',mold_id:id,tipe:'part',spare_part_id:pid,qty:q});if(d.success)n++;else err=d.error||err;}return {n,err};};
  const tambahPart=async()=>{if(!partDipilih||!moldId)return kabar('err',`Pilih spare part milik ${mesinAktif?.nama||'mesin ini'} dari daftar yang muncul`);
    setSibuk(true);let h={n:0,err:''};try{h=await tambahKeSemua(Number(partDipilih.id),qtyPart);}finally{setSibuk(false);}
    if(h.n)kabar('ok',`${partDipilih.nama_part||'Part'} ditambahkan${idsSemua.length>1?` ke ${h.n} mold`:''}`);else kabar('err',h.err||'Gagal menambah part');
    setPartDipilih(null);setQtyPart('1');muatDetail(moldId);if(mesinId)muatMolds(mesinId);};
  const hapusBanyakItem=async(list:any[])=>{if(!list.length||!await tanya(`Hapus ${list.length} part dari template${idsSemua.length>1?` semua ${idsSemua.length} mold`:''}?`))return;setSibuk(true);try{for(const it of list)await keSemuaMold(it,x=>({aksi:'item_hapus',id:x.id}));}finally{setSibuk(false);}kabar('ok',`${list.length} part dihapus dari template`);if(moldId)muatDetail(moldId);if(mesinId)muatMolds(mesinId);};
  const ubahQty=async(it:any,qty:string)=>{const n=parseInt(qty);if(!n||n<1||n===it.qty)return;setSibuk(true);try{await keSemuaMold(it,x=>({aksi:'item_ubah',id:x.id,qty:n,catatan:x.catatan}));}finally{setSibuk(false);}kabar('ok','Jumlah diperbarui');if(moldId)muatDetail(moldId);};
  const hapusItem=async(it:any)=>{if(!await tanya(`Hapus "${it.nama_part||it.nama_item}" dari template${idsSemua.length>1?` semua ${idsSemua.length} mold`:''}?`))return;setSibuk(true);try{await keSemuaMold(it,x=>({aksi:'item_hapus',id:x.id}));}finally{setSibuk(false);}kabar('ok','Part dihapus dari template');if(moldId)muatDetail(moldId);if(mesinId)muatMolds(mesinId);};

  const crumb=(teks:string,onClick?:()=>void)=>onClick?<button type="button" className="mcc-link-btn" onClick={onClick}>{teks}</button>:<span style={{fontWeight:700,color:'var(--mcc-text)'}}>{teks}</span>;
  const lbl={display:'flex',flexDirection:'column' as const,gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'};
  const fotoKotak=(url:string|null,ukuran:number,emoji=L.ikon)=>(
    <div style={{width:ukuran,height:ukuran,borderRadius:'10px',overflow:'hidden',background:'#eef3fb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      {url?<img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:ukuran*0.45}}>{emoji}</span>}
    </div>
  );
  const itemsPart=detail?.items.filter(i=>i.tipe==='part')||[];
  const grupList=grupkanMold((molds||[]).filter(m=>lihatSembunyi||m.is_active));
  const grupAktif=grup?(grupList.find(g=>g.key===grup&&g.units.length>1)||null):null;
  const grupC=(()=>{if(!detail)return null;const g=grupkanMold(molds||[]).find(x=>x.units.some((u:any)=>u.id===detail.mold.id));return g||{key:'',nama:namaDasarMold(detail.mold.nama_mold),units:[detail.mold]};})();
  const idsSemua:number[]=grupC?grupC.units.map((u:any)=>Number(u.id)):[];
  const isiBeda=!!grupC&&grupC.units.length>1&&new Set(grupC.units.map((u:any)=>Number(u.jumlah_part)||0)).size>1;
  const samakanMold=async()=>{
    if(!moldId)return;setSibuk(true);let n=0;
    try{
      const semua:{id:number;items:any[]}[]=[];for(const id of idsSemua)semua.push({id,items:await itemsMold(id)});
      const gabung:any[]=[];semua.forEach(x=>x.items.forEach(it=>{if(!gabung.some(g=>cocokItem(g,it)))gabung.push(it);}));
      for(const x of semua)for(const it of gabung)if(!x.items.some(y=>cocokItem(y,it))){const d=await post({aksi:'item_tambah',mold_id:x.id,tipe:it.tipe,spare_part_id:it.spare_part_id,nama_item:it.nama_item,qty:it.qty,catatan:it.catatan});if(d.success)n++;}
    }finally{setSibuk(false);}
    kabar('ok',`Semua mold disamakan (${n} isian ditambahkan)`);muatDetail(moldId);if(mesinId)muatMolds(mesinId);
  };
  const nonaktifMold=async(u:any)=>{if(u.is_active&&!await tanya(`Sembunyikan ${u.nama_mold} dari web Teknisi?`))return;const d=await kirim({aksi:'mold_nonaktif',id:u.id,aktif:!u.is_active});if(d.success){if(moldId)muatDetail(moldId);if(mesinId)muatMolds(mesinId);}};
  const hapusMold=async(u:any)=>{if(!await tanya(`Hapus PERMANEN ${u.nama_mold}?`))return;const d=await kirim({aksi:'mold_hapus',id:u.id});if(!d.success)return;
    if(u.id===moldId){const lain=grupC?.units.find((x:any)=>x.id!==u.id);if(lain)setMoldId(lain.id);else{setMoldId(null);setGrup(null);}}
    if(mesinId)muatMolds(mesinId);muatMesin();};
  // Tambah unit dari halaman template: nama = nama dasar + nomor berikutnya, spare part bisa disalin dari unit ini
  const unitBaru=(()=>{
    if(!detail)return null;
    const nama=namaDasarMold(detail.mold.nama_mold);
    const key=nama.toLowerCase().replace(/\s+/g,' ');
    const units=grupC?.units||[detail.mold];
    const nos=units.map(u=>{const m=String(labelUnitMold(u)).match(/^Unit (\d+)$/);return m?parseInt(m[1]):0;});
    const mulai=Math.max(units.length,...nos)+1;
    const n=Math.min(30,Math.max(1,parseInt(formUnit?.jumlah||'1')||1));
    return {nama,key,mulai,n,namaList:Array.from({length:n},(_,i)=>`${nama} ${mulai+i}`)};
  })();
  const simpanUnit=async()=>{
    if(!detail||!unitBaru||!mesinId||!formUnit)return;
    setSibuk(true);
    let jadi=0; let gagal='';
    try{
      for(const nm of unitBaru.namaList){
        const d=await fetch('/api/mold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aksi:'mold_simpan',mesin_jenis_id:mesinId,kategori,nama_mold:nm,kode_mold:'',keterangan:''})}).then(r=>r.json()).catch(()=>({success:false,error:'Gagal menghubungi server'}));
        if(!d.success||!d.id){gagal=`${nm}: ${d.error||'gagal'}`;break;}
        jadi++;
        if(formUnit.salin)for(const it of detail.items){
          await fetch('/api/mold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aksi:'item_tambah',mold_id:d.id,tipe:it.tipe,spare_part_id:it.spare_part_id,nama_item:it.nama_item,qty:it.qty,catatan:it.catatan})}).catch(()=>{});
        }
      }
    }finally{setSibuk(false);}
    if(gagal)kabar('err',`${jadi} mold dibuat. Berhenti di ${gagal}`);else kabar('ok',`${jadi} mold ${unitBaru.nama} ditambahkan${formUnit.salin&&detail.items.length?' + spare part disalin':''}`);
    setFormUnit(null);setGrup(unitBaru.key);muatMolds(mesinId);muatMesin();
  };
  const chipUnit=(aktif:boolean)=>({padding:'8px 14px',borderRadius:'999px',border:`1px solid ${aktif?'#0b5ed7':'var(--mcc-border)'}`,background:aktif?'#e7f0fd':'var(--mcc-card,#fff)',color:aktif?'#0b5ed7':'var(--mcc-text)',font:'inherit',fontSize:'13px',fontWeight:600,cursor:'pointer',display:'inline-flex',flexDirection:'column' as const,alignItems:'flex-start',gap:'2px'});

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      {pesan&&<div role="status" className="mcc-fade-in" style={{position:'fixed',top:'20px',right:'24px',zIndex:1000,padding:'10px 16px',borderRadius:'8px',fontSize:'14px',fontWeight:600,background:pesan.type==='ok'?'#e8f4ec':'#fdecec',color:pesan.type==='ok'?'#1e7e34':'#c62828',border:`1px solid ${pesan.type==='ok'?'#b9dcc4':'#f3c2c2'}`}}>{pesan.text}</div>}
      <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',fontSize:'15px',color:'var(--mcc-text-muted)'}}>
        {crumb('Master Data',onKembali)}<span>›</span>
        {crumb(L.judul,mesinId?()=>setMesinId(null):undefined)}
        {mesinAktif&&<><span>›</span>{crumb(mesinAktif.nama,(moldId||grupAktif)?()=>{setMoldId(null);setGrup(null);}:undefined)}</>}
        {!moldId&&grupAktif&&<><span>›</span>{crumb(grupAktif.nama)}</>}
        {detail&&moldId&&<><span>›</span>{crumb(grupC?.nama||detail.mold.nama_mold)}</>}
        <div style={{flex:1}}/>
        {mesinId&&!moldId&&<label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}><input type="checkbox" checked={lihatSembunyi} onChange={e=>setLihatSembunyi(e.target.checked)}/>Tampilkan {L.item} yang disembunyikan</label>}
      </div>

      {/* A: mesin Molding */}
      {!mesinId&&(
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
            <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{L.intro}</div>
            {formMesin===null?<button type="button" className="mcc-btn-primary" onClick={()=>setFormMesin('')}>+ Tambah jenis mesin</button>:(
              <div style={{display:'flex',gap:'8px'}}>
                <input style={{...G.inp,width:'220px'}} autoFocus value={formMesin} onChange={e=>setFormMesin(e.target.value)} placeholder="Nama mesin Molding"/>
                <button type="button" className="mcc-btn-secondary" onClick={()=>setFormMesin(null)}>Batal</button>
                <button type="button" className="mcc-btn-primary" onClick={tambahMesin}>Simpan</button>
              </div>
            )}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:'14px'}}>
            {mesin.filter(m=>m.is_active).map(m=>(
              <button key={m.id} type="button" onClick={()=>setMesinId(m.id)} style={{...G.card,padding:'14px',font:'inherit',cursor:'pointer',display:'flex',gap:'12px',alignItems:'center',textAlign:'left'}}>
                {fotoKotak(m.foto_url,56,m.emoji||'⚙️')}
                <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  <span style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-text)'}}>{m.nama}</span>
                  <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{m.jumlah_mold} {L.item}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* B: daftar mold (unit bernama sama digabung jadi 1 kartu) */}
      {mesinId&&!moldId&&!grupAktif&&(
        <>
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            {!formMold&&<button type="button" className="mcc-btn-primary" onClick={()=>setFormMold({nama_mold:'',kode_mold:'',keterangan:''})}>+ Tambah {L.item}</button>}
          </div>
          {formMold&&!formMold.id&&(
            <div style={{...G.card,padding:'16px',display:'grid',gridTemplateColumns:'2fr 1fr 2fr auto auto',gap:'10px',alignItems:'end'}}>
              <label style={lbl}>Nama {L.item} *<input style={G.inp} autoFocus value={formMold.nama_mold} onChange={e=>setFormMold(f=>f&&({...f,nama_mold:e.target.value}))} placeholder={L.contoh}/></label>
              <label style={lbl}>{L.kode}<input style={G.inp} value={formMold.kode_mold} onChange={e=>setFormMold(f=>f&&({...f,kode_mold:e.target.value}))} placeholder="mis. M-AK-01"/></label>
              <label style={lbl}>Keterangan<input style={G.inp} value={formMold.keterangan} onChange={e=>setFormMold(f=>f&&({...f,keterangan:e.target.value}))}/></label>
              <button type="button" className="mcc-btn-secondary" onClick={()=>setFormMold(null)}>Batal</button>
              <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanMold}>Simpan</button>
            </div>
          )}
          {molds===null?<div style={{color:'var(--mcc-text-muted)'}}>Memuat...</div>:molds.filter(m=>lihatSembunyi||m.is_active).length===0
            ?<div style={{...G.card,padding:'24px',color:'var(--mcc-text-muted)'}}>Belum ada {L.item} di {mesinAktif?.nama}. Klik "+ Tambah {L.item}".</div>
            :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:'14px'}}>
              {grupList.map(g=>g.units.length>1?(
                <button key={'g-'+g.key} type="button" onClick={()=>{setGrup(g.key);setMoldId((g.units.find((u:any)=>u.is_active)||g.units[0]).id);}} style={{...G.card,padding:'14px',font:'inherit',cursor:'pointer',display:'flex',gap:'12px',alignItems:'center',textAlign:'left'}}>
                  {fotoKotak((g.units.find(u=>u.foto_url)||{}).foto_url||null,56)}
                  <span style={{display:'flex',flexDirection:'column',gap:'2px',minWidth:0}}>
                    <span style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-text)'}}>{g.nama}</span>
                    <span style={{fontSize:'12px',fontWeight:700,color:'#0b5ed7'}}>{g.units.length} mold</span>
                    {g.units.some(u=>u.jumlah_kurang>0)&&<span style={{fontSize:'12px',color:'#c62828'}}>Ada part yang stoknya kurang</span>}
                  </span>
                </button>
              ):g.units.map(m=>(
                <button key={m.id} type="button" onClick={()=>setMoldId(m.id)} style={{...G.card,padding:'14px',font:'inherit',cursor:'pointer',display:'flex',gap:'12px',alignItems:'center',textAlign:'left',opacity:m.is_active?1:0.5}}>
                  {fotoKotak(m.foto_url,56)}
                  <span style={{display:'flex',flexDirection:'column',gap:'2px',minWidth:0}}>
                    <span style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-text)'}}>{m.nama_mold}</span>
                    {m.kode_mold&&<span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{m.kode_mold}</span>}
                    <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{m.jumlah_part} spare part</span>
                    {m.jumlah_kurang>0&&<span style={{fontSize:'12px',color:'#c62828'}}>{m.jumlah_kurang} part stoknya kurang</span>}
                  </span>
                </button>
              )))}
            </div>}
        </>
      )}

      {/* B2: unit dari satu jenis mold */}
      {mesinId&&!moldId&&grupAktif&&(
        <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'flex',alignItems:'baseline',gap:'10px',flexWrap:'wrap'}}>
            <h3 style={{margin:0,fontSize:'18px',fontWeight:700}}>{grupAktif.nama}</h3>
            <span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{grupAktif.units.length} mold · pilih mold untuk atur spare part</span>
            <div style={{flex:1}}/>
            {!formMold&&<button type="button" className="mcc-btn-primary" onClick={()=>{const no=grupAktif.units.map(u=>{const m=String(labelUnitMold(u)).match(/^Unit (\d+)$/);return m?parseInt(m[1]):0;});const next=Math.max(grupAktif.units.length,...no)+1;setFormMold({nama_mold:`${grupAktif.nama} ${next}`,kode_mold:'',keterangan:''});}}>+ Tambah mold</button>}
          </div>
          {formMold&&!formMold.id&&(
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 2fr auto auto',gap:'10px',alignItems:'end'}}>
              <label style={lbl}>Nama mold baru *<input style={G.inp} autoFocus value={formMold.nama_mold} onChange={e=>setFormMold(f=>f&&({...f,nama_mold:e.target.value}))}/></label>
              <label style={lbl}>{L.kode}<input style={G.inp} value={formMold.kode_mold} onChange={e=>setFormMold(f=>f&&({...f,kode_mold:e.target.value}))} placeholder="mis. A-4985-A1"/></label>
              <label style={lbl}>Keterangan<input style={G.inp} value={formMold.keterangan} onChange={e=>setFormMold(f=>f&&({...f,keterangan:e.target.value}))}/></label>
              <button type="button" className="mcc-btn-secondary" onClick={()=>setFormMold(null)}>Batal</button>
              <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanMold}>Simpan</button>
            </div>
          )}
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
            {grupAktif.units.map(u=>(
              <button key={u.id} type="button" onClick={()=>setMoldId(u.id)} style={{...chipUnit(false),opacity:u.is_active?1:0.5}}>
                <span>{u.nama_mold}</span>
                <span style={{fontSize:'11px',fontWeight:400,color:u.jumlah_kurang>0?'#c62828':'var(--mcc-text-muted)'}}>{u.kode_mold?`${u.kode_mold} · `:''}{u.jumlah_part} part</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* C: template mold */}
      {moldId&&(!detail?<div style={{color:'var(--mcc-text-muted)'}}>Memuat...</div>:(
        <>
          <section style={{...G.card,padding:'20px',display:'flex',gap:'20px',alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',alignItems:'center'}}>
              {fotoKotak(detail.mold.foto_url,110)}
              <input ref={fotoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{gantiFoto(e.target.files?.[0]);e.target.value='';}}/>
              <button type="button" className="mcc-link-btn" onClick={()=>fotoRef.current?.click()}>Ganti foto</button>
            </div>
            <div style={{flex:1,minWidth:'260px',display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{display:'flex',alignItems:'baseline',gap:'12px',flexWrap:'wrap'}}>
                <h2 style={{margin:0,fontSize:'22px',fontWeight:700}}>{grupC?.nama||detail.mold.nama_mold}</h2>
                <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{detail.mold.mesin_nama} · {idsSemua.length||1} {kategori==='mold'?'mold':L.item}</span>
              </div>
              <div style={{borderTop:'1px solid var(--mcc-border)',paddingTop:'10px',display:'flex',flexDirection:'column',gap:'8px'}}>
                <div style={{fontSize:'13px',fontWeight:700,color:'var(--mcc-text)'}}>{kategori==='mold'?'Mold':L.item}</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px',alignItems:'center'}}>
                  {(grupC?.units||[detail.mold]).map((u:any)=>(
                    <span key={u.id} style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'6px 10px',border:'1px solid var(--mcc-border)',borderRadius:'6px',fontSize:'12px',opacity:u.is_active?1:0.5}}>
                      <span style={{fontWeight:600,color:'var(--mcc-text)'}}>{u.nama_mold}</span>
                      {u.kode_mold&&<span style={{color:'var(--mcc-text-muted)'}}>{u.kode_mold}</span>}
                      <button type="button" className="mcc-link-btn" onClick={()=>setFormMold({id:u.id,nama_mold:u.nama_mold,kode_mold:u.kode_mold||'',keterangan:u.keterangan||''})}>ubah</button>
                      <button type="button" className="mcc-link-btn" style={{color:'#c62828'}} disabled={sibuk} onClick={()=>nonaktifMold(u)}>{u.is_active?'sembunyikan':'tampilkan'}</button>
                      <button type="button" className="mcc-link-btn" style={{color:'#c62828'}} disabled={sibuk} onClick={()=>hapusMold(u)}>hapus</button>
                    </span>
                  ))}
                  {kategori==='mold'&&<button type="button" className="mcc-btn-secondary" onClick={()=>setFormUnit(f=>f?null:{jumlah:'1',salin:true})}>+ Mold</button>}
                </div>
                {formMold?.id&&(grupC?.units||[detail.mold]).some((u:any)=>u.id===formMold.id)&&(
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 2fr auto auto',gap:'10px',alignItems:'end'}}>
                    <label style={lbl}>Nama mold<input style={G.inp} autoFocus value={formMold.nama_mold} onChange={e=>setFormMold(f=>f&&({...f,nama_mold:e.target.value}))}/></label>
                    <label style={lbl}>{L.kode}<input style={G.inp} value={formMold.kode_mold} onChange={e=>setFormMold(f=>f&&({...f,kode_mold:e.target.value}))}/></label>
                    <label style={lbl}>Keterangan<input style={G.inp} value={formMold.keterangan} onChange={e=>setFormMold(f=>f&&({...f,keterangan:e.target.value}))}/></label>
                    <button type="button" className="mcc-btn-secondary" onClick={()=>setFormMold(null)}>Batal</button>
                    <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanMold}>Simpan</button>
                  </div>
                )}
                {formUnit&&unitBaru&&(
                  <div style={{border:'1px solid #bcd3f5',background:'#f4f8fe',borderRadius:'8px',padding:'12px',display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div style={{display:'flex',gap:'12px',alignItems:'end',flexWrap:'wrap'}}>
                      <label style={lbl}>Jumlah mold baru<input type="number" min={1} max={30} style={{...G.inp,width:'110px'}} autoFocus value={formUnit.jumlah} onChange={e=>setFormUnit(f=>f&&({...f,jumlah:e.target.value}))}/></label>
                      <div style={{flex:1}}/>
                      <button type="button" className="mcc-btn-secondary" onClick={()=>setFormUnit(null)}>Batal</button>
                      <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanUnit}>{sibuk?'Menyimpan...':'Simpan'}</button>
                    </div>
                    <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Akan dibuat: <b>{unitBaru.namaList.length>3?`${unitBaru.namaList[0]} s/d ${unitBaru.namaList[unitBaru.namaList.length-1]}`:unitBaru.namaList.join(', ')}</b>. Daftar spare part di bawah ({itemsPart.length} part) ikut dipakai mold baru.</div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <div>
            <TabelPartTemplate judul={`Spare part ${grupC?.nama||detail.mold.nama_mold}`} items={itemsPart} parts={parts} labelJumlah="Jumlah / ganti mold"
              kosong="Belum ada spare part di template ini"
              onUbahQty={ubahQty} onHapus={hapusItem} onHapusBanyak={hapusBanyakItem} onUbah={p=>{setBuatBaru(false);setUbahPart(p);}}
              aksiKanan={!buatBaru&&mesinId?<button type="button" className="mcc-btn-primary" onClick={()=>{setUbahPart(null);setBuatBaru(true);}}>+ Part baru</button>:null}
              keterangan={<>
                {idsSemua.length>1&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Part di sini dipakai bersama oleh semua {idsSemua.length} mold {grupC?.nama}. Tambah / ubah / hapus otomatis berlaku untuk semua mold. Mold yang dipakai dicatat saat teknisi memesan.</div>}
                {isiBeda&&<div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',padding:'8px 12px',borderRadius:'6px',background:'#fff7e6',border:'1px solid #f5d9a8',fontSize:'13px',color:'#8a5200'}}>Isi spare part antar mold belum sama (data lama).<button type="button" className="mcc-btn-secondary" disabled={sibuk} onClick={samakanMold}>Samakan semua mold</button></div>}
                <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{parts.length>0?`Tambah dari part milik ${mesinAktif?.nama||'mesin ini'} (${parts.length} part) di kotak bawah, atau klik "+ Part baru" kalau belum terdaftar.`:`Belum ada part milik ${mesinAktif?.nama||'mesin ini'}. Klik "+ Part baru" untuk membuatnya langsung di sini.`}</div>
              </>}>
              {ubahPart&&mesinId&&moldId&&(
                <FormPartBaru key={'u'+ubahPart.id} awal={ubahPart} mesinId={mesinId} mesinNama={mesinAktif?.nama||'mesin ini'} tujuan="" onBatal={()=>setUbahPart(null)}
                  onSelesai={async(_pid,_q,nama)=>{kabar('ok',`${nama} diperbarui`);setUbahPart(null);muatDetail(moldId);
                    fetch(`/api/mesin?parts=${mesinId}`).then(r=>r.json()).then(x=>setParts(x.success?toArr(x.data):[])).catch(()=>{});}}/>
              )}
              {buatBaru&&mesinId&&moldId&&(
                <FormPartBaru mesinId={mesinId} mesinNama={mesinAktif?.nama||'mesin ini'} tujuan={idsSemua.length>1?`semua ${idsSemua.length} mold ${grupC?.nama||''}`:(grupC?.nama||detail.mold.nama_mold)} onBatal={()=>setBuatBaru(false)}
                  onSelesai={async(pid,q,nama)=>{
                    const h=await tambahKeSemua(pid,q);
                    if(h.n)kabar('ok',`${nama} dibuat (milik ${mesinAktif?.nama}) dan masuk ke template${idsSemua.length>1?` ${h.n} mold`:''}`);
                    setBuatBaru(false);muatDetail(moldId);if(mesinId)muatMolds(mesinId);
                    fetch(`/api/mesin?parts=${mesinId}`).then(r=>r.json()).then(x=>setParts(x.success?toArr(x.data):[])).catch(()=>{});
                  }}/>
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 150px auto',gap:'8px',alignItems:'end'}}>
                <label style={lbl}>Tambah part yang sudah terdaftar<PartPicker parts={parts} pilihan={partDipilih} setPilihan={setPartDipilih} disabled={!parts.length} placeholder={parts.length?"Ketik sebagian nama atau 12NC, lalu klik part-nya":"Belum ada part milik mesin ini"}/></label>
                <label style={lbl}>Jumlah per ganti mold<input type="number" min={1} style={G.inp} value={qtyPart} onChange={e=>setQtyPart(e.target.value)}/></label>
                <button type="button" className="mcc-btn-primary" disabled={sibuk||!partDipilih} onClick={tambahPart}>Tambah</button>
              </div>
            </TabelPartTemplate>

          </div>
        </>
      ))}
    </div>
  );
}

// ===== Jatah per mesin (migrasi 18): satu part dipakai banyak mesin, stok dibagi sesuai kebutuhan =====
type MesinBagi = { id:number; qty_per_unit:number };
function ChipMesin({ jenis, kecuali, nilai, onUbah }:{ jenis:any[]; kecuali?:string; nilai:MesinBagi[]; onUbah:(v:MesinBagi[])=>void }) {
  const k=String(kecuali||'').trim().toLowerCase();
  const daftar=jenis.filter((j:any)=>j.is_active!==false&&!/^maintenance\s*(mold|machine)$/i.test(String(j.nama).trim())&&String(j.nama).trim().toLowerCase()!==k);
  const ada=(id:number)=>nilai.find(m=>m.id===id);
  const ubah=(id:number)=>onUbah(ada(id)?nilai.filter(m=>m.id!==id):[...nilai,{id,qty_per_unit:1}]);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
      {(['Molding','Non-molding'] as const).map(a=>{const l=daftar.filter((j:any)=>j.area===a);if(!l.length)return null;return(
        <div key={a} style={{display:'flex',flexWrap:'wrap',gap:'6px',alignItems:'center'}}>
          <span style={{fontSize:'11px',fontWeight:700,color:'var(--mcc-text-muted)',textTransform:'uppercase',minWidth:'84px'}}>{a}</span>
          {l.map((j:any)=>{const on=!!ada(j.id);return(
            <button key={j.id} type="button" aria-pressed={on} onClick={()=>ubah(j.id)} style={{padding:'4px 10px',borderRadius:'14px',border:`1px solid ${on?'#0b5ed7':'#d9dee5'}`,background:on?'#e7f0fd':'#fff',color:on?'#0b5ed7':'#13294b',fontSize:'12px',fontWeight:on?700:500,cursor:'pointer'}}>{on?'✓ ':''}{j.nama}</button>);})}
        </div>);})}
    </div>
  );
}
function TabelJatah({ rows, kolomTambah }:{ rows:any[]; kolomTambah?:boolean }) {
  if(!rows.length)return null;
  return (
    <table className="mcc-table" style={{width:'100%',marginTop:'6px'}}>
      <thead><tr><th>Mesin</th><th style={{textAlign:'right'}}>Unit</th><th style={{textAlign:'right'}}>Qty / unit</th><th style={{textAlign:'right'}}>Kebutuhan</th>{kolomTambah&&<th style={{textAlign:'right'}}>+ Masuk</th>}<th style={{textAlign:'right'}}>Jatah</th></tr></thead>
      <tbody>{rows.map((r:any)=>(
        <tr key={r.mesin_jenis_id}><td style={{fontWeight:600}}>{r.nama}</td><td style={{textAlign:'right'}}>{r.unit||1}</td><td style={{textAlign:'right'}}>{r.qty_per_unit}</td><td style={{textAlign:'right'}}>{r.kebutuhan}</td>
          {kolomTambah&&<td style={{textAlign:'right',color:'#1e7e34',fontWeight:700}}>+{r.tambah}</td>}
          <td style={{textAlign:'right',fontWeight:700}}>{kolomTambah?r.jatah_sesudah:r.jatah}</td></tr>))}
      </tbody>
    </table>
  );
}
// Part In: pilih mesin pemakai part (pengganti kolom "Nama Mesin"). Mesin pertama yang dipilih = mesin utama.
// Kalau dipilih lebih dari satu, stok tetap satu angka dan sistem membagi jatah per mesin.
/* Kelola part > Ubah: gabungkan part kembar (barang sama tercatat 2 item) ke part yang sedang dibuka. */
function GabungPart({ partId, namaPart, onSelesai }:{ partId:number; namaPart:string; onSelesai:(pesan:string)=>void }) {
  const [buka,setBuka]=useState(false);
  const [semua,setSemua]=useState<any[]|null>(null);
  const [q,setQ]=useState('');
  const [pilih,setPilih]=useState<any|null>(null);
  const [sibuk,setSibuk]=useState(false);
  const [err,setErr]=useState('');
  useEffect(()=>{
    if(!buka||semua)return;
    fetch('/api/mesin?parts=all',{cache:'no-store'}).then(r=>r.json()).then(d=>{const arr=Array.isArray(d?.data)?d.data:Array.isArray(d)?d:[];
      setSemua(arr.filter((p:any)=>p.id!==partId&&(p.is_active==null||!!p.is_active)));}).catch(()=>setSemua([]));
  },[buka]); // eslint-disable-line react-hooks/exhaustive-deps
  const norm=(v:any)=>String(v??'').replace(/\s+/g,' ').trim().toLowerCase();
  const kata=norm(q);
  const daftar=semua?(kata?semua.filter((p:any)=>norm(p.nama_part).includes(kata)||norm(p.kode_12nc).includes(kata)||norm(p.nomor_bin).includes(kata)).slice(0,10)
    :semua.filter((p:any)=>norm(p.nama_part)===norm(namaPart))):[];
  const gabung=async()=>{
    if(!pilih)return;
    setSibuk(true);setErr('');
    try{const d=await fetch('/api/gabung-part',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dari:pilih.id,ke:partId})}).then(r=>r.json());
      if(d.success){setPilih(null);setBuka(false);setSemua(null);onSelesai(d.message);}else setErr(d.error||'Gagal menggabungkan');
    }catch{setErr('Gagal terhubung ke server');}
    finally{setSibuk(false);}
  };
  if(!buka)return <button type="button" className="mcc-link-btn" onClick={()=>setBuka(true)}>Ada part kembar (barang sama, tercatat 2 item)? Gabungkan ke part ini</button>;
  return (
    <div style={{border:'1px solid #e6eaf0',borderRadius:'8px',padding:'14px',display:'flex',flexDirection:'column',gap:'10px'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:'10px',alignItems:'center'}}>
        <div style={{fontSize:'14px',fontWeight:700}}>Gabungkan part kembar ke "{namaPart}"</div>
        <button type="button" className="mcc-link-btn" onClick={()=>{setBuka(false);setPilih(null);setErr('');}}>Tutup</button>
      </div>
      {!pilih&&<>
        <input style={G.inp} value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari part kembar: nama, 12NC atau rak..."/>
        {semua===null?<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Memuat...</div>
          :daftar.length===0?<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{kata?'Tidak ada part yang cocok.':'Tidak ada part lain dengan nama yang sama. Cari dengan nama, 12NC atau rak.'}</div>
          :<div style={{border:'1px solid #eef1f5',borderRadius:'8px'}}>{daftar.map((p:any,i:number)=>(
            <button key={p.id} type="button" onClick={()=>setPilih(p)} style={{display:'flex',width:'100%',justifyContent:'space-between',gap:'10px',padding:'9px 12px',border:'none',borderTop:i?'1px solid #eef1f5':'none',background:'transparent',cursor:'pointer',textAlign:'left',font:'inherit'}}>
              <span style={{minWidth:0}}><b>{p.nama_part}</b><span style={{display:'block',fontSize:'12px',color:'var(--mcc-text-muted)'}}>{[p.kode_12nc,p.merk,p.is_critical?'Critical':'Normal'].filter(Boolean).join(' · ')}</span></span>
              <span style={{fontSize:'12px',color:'var(--mcc-text-muted)',whiteSpace:'nowrap',textAlign:'right'}}>Rak {p.nomor_bin||'-'}<br/>stok {p.stok_saat_ini??0}</span>
            </button>))}</div>}
      </>}
      {pilih&&<div style={{fontSize:'13px',lineHeight:1.55,padding:'12px',borderRadius:'8px',background:'#fff8e6',border:'1px solid rgba(180,83,9,0.35)'}}>
        <b>{pilih.nama_part}</b> (rak {pilih.nomor_bin||'-'}, stok {pilih.stok_saat_ini??0}) akan digabung ke <b>{namaPart}</b>:
        <ul style={{margin:'6px 0 6px 18px'}}>
          <li>Stok {pilih.stok_saat_ini??0} ditambahkan ke part ini.</li>
          <li>Semua riwayat (Part In, Part Out, request, return, mesin pemakai) pindah ke part ini.</li>
          <li>Part kembar dinonaktifkan dan tidak tampil lagi. <b>Tidak bisa dibatalkan.</b></li>
        </ul>
        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
          <button type="button" className="mcc-btn-secondary" disabled={sibuk} onClick={()=>setPilih(null)}>Batal</button>
          <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={gabung}>{sibuk?'Menggabungkan...':'Ya, gabungkan'}</button>
        </div>
      </div>}
      {err&&<div role="alert" style={{fontSize:'13px',color:'#c62828',fontWeight:600}}>{err}</div>}
    </div>
  );
}

/* Part In: pilih part dari master data (Kelola part). Data part hanya ditampilkan, tidak bisa diubah di sini. */
function PilihPartIn({ parts, nilai, onPilih, onKeMaster }:{ parts:any[]; nilai:string; onPilih:(p:any|null)=>void; onKeMaster:()=>void }) {
  const [q,setQ]=useState('');
  const [mesin,setMesin]=useState<string[]|null>(null);
  const dipilih=nilai?parts.find((p:any)=>String(p.id)===String(nilai))||null:null;
  const pid=dipilih?.id;
  useEffect(()=>{
    setMesin(null);
    if(!pid)return;
    let batal=false;
    fetch(`/api/jatah?part=${pid}`).then(r=>r.json()).then(d=>{if(batal)return;const daftar:string[]=(d.rows||[]).map((r:any)=>r.nama).filter(Boolean);if(!daftar.length&&d.part?.mesin_utama)daftar.push(d.part.mesin_utama);setMesin(daftar);}).catch(()=>{if(!batal)setMesin([]);});
    return ()=>{batal=true;};
  },[pid]);
  const norm=(v:any)=>String(v??'').replace(/\s+/g,' ').trim().toLowerCase();
  const kata=norm(q);
  const hasil=kata?parts.filter((p:any)=>norm(p.nama_part).includes(kata)||norm(p.kode_12nc).includes(kata)||norm(p.nomor_bin).includes(kata)).slice(0,8):[];
  const baris=(l:string,v:any)=><div style={{display:'flex',gap:'8px',fontSize:'13px'}}><span style={{width:'92px',flexShrink:0,color:'var(--mcc-text-muted)'}}>{l}</span><span style={{fontWeight:600,minWidth:0,overflowWrap:'anywhere'}}>{v}</span></div>;
  if(dipilih){
    const low=(dipilih.stok_saat_ini??0)<=(dipilih.reorder_point??0);
    return (
      <div>
        <label style={G.lbl}>Spare part *</label>
        <div style={{border:'1px solid rgba(11,94,215,0.35)',background:'rgba(11,94,215,0.05)',borderRadius:'8px',padding:'12px 14px',display:'flex',flexDirection:'column',gap:'6px'}}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'10px'}}>
            <div style={{fontSize:'15px',fontWeight:700,minWidth:0}}>{dipilih.nama_part}{dipilih.is_consumable?<span style={{fontSize:'11px',fontWeight:600,color:'#b45309',marginLeft:'6px'}}>consumable</span>:null}</div>
            <button type="button" className="mcc-link-btn" onClick={()=>{onPilih(null);setQ('');}}>Ganti part</button>
          </div>
          {baris('12NC',dipilih.kode_12nc||'-')}
          {baris('Merk',dipilih.merk||'-')}
          {baris('Rak',dipilih.nomor_bin||'-')}
          {baris('Stok / min',<span style={{color:low?'#c62828':undefined}}>{dipilih.stok_saat_ini??0} / {dipilih.reorder_point??0}</span>)}
          {baris('Dipakai di',mesin===null?'Memuat...':mesin.length?mesin.join(', '):(dipilih.is_consumable?'Consumable (semua area)':'Belum punya mesin'))}
          <div style={{fontSize:'12px',color:'var(--mcc-text-muted)',marginTop:'4px'}}>Data part dari master. Ada yang salah? <button type="button" className="mcc-link-btn" style={{fontSize:'12px'}} onClick={onKeMaster}>Ubah di Kelola part</button></div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <label style={G.lbl}>Spare part * <span style={{fontWeight:400,color:'var(--mcc-text-muted)'}}>(pilih dari master data)</span></label>
      <input style={G.inp} value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama, 12NC atau rak..."/>
      {kata&&(hasil.length
        ?<div style={{border:'1px solid #e6eaf0',borderRadius:'8px',marginTop:'6px',maxHeight:'280px',overflowY:'auto'}}>
          {hasil.map((p:any,i:number)=>(
            <button key={p.id} type="button" onClick={()=>{onPilih(p);setQ('');}} style={{display:'flex',width:'100%',justifyContent:'space-between',gap:'10px',padding:'9px 12px',border:'none',borderTop:i?'1px solid #eef1f5':'none',background:'transparent',cursor:'pointer',textAlign:'left',font:'inherit'}}>
              <span style={{minWidth:0}}><span style={{fontWeight:600}}>{p.nama_part}</span><span style={{display:'block',fontSize:'12px',color:'var(--mcc-text-muted)'}}>{[p.kode_12nc,p.merk].filter(Boolean).join(' · ')||'-'}</span></span>
              <span style={{fontSize:'12px',color:'var(--mcc-text-muted)',whiteSpace:'nowrap',textAlign:'right'}}>Rak {p.nomor_bin||'-'}<br/>stok {p.stok_saat_ini??0}</span>
            </button>
          ))}
        </div>
        :<div style={{marginTop:'6px',fontSize:'13px',lineHeight:1.5,padding:'10px 12px',borderRadius:'8px',background:'#fff8e6',border:'1px solid rgba(180,83,9,0.3)'}}>
          Part "<b>{q.trim()}</b>" tidak ada di master data. Tambahkan dulu di Kelola part (nama, rak, mesin pemakai, min stok), lalu kembali ke Part In.
          <div style={{marginTop:'6px'}}><button type="button" className="mcc-btn-secondary" onClick={onKeMaster}>Buka Kelola part</button></div>
        </div>)}
    </div>
  );
}

function BagiPartIn({ jenis, nama, kode, qty, nilai, onUbah }:{ jenis:any[]; nama:string; kode:string; qty:string; nilai:MesinBagi[]; onUbah:(v:MesinBagi[],utama:string)=>void }) {
  const [hasil,setHasil]=useState<any>(null);
  const namaJ=(id:number)=>jenis.find((x:any)=>x.id===id)?.nama||'';
  const utama=nilai.length?namaJ(nilai[0].id):'';
  const ubah=(v:MesinBagi[])=>onUbah(v,v.length?namaJ(v[0].id):'');
  useEffect(()=>{
    const t=setTimeout(()=>{
      if((!nama.trim()&&!kode.trim())||nilai.length<2){setHasil(null);return;}
      const m=nilai.map(x=>`${x.id}:${x.qty_per_unit}`).join(',');
      fetch(`/api/jatah?pratinjau=1&nama=${encodeURIComponent(nama)}&kode=${encodeURIComponent(kode)}&qty=${parseInt(qty)||0}&mesin=${m}&utama=${encodeURIComponent(utama)}`)
        .then(r=>r.json()).then(setHasil).catch(()=>setHasil(null));
    },400);
    return()=>clearTimeout(t);
  },[nama,kode,qty,utama,JSON.stringify(nilai)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{border:'1px solid var(--mcc-border)',borderRadius:'8px',padding:'12px',display:'flex',flexDirection:'column',gap:'8px',background:'#fbfcfe'}}>
      <div style={{fontSize:'13px',fontWeight:700}}>Mesin pemakai part ini <span style={{fontWeight:400,color:'var(--mcc-text-muted)'}}>(klik mesinnya · boleh lebih dari satu, stok tetap satu dan jatah dibagi per mesin)</span></div>
      <ChipMesin jenis={jenis} nilai={nilai} onUbah={ubah}/>
      {nilai.length===0&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Belum ada mesin dipilih. Part baru tanpa mesin akan masuk ke "Part belum punya mesin" di Kelola part. Part yang sudah ada tetap di mesinnya.</div>}
      {nilai.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'10px'}}>
        {nilai.map((m,i)=>(
          <label key={m.id} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--mcc-text-muted)'}}><b style={{color:'var(--mcc-text)'}}>{namaJ(m.id)}</b>{i===0?' (utama)':''} · qty/unit
            <input type="number" min={1} value={m.qty_per_unit} onChange={e=>ubah(nilai.map(x=>x.id===m.id?{...x,qty_per_unit:Math.max(1,parseInt(e.target.value)||1)}:x))} style={{...G.inp,width:'64px',padding:'4px 6px'}}/></label>))}
      </div>}
      {hasil&&hasil.aktif===false&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Pembagian per mesin butuh migrasi 18.</div>}
      {hasil?.bersama&&<>
        <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Pembagian otomatis (kebutuhan = qty per unit × jumlah unit). Jatah lama yang kurang diisi dulu.</div>
        <TabelJatah rows={hasil.rows} kolomTambah/>
      </>}
    </div>
  );
}
// Kartu stok: menjelaskan asal angka stok (Part In +, Part Out -, Return -) dengan saldo berjalan
function KartuStok({ partId, namaPart }:{ partId:number; namaPart:string }) {
  const [d,setD]=useState<any>(null); const [semua,setSemua]=useState(false);
  useEffect(()=>{setD(null);fetch(`/api/kartu-stok?part=${partId}`,{cache:'no-store'}).then(r=>r.json()).then(setD).catch(()=>setD({success:false,error:'Gagal memuat'}));},[partId]);
  const fmt=(t:any)=>{const x=tglDb(t);return isNaN(x.getTime())?'-':x.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
  const warna:Record<string,string>={'Part In':'#1e7e34','Part Out':'#c62828','Return':'#b45309'};
  if(!d)return <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Memuat riwayat stok...</div>;
  if(!d.success)return <div style={{fontSize:'12px',color:'#c62828'}}>Riwayat stok gagal dimuat: {d.error}</div>;
  const g=d.ringkas, rows:any[]=d.rows||[], tampil=semua?rows:rows.slice(0,8);
  const unduh=()=>unduhXLSX(`kartu-stok-${namaPart.replace(/[^\w-]+/g,'_')}.xlsx`,`Kartu stok ${namaPart}`.slice(0,31),`Stok sekarang ${g.stok} = stok awal ${g.awal} + masuk ${g.masuk} - keluar ${g.keluar} - return ${g.retur}`,
    ['Tanggal','Jenis','Qty','Saldo','Referensi','Keterangan'],[...rows].reverse().map(r=>[fmt(r.tgl),r.jenis,r.qty,r.saldo,r.ref,r.ket]));
  return (
    <div style={{border:'1px solid var(--mcc-border)',borderRadius:'8px',padding:'12px',display:'flex',flexDirection:'column',gap:'8px',background:'#fbfcfe'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
        <div style={{fontSize:'13px',fontWeight:700,flex:1}}>Asal stok (kartu stok)</div>
        {rows.length>0&&<button type="button" className="mcc-btn-secondary" onClick={unduh} style={{padding:'5px 10px',fontSize:'12px'}}>Unduh Excel</button>}
      </div>
      <div style={{fontSize:'14px',display:'flex',flexWrap:'wrap',gap:'6px',alignItems:'center'}}>
        <span>Stok sekarang <b style={{fontSize:'16px'}}>{g.stok}</b> =</span>
        <span title="Stok yang diisi saat part dibuat atau data lama sebelum ada riwayat">stok awal <b>{g.awal}</b></span>
        <span style={{color:'#1e7e34'}}>+ masuk <b>{g.masuk}</b></span>
        <span style={{color:'#c62828'}}>− keluar <b>{g.keluar}</b></span>
        <span style={{color:'#b45309'}}>− return <b>{g.retur}</b></span>
      </div>
      {g.awal!==0&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Stok awal = jumlah yang diisi di "Stok sekarang di rak" saat part dibuat, atau stok lama sebelum sistem mencatat riwayat{g.awal<0?'. Angka minus berarti ada pengambilan yang tercatat lebih banyak dari stok (mis. stok sempat dikosongkan saat verifikasi).':'.'}</div>}
      {rows.length===0?<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Belum ada Part In / Part Out / Return untuk part ini.</div>:(
        <table className="mcc-table" style={{width:'100%'}}>
          <thead><tr><th>Tanggal</th><th>Jenis</th><th style={{textAlign:'right'}}>Qty</th><th style={{textAlign:'right'}}>Saldo</th><th>Referensi</th><th>Keterangan</th></tr></thead>
          <tbody>{tampil.map((r:any,i:number)=>(
            <tr key={i}><td style={{whiteSpace:'nowrap'}}>{fmt(r.tgl)}</td><td style={{color:warna[r.jenis],fontWeight:700,whiteSpace:'nowrap'}}>{r.jenis}</td>
              <td style={{textAlign:'right',fontWeight:700,color:r.qty>0?'#1e7e34':'#c62828'}}>{r.qty>0?'+':''}{r.qty}</td><td style={{textAlign:'right'}}>{r.saldo}</td>
              <td style={{whiteSpace:'nowrap'}}>{r.ref}</td><td style={{color:'var(--mcc-text-muted)'}}>{r.ket||'-'}</td></tr>))}
          </tbody>
        </table>)}
      {rows.length>8&&<button type="button" className="mcc-link-btn" onClick={()=>setSemua(x=>!x)} style={{alignSelf:'flex-start'}}>{semua?'Tampilkan 8 terbaru':`Tampilkan semua (${rows.length})`}</button>}
    </div>
  );
}
// Master Data: atur mesin pemakai part yang sudah ada
/* Kelola part > Ubah: min stok per unit mesin (migrasi 22). Min stok part = jumlah semua unit. */
function MinPerUnit({ partId, onTotal }:{ partId:number; onTotal:(t:number|null)=>void }) {
  const [data,setData]=useState<any|null>(null);
  const [nilai,setNilai]=useState<Record<number,string>>({});
  const [isiSemua,setIsiSemua]=useState<Record<number,string>>({});
  const [sibuk,setSibuk]=useState(false);
  const [pesan,setPesan]=useState<{ok:boolean;t:string}|null>(null);
  const [buka,setBuka]=useState<Record<number,boolean>>({});
  const muat=()=>{setData(null);fetch(`/api/min-unit?part=${partId}`,{cache:'no-store'}).then(r=>r.json()).then(d=>{setData(d);
    if(d?.aktif){const v:Record<number,string>={};(d.mesin||[]).forEach((m:any)=>m.unit.forEach((u:any)=>{v[u.id]=u.min_qty?String(u.min_qty):'';}));setNilai(v);
      const t=Object.values(v).reduce((a,x)=>a+(parseInt(x)||0),0);onTotal(Object.values(v).some(x=>parseInt(x)>0)?t:null);}}).catch(()=>setData({success:false,error:'Gagal memuat'}));};
  useEffect(()=>{muat();},[partId]); // eslint-disable-line react-hooks/exhaustive-deps
  if(!data)return <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Memuat min per unit...</div>;
  if(!data.success)return <div style={{fontSize:'13px',color:'#c62828'}}>{data.error||'Gagal memuat min per unit'}</div>;
  if(!data.aktif)return <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{data.pesan}</div>;
  const mesin:any[]=data.mesin||[];
  const total=Object.values(nilai).reduce((a,x)=>a+(parseInt(x)||0),0);
  const terisi=Object.values(nilai).some(x=>parseInt(x)>0);
  const simpan=async()=>{setSibuk(true);setPesan(null);
    try{const rows=Object.entries(nilai).map(([k,v])=>({unit_id:Number(k),min_qty:parseInt(v)||0}));
      const d=await fetch('/api/min-unit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({part_id:partId,rows})}).then(r=>r.json());
      setPesan({ok:!!d.success,t:d.message||d.error||'Gagal menyimpan'});if(d.success)onTotal(d.total??null);
    }catch{setPesan({ok:false,t:'Gagal terhubung ke server'});}finally{setSibuk(false);}};
  return (
    <div style={{border:'1px solid #e6eaf0',borderRadius:'8px',padding:'14px',display:'flex',flexDirection:'column',gap:'12px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'10px',flexWrap:'wrap'}}>
        <div><div style={{fontSize:'14px',fontWeight:700}}>Min stok per unit mesin</div>
          <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Isi kebutuhan minimum part ini di setiap unit. Min stok part = jumlah semua unit. Kosong / 0 = unit itu tidak dihitung.</div></div>
        <button type="button" className="mcc-link-btn" onClick={muat}>Muat ulang mesin</button>
      </div>
      {mesin.length===0&&<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Part ini belum dipakai di mesin mana pun. Atur dulu di "Dipakai di mesin", lalu klik Muat ulang mesin.</div>}
      {mesin.map((m:any)=>{const sub=m.unit.reduce((a:number,u:any)=>a+(parseInt(nilai[u.id])||0),0);const tampil=buka[m.id]??(m.unit.length<=16);
        return (
        <div key={m.id} style={{display:'flex',flexDirection:'column',gap:'8px',borderTop:'1px solid #eef1f5',paddingTop:'10px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
            <b style={{fontSize:'14px'}}>{m.nama}</b><span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{m.unit.length} unit · subtotal {sub}</span>
            <div style={{flex:1}}/>
            <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Isi semua unit</span>
            <input type="number" min={0} aria-label={`Isi semua unit ${m.nama}`} style={{...G.inp,width:'70px',padding:'6px 8px'}} value={isiSemua[m.id]||''} onChange={e=>setIsiSemua(x=>({...x,[m.id]:e.target.value}))}/>
            <button type="button" className="mcc-btn-secondary" onClick={()=>{const v=isiSemua[m.id]||'';setNilai(x=>{const n={...x};m.unit.forEach((u:any)=>{n[u.id]=v;});return n;});}}>Terapkan</button>
            {m.unit.length>16&&<button type="button" className="mcc-link-btn" onClick={()=>setBuka(x=>({...x,[m.id]:!tampil}))}>{tampil?'Sembunyikan unit':'Lihat per unit'}</button>}
          </div>
          {m.unit.length===0&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Mesin ini belum punya unit aktif.</div>}
          {tampil&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:'8px'}}>
            {m.unit.map((u:any)=>(
              <label key={u.id} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',border:'1px solid #e6eaf0',borderRadius:'6px',padding:'4px 8px',background:parseInt(nilai[u.id])>0?'rgba(11,94,215,0.05)':undefined}}>
                <span style={{flex:1,minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{m.nama} {u.nomor_unit}</span>
                <input type="number" min={0} style={{...G.inp,width:'56px',padding:'4px 6px'}} value={nilai[u.id]??''} onChange={e=>setNilai(x=>({...x,[u.id]:e.target.value}))}/>
              </label>))}
          </div>}
        </div>);})}
      <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',borderTop:'1px solid #eef1f5',paddingTop:'10px'}}>
        <span style={{fontSize:'14px'}}>Min stok part = <b style={{fontSize:'18px'}}>{terisi?total:'-'}</b>{!terisi&&<span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}> (belum diisi, min stok diketik manual)</span>}</span>
        <div style={{flex:1}}/>
        <button type="button" className="mcc-btn-primary" disabled={sibuk||mesin.length===0} onClick={simpan}>{sibuk?'Menyimpan...':'Simpan min per unit'}</button>
      </div>
      {pesan&&<div role="status" style={{fontSize:'13px',fontWeight:600,color:pesan.ok?'#1e7e34':'#c62828'}}>{pesan.t}</div>}
    </div>
  );
}

function JatahEditor({ partId, jenis, utamaId }:{ partId:number; jenis:any[]; utamaId:number|null }) {
  const [rows,setRows]=useState<any[]|null>(null); const [pilih,setPilih]=useState<MesinBagi[]>([]); const [pesan,setPesan]=useState(''); const [aktif,setAktif]=useState(true);
  const muat=()=>fetch(`/api/jatah?part=${partId}`).then(r=>r.json()).then(d=>{if(d.aktif===false){setAktif(false);return;}const rs=d.rows||[];setRows(rs);setPilih(rs.filter((r:any)=>r.mesin_jenis_id!==utamaId).map((r:any)=>({id:r.mesin_jenis_id,qty_per_unit:r.qty_per_unit})));}).catch(()=>setRows([]));
  useEffect(()=>{muat();},[partId]); // eslint-disable-line react-hooks/exhaustive-deps
  if(!aktif)return <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Pembagian per mesin butuh migrasi 18.</div>;
  const utama=jenis.find((j:any)=>j.id===utamaId);
  const qpuUtama=rows?.find((r:any)=>r.mesin_jenis_id===utamaId)?.qty_per_unit||1;
  const [qUtama,setQUtama]=[qpuUtama,(v:number)=>setRows(r=>(r||[]).map((x:any)=>x.mesin_jenis_id===utamaId?{...x,qty_per_unit:v}:x))];
  const simpan=async()=>{
    const mesin=[...(utamaId?[{id:utamaId,qty_per_unit:qUtama}]:[]),...pilih];
    const d=await fetch('/api/jatah',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({aksi:'atur',part_id:partId,mesin})}).then(r=>r.json()).catch(()=>({success:false,error:'Gagal'}));
    setPesan(d.success?d.message:(d.error||'Gagal'));if(d.success){setRows(d.rows||[]);}
  };
  return (
    <div style={{border:'1px solid var(--mcc-border)',borderRadius:'8px',padding:'12px',display:'flex',flexDirection:'column',gap:'8px',background:'#fbfcfe'}}>
      <div style={{fontSize:'13px',fontWeight:700}}>Dipakai di mesin <span style={{fontWeight:400,color:'var(--mcc-text-muted)'}}>· stok tetap satu, jatah dibagi sesuai kebutuhan</span></div>
      {utama&&<label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--mcc-text-muted)'}}>Mesin utama <b style={{color:'var(--mcc-text)'}}>{utama.nama}</b> · qty/unit
        <input type="number" min={1} value={qUtama} onChange={e=>setQUtama(Math.max(1,parseInt(e.target.value)||1))} style={{...G.inp,width:'64px',padding:'4px 6px'}}/></label>}
      <ChipMesin jenis={jenis} kecuali={utama?.nama} nilai={pilih} onUbah={setPilih}/>
      {pilih.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'10px'}}>
        {pilih.map(m=>{const j=jenis.find((x:any)=>x.id===m.id);return(
          <label key={m.id} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',color:'var(--mcc-text-muted)'}}>{j?.nama} · qty/unit
            <input type="number" min={1} value={m.qty_per_unit} onChange={e=>setPilih(pilih.map(x=>x.id===m.id?{...x,qty_per_unit:Math.max(1,parseInt(e.target.value)||1)}:x))} style={{...G.inp,width:'64px',padding:'4px 6px'}}/></label>);})}
      </div>}
      {rows&&rows.length>=2&&<TabelJatah rows={rows}/>}
      <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
        <button type="button" className="mcc-btn-secondary" onClick={simpan}>Simpan mesin pemakai</button>
        {pesan&&<span style={{fontSize:'12px',fontWeight:600,color:'#1e7e34'}}>{pesan}</span>}
      </div>
    </div>
  );
}

function MasterMesin({ kategoriList, onTampilanLama, onPartsBerubah }:{ kategoriList:string[]; onTampilanLama:()=>void; onPartsBerubah:()=>void }) {
  const [jenis,setJenis]=useState<JenisMesin[]>([]);
  const [unit,setUnit]=useState<UnitMesin[]>([]);
  const [tanpaMesin,setTanpaMesin]=useState(0);
  const [error,setError]=useState('');
  const [siap,setSiap]=useState(false);
  const [lihatSembunyi,setLihatSembunyi]=useState(false);
  // navigasi: area -> jenis ; atau daftar "tanpa mesin"
  const [area,setArea]=useState<'Molding'|'Non-molding'|null>(null);
  const [jenisId,setJenisId]=useState<number|null>(null);
  const [modeTanpa,setModeTanpa]=useState(false);
  const [modeCons,setModeCons]=useState(false); // daftar consumable part (lintas mesin)
  const [infoCons,setInfoCons]=useState<{jumlah:number;warning:number}|null>(null);
  const [modeMold,setModeMold]=useState<false|'mold'|'mesin'>(false);
  const [parts,setParts]=useState<PartMesin[]|null>(null);
  const [cari,setCari]=useState('');
  const [dipilih,setDipilih]=useState<Set<number>>(new Set());
  const [tujuan,setTujuan]=useState('');
  const [pesan,setPesan]=useState<{type:'ok'|'err';text:string}|null>(null);
  const [formJenis,setFormJenis]=useState<null|{id?:number;nama:string;emoji:string;leader_nama:string;keterangan:string}>(null);
  const [formUnit,setFormUnit]=useState<null|{id?:number;nomor_unit:string;kode_aset:string;leader_nama:string}>(null);
  const [formPart,setFormPart]=useState<null|(typeof PART_KOSONG & {id?:number})>(null);
  const [minUnitTotal,setMinUnitTotal]=useState<number|null>(null);
  useEffect(()=>{setMinUnitTotal(null);},[formPart?.id]);
  const [rakPart,setRakPart]=useState({kode:'',tingkat:''});
  const [errPart,setErrPart]=useState<{pesan:string;kolom:string[]}|null>(null); // pesan wajib-isi, tampil di dalam form
  const [lokasi,setLokasi]=useState<{rak:RakInfo[];bins:BinInfo[]}>({rak:[],bins:[]});
  const [sibuk,setSibuk]=useState(false);
  const fotoRef=useRef<HTMLInputElement>(null);

  const kabar=(type:'ok'|'err',text:string)=>{setPesan({type,text});setTimeout(()=>setPesan(null),3500);};
  const muat=()=>fetch('/api/mesin?semua=1').then(r=>r.json()).then(d=>{
    if(d.success){setJenis(d.jenis||[]);setUnit(d.unit||[]);setTanpaMesin(d.part_tanpa_mesin||0);setInfoCons(d.consumable||null);setError('');}
    else setError(d.error||'Gagal memuat master data');
  }).catch(()=>setError('Gagal memuat master data')).finally(()=>setSiap(true));
  const muatLokasi=()=>fetch('/api/lokasi-rak').then(r=>r.json()).then(d=>{if(d.success)setLokasi({rak:d.rak||[],bins:d.bins||[]});}).catch(()=>{});
  const muatParts=(key:number|'none'|'consumable')=>{setParts(null);fetch(`/api/mesin?parts=${key}`).then(r=>r.json()).then(d=>setParts(d.success?(d.data||[]):[])).catch(()=>setParts([]));};
  useEffect(()=>{muat();muatLokasi();},[]);
  useEffect(()=>{setDipilih(new Set());setCari('');setFormPart(null);setErrPart(null);if(jenisId)muatParts(jenisId);else if(modeTanpa)muatParts('none');else if(modeCons)muatParts('consumable');else setParts(null);},[jenisId,modeTanpa,modeCons]); // eslint-disable-line react-hooks/exhaustive-deps

  const kirim=async(body:any)=>{
    setSibuk(true);
    try{const d=await fetch('/api/mesin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
      if(d.success)kabar('ok',d.message);else kabar('err',d.error||'Gagal menyimpan');
      return d;
    }catch{kabar('err','Gagal menyimpan');return {success:false};}
    finally{setSibuk(false);}
  };
  const segarkan=()=>{muat();if(jenisId)muatParts(jenisId);else if(modeTanpa)muatParts('none');else if(modeCons)muatParts('consumable');onPartsBerubah();};

  const jenisAktif=jenis.find(j=>j.id===jenisId)||null;
  // Jenis "Maintenance Mold" bukan mesin, melainkan tim ganti mold -> buka fitur template mold
  useEffect(()=>{if(!jenisAktif)return;const n=jenisAktif.nama.trim();if(/^maintenance\s*mold$/i.test(n)){setJenisId(null);setModeMold('mold');}else if(/^maintenance\s*machine$/i.test(n)){setJenisId(null);setModeMold('mesin');}},[jenisAktif]);
  const unitAktif=jenisAktif?unit.filter(u=>u.jenis_id===jenisAktif.id&&(lihatSembunyi||u.is_active)):[];
  const daftarArea=(a:string)=>jenis.filter(j=>j.area===a&&(lihatSembunyi||j.is_active));
  const q=cari.trim().toLowerCase();
  const partsTampil=(parts||[]).filter(p=>!q||p.nama_part.toLowerCase().includes(q)||String(p.kode_12nc||'').toLowerCase().includes(q)||String(p.nomor_bin||'').toLowerCase().includes(q)||String(p.mesin||'').toLowerCase().includes(q)||String(p.kategori||'').toLowerCase().includes(q)||String(p.merk||'').toLowerCase().includes(q));
  const semuaTerpilih=partsTampil.length>0&&partsTampil.every(p=>dipilih.has(p.id));
  const toggle=(id:number)=>setDipilih(s=>{const n=new Set(s);if(n.has(id))n.delete(id);else n.add(id);return n;});
  const toggleSemua=()=>setDipilih(s=>{const n=new Set(s);if(semuaTerpilih)partsTampil.forEach(p=>n.delete(p.id));else partsTampil.forEach(p=>n.add(p.id));return n;});

  const gantiFoto=async(file:File|undefined)=>{
    if(!file||!jenisAktif)return;
    const raw:string=await new Promise(res=>{const rd=new FileReader();rd.onload=e=>res(String(e.target?.result||''));rd.readAsDataURL(file);});
    const foto=await kecilkanFoto(raw,800,0.8);
    const d=await kirim({aksi:'jenis_foto',id:jenisAktif.id,foto});
    if(d.success)muat();
  };
  const simpanJenis=async()=>{
    if(!formJenis)return;
    const a=jenisAktif?.area||area; if(!a)return;
    const d=await kirim({aksi:'jenis_simpan',id:formJenis.id,area:a,nama:formJenis.nama,emoji:formJenis.emoji,leader_nama:formJenis.leader_nama,keterangan:formJenis.keterangan,warna:jenisAktif?.warna||'#0b5ed7',is_active:formJenis.id?jenisAktif?.is_active:true});
    if(d.success){setFormJenis(null);muat();if(d.id)setJenisId(d.id);}
  };
  const simpanUnit=async()=>{
    if(!formUnit||!jenisAktif)return;
    const d=await kirim({aksi:'unit_simpan',jenis_id:jenisAktif.id,...formUnit});
    if(d.success){setFormUnit(null);muat();}
  };
  const simpanLokasiBin=async(bin:string)=>{
    const nb=bin.trim(); const kode=rakPart.kode.trim().replace(/^rak\s*/i,'').toUpperCase();
    if(!nb||!kode)return;
    const rak=lokasi.rak.find(r=>r.kode===kode); if(!rak)return;
    const info=lokasi.bins.find(x=>x.nomor_bin.toLowerCase()===nb.toLowerCase());
    const tingkat=rakPart.tingkat?Number(rakPart.tingkat):null;
    if(info?.rak_id===rak.id&&(info?.tingkat??null)===tingkat)return;
    await fetch('/api/lokasi-rak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bins:[nb],rak_id:rak.id,tingkat})}).catch(()=>{});
    muatLokasi();
  };
  const simpanPart=async()=>{
    if(!formPart)return;
    const kurang:string[]=[];
    if(!formPart.nama_part.trim())kurang.push('nama_part');
    if(!String(formPart.nomor_bin||'').trim())kurang.push('nomor_bin');
    if(kurang.length){
      const label:Record<string,string>={nama_part:'Nama spare part',nomor_bin:'Rak'};
      setErrPart({pesan:`Belum bisa disimpan. Lengkapi dulu: ${kurang.map(k=>label[k]).join(', ')}.`,kolom:kurang});
      return;
    }
    setErrPart(null);
    // Kategori tidak diisi manual lagi: part sudah berada di dalam mesinnya.
    // Part lama tetap memakai kategori yang tersimpan; part baru otomatis = nama mesin (atau "Consumable").
    const mesinCons=modeCons?jenis.find(j=>j.id===Number(formPart.mesin_jenis_id)):null;
    const kategoriOtomatis=(formPart.kategori||'').trim()||(jenisAktif?.nama||mesinCons?.nama||(modeCons?'Consumable':'Lainnya')).slice(0,50);
    const fp={...formPart,kategori:kategoriOtomatis};
    const d=fp.id
      ?await kirim({aksi:'part_ubah',...fp})
      :await kirim({aksi:'part_baru',...fp,stok_saat_ini:0,mesin_jenis_id:jenisAktif?.id||(modeCons?(Number(formPart.mesin_jenis_id)||null):null),is_consumable:modeCons?true:formPart.is_consumable});
    if(d.success){await simpanLokasiBin(formPart.nomor_bin);setFormPart(null);setRakPart({kode:'',tingkat:''});segarkan();}
    else setErrPart({pesan:d.error||'Gagal menyimpan',kolom:[]});
  };
  const tetapkan=async(jid:number|null)=>{
    if(!dipilih.size)return kabar('err','Pilih part dulu');
    const d=await kirim({aksi:'part_tetapkan',part_ids:Array.from(dipilih),jenis_id:jid});
    if(d.success){setDipilih(new Set());setTujuan('');segarkan();}
  };

  const fotoBox=(j:JenisMesin,ukuran:number)=>(
    <div style={{width:ukuran,height:ukuran,borderRadius:'10px',overflow:'hidden',background:'#eef3fb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      {j.foto_url?<img src={j.foto_url} alt={j.nama} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:ukuran*0.45}}>{j.emoji||'⚙️'}</span>}
    </div>
  );
  const crumb=(teks:string,onClick?:()=>void)=>onClick
    ?<button type="button" className="mcc-link-btn" onClick={onClick}>{teks}</button>
    :<span style={{fontWeight:700,color:'var(--mcc-text)'}}>{teks}</span>;
  const pilihanTujuan=(
    <select style={{...G.inp,width:'240px',cursor:'pointer'}} value={tujuan} onChange={e=>setTujuan(e.target.value)}>
      <option value="">Pilih mesin tujuan</option>
      {(['Molding','Non-molding'] as const).map(a=>(
        <optgroup key={a} label={a}>{jenis.filter(j=>j.area===a&&j.is_active&&j.id!==jenisId).map(j=><option key={j.id} value={j.id}>{j.nama}</option>)}</optgroup>
      ))}
    </select>
  );

  if(!siap)return <div style={{padding:'32px',color:'var(--mcc-text-muted)'}}>Memuat master data...</div>;
  if(error)return <div style={{padding:'32px'}}><div style={{...G.card,padding:'20px',color:'#c62828'}}>{error}. Pastikan migrasi 06 sudah dijalankan. <button type="button" className="mcc-link-btn" onClick={onTampilanLama}>Buka tampilan lama</button></div></div>;

  return (
    <div style={{padding:'28px 32px',display:'flex',flexDirection:'column',gap:'20px'}}>
      {pesan&&<div role="status" className="mcc-fade-in" style={{position:'fixed',top:'20px',right:'24px',zIndex:1000,padding:'10px 16px',borderRadius:'8px',fontSize:'14px',fontWeight:600,background:pesan.type==='ok'?'#e8f4ec':'#fdecec',color:pesan.type==='ok'?'#1e7e34':'#c62828',border:`1px solid ${pesan.type==='ok'?'#b9dcc4':'#f3c2c2'}`}}>{pesan.text}</div>}

      {/* Breadcrumb + aksi umum */}
      {!modeMold&&<div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',fontSize:'15px',color:'var(--mcc-text-muted)'}}>
        {crumb('Master Data',(area||modeTanpa||modeCons)?()=>{setArea(null);setJenisId(null);setModeTanpa(false);setModeCons(false);}:undefined)}
        {modeTanpa&&<><span>›</span>{crumb('Part belum punya mesin')}</>}
        {modeCons&&<><span>›</span>{crumb('Consumable part')}</>}
        {area&&<><span>›</span>{crumb(area,jenisId?()=>setJenisId(null):undefined)}</>}
        {jenisAktif&&<><span>›</span>{crumb(jenisAktif.nama)}</>}
        <div style={{flex:1}}/>
        <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}><input type="checkbox" checked={lihatSembunyi} onChange={e=>setLihatSembunyi(e.target.checked)}/>Tampilkan yang disembunyikan</label>
        <button type="button" className="mcc-btn-secondary" onClick={onTampilanLama}>Tampilan lama / Upload Excel</button>
      </div>}

      {/* LEVEL 0: pilih area */}
      {modeMold==='mesin'&&<PmMaster onKembali={()=>setModeMold(false)}/>}
      {modeMold==='mold'&&<MoldMaster key={modeMold} kategori={modeMold} onKembali={()=>setModeMold(false)} kirimMesin={kirim}/>}

      {!area&&!modeTanpa&&!modeCons&&!modeMold&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'16px'}}>
          {(['Molding','Non-molding'] as const).map(a=>{
            const list=daftarArea(a);
            const nPart=list.reduce((s,j)=>s+(j.jumlah_part||0),0);
            const nWarn=list.reduce((s,j)=>s+(j.jumlah_warning||0),0);
            return (
              <button key={a} type="button" onClick={()=>setArea(a)} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px'}}>
                <span style={{fontSize:'20px',fontWeight:700,color:'var(--mcc-text)'}}>{a}</span>
                <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{list.length} jenis mesin · {nPart} part</span>
                {nWarn>0&&<span style={{fontSize:'13px',color:'#c62828'}}>{nWarn} part warning</span>}
              </button>
            );
          })}
          <button type="button" onClick={()=>setModeTanpa(true)} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px',borderColor:tanpaMesin?'#f0d9a8':undefined,background:tanpaMesin?'#fffaf0':undefined}}>
            <span style={{fontSize:'20px',fontWeight:700,color:'var(--mcc-text)'}}>Part belum punya mesin</span>
            <span style={{fontSize:'14px',color:tanpaMesin?'#8a5a00':'var(--mcc-text-muted)'}}>{tanpaMesin} part · belum tampil di web Teknisi</span>
          </button>
          <button type="button" onClick={()=>{if(!infoCons)return kabar('err','Jalankan migrasi 16 dulu untuk fitur consumable part');setModeCons(true);}} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px',borderColor:'#f3d9b1',background:'#fffaf3'}}>
            <span style={{fontSize:'20px',fontWeight:700,color:'var(--mcc-text)'}}>Consumable part</span>
            <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{infoCons?`${infoCons.jumlah} part habis pakai · tampil sendiri di web Teknisi`:'Butuh migrasi 16'}</span>
            {!!infoCons?.warning&&<span style={{fontSize:'13px',color:'#c62828'}}>{infoCons.warning} part warning</span>}
          </button>
          <button type="button" onClick={()=>setModeMold('mold')} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px'}}>
            <span style={{fontSize:'20px',fontWeight:700,color:'var(--mcc-text)'}}>Maintenance Mold</span>
            <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Jenis mold per mesin + template spare part</span>
          </button>
          <button type="button" onClick={()=>setModeMold('mesin')} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px'}}>
            <span style={{fontSize:'20px',fontWeight:700,color:'var(--mcc-text)'}}>Maintenance Machine</span>
            <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Checklist PM (template semua mesin Molding) + spare part per mesin</span>
          </button>
        </div>
      )}

      {/* LEVEL 1: daftar jenis mesin di area */}
      {area&&!jenisAktif&&!modeMold&&(
        <>
          <div style={{display:'flex',justifyContent:'flex-end'}}>
            <button type="button" className="mcc-btn-primary" onClick={()=>setFormJenis({nama:'',emoji:'⚙️',leader_nama:'',keterangan:''})}>+ Tambah jenis mesin</button>
          </div>
          {formJenis&&!formJenis.id&&(
            <div style={{...G.card,padding:'16px',display:'grid',gridTemplateColumns:'2fr 80px 2fr auto auto',gap:'10px',alignItems:'end'}}>
              <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Nama jenis mesin<input style={{...G.inp,marginTop:'6px'}} value={formJenis.nama} onChange={e=>setFormJenis(f=>f&&({...f,nama:e.target.value}))} placeholder="mis. Haitian 3K"/></label>
              <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Ikon<input style={{...G.inp,marginTop:'6px'}} value={formJenis.emoji} onChange={e=>setFormJenis(f=>f&&({...f,emoji:e.target.value}))}/></label>
              <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Leader<input style={{...G.inp,marginTop:'6px'}} value={formJenis.leader_nama} onChange={e=>setFormJenis(f=>f&&({...f,leader_nama:e.target.value}))}/></label>
              <button type="button" className="mcc-btn-secondary" onClick={()=>setFormJenis(null)}>Batal</button>
              <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanJenis}>Simpan</button>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'14px'}}>
            {daftarArea(area).map(j=>{
              const nUnit=unit.filter(u=>u.jenis_id===j.id&&u.is_active).length;
              return (
                <button key={j.id} type="button" onClick={()=>{const n=j.nama.trim();if(/^maintenance\s*mold$/i.test(n))setModeMold('mold');else if(/^maintenance\s*machine$/i.test(n))setModeMold('mesin');else setJenisId(j.id);}} style={{...G.card,padding:'14px',font:'inherit',cursor:'pointer',display:'flex',gap:'12px',alignItems:'center',textAlign:'left',opacity:j.is_active?1:0.5}}>
                  {fotoBox(j,56)}
                  <span style={{display:'flex',flexDirection:'column',gap:'2px',minWidth:0}}>
                    <span style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-text)'}}>{j.nama}</span>
                    <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{j.jumlah_part} part{nUnit?` · ${nUnit} unit`:''}</span>
                    {j.jumlah_warning>0&&<span style={{fontSize:'12px',color:'#c62828'}}>{j.jumlah_warning} warning</span>}
                    {!j.is_active&&<span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Disembunyikan</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* LEVEL 2: detail jenis mesin */}
      {jenisAktif&&(
        <>
          <section style={{...G.card,padding:'20px',display:'flex',gap:'20px',alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'8px',alignItems:'center'}}>
              {fotoBox(jenisAktif,110)}
              <input ref={fotoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{gantiFoto(e.target.files?.[0]);e.target.value='';}}/>
              <button type="button" className="mcc-link-btn" onClick={()=>fotoRef.current?.click()}>Ganti foto</button>
            </div>
            <div style={{flex:1,minWidth:'260px',display:'flex',flexDirection:'column',gap:'10px'}}>
              {formJenis?.id===jenisAktif.id?(
                <div style={{display:'grid',gridTemplateColumns:'2fr 80px 2fr',gap:'10px'}}>
                  <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Nama<input style={{...G.inp,marginTop:'6px'}} value={formJenis.nama} onChange={e=>setFormJenis(f=>f&&({...f,nama:e.target.value}))}/></label>
                  <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Ikon<input style={{...G.inp,marginTop:'6px'}} value={formJenis.emoji} onChange={e=>setFormJenis(f=>f&&({...f,emoji:e.target.value}))}/></label>
                  <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Leader<input style={{...G.inp,marginTop:'6px'}} value={formJenis.leader_nama} onChange={e=>setFormJenis(f=>f&&({...f,leader_nama:e.target.value}))}/></label>
                  <label style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Keterangan<input style={{...G.inp,marginTop:'6px'}} value={formJenis.keterangan} onChange={e=>setFormJenis(f=>f&&({...f,keterangan:e.target.value}))}/></label>
                  <div style={{gridColumn:'1/-1',display:'flex',gap:'8px'}}>
                    <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanJenis}>Simpan</button>
                    <button type="button" className="mcc-btn-secondary" onClick={()=>setFormJenis(null)}>Batal</button>
                  </div>
                </div>
              ):(
                <>
                  <div style={{display:'flex',alignItems:'baseline',gap:'12px',flexWrap:'wrap'}}>
                    <h2 style={{margin:0,fontSize:'22px',fontWeight:700}}>{jenisAktif.nama}</h2>
                    <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{jenisAktif.area} · {jenisAktif.jumlah_part} part{jenisAktif.leader_nama?` · Leader: ${jenisAktif.leader_nama}`:''}</span>
                  </div>
                  {jenisAktif.keterangan&&<div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{jenisAktif.keterangan}</div>}
                  <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                    <button type="button" className="mcc-btn-secondary" onClick={()=>setFormJenis({id:jenisAktif.id,nama:jenisAktif.nama,emoji:jenisAktif.emoji||'',leader_nama:jenisAktif.leader_nama||'',keterangan:jenisAktif.keterangan||''})}>Ubah data mesin</button>
                    <button type="button" className="mcc-btn-secondary" disabled={sibuk} onClick={async()=>{if(jenisAktif.is_active&&!await tanya(`Sembunyikan ${jenisAktif.nama} dari Admin dan Teknisi?`))return;const d=await kirim({aksi:'jenis_nonaktif',id:jenisAktif.id,aktif:!jenisAktif.is_active});if(d.success)muat();}}>{jenisAktif.is_active?'Sembunyikan':'Tampilkan lagi'}</button>
                    <button type="button" className="mcc-btn-secondary" style={{color:'#c62828'}} disabled={sibuk} onClick={async()=>{if(!await tanya(`Hapus PERMANEN mesin ${jenisAktif.nama}? (Hanya bisa kalau tidak punya part & belum dipakai di riwayat)`))return;const d=await kirim({aksi:'jenis_hapus',id:jenisAktif.id});if(d.success){setJenisId(null);muat();}}}>Hapus mesin</button>
                  </div>
                </>
              )}

              {/* Unit */}
              <div style={{borderTop:'1px solid var(--mcc-border)',paddingTop:'12px'}}>
                <div style={{fontSize:'14px',fontWeight:600,marginBottom:'8px'}}>Unit mesin</div>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                  {unitAktif.length===0&&<span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Belum ada unit (mesin ini dianggap 1 unit).</span>}
                  {unitAktif.map(u=>(
                    <span key={u.id} style={{display:'inline-flex',alignItems:'center',gap:'6px',border:'1px solid var(--mcc-border)',borderRadius:'6px',padding:'4px 8px',fontSize:'13px',opacity:u.is_active?1:0.5}}>
                      {jenisAktif.nama} {u.nomor_unit}{u.leader_nama?` · ${u.leader_nama}`:''}
                      <button type="button" className="mcc-link-btn" style={{fontSize:'12px'}} onClick={()=>setFormUnit({id:u.id,nomor_unit:u.nomor_unit,kode_aset:u.kode_aset||'',leader_nama:u.leader_nama||''})}>ubah</button>
                      {u.is_active&&<button type="button" className="mcc-link-btn" style={{fontSize:'12px',color:'#c62828'}} onClick={async()=>{if(!await tanya(`Sembunyikan ${jenisAktif.nama} ${u.nomor_unit}?`))return;const d=await kirim({aksi:'unit_nonaktif',id:u.id});if(d.success)muat();}}>sembunyikan</button>}
                      <button type="button" className="mcc-link-btn" style={{fontSize:'12px',color:'#c62828'}} onClick={async()=>{if(!await tanya(`Hapus PERMANEN ${jenisAktif.nama} ${u.nomor_unit}?`))return;const d=await kirim({aksi:'unit_hapus',id:u.id});if(d.success)muat();}}>hapus</button>
                    </span>
                  ))}
                  {!formUnit&&<button type="button" className="mcc-btn-secondary" onClick={()=>setFormUnit({nomor_unit:'',kode_aset:'',leader_nama:''})}>+ Unit</button>}
                </div>
                {formUnit&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto auto',gap:'8px',alignItems:'end',marginTop:'10px'}}>
                    <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Unit ke / nama<input style={{...G.inp,marginTop:'6px'}} maxLength={20} value={formUnit.nomor_unit} onChange={e=>setFormUnit(f=>f&&({...f,nomor_unit:e.target.value}))} placeholder="mis. 3"/></label>
                    <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Kode aset<input style={{...G.inp,marginTop:'6px'}} value={formUnit.kode_aset} onChange={e=>setFormUnit(f=>f&&({...f,kode_aset:e.target.value}))}/></label>
                    <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Penanggung jawab<input style={{...G.inp,marginTop:'6px'}} value={formUnit.leader_nama} onChange={e=>setFormUnit(f=>f&&({...f,leader_nama:e.target.value}))}/></label>
                    <button type="button" className="mcc-btn-secondary" onClick={()=>setFormUnit(null)}>Batal</button>
                    <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanUnit}>Simpan</button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* DAFTAR PART (jenis mesin atau tanpa mesin) */}
      {(jenisAktif||modeTanpa||modeCons)&&(
        <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <h3 style={{margin:0,fontSize:'16px',fontWeight:700,flex:1}}>{modeTanpa?'Part belum punya mesin':modeCons?'Consumable part':`Spare part ${jenisAktif!.nama}`}{parts?` (${parts.length})`:''}</h3>
            <input style={{...G.inp,width:'260px'}} placeholder="Cari nama, 12NC, bin, kategori" value={cari} onChange={e=>setCari(e.target.value)}/>
            {(jenisAktif||modeCons)&&!formPart&&<button type="button" className="mcc-btn-primary" onClick={()=>{setFormPart({...PART_KOSONG,is_consumable:modeCons});setRakPart({kode:'',tingkat:''});}}>+ Part baru</button>}
          </div>
          {modeCons&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Part habis pakai yang sering diambil (mis. majun, cairan pembersih, sarung tangan). Di web Teknisi tampil di kotak <b>Consumable part</b>. Part milik mesin juga bisa ditandai consumable lewat tombol Ubah.</div>}
          {jenisAktif&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Part di sini dipakai bersama oleh semua unit {jenisAktif.nama}. Unit yang memakai dicatat saat teknisi memesan.</div>}

          {formPart&&(
            <div style={{border:'1px solid var(--mcc-blue)',borderRadius:'8px',padding:'16px',background:'#f8fbff',display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'12px'}}>
              <div style={{gridColumn:'1/-1',fontSize:'15px',fontWeight:700}}>{formPart.id?'Ubah part':modeCons?'Consumable part baru':`Part baru untuk ${jenisAktif?.nama}`}</div>
              {modeCons&&!formPart.id&&<div style={{gridColumn:'1/-1'}}><label style={G.lbl}>Mesin pemilik (opsional)</label><select style={{...G.inp,cursor:'pointer'}} value={String(formPart.mesin_jenis_id||'')} onChange={e=>setFormPart(f=>f&&({...f,mesin_jenis_id:e.target.value}))}><option value="">Tidak khusus mesin tertentu (umum)</option>{(['Molding','Non-molding'] as const).map(a=><optgroup key={a} label={a}>{jenis.filter(j=>j.area===a&&j.is_active).map(j=><option key={j.id} value={j.id}>{j.nama}</option>)}</optgroup>)}</select></div>}
              <div style={{gridColumn:'span 2'}}><label style={G.lbl}>Nama spare part *</label><input style={{...G.inp,...(errPart?.kolom.includes('nama_part')?{borderColor:'#c62828',background:'#fff5f5'}:{})}} value={formPart.nama_part} onChange={e=>setFormPart(f=>f&&({...f,nama_part:e.target.value}))}/></div>
              <div><label style={G.lbl}>Kode / 12NC</label><input style={G.inp} value={formPart.kode_12nc} onChange={e=>setFormPart(f=>f&&({...f,kode_12nc:e.target.value}))}/></div>
              <div><label style={G.lbl}>Merk</label><input style={G.inp} list="mm-merk" maxLength={200} placeholder="mis. SMC, Festo (pisahkan dengan koma)" value={formPart.merk||''} onChange={e=>setFormPart(f=>f&&({...f,merk:e.target.value}))}/><datalist id="mm-merk">{['Husky','Schneider','SMC','Omron','Misumi','Parker','Festo','Bosch','SKF','NSK','Keyence'].map(b=><option key={b} value={b}/>)}</datalist><div style={{fontSize:'11px',color:'var(--mcc-text-muted)',marginTop:'3px'}}>Nama sama beda merk = stok digabung, merk dicatat di sini.</div></div>
              {/* Kategori dihapus dari form: otomatis mengikuti mesin */}
              <div><label style={G.lbl}>Rak *</label><input list="mm-bin" style={{...G.inp,...(errPart?.kolom.includes('nomor_bin')?{borderColor:'#c62828',background:'#fff5f5'}:{})}} placeholder="mis. VM2-212 (wajib)" value={formPart.nomor_bin} onChange={e=>{const v=e.target.value;setFormPart(f=>f&&({...f,nomor_bin:v}));const info=lokasi.bins.find(x=>x.nomor_bin.toLowerCase()===v.trim().toLowerCase());if(info?.rak_kode)setRakPart({kode:info.rak_kode,tingkat:info.tingkat?String(info.tingkat):''});}}/>
                <datalist id="mm-bin">{lokasi.bins.map(b=><option key={b.nomor_bin} value={b.nomor_bin}/>)}</datalist></div>
              {!formPart.id&&<div style={{fontSize:'12px',lineHeight:1.5,color:'var(--mcc-text-muted)',alignSelf:'end',paddingBottom:'6px'}}>Stok part baru dimulai dari 0. Jumlah barangnya diisi lewat menu <b>Part In</b> supaya tercatat di kartu stok dan tidak terhitung dua kali.</div>}
              <div><label style={G.lbl}>Min stok (batas pesan ulang){formPart.id&&minUnitTotal!=null&&<span style={{fontWeight:400,color:'var(--mcc-text-muted)'}}> · otomatis dari min per unit</span>}</label><input type="number" min={0} readOnly={!!formPart.id&&minUnitTotal!=null} style={{...G.inp,...(formPart.id&&minUnitTotal!=null?{background:'#f3f6fa'}:{})}} placeholder="Stok ≤ angka ini = warning" value={formPart.reorder_point} onChange={e=>setFormPart(f=>f&&({...f,reorder_point:e.target.value}))}/></div>
              <div><label style={G.lbl}>Harga satuan (Rp / pcs)</label><input inputMode="decimal" style={G.inp} value={formPart.harga_satuan??''} onChange={e=>setFormPart(f=>f&&({...f,harga_satuan:e.target.value}))} placeholder="mis. 125000"/></div>
              <div><label style={G.lbl}>Kategori</label><select style={{...G.inp,cursor:'pointer'}} value={formPart.is_critical?'critical':'normal'} onChange={e=>setFormPart(f=>f&&({...f,is_critical:e.target.value==='critical'}))}><option value="normal">Normal</option><option value="critical">Critical</option></select></div>
              <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'14px',alignSelf:'end',paddingBottom:'10px'}}><input type="checkbox" checked={!!formPart.is_consumable} disabled={modeCons&&!formPart.id} onChange={e=>setFormPart(f=>f&&({...f,is_consumable:e.target.checked}))}/>Consumable part</label>
              {formPart.id&&<div style={{gridColumn:'1/-1'}}><KartuStok partId={formPart.id} namaPart={formPart.nama_part}/></div>}
              {formPart.id&&<div style={{gridColumn:'1/-1'}}><JatahEditor partId={formPart.id} jenis={jenis} utamaId={(formPart as any).mesin_jenis_id?Number((formPart as any).mesin_jenis_id):(jenisAktif?.id||null)}/></div>}
              {formPart.id&&<div style={{gridColumn:'1/-1'}}><MinPerUnit key={formPart.id} partId={formPart.id} onTotal={t=>{setMinUnitTotal(t);if(t!=null)setFormPart(f=>f&&({...f,reorder_point:String(t)}));}}/></div>}
              {formPart.id&&<div style={{gridColumn:'1/-1'}}><GabungPart partId={formPart.id} namaPart={formPart.nama_part} onSelesai={m=>{kabar('ok',m);setFormPart(null);segarkan();}}/></div>}
              <div style={{gridColumn:'1/-1'}}><label style={G.lbl}>Foto spare part</label><PartImageUpload key={formPart.id||'baru'} awal={formPart.foto_url||null} onUrl={url=>setFormPart(f=>f&&({...f,foto_url:url}))}/></div>
              {errPart&&<div role="alert" style={{gridColumn:'1/-1',padding:'10px 12px',borderRadius:'6px',background:'#fdecec',border:'1px solid #f3c2c2',color:'#c62828',fontSize:'14px',fontWeight:600}}>{errPart.pesan}</div>}
              <div style={{gridColumn:'1/-1',display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                {formPart.id&&<span style={{flex:1,fontSize:'12px',color:'var(--mcc-text-muted)',alignSelf:'center'}}>Stok diubah lewat Part In / Part Out supaya tercatat di riwayat.</span>}
                {formPart.id&&<button type="button" className="mcc-btn-secondary" style={{color:'#c62828',borderColor:'rgba(198,40,40,0.4)'}} disabled={sibuk} onClick={async()=>{
                  if(!await tanya({judul:`Hapus "${formPart.nama_part}"?`,pesan:'Part dihapus dari master data: hilang dari Kelola part, Part In, Katalog dan web Teknisi. Riwayat transaksinya tetap tersimpan untuk audit.\n\nHanya bisa kalau stok 0 dan tidak ada request yang belum selesai. Cocok untuk part percobaan / salah daftar.',oke:'Hapus part',bahaya:true}))return;
                  const d=await kirim({aksi:'part_hapus_master',id:formPart.id});if(d.success){setFormPart(null);setErrPart(null);segarkan();}else setErrPart({pesan:d.error||'Gagal menghapus',kolom:[]});}}>Hapus part</button>}
                <button type="button" className="mcc-btn-secondary" onClick={()=>{setFormPart(null);setErrPart(null);}}>Batal</button>
                <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={simpanPart}>{sibuk?'Menyimpan...':'Simpan part'}</button>
              </div>
            </div>
          )}

          {/* Aksi massal */}
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',fontSize:'13px',color:'var(--mcc-text-muted)'}}>
            <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer'}}><input type="checkbox" checked={semuaTerpilih} onChange={toggleSemua}/>Pilih semua yang tampil ({partsTampil.length})</label>
            <span>· {dipilih.size} dipilih</span>
            <div style={{flex:1}}/>
            {pilihanTujuan}
            <button type="button" className="mcc-btn-primary" disabled={sibuk||!dipilih.size||!tujuan} onClick={()=>tetapkan(Number(tujuan))}>{modeTanpa||modeCons?'Tetapkan ke mesin':'Pindahkan ke mesin'}</button>
            {!modeTanpa&&!modeCons&&<button type="button" className="mcc-btn-secondary" disabled={sibuk||!dipilih.size} onClick={async ()=>{if(await tanya(`Lepas ${dipilih.size} part dari ${jenisAktif?.nama}?`))tetapkan(null);}}>Lepas dari mesin</button>}
            <button type="button" className="mcc-btn-secondary" style={{color:'#c62828',borderColor:'rgba(198,40,40,0.4)'}} disabled={sibuk||!dipilih.size} onClick={async ()=>{
              if(!await tanya({judul:`Hapus ${dipilih.size} part terpilih?`,pesan:'Part dihapus dari master data (hilang dari Kelola part, Part In, Katalog, web Teknisi). Riwayatnya tetap tersimpan dan namanya bisa dipakai lagi.\n\nPart yang stoknya masih ada atau punya request belum selesai TIDAK ikut dihapus.',oke:'Hapus part',bahaya:true}))return;
              const d=await kirim({aksi:'part_hapus_master',ids:Array.from(dipilih)});if(d.success){setDipilih(new Set());segarkan();}}}>Hapus terpilih</button>
          </div>

          <div style={{maxHeight:'560px',overflowY:'auto',border:'1px solid var(--mcc-border)',borderRadius:'6px'}}>
            <table className="mcc-table" style={{width:'100%'}}>
              <thead><tr><th style={{width:'32px'}}></th><th>Nama part</th><th>12NC</th><th>Merk</th><th>Kategori{modeTanpa?' / mesin lama':modeCons?' / mesin':''}</th><th>Bin · rak</th><th style={{textAlign:'right'}}>Stok / min</th><th style={{textAlign:'right'}}>Harga</th><th></th></tr></thead>
              <tbody>
                {parts===null&&<tr><td colSpan={9} style={{padding:'20px',textAlign:'center',color:'var(--mcc-text-muted)'}}>Memuat...</td></tr>}
                {parts&&partsTampil.length===0&&<tr><td colSpan={9} style={{padding:'20px',textAlign:'center',color:'var(--mcc-text-muted)'}}>Tidak ada part</td></tr>}
                {partsTampil.map(p=>{
                  const warn=p.stok_saat_ini<=p.reorder_point;
                  return (
                    <tr key={p.id} style={{background:dipilih.has(p.id)?'var(--mcc-blue-soft)':undefined}}>
                      <td><input type="checkbox" checked={dipilih.has(p.id)} onChange={()=>toggle(p.id)} aria-label={`Pilih ${p.nama_part}`}/></td>
                      <td style={{fontWeight:600}}><span style={{display:'flex',alignItems:'center',gap:'10px'}}>{p.foto_url?<img src={p.foto_url} alt="" style={{width:'36px',height:'36px',objectFit:'cover',borderRadius:'6px',flexShrink:0}}/>:<span style={{width:'36px',height:'36px',borderRadius:'6px',background:'#eef3fb',flexShrink:0,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>🔩</span>}<span>{p.nama_part}{!!p.is_consumable&&!modeCons&&<span style={{marginLeft:'6px',fontSize:'11px',color:'#b45309'}}>consumable</span>}{(p.jumlah_mesin_pakai||0)>=2&&<span style={{marginLeft:'6px',fontSize:'11px',color:'#0b5ed7'}}>dipakai {p.jumlah_mesin_pakai} mesin</span>}</span></span></td>
                      <td>{p.kode_12nc||'-'}</td>
                      <td style={{color:p.merk?undefined:'var(--mcc-text-muted)'}}>{p.merk||'-'}</td>
                      <td style={{whiteSpace:'nowrap'}}><KatBadge critical={!!p.is_critical}/>{modeTanpa&&p.mesin?<span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}> · {p.mesin}</span>:null}{modeCons?<span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}> · {p.mesin_jenis_nama||'umum'}</span>:null}</td>
                      <td style={{whiteSpace:'nowrap'}}>{p.nomor_bin||'-'}{p.rak_kode?` · Rak ${p.rak_kode}${p.rak_tingkat?` S${p.rak_tingkat}`:''}`:''}</td>
                      <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:warn?'#c62828':undefined,fontWeight:warn?700:400}}>{p.stok_saat_ini} / {p.reorder_point}</td>
                      <td style={{textAlign:'right',whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',color:p.harga_satuan==null?'var(--mcc-text-muted)':undefined}}>{fmtHarga(p.harga_satuan)}</td>
                      <td>{<button type="button" className="mcc-link-btn" onClick={()=>{setFormPart({id:p.id,nama_part:p.nama_part,kode_12nc:p.kode_12nc||'',kategori:p.kategori,nomor_bin:p.nomor_bin||'',stok_saat_ini:String(p.stok_saat_ini),reorder_point:String(p.reorder_point),is_critical:!!p.is_critical,foto_url:p.foto_url||'',harga_satuan:p.harga_satuan==null?'':String(p.harga_satuan),is_consumable:!!p.is_consumable,mesin_jenis_id:p.mesin_jenis_id?String(p.mesin_jenis_id):'',merk:p.merk||''});setRakPart({kode:p.rak_kode||'',tingkat:p.rak_tingkat?String(p.rak_tingkat):''});}}>Ubah</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ===== Order spare part (Tahap 3): alur status ala Shopee, tersimpan di database =====
const ORDER_LANGKAH = [
  { key:'request',        label:'Request' },
  { key:'approval',       label:'Disetujui' },
  { key:'submit',         label:'Submit' },
  { key:'menunggu_buyer', label:'Proses buyer' },
  { key:'pilih_supplier', label:'Supplier' },
  { key:'pr',             label:'PR' },
  { key:'admin_order',    label:'Dipesan' },
  { key:'po',             label:'PO' },
  { key:'selesai',        label:'Diterima' },
] as const;
const ORDER_TAB = [
  { id:'buat',     label:'Order spare part', status:[] as string[] },
  { id:'semua',    label:'Semua',            status:[] as string[] },
  { id:'setuju',   label:'Menunggu persetujuan', status:['request'] },
  { id:'buyer',    label:'Diproses buyer',   status:['approval','submit','menunggu_buyer','pilih_supplier','pr'] },
  { id:'dipesan',  label:'Dipesan',          status:['admin_order','po'] },
  { id:'selesai',  label:'Selesai',          status:['selesai'] },
  { id:'batal',    label:'Dibatalkan',       status:['batal'] },
];
const AKSI_BERIKUT: Record<string,string> = {
  request:'Setujui order', approval:'Submit ke buyer', submit:'Buyer mulai proses', menunggu_buyer:'Simpan pilihan supplier',
  pilih_supplier:'Simpan nomor PR', pr:'Tandai sudah dipesan', admin_order:'Simpan nomor PO', po:'Terima barang',
};
const fmtTgl=(v:any)=>v?tglDb(v).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-';
const fmtRp=(n:number)=>'Rp '+Math.round(n).toLocaleString('id-ID');
// Request dari mesin di luar tanggung jawab teknisi (dikirim web Teknisi: "<mesin> · Luar tugas: <alasan>")
const luarTugasDari=(area:any):{mesin:string;alasan:string}|null=>{const m=/^(.*?)\s*·\s*Luar tugas:\s*(.*)$/.exec(String(area||''));return m?{mesin:m[1].trim(),alasan:m[2].trim()}:null;};
function BannerLuarTugas({area}:{area:any}){const x=luarTugasDari(area);if(!x)return null;return(
  <div style={{background:'rgba(178,106,0,0.12)',border:'1px solid rgba(178,106,0,0.45)',borderRadius:'6px',padding:'5px 10px',fontSize:'11px',fontWeight:700,color:'#8a5a00',margin:'4px 0 6px',lineHeight:1.4}}>
    ⚠ DI LUAR MESIN TANGGUNG JAWAB — {x.mesin}. Alasan: “{x.alasan}”. Konfirmasi ke teknisi sebelum disiapkan.
  </div>);}

function OrderPage({ partsList, namaUser, onStokBerubah }:{ partsList:any[]; namaUser:string; onStokBerubah:()=>void }) {
  const [tab,setTab]=useState('buat');
  const [orders,setOrders]=useState<any[]>([]);
  const [error,setError]=useState('');
  const [keranjang,setKeranjang]=useState<{part:any;qty:number}[]>([]);
  const [catatan,setCatatan]=useState('');
  const [cariPart,setCariPart]=useState('');
  const [buka,setBuka]=useState<number|null>(null);
  const [isian,setIsian]=useState<any>({});
  const [sibuk,setSibuk]=useState(false);
  const [pesan,setPesan]=useState<{type:'ok'|'err';text:string}|null>(null);
  const kabar=(type:'ok'|'err',text:string)=>{setPesan({type,text});setTimeout(()=>setPesan(null),3500);};
  const muat=()=>fetch('/api/order').then(r=>r.json()).then(d=>{if(d.success){setOrders(d.data||[]);setError('');}else setError(d.error||'Gagal memuat order');}).catch(()=>setError('Gagal memuat order'));
  useEffect(()=>{muat();},[]);

  const kirim=async(body:any)=>{
    setSibuk(true);
    try{const d=await fetch('/api/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,oleh:namaUser||'Admin'})}).then(r=>r.json());
      if(d.success){kabar('ok',d.message);muat();}else kabar('err',d.error||'Gagal');return d;
    }catch{kabar('err','Gagal menyimpan');return {success:false};}finally{setSibuk(false);}
  };

  const hitung=(t:typeof ORDER_TAB[number])=>t.id==='buat'?keranjang.length:t.id==='semua'?orders.length:orders.filter(o=>t.status.includes(o.status)).length;
  const tabAktif=ORDER_TAB.find(t=>t.id===tab)!;
  const daftar=tab==='semua'?orders:orders.filter(o=>tabAktif.status.includes(o.status));
  const sedangDiorder=new Set(orders.filter(o=>o.status!=='selesai'&&o.status!=='batal').flatMap(o=>o.items.map((i:any)=>i.spare_part_id)));

  // ── Buat order ──
  const warning=partsList.filter(p=>(p.stok_saat_ini??0)<=(p.reorder_point??0));
  const q=cariPart.trim().toLowerCase();
  const kandidat=(q?partsList.filter(p=>String(p.nama_part||'').toLowerCase().includes(q)||String(p.kode_12nc||'').toLowerCase().includes(q)):warning).slice(0,60);
  const saran=(p:any)=>Math.max(1,(p.reorder_point*3)-(p.stok_saat_ini||0));
  const diKeranjang=(id:number)=>keranjang.some(k=>k.part.id===id);
  const tambah=(p:any)=>setKeranjang(k=>diKeranjang(p.id)?k:[...k,{part:p,qty:saran(p)}]);
  const buatOrder=async()=>{
    const d=await kirim({aksi:'buat',catatan,items:keranjang.map(k=>({spare_part_id:k.part.id,qty:k.qty}))});
    if(d.success){setKeranjang([]);setCatatan('');setTab('setuju');}
  };

  const isi=(id:number,k:string,v:any)=>setIsian((s:any)=>({...s,[id]:{...(s[id]||{}),[k]:v}}));
  const maju=async(o:any)=>{
    const f=isian[o.id]||{};
    if(o.status==='po'){
      const items=o.items.map((i:any)=>({item_id:i.id,qty_diterima:f[`terima_${i.id}`]??i.qty}));
      const d=await kirim({aksi:'terima',id:o.id,nomor_do:f.nomor_do||'',items});
      if(d.success){onStokBerubah();setIsian((s:any)=>({...s,[o.id]:{}}));}
      return;
    }
    const harga:Record<string,number>={};
    o.items.forEach((i:any)=>{const v=f[`harga_${i.id}`];if(v!==undefined&&v!=='')harga[i.id]=Number(v);});
    const d=await kirim({aksi:'maju',id:o.id,supplier_nama:f.supplier_nama,harga,nomor_pr:f.nomor_pr,nomor_po:f.nomor_po,eta:f.eta});
    if(d.success)setIsian((s:any)=>({...s,[o.id]:{}}));
  };
  const batal=async(o:any)=>{const al=prompt(`Alasan membatalkan ${o.nomor_order}?`);if(!al)return;await kirim({aksi:'batal',id:o.id,alasan:al});};

  const Stepper=({o}:{o:any})=>{
    const idx=o.status==='batal'?-1:ORDER_LANGKAH.findIndex(l=>l.key===o.status);
    const waktu=(k:string)=>o.log.filter((l:any)=>l.status===k).slice(-1)[0]?.waktu;
    return (
      <div style={{display:'grid',gridTemplateColumns:`repeat(${ORDER_LANGKAH.length},minmax(0,1fr))`,alignItems:'start'}}>
        {ORDER_LANGKAH.map((l,i)=>{
          const done=i<=idx, now=i===idx;
          return (
            <div key={l.key} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',position:'relative'}}>
              {i>0&&<div style={{position:'absolute',top:'9px',right:'50%',width:'100%',height:'2px',background:i<=idx?'var(--mcc-blue)':'#e1e6ed'}}/>}
              <div style={{position:'relative',zIndex:1,width:'20px',height:'20px',borderRadius:'50%',background:done?'var(--mcc-blue)':'#fff',border:`2px solid ${done?'var(--mcc-blue)':'#cfd6df'}`,boxShadow:now?'0 0 0 4px var(--mcc-blue-soft)':'none',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'11px',fontWeight:700}}>{done&&!now?'✓':''}</div>
              <div style={{fontSize:'11px',fontWeight:now?700:500,color:done?'var(--mcc-text)':'var(--mcc-text-muted)',textAlign:'center',lineHeight:1.2}}>{l.label}</div>
              {waktu(l.key)&&<div style={{fontSize:'10px',color:'var(--mcc-text-muted)',textAlign:'center'}}>{new Date(waktu(l.key)).toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}</div>}
            </div>
          );
        })}
      </div>
    );
  };

  if(error)return <div style={{padding:'32px'}}><div style={{...G.card,padding:'20px',color:'#c62828'}}>{error}. Pastikan migrasi 07 sudah dijalankan.</div></div>;

  return (
    <div style={{padding:'24px 32px',display:'flex',flexDirection:'column',gap:'16px'}}>
      {pesan&&<div role="status" className="mcc-fade-in" style={{position:'fixed',top:'20px',right:'24px',zIndex:1000,padding:'10px 16px',borderRadius:'8px',fontSize:'14px',fontWeight:600,background:pesan.type==='ok'?'#e8f4ec':'#fdecec',color:pesan.type==='ok'?'#1e7e34':'#c62828',border:`1px solid ${pesan.type==='ok'?'#b9dcc4':'#f3c2c2'}`}}>{pesan.text}</div>}

      {/* Tab status ala Shopee */}
      <div role="tablist" style={{...G.card,display:'flex',overflowX:'auto'}}>
        {ORDER_TAB.map(t=>{
          const on=tab===t.id, n=hitung(t);
          return (
            <button key={t.id} role="tab" aria-selected={on} onClick={()=>{setTab(t.id);setBuka(null);}}
              style={{flex:'1 0 auto',padding:'14px 16px',border:'none',borderBottom:`3px solid ${on?'var(--mcc-blue)':'transparent'}`,background:'transparent',font:'inherit',fontSize:'14px',fontWeight:on?700:500,color:on?'var(--mcc-blue)':'var(--mcc-text)',cursor:'pointer',whiteSpace:'nowrap'}}>
              {t.label}{n>0&&<span style={{marginLeft:'6px',fontSize:'12px',padding:'1px 7px',borderRadius:'10px',background:on?'var(--mcc-blue)':'#eef1f5',color:on?'#fff':'var(--mcc-text-muted)'}}>{n}</span>}
            </button>
          );
        })}
      </div>

      {/* ── Buat order ── */}
      {tab==='buat'&&(
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,3fr) minmax(0,2fr)',gap:'16px',alignItems:'start'}}>
          <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
            <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
              <h3 style={{margin:0,fontSize:'16px',fontWeight:700,flex:1}}>{q?'Hasil pencarian':`Part yang perlu dipesan (${warning.length})`}</h3>
              <input style={{...G.inp,width:'280px'}} placeholder="Cari part lain (nama / 12NC)" value={cariPart} onChange={e=>setCariPart(e.target.value)}/>
            </div>
            <div style={{maxHeight:'560px',overflowY:'auto',border:'1px solid var(--mcc-border)',borderRadius:'6px'}}>
              <table className="mcc-table" style={{width:'100%'}}>
                <thead><tr><th>Part</th><th style={{textAlign:'right'}}>Stok / min</th><th style={{textAlign:'right'}}>Saran</th><th></th></tr></thead>
                <tbody>
                  {kandidat.length===0&&<tr><td colSpan={4} style={{padding:'20px',textAlign:'center',color:'var(--mcc-text-muted)'}}>{q?'Part tidak ditemukan':'Semua stok aman'}</td></tr>}
                  {kandidat.map(p=>(
                    <tr key={p.id}>
                      <td><div style={{fontWeight:600}}>{p.nama_part}</div><div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{p.kode_12nc||'-'} · {p.nomor_bin||'-'}{sedangDiorder.has(p.id)&&<span style={{color:'#8a5a00'}}> · sudah ada di order berjalan</span>}</div></td>
                      <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:(p.stok_saat_ini??0)<=(p.reorder_point??0)?'#c62828':undefined}}>{p.stok_saat_ini??0} / {p.reorder_point??0}</td>
                      <td style={{textAlign:'right'}}>{saran(p)}</td>
                      <td style={{textAlign:'right',width:'56px'}}>{diKeranjang(p.id)
                        ?<span title="Sudah di keranjang" aria-label="Sudah di keranjang" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'36px',height:'36px',borderRadius:'8px',background:'var(--mcc-blue-soft)',color:'var(--mcc-blue)',fontSize:'16px',fontWeight:700}}>✓</span>
                        :<button type="button" title="Tambah ke keranjang" aria-label={`Tambah ${p.nama_part} ke keranjang`} onClick={()=>tambah(p)} style={{width:'36px',height:'36px',borderRadius:'8px',border:'1px solid var(--mcc-blue)',background:'var(--mcc-surface)',color:'var(--mcc-blue)',fontSize:'20px',lineHeight:1,fontWeight:600,cursor:'pointer',padding:0}}>+</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Saran = 3 × min stok − stok sekarang (rumus yang sama dengan halaman lama).</div>
          </section>

          <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px',position:'sticky',top:'16px'}}>
            <h3 style={{margin:0,fontSize:'16px',fontWeight:700}}>Keranjang order ({keranjang.length})</h3>
            {keranjang.length===0?<div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Tambahkan part dari daftar di kiri.</div>:(
              <div style={{display:'flex',flexDirection:'column',maxHeight:'380px',overflowY:'auto'}}>
                {keranjang.map((k,i)=>(
                  <div key={k.part.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid #eef1f5'}}>
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:'14px',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{k.part.nama_part}</div><div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Stok {k.part.stok_saat_ini??0}</div></div>
                    <input type="number" min={1} style={{...G.inp,width:'80px'}} value={k.qty} onChange={e=>{const v=Math.max(1,parseInt(e.target.value)||1);setKeranjang(c=>c.map((x,j)=>j===i?{...x,qty:v}:x));}} aria-label="Jumlah"/>
                    <button type="button" className="mcc-link-btn" style={{color:'#c62828'}} onClick={()=>setKeranjang(c=>c.filter((_,j)=>j!==i))}>Hapus</button>
                  </div>
                ))}
              </div>
            )}
            <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Catatan order<textarea style={{...G.inp,marginTop:'6px',height:'60px',resize:'vertical'}} value={catatan} onChange={e=>setCatatan(e.target.value)} placeholder="mis. untuk perbaikan mesin Aoki 3"/></label>
            <button type="button" className="mcc-btn-primary" disabled={sibuk||!keranjang.length} onClick={buatOrder}>{sibuk?'Mengirim...':'Kirim request order'}</button>
          </section>
        </div>
      )}

      {/* ── Daftar order per status ── */}
      {tab!=='buat'&&(
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {daftar.length===0&&<div style={{...G.card,padding:'32px',textAlign:'center',color:'var(--mcc-text-muted)'}}>Belum ada order di sini.</div>}
          {daftar.map(o=>{
            const f=isian[o.id]||{};
            const total=o.items.reduce((s:number,i:any)=>s+(i.harga_satuan!=null?Number(i.harga_satuan)*i.qty:0),0);
            const terbuka=buka===o.id;
            const st=ORDER_LANGKAH.find(l=>l.key===o.status);
            return (
              <article key={o.id} style={{...G.card,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:'1px solid #eef1f5',display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                  <span style={{fontWeight:700}}>{o.nomor_order}</span>
                  <span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{fmtTgl(o.created_at)} · {o.dibuat_oleh||'-'}</span>
                  {o.supplier_nama&&<span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>· {o.supplier_nama}</span>}
                  <div style={{flex:1}}/>
                  <span style={{fontSize:'13px',fontWeight:700,color:o.status==='batal'?'#c62828':o.status==='selesai'?'#1e7e34':'var(--mcc-blue)',textTransform:'uppercase',letterSpacing:'0.3px'}}>{o.status==='batal'?'Dibatalkan':st?.label}</span>
                </div>
                <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:'6px'}}>
                  {o.items.slice(0,terbuka?undefined:3).map((i:any)=>(
                    <div key={i.id} style={{display:'flex',justifyContent:'space-between',gap:'12px',fontSize:'14px'}}>
                      <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.nama_part}<span style={{color:'var(--mcc-text-muted)'}}> · {i.kode_12nc||'-'}</span></span>
                      <span style={{whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums'}}>x{i.qty}{i.harga_satuan!=null&&<span style={{color:'var(--mcc-text-muted)'}}> · {fmtRp(Number(i.harga_satuan))}</span>}{i.qty_diterima!=null&&<span style={{color:'#1e7e34'}}> · diterima {i.qty_diterima}</span>}</span>
                    </div>
                  ))}
                  {!terbuka&&o.items.length>3&&<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>+{o.items.length-3} part lainnya</div>}
                  {total>0&&<div style={{textAlign:'right',fontSize:'14px'}}>Total: <strong>{fmtRp(total)}</strong></div>}
                </div>
                {o.status!=='batal'&&<div style={{padding:'8px 16px 14px'}}><Stepper o={o}/></div>}
                {o.status==='batal'&&<div style={{padding:'0 16px 12px',fontSize:'13px',color:'#c62828'}}>Alasan: {o.alasan_batal}</div>}

                {terbuka&&(
                  <div style={{padding:'12px 16px',borderTop:'1px solid #eef1f5',background:'#fafbfc',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:700,marginBottom:'6px'}}>Detail</div>
                      <div style={{fontSize:'13px',color:'var(--mcc-text-muted)',display:'grid',gap:'3px'}}>
                        <span>Catatan: {o.catatan||'-'}</span><span>Nomor PR: {o.nomor_pr||'-'}</span><span>Nomor PO: {o.nomor_po||'-'}</span>
                        <span>Perkiraan tiba: {o.eta?tglDb(o.eta).toLocaleDateString('id-ID'):'-'}</span><span>Nomor DO: {o.nomor_do||'-'}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize:'13px',fontWeight:700,marginBottom:'6px'}}>Riwayat status</div>
                      <div style={{display:'flex',flexDirection:'column',gap:'6px',maxHeight:'200px',overflowY:'auto'}}>
                        {[...o.log].reverse().map((l:any)=>(
                          <div key={l.id} style={{fontSize:'13px',borderLeft:'2px solid var(--mcc-blue)',paddingLeft:'8px'}}>
                            <div style={{fontWeight:600}}>{ORDER_LANGKAH.find(x=>x.key===l.status)?.label||(l.status==='batal'?'Dibatalkan':l.status)} <span style={{fontWeight:400,color:'var(--mcc-text-muted)'}}>· {fmtTgl(l.waktu)} · {l.oleh||'-'}</span></div>
                            {l.keterangan&&<div style={{color:'var(--mcc-text-muted)'}}>{l.keterangan}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Isian untuk langkah berikutnya */}
                {o.status!=='selesai'&&o.status!=='batal'&&(
                  <div style={{padding:'12px 16px',borderTop:'1px solid #eef1f5',display:'flex',gap:'10px',alignItems:'flex-end',flexWrap:'wrap'}}>
                    {o.status==='menunggu_buyer'&&(<>
                      <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Supplier *<input style={{...G.inp,marginTop:'6px',width:'220px'}} value={f.supplier_nama||''} onChange={e=>isi(o.id,'supplier_nama',e.target.value)} placeholder="PT ..."/></label>
                      {o.items.map((i:any)=>(
                        <label key={i.id} style={{fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)',maxWidth:'200px'}}><span style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Harga satuan · {i.nama_part}</span>
                          <input type="number" min={0} style={{...G.inp,marginTop:'6px',width:'180px'}} value={f[`harga_${i.id}`]??''} onChange={e=>isi(o.id,`harga_${i.id}`,e.target.value)} placeholder="Rp"/></label>
                      ))}
                    </>)}
                    {o.status==='pilih_supplier'&&<label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Nomor PR *<input style={{...G.inp,marginTop:'6px',width:'220px'}} value={f.nomor_pr||''} onChange={e=>isi(o.id,'nomor_pr',e.target.value)}/></label>}
                    {o.status==='admin_order'&&(<>
                      <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Nomor PO *<input style={{...G.inp,marginTop:'6px',width:'220px'}} value={f.nomor_po||''} onChange={e=>isi(o.id,'nomor_po',e.target.value)}/></label>
                      <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Perkiraan tiba<input type="date" style={{...G.inp,marginTop:'6px',width:'170px'}} value={f.eta||''} onChange={e=>isi(o.id,'eta',e.target.value)}/></label>
                    </>)}
                    {o.status==='po'&&(<>
                      <label style={{display:'flex',flexDirection:'column',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Nomor DO<input style={{...G.inp,marginTop:'6px',width:'200px'}} value={f.nomor_do||''} onChange={e=>isi(o.id,'nomor_do',e.target.value)}/></label>
                      {o.items.map((i:any)=>(
                        <label key={i.id} style={{fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)',maxWidth:'200px'}}><span style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Diterima · {i.nama_part}</span>
                          <input type="number" min={0} style={{...G.inp,marginTop:'6px',width:'120px'}} value={f[`terima_${i.id}`]??i.qty} onChange={e=>isi(o.id,`terima_${i.id}`,e.target.value)}/></label>
                      ))}
                    </>)}
                    <div style={{flex:1}}/>
                    <button type="button" className="mcc-link-btn" onClick={()=>setBuka(terbuka?null:o.id)}>{terbuka?'Tutup detail':'Lihat detail'}</button>
                    <button type="button" className="mcc-btn-secondary" disabled={sibuk} onClick={()=>batal(o)}>Batalkan</button>
                    <button type="button" className="mcc-btn-primary" disabled={sibuk} onClick={()=>maju(o)}>{AKSI_BERIKUT[o.status]}</button>
                  </div>
                )}
                {(o.status==='selesai'||o.status==='batal')&&(
                  <div style={{padding:'8px 16px 12px',display:'flex',justifyContent:'flex-end'}}><button type="button" className="mcc-link-btn" onClick={()=>setBuka(terbuka?null:o.id)}>{terbuka?'Tutup detail':'Lihat detail'}</button></div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== Riwayat per mesin (Tahap 4): Molding/Non-molding -> mesin -> unit -> spare part =====
const TIPE_TRX: Record<string,{label:string;warna:string;tanda:string}> = {
  in:{label:'Masuk',warna:'#1e7e34',tanda:'+'}, out:{label:'Keluar',warna:'#c62828',tanda:'−'}, return:{label:'Return',warna:'#8a5a00',tanda:'−'},
};
function RiwayatMesin({ onTampilanLama }:{ onTampilanLama:()=>void }) {
  const isoHari=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; // tanggal lokal (WIB)
  const [dari,setDari]=useState(()=>isoHari(new Date(Date.now()-30*86400000)));
  const [sampai,setSampai]=useState(()=>isoHari(new Date()));
  const [tipe,setTipe]=useState<'semua'|'in'|'out'|'return'>('semua');
  const [rows,setRows]=useState<any[]|null>(null);
  const [error,setError]=useState('');
  const [area,setArea]=useState<string|null>(null);
  const [jenisId,setJenisId]=useState<number|'tanpa'|null>(null);
  const [unitId,setUnitId]=useState<number|'semua'|'kosong'>('semua');
  const [cari,setCari]=useState('');
  const [bukaPart,setBukaPart]=useState<number|null>(null);
  const [foto,setFoto]=useState<{judul:string;loading:boolean;list:{label:string;src:string;ket?:string}[];pesan?:string}|null>(null);
  const lihatFoto=async(r:any)=>{
    const judul=`${r.nama_part||'-'} · ${TIPE_TRX[r.tipe]?.label||''} ${tglDb(r.tanggal).toLocaleDateString('id-ID')}`;
    setFoto({judul,loading:true,list:[]});
    const list:{label:string;src:string;ket?:string}[]=[];
    try{
      if(r.tipe==='out'&&r.request_id){
        const d=await fetch(`/api/request-foto?request_id=${r.request_id}`).then(x=>x.json());
        const arr=Array.isArray(d)?d:(d.data||[]);
        arr.forEach((f:any)=>{if(f.foto_base64)list.push({label:String(f.tipe_foto||'').toLowerCase()==='siapkan'?'Foto admin saat siapkan':'Foto verifikasi teknisi',src:f.foto_base64,ket:[f.uploaded_by,f.catatan].filter(Boolean).join(' · ')});});
      }
      if(r.tipe==='return'){
        const d=await fetch(`/api/return?foto_id=${r.id}`).then(x=>x.json());
        if(d.success&&d.foto)list.push({label:'Foto barang return',src:d.foto});
      }
    }catch{}
    if(r.foto_part)list.push({label:'Foto spare part',src:r.foto_part});
    setFoto({judul,loading:false,list,pesan:list.length?undefined:r.tipe==='in'?'Part In tidak menyimpan foto transaksi, dan part ini belum punya foto.':'Tidak ada foto untuk transaksi ini.'});
  };

  useEffect(()=>{
    let batal=false; setRows(null);
    fetch(`/api/riwayat?dari=${dari}&sampai=${sampai}`).then(r=>r.json()).then(d=>{if(batal)return;if(d.success){setRows(d.data||[]);setError('');}else setError(d.error||'Gagal memuat riwayat');}).catch(()=>{if(!batal)setError('Gagal memuat riwayat');});
    return()=>{batal=true;};
  },[dari,sampai]);
  useEffect(()=>{setUnitId('semua');setBukaPart(null);},[jenisId]);

  const semua=(rows||[]).filter(r=>tipe==='semua'||r.tipe===tipe);
  const areaOf=(r:any)=>r.area||'Tanpa mesin';
  const ringkas=(list:any[])=>({
    masuk:list.filter(r=>r.tipe==='in').reduce((s,r)=>s+r.jumlah,0),
    keluar:list.filter(r=>r.tipe==='out').reduce((s,r)=>s+r.jumlah,0),
    ret:list.filter(r=>r.tipe==='return').reduce((s,r)=>s+r.jumlah,0),
    n:list.length,
  });
  const Angka=({x}:{x:ReturnType<typeof ringkas>})=>(
    <span style={{display:'flex',gap:'10px',fontSize:'13px',fontVariantNumeric:'tabular-nums'}}>
      <span style={{color:'#1e7e34'}}>+{x.masuk} masuk</span><span style={{color:'#c62828'}}>−{x.keluar} keluar</span>{x.ret>0&&<span style={{color:'#8a5a00'}}>−{x.ret} return</span>}
    </span>
  );

  const diArea=area?semua.filter(r=>areaOf(r)===area):[];
  const jenisList=Array.from(new Map(diArea.filter(r=>r.jenis_id).map(r=>[r.jenis_id,r.jenis_nama])).entries()).sort((a,b)=>String(a[1]).localeCompare(String(b[1])));
  const diJenis=jenisId==null?[]:jenisId==='tanpa'?semua.filter(r=>!r.jenis_id):semua.filter(r=>r.jenis_id===jenisId);
  const unitList=Array.from(new Map(diJenis.filter(r=>r.unit_id).map(r=>[r.unit_id,r.nomor_unit])).entries()).sort((a,b)=>String(a[1]).localeCompare(String(b[1]),undefined,{numeric:true}));
  const q=cari.trim().toLowerCase();
  const diUnit=diJenis.filter(r=>unitId==='semua'||(unitId==='kosong'?!r.unit_id:r.unit_id===unitId))
    .filter(r=>!q||String(r.nama_part||'').toLowerCase().includes(q)||String(r.kode_12nc||'').toLowerCase().includes(q)||String(r.ref||'').toLowerCase().includes(q)||String(r.oleh||'').toLowerCase().includes(q));
  const grupPart=new Map<number,any[]>(); diUnit.forEach(r=>{const k=r.spare_part_id;if(!grupPart.has(k))grupPart.set(k,[]);grupPart.get(k)!.push(r);});
  const perPart=Array.from(grupPart.entries())
    .map(([id,list])=>({id,nama:list[0].nama_part||'(part terhapus)',kode:list[0].kode_12nc,bin:list[0].nomor_bin,list,x:ringkas(list)}))
    .sort((a,b)=>b.x.keluar-a.x.keluar||b.x.n-a.x.n);
  const namaJenis=jenisId==='tanpa'?'Belum punya mesin':jenisList.find(([id])=>id===jenisId)?.[1]||semua.find(r=>r.jenis_id===jenisId)?.jenis_nama;

  const exportCSV=()=>{
    const esc=(v:any)=>{const s=String(v??'');return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
    const data=(jenisId!=null?diUnit:area?diArea:semua);
    const baris=[['Tanggal','Tipe','Area','Mesin','Unit','Part','12NC','Jumlah','Referensi','Oleh'],
      ...data.map(r=>[tglDb(r.tanggal).toLocaleString('id-ID'),TIPE_TRX[r.tipe]?.label,areaOf(r),r.jenis_nama||'-',r.nomor_unit||'-',r.nama_part,r.kode_12nc||'',r.jumlah,r.ref||'',r.oleh||''])];
    const blob=new Blob(['﻿'+baris.map(b=>b.map(esc).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`riwayat-${dari}-sd-${sampai}.csv`;a.click();URL.revokeObjectURL(a.href);
  };

  const exportXLSX=()=>{
    const data=(jenisId!=null?diUnit:area?diArea:semua); const x=ringkas(data);
    unduhXLSX(`riwayat-${dari}-sd-${sampai}.xlsx`,'Riwayat transaksi',`Periode ${dari} s/d ${sampai} · ${x.n} transaksi · Masuk ${x.masuk} pcs · Keluar ${x.keluar} pcs · Return ${x.ret} pcs`,
      ['Tanggal','Tipe','Area','Mesin','Unit','Part','12NC','Rak','Jumlah','Referensi (WO/DO)','Oleh','Keterangan','Foto'],
      data.map(r=>[tglDb(r.tanggal).toLocaleString('id-ID'),TIPE_TRX[r.tipe]?.label,areaOf(r),r.jenis_nama||'-',r.nomor_unit||'-',r.nama_part,r.kode_12nc||'',r.nomor_bin||'',r.tipe==='in'?r.jumlah:-r.jumlah,r.ref||'',r.oleh||'',r.keterangan||'',
        r.tipe==='out'&&r.request_id?'Ada (foto siapkan / verifikasi)':r.tipe==='return'?'Lihat di menu Return':r.foto_part?'Foto part':'-']));
  };
  const crumb=(teks:string,onClick?:()=>void)=>onClick?<button type="button" className="mcc-link-btn" onClick={onClick}>{teks}</button>:<span style={{fontWeight:700,color:'var(--mcc-text)'}}>{teks}</span>;
  const kartu:React.CSSProperties={...G.card,padding:'18px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px'};

  return (
    <div style={{padding:'24px 32px',display:'flex',flexDirection:'column',gap:'16px'}}>
      {/* Filter */}
      <div style={{display:'flex',gap:'12px',alignItems:'flex-end',flexWrap:'wrap'}}>
        <label style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Dari<input type="date" style={{...G.inp,width:'160px'}} value={dari} max={sampai} onChange={e=>e.target.value&&setDari(e.target.value)}/></label>
        <label style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Sampai<input type="date" style={{...G.inp,width:'160px'}} value={sampai} min={dari} onChange={e=>e.target.value&&setSampai(e.target.value)}/></label>
        <div role="group" aria-label="Jenis transaksi" style={{display:'flex',gap:'4px'}}>
          {(['semua','out','in','return'] as const).map(t=>(
            <button key={t} type="button" aria-pressed={tipe===t} onClick={()=>setTipe(t)} style={{padding:'9px 12px',borderRadius:'6px',border:`1px solid ${tipe===t?'var(--mcc-blue)':'var(--mcc-border)'}`,background:tipe===t?'var(--mcc-blue-soft)':'var(--mcc-surface)',color:tipe===t?'var(--mcc-blue)':'var(--mcc-text)',font:'inherit',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>{t==='semua'?'Semua':TIPE_TRX[t].label}</button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <button type="button" className="mcc-btn-primary" disabled={!rows?.length} onClick={exportXLSX}>Unduh Excel (.xlsx)</button>
        <button type="button" className="mcc-btn-secondary" disabled={!rows?.length} onClick={exportCSV}>CSV</button>
        <button type="button" className="mcc-btn-secondary" onClick={onTampilanLama}>Tampilan lama</button>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',fontSize:'15px',color:'var(--mcc-text-muted)'}}>
        {crumb('Riwayat',area?()=>{setArea(null);setJenisId(null);}:undefined)}
        {area&&<><span>›</span>{crumb(area,jenisId!=null?()=>setJenisId(null):undefined)}</>}
        {jenisId!=null&&<><span>›</span>{crumb(String(namaJenis||'-'))}</>}
      </div>

      {error&&<div style={{...G.card,padding:'16px',color:'#c62828'}}>{error}. Pastikan migrasi 06 sudah dijalankan.</div>}
      {!error&&rows===null&&<div style={{color:'var(--mcc-text-muted)'}}>Memuat riwayat...</div>}

      {/* Ringkasan keseluruhan periode (mengikuti filter tipe) */}
      {rows&&(()=>{const x=ringkas(semua);const n=(t:string)=>semua.filter(r=>r.tipe===t).length;return(
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:'12px'}}>
          {[{l:'Total transaksi',v:x.n,s:`${dari} s/d ${sampai}`,w:'var(--mcc-text)'},{l:'Masuk (Part In)',v:`+${x.masuk}`,s:`${n('in')} transaksi`,w:'#1e7e34'},{l:'Keluar (Part Out)',v:`−${x.keluar}`,s:`${n('out')} transaksi`,w:'#c62828'},{l:'Return ke supplier',v:`−${x.ret}`,s:`${n('return')} transaksi`,w:'#8a5a00'}].map(k=>(
            <div key={k.l} style={{...G.card,padding:'14px 16px',display:'flex',flexDirection:'column',gap:'4px'}}>
              <span style={{fontSize:'12px',fontWeight:600,color:'var(--mcc-text-muted)'}}>{k.l}</span>
              <span style={{fontSize:'26px',fontWeight:800,color:k.w,fontVariantNumeric:'tabular-nums'}}>{k.v}<span style={{fontSize:'13px',fontWeight:600,marginLeft:'4px'}}>{k.l==='Total transaksi'?'':'pcs'}</span></span>
              <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{k.s}</span>
            </div>))}
        </div>);})()}

      {/* Level 0: area */}
      {rows&&!area&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'16px'}}>
          {['Molding','Non-molding','Tanpa mesin'].map(a=>{
            const list=semua.filter(r=>areaOf(r)===a); const x=ringkas(list);
            return (
              <button key={a} type="button" style={kartu} onClick={()=>{setArea(a);if(a==='Tanpa mesin')setJenisId('tanpa');}}>
                <span style={{fontSize:'19px',fontWeight:700,color:'var(--mcc-text)'}}>{a}</span>
                <span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{x.n} transaksi</span>
                <Angka x={x}/>
              </button>
            );
          })}
        </div>
      )}

      {/* Level 1: jenis mesin */}
      {rows&&area&&jenisId==null&&(
        jenisList.length===0
          ?<div style={{...G.card,padding:'24px',color:'var(--mcc-text-muted)'}}>Tidak ada transaksi di {area} pada periode ini.</div>
          :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:'14px'}}>
            {jenisList.map(([id,nama])=>{
              const list=diArea.filter(r=>r.jenis_id===id); const x=ringkas(list);
              const nUnit=new Set(list.filter(r=>r.unit_id).map(r=>r.unit_id)).size;
              return (
                <button key={id} type="button" style={kartu} onClick={()=>setJenisId(id)}>
                  <span style={{fontSize:'16px',fontWeight:700,color:'var(--mcc-text)'}}>{nama}</span>
                  <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{x.n} transaksi{nUnit?` · ${nUnit} unit`:''}</span>
                  <Angka x={x}/>
                </button>
              );
            })}
          </div>
      )}

      {/* Level 2: unit + spare part */}
      {rows&&jenisId!=null&&(
        <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
          {jenisId!=='tanpa'&&(
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
              <span style={{fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)',marginRight:'4px'}}>Unit:</span>
              {([['semua','Semua unit'] as [any,string], ...unitList.map(([id,n])=>[id,`${namaJenis} ${n}`] as [any,string]), ['kosong','Unit tidak tercatat'] as [any,string]]).map(([id,label])=>(
                <button key={String(id)} type="button" aria-pressed={unitId===id} onClick={()=>setUnitId(id)} style={{padding:'6px 10px',borderRadius:'6px',border:`1px solid ${unitId===id?'var(--mcc-blue)':'var(--mcc-border)'}`,background:unitId===id?'var(--mcc-blue-soft)':'var(--mcc-surface)',color:unitId===id?'var(--mcc-blue)':'var(--mcc-text)',font:'inherit',fontSize:'13px',cursor:'pointer'}}>{label}</button>
              ))}
            </div>
          )}
          <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
            <h3 style={{margin:0,fontSize:'16px',fontWeight:700,flex:1}}>Spare part ({perPart.length})</h3>
            <Angka x={ringkas(diUnit)}/>
            <input style={{...G.inp,width:'240px'}} placeholder="Cari part, WO, DO, teknisi" value={cari} onChange={e=>setCari(e.target.value)}/>
          </div>
          <div style={{border:'1px solid var(--mcc-border)',borderRadius:'6px',maxHeight:'600px',overflowY:'auto'}}>
            {perPart.length===0&&<div style={{padding:'20px',textAlign:'center',color:'var(--mcc-text-muted)'}}>Tidak ada transaksi</div>}
            {perPart.map(p=>{
              const buka=bukaPart===p.id;
              return (
                <div key={p.id} style={{borderBottom:'1px solid #eef1f5'}}>
                  <button type="button" onClick={()=>setBukaPart(buka?null:p.id)} aria-expanded={buka} style={{width:'100%',display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',border:'none',background:buka?'#f8fbff':'transparent',font:'inherit',cursor:'pointer',textAlign:'left'}}>
                    <span style={{color:'var(--mcc-text-muted)',width:'12px'}}>{buka?'▾':'▸'}</span>
                    {p.list[0]?.foto_part?<img src={p.list[0].foto_part} alt="" style={{width:'38px',height:'38px',objectFit:'cover',borderRadius:'6px',flexShrink:0}}/>:<span style={{width:'38px',height:'38px',borderRadius:'6px',background:'#eef3fb',flexShrink:0}}/>}
                    <span style={{flex:1,minWidth:0}}><span style={{display:'block',fontWeight:600,color:'var(--mcc-text)'}}>{p.nama}</span><span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{p.kode||'-'} · {p.bin||'-'} · {p.x.n} transaksi</span></span>
                    <Angka x={p.x}/>
                  </button>
                  {buka&&(
                    <table className="mcc-table" style={{width:'100%',background:'#fafbfc'}}>
                      <thead><tr><th>Tanggal</th><th>Tipe</th><th>Unit</th><th style={{textAlign:'right'}}>Jumlah</th><th>WO / DO</th><th>Oleh</th><th>Keterangan</th><th>Foto</th></tr></thead>
                      <tbody>
                        {p.list.map((r:any)=>(
                          <tr key={r.tipe+r.id}>
                            <td style={{whiteSpace:'nowrap'}}>{tglDb(r.tanggal).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                            <td style={{color:TIPE_TRX[r.tipe]?.warna,fontWeight:600}}>{TIPE_TRX[r.tipe]?.label}</td>
                            <td>{r.nomor_unit?`${r.jenis_nama} ${r.nomor_unit}`:(r.area_teks||'-')}</td>
                            <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:TIPE_TRX[r.tipe]?.warna}}>{TIPE_TRX[r.tipe]?.tanda}{r.jumlah}</td>
                            <td>{r.ref||'-'}</td><td>{r.oleh||'-'}</td><td style={{color:'var(--mcc-text-muted)',maxWidth:'260px'}}>{r.keterangan||'-'}</td>
                            <td>{(r.tipe==='out'&&r.request_id)||r.tipe==='return'||r.foto_part?<button type="button" className="mcc-link-btn" onClick={()=>lihatFoto(r)}>Lihat foto</button>:<span style={{color:'var(--mcc-text-muted)'}}>-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
          {foto&&(
            <div role="dialog" aria-modal="true" onClick={e=>{if(e.target===e.currentTarget)setFoto(null);}} style={{position:'fixed',inset:0,zIndex:4000,background:'rgba(15,25,45,0.55)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
              <div style={{...G.card,width:'100%',maxWidth:'900px',maxHeight:'90vh',overflowY:'auto',padding:'18px',display:'flex',flexDirection:'column',gap:'12px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}><div style={{fontSize:'16px',fontWeight:700,flex:1}}>{foto.judul}</div><button type="button" className="mcc-btn-secondary" onClick={()=>setFoto(null)}>Tutup</button></div>
                {foto.loading&&<div style={{color:'var(--mcc-text-muted)'}}>Memuat foto...</div>}
                {!foto.loading&&foto.pesan&&<div style={{color:'var(--mcc-text-muted)'}}>{foto.pesan}</div>}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'12px'}}>
                  {foto.list.map((f,i)=>(<figure key={i} style={{margin:0,display:'flex',flexDirection:'column',gap:'6px'}}>
                    <img src={f.src} alt={f.label} style={{width:'100%',maxHeight:'60vh',objectFit:'contain',background:'#eef1f5',borderRadius:'8px'}}/>
                    <figcaption style={{fontSize:'13px',fontWeight:600}}>{f.label}{f.ket&&<span style={{display:'block',fontWeight:400,color:'var(--mcc-text-muted)'}}>{f.ket}</span>}</figcaption></figure>))}
                </div>
              </div>
            </div>
          )}
          {jenisId!=='tanpa'&&<div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Unit hanya tercatat untuk part keluar yang dipesan teknisi setelah web Teknisi memakai Master Data. Part masuk dan return dicatat per jenis mesin.</div>}
        </section>
      )}
    </div>
  );
}

// ===== Katalog (terhubung Master Data): area -> jenis mesin -> spare part, + cari semua part =====
/** Part In terakhir per part (dari riwayat Part In), untuk kolom "Masuk terakhir". */
function petaMasukTerakhir(riwayat:any[]){const m:Record<number,{qty:number;tgl:string}>={};(riwayat||[]).forEach((r:any)=>{const id=Number(r.spare_part_id);if(!id)return;const t=String(r.tanggal_masuk||'');if(!m[id]||t>m[id].tgl)m[id]={qty:Number(r.jumlah_masuk)||0,tgl:t};});return m;}
function TeksMasuk({ x }:{ x?:{qty:number;tgl:string} }){if(!x)return <span style={{color:'var(--mcc-text-muted)',fontSize:'12px'}}>-</span>;const d=tglDb(x.tgl);return <span style={{whiteSpace:'nowrap',fontSize:'12px'}}><b style={{color:'#1e7e34'}}>+{x.qty}</b> <span style={{color:'var(--mcc-text-muted)'}}>{isNaN(d.getTime())?'':d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})}</span></span>;}
function KatalogMaster({ partsList, riwayatMasuk=[], onTampilanLama }:{ partsList:any[]; riwayatMasuk?:any[]; onTampilanLama:()=>void }) {
  const masuk=petaMasukTerakhir(riwayatMasuk);
  const [jenis,setJenis]=useState<any[]>([]);
  const [area,setArea]=useState<string|null>(null);
  const [jenisId,setJenisId]=useState<number|'none'|'consumable'|null>(null);
  const [parts,setParts]=useState<any[]|null>(null);
  const [cari,setCari]=useState('');
  const [hanyaWarning,setHanyaWarning]=useState(false);
  useEffect(()=>{fetch('/api/mesin').then(r=>r.json()).then(d=>{if(d.success)setJenis(d.jenis||[]);}).catch(()=>{});},[]);
  useEffect(()=>{if(jenisId==null){setParts(null);return;}setParts(null);fetch(`/api/mesin?parts=${jenisId}`).then(r=>r.json()).then(d=>setParts(d.success?(d.data||[]):[])).catch(()=>setParts([]));},[jenisId]);
  const q=cari.trim().toLowerCase();
  const cocok=(p:any)=>!q||String(p.nama_part||'').toLowerCase().includes(q)||String(p.kode_12nc||'').toLowerCase().includes(q)||String(p.nomor_bin||'').toLowerCase().includes(q);
  const warn=(p:any)=>(p.stok_saat_ini??0)<=(p.reorder_point??0);
  // Pencarian global (tanpa memilih mesin) memakai daftar part yang sudah dimuat halaman
  const hasilGlobal=q&&jenisId==null?partsList.filter(cocok).filter(p=>!hanyaWarning||warn(p)).slice(0,100):null;
  const jenisNama=(id:any)=>jenis.find(j=>j.id===id)?.nama;
  const tampil=(parts||[]).filter(cocok).filter(p=>!hanyaWarning||warn(p));
  const aktif=jenisId==='none'?{nama:'General part'}:jenisId==='consumable'?{nama:'Consumable part'}:jenis.find(j=>j.id===jenisId);
  const crumb=(t:string,f?:()=>void)=>f?<button type="button" className="mcc-link-btn" onClick={f}>{t}</button>:<span style={{fontWeight:700,color:'var(--mcc-text)'}}>{t}</span>;
  const Tabel=({rows,tampilMesin}:{rows:any[];tampilMesin?:boolean})=>(
    <div style={{border:'1px solid var(--mcc-border)',borderRadius:'6px',maxHeight:'620px',overflowY:'auto'}}>
      <table className="mcc-table" style={{width:'100%'}}>
        <thead><tr><th style={{width:'52px'}}></th><th>Nama part</th><th>12NC</th>{tampilMesin&&<th>Mesin</th>}<th>Kategori</th><th>Bin · rak</th><th style={{textAlign:'right'}}>Stok aktual / min</th><th>Masuk terakhir</th></tr></thead>
        <tbody>
          {rows.length===0&&<tr><td colSpan={tampilMesin?8:7} style={{padding:'20px',textAlign:'center',color:'var(--mcc-text-muted)'}}>Tidak ada part</td></tr>}
          {rows.map((p:any)=>(
            <tr key={p.id}>
              <td>{p.foto_url?<img src={p.foto_url} alt="" style={{width:'40px',height:'40px',objectFit:'cover',borderRadius:'6px'}}/>:<div style={{width:'40px',height:'40px',borderRadius:'6px',background:'#eef3fb'}}/>}</td>
              <td style={{fontWeight:600}}>{p.nama_part}</td>
              <td>{p.kode_12nc||'-'}</td>
              {tampilMesin&&<td>{jenisNama(p.mesin_jenis_id)||p.mesin||'-'}</td>}
              <td><KatBadge critical={!!p.is_critical}/></td>
              <td style={{whiteSpace:'nowrap'}}>{p.nomor_bin||'-'}{p.rak_kode?` · Rak ${p.rak_kode}${p.rak_tingkat?` S${p.rak_tingkat}`:''}`:''}</td>
              <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:warn(p)?'#c62828':undefined,fontWeight:warn(p)?700:400}}>{p.stok_saat_ini??0} / {p.reorder_point??0}</td>
              <td><TeksMasuk x={masuk[p.id]}/></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div style={{padding:'24px 32px',display:'flex',flexDirection:'column',gap:'16px'}}>
      <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'15px',color:'var(--mcc-text-muted)',flex:1}}>
          {crumb('Katalog',(area||jenisId!=null)?()=>{setArea(null);setJenisId(null);}:undefined)}
          {area&&<><span>›</span>{crumb(area,jenisId!=null?()=>setJenisId(null):undefined)}</>}
          {aktif&&jenisId!=null&&<><span>›</span>{crumb(aktif.nama)}</>}
        </div>
        <input style={{...G.inp,width:'300px'}} placeholder={jenisId!=null?`Cari di ${aktif?.nama}`:'Cari semua part (nama / 12NC / bin)'} value={cari} onChange={e=>setCari(e.target.value)}/>
        <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',cursor:'pointer'}}><input type="checkbox" checked={hanyaWarning} onChange={e=>setHanyaWarning(e.target.checked)}/>Hanya warning</label>
        <button type="button" className="mcc-btn-secondary" onClick={onTampilanLama}>Tampilan lama</button>
      </div>

      {hasilGlobal&&(<><div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Hasil pencarian: {hasilGlobal.length}{hasilGlobal.length===100?'+ (ketik lebih spesifik)':''}</div><Tabel rows={hasilGlobal} tampilMesin/></>)}

      {!hasilGlobal&&!area&&jenisId==null&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:'16px'}}>
          {['Molding','Non-molding'].map(a=>{const l=jenis.filter(j=>j.area===a);return(
            <button key={a} type="button" onClick={()=>setArea(a)} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px'}}>
              <span style={{fontSize:'20px',fontWeight:700,color:'var(--mcc-text)'}}>{a}</span>
              <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{l.length} jenis mesin · {l.reduce((s,j)=>s+(j.jumlah_part||0),0)} part</span>
              {l.reduce((s,j)=>s+(j.jumlah_warning||0),0)>0&&<span style={{fontSize:'13px',color:'#c62828'}}>{l.reduce((s,j)=>s+(j.jumlah_warning||0),0)} part warning</span>}
            </button>);})}
          <button type="button" onClick={()=>setJenisId('consumable')} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px',border:'1px solid rgba(180,83,9,0.35)',background:'#fff8f0'}}>
            <span style={{fontSize:'20px',fontWeight:700,color:'#b45309'}}>Consumable part</span>
            <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Part habis pakai yang sering diambil (semua mesin)</span>
          </button>
          <button type="button" onClick={()=>setJenisId('none')} style={{...G.card,padding:'24px',textAlign:'left',font:'inherit',cursor:'pointer',display:'flex',flexDirection:'column',gap:'6px'}}>
            <span style={{fontSize:'20px',fontWeight:700,color:'var(--mcc-text)'}}>General part</span>
            <span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Part yang belum ditetapkan ke mesin di Master Data</span>
          </button>
        </div>
      )}

      {!hasilGlobal&&area&&jenisId==null&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'14px'}}>
          {jenis.filter(j=>j.area===area).map(j=>(
            <button key={j.id} type="button" onClick={()=>setJenisId(j.id)} style={{...G.card,padding:'14px',font:'inherit',cursor:'pointer',display:'flex',gap:'12px',alignItems:'center',textAlign:'left'}}>
              <div style={{width:'56px',height:'56px',borderRadius:'10px',overflow:'hidden',background:'#eef3fb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {j.foto_url?<img src={j.foto_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'26px'}}>{j.emoji||'⚙️'}</span>}
              </div>
              <span style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                <span style={{fontSize:'15px',fontWeight:700,color:'var(--mcc-text)'}}>{j.nama}</span>
                <span style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{j.jumlah_part} part</span>
                {j.jumlah_warning>0&&<span style={{fontSize:'12px',color:'#c62828'}}>{j.jumlah_warning} warning</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {jenisId!=null&&(parts===null?<div style={{color:'var(--mcc-text-muted)'}}>Memuat...</div>:<><div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{tampil.length} part</div><Tabel rows={tampil}/></>)}
    </div>
  );
}

// ===== Kelola user per mesin (bagian) + pencarian =====
// ===== Kelola role pengguna (tabel UserRole, migrasi 15) =====
const ROLE_BAWAAN=[{kode:'LT',nama:'Leader Teknisi',warna:'#1e7e34'},{kode:'TL',nama:'Team Leader',warna:'#6d28d9'},{kode:'TO',nama:'Teknisi Operator',warna:'#0f766e'},{kode:'teknisi',nama:'Teknisi',warna:'#1e7e34'},{kode:'admin',nama:'Admin',warna:'#0b5ed7'}];
function KelolaRole({ roles, onBerubah, onTutup, error }:{ roles:any[]; onBerubah:()=>void; onTutup:()=>void; error?:string }) {
  const [f,setF]=useState<{kode:string;nama:string;warna:string;kode_lama?:string}|null>(null);
  const [sibuk,setSibuk]=useState(false); const [pesan,setPesan]=useState<{t:'ok'|'err';s:string}|null>(null);
  const kirim=async(body:any)=>{setSibuk(true);setPesan(null);
    try{const d=await fetch('/api/role',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
      setPesan({t:d.success?'ok':'err',s:d.success?d.message:(d.error||'Gagal')});if(d.success){onBerubah();setF(null);}
    }catch{setPesan({t:'err',s:'Gagal menyimpan'});}finally{setSibuk(false);}};
  const WARNA=['#1e7e34','#0b5ed7','#6d28d9','#0f766e','#b26a00','#c62828','#be185d','#475569'];
  return (
    <div style={{...G.card,padding:'18px',marginBottom:'20px',display:'flex',flexDirection:'column',gap:'12px',border:'1px solid rgba(11,94,215,0.25)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px'}}>
        <div style={{fontSize:'15px',fontWeight:700,color:'#13294b'}}>Kelola role</div>
        <span style={{display:'flex',gap:'8px'}}>
          {!f&&<button type="button" className="mcc-btn-primary" onClick={()=>setF({kode:'',nama:'',warna:'#b26a00'})}>+ Role baru</button>}
          <button type="button" className="mcc-btn-secondary" onClick={onTutup}>Tutup</button>
        </span>
      </div>
      {error&&<div style={{fontSize:'13px',color:'#c62828',fontWeight:600}}>{error}</div>}
      {pesan&&<div style={{fontSize:'13px',fontWeight:600,color:pesan.t==='ok'?'#1e7e34':'#c62828'}}>{pesan.s}</div>}
      {f&&(
        <div style={{display:'grid',gridTemplateColumns:'140px 1fr auto auto auto',gap:'10px',alignItems:'end',background:'#f8fbff',border:'1px dashed rgba(11,94,215,0.4)',borderRadius:'8px',padding:'12px'}}>
          <label style={G.lbl}>Kode<input style={G.inp} value={f.kode} disabled={!!f.kode_lama} maxLength={20} onChange={e=>setF(x=>x&&({...x,kode:e.target.value.replace(/\s/g,'')}))} placeholder="mis. SPV"/></label>
          <label style={G.lbl}>Nama role<input style={G.inp} value={f.nama} maxLength={60} onChange={e=>setF(x=>x&&({...x,nama:e.target.value}))} placeholder="mis. Supervisor"/></label>
          <div><div style={G.lbl}>Warna</div><div style={{display:'flex',gap:'4px',paddingBottom:'6px'}}>{WARNA.map(c=><button key={c} type="button" onClick={()=>setF(x=>x&&({...x,warna:c}))} aria-label={`Warna ${c}`} style={{width:'22px',height:'22px',borderRadius:'50%',background:c,border:f.warna===c?'3px solid #13294b':'2px solid #fff',boxShadow:'0 0 0 1px #d9dee5',cursor:'pointer',padding:0}}/>)}</div></div>
          <button type="button" className="mcc-btn-secondary" onClick={()=>setF(null)}>Batal</button>
          <button type="button" className="mcc-btn-primary" disabled={sibuk||!f.kode.trim()||!f.nama.trim()} onClick={()=>kirim({aksi:'simpan',...f})}>Simpan</button>
        </div>
      )}
      <table className="mcc-table" style={{width:'100%'}}>
        <thead><tr><th>Role</th><th>Kode</th><th style={{textAlign:'right'}}>Dipakai</th><th style={{width:'150px',textAlign:'right'}}>Aksi</th></tr></thead>
        <tbody>
          {roles.map(r=>(
            <tr key={r.kode}>
              <td><span style={{background:r.warna+'1f',color:r.warna,fontSize:'12px',fontWeight:700,padding:'2px 10px',borderRadius:'10px'}}>{r.nama}</span>{r.is_system?<span style={{marginLeft:'8px',fontSize:'11px',color:'var(--mcc-text-muted)'}}>bawaan</span>:null}</td>
              <td style={{fontFamily:'ui-monospace,monospace',fontSize:'13px'}}>{r.kode}</td>
              <td style={{textAlign:'right'}}>{r.jumlah_user??'-'} orang</td>
              <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                <button type="button" className="mcc-link-btn" onClick={()=>setF({kode:r.kode,nama:r.nama,warna:r.warna,kode_lama:r.kode})}>Ubah</button>
                {!r.is_system&&<><span style={{color:'#d0d6df'}}> · </span><button type="button" className="mcc-link-btn" style={{color:'#c62828'}} disabled={sibuk} onClick={async()=>{if(!await tanya(`Hapus role "${r.nama}"?`))return;kirim({aksi:'hapus',kode:r.kode});}}>Hapus</button></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>Role adalah label jabatan pengguna. Hak akses khusus hanya untuk role <b>admin</b>; role lain diperlakukan sebagai teknisi saat tap RFID. Role bawaan tidak bisa dihapus; role yang masih dipakai harus diganti dulu di pengguna.</div>
    </div>
  );
}

// Bagian + mesin dalam satu deretan chip: chip pertama = mesin utama / tim (★, disimpan di kolom bagian),
// chip berikutnya = mesin tambahan (✓). Tim Maintenance Mold / Machine menentukan alur teknisi.
const TIM_MAINT=['Maintenance Mold','Maintenance Machine'];
function PilihBagianMesin({ jenis, bagian, nilai, onUbah }:{ jenis:any[]; bagian:string; nilai:number[]; onUbah:(bagian:string,ids:number[])=>void }) {
  const kec=(x:any)=>String(x||'').trim().toLowerCase();
  const b=String(bagian||'').trim();
  const daftar=jenis.filter((j:any)=>j.is_active!==false&&!/^maintenance\s*(mold|machine)$/i.test(String(j.nama).trim()));
  const idDari=(nama:string)=>{const j=daftar.find((x:any)=>kec(x.nama)===kec(nama));return j?Number(j.id):null;};
  const lain=b&&b!=='-'&&!TIM_MAINT.some(t=>kec(t)===kec(b))&&idDari(b)===null?b:''; // bagian lama yang bukan jenis mesin
  const klik=(nama:string,id:number|null,tim:boolean)=>{
    if(kec(nama)===kec(b)){ // lepas utama -> tambahan pertama naik jadi utama
      const [naik,...sisa]=nilai; const j=daftar.find((x:any)=>Number(x.id)===naik);
      return j?onUbah(String(j.nama),sisa):onUbah('',nilai);
    }
    if(id!==null&&nilai.includes(id))return onUbah(b,nilai.filter(x=>x!==id));
    if(!b||b==='-')return onUbah(nama,nilai.filter(x=>x!==id));
    if(tim){const lama=idDari(b);return onUbah(nama,lama!==null&&!nilai.includes(lama)?[lama,...nilai]:nilai);} // tim selalu jadi utama
    if(id!==null)return onUbah(b,[...nilai,id]);
  };
  const chip=(key:any,nama:string,id:number|null,tim:boolean)=>{
    const utama=kec(nama)===kec(b), on=utama||(id!==null&&nilai.includes(id));
    return <button key={key} type="button" aria-pressed={on} onClick={()=>klik(nama,id,tim)} title={utama?'Mesin utama / tim (klik untuk lepas)':on?'Mesin tambahan (klik untuk lepas)':''}
      style={{padding:'4px 10px',borderRadius:'14px',border:`1px solid ${utama?'#b26a00':on?'#0b5ed7':'#d9dee5'}`,background:utama?'#fff4e0':on?'#e7f0fd':'#fff',color:utama?'#8a5200':on?'#0b5ed7':'#13294b',fontSize:'12px',fontWeight:on?700:500,cursor:'pointer'}}>{utama?'★ ':on?'✓ ':''}{nama}</button>;
  };
  const baris=(label:string,isi:any)=>(
    <div style={{display:'flex',flexWrap:'wrap',gap:'6px',alignItems:'center'}}>
      <span style={{fontSize:'11px',fontWeight:700,color:'var(--mcc-text-muted)',textTransform:'uppercase',minWidth:'84px'}}>{label}</span>{isi}
    </div>);
  const utamaNama=b&&b!=='-'?b:'';
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
      {baris('Tim',TIM_MAINT.map(t=>chip(t,t,null,true)))}
      {(['Molding','Non-molding'] as const).map(a=>{const l=daftar.filter((j:any)=>j.area===a);if(!l.length)return null;return <div key={a}>{baris(a,l.map((j:any)=>chip(j.id,String(j.nama),Number(j.id),false)))}</div>;})}
      {lain&&baris('Lainnya',chip('lain',lain,null,false))}
      <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>
        {utamaNama?<>★ Utama: <b>{utamaNama}</b>{nilai.length?` · ✓ ${nilai.length} mesin tambahan`:''}</>:'Klik chip pertama = mesin utama / tim (★). Chip berikutnya = mesin tambahan (✓).'}
      </div>
    </div>
  );
}

// Pilih mesin tambahan (selain bagian utama) untuk satu pengguna. Butuh migrasi 17.
function PilihMesinTambahan({ jenis, utama, nilai, onUbah }:{ jenis:any[]; utama:string; nilai:number[]; onUbah:(ids:number[])=>void }) {
  const u=String(utama||'').trim().toLowerCase();
  const daftar=jenis.filter((j:any)=>j.is_active!==false&&!/^maintenance\s*(mold|machine)$/i.test(String(j.nama).trim())&&String(j.nama).trim().toLowerCase()!==u);
  const ubah=(id:number)=>onUbah(nilai.includes(id)?nilai.filter(x=>x!==id):[...nilai,id]);
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
      {(['Molding','Non-molding'] as const).map(a=>{const l=daftar.filter((j:any)=>j.area===a);if(!l.length)return null;return(
        <div key={a} style={{display:'flex',flexWrap:'wrap',gap:'6px',alignItems:'center'}}>
          <span style={{fontSize:'11px',fontWeight:700,color:'var(--mcc-text-muted)',textTransform:'uppercase',minWidth:'84px'}}>{a}</span>
          {l.map((j:any)=>{const on=nilai.includes(j.id);return(
            <button key={j.id} type="button" aria-pressed={on} onClick={()=>ubah(j.id)} style={{padding:'4px 10px',borderRadius:'14px',border:`1px solid ${on?'#0b5ed7':'#d9dee5'}`,background:on?'#e7f0fd':'#fff',color:on?'#0b5ed7':'#13294b',fontSize:'12px',fontWeight:on?700:500,cursor:'pointer'}}>{on?'✓ ':''}{j.nama}</button>);})}
        </div>);})}
      <div style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{nilai.length?`${nilai.length} mesin tambahan dipilih.`:'Belum ada mesin tambahan.'} Mesin utama tetap dari Bagian / Area.</div>
    </div>
  );
}

function UserPerMesin({ users, jenis, onEdit, onHapus, roleColor }:{ users:any[]; jenis:any[]; onEdit:(u:any)=>void; onHapus:(id:number,nama:string)=>void; roleColor:(r:string)=>{bg:string;color:string} }) {
  const [cari,setCari]=useState('');
  const [pilih,setPilih]=useState<string>('*');
  const [tanpaRfid,setTanpaRfid]=useState(false);
  const isi=(v:any)=>{const s=String(v??'').trim();return s&&s!=='-'?s:'';};
  const q=cari.trim().toLowerCase();
  const cocok=(u:any)=>(!q||[u.nama,u.employee_id,u.rfid_tag,u.bagian,u.nomor_mesin,u.role].some(v=>String(v||'').toLowerCase().includes(q)))&&(!tanpaRfid||!isi(u.rfid_tag));
  const tim=['Maintenance Mold','Maintenance Machine'];
  const areaOf=(b:string)=>{if(!b)return 'Belum ada bagian';if(tim.some(t=>t.toLowerCase()===b.toLowerCase()))return 'Tim maintenance';return jenis.find(j=>String(j.nama).trim().toLowerCase()===b.toLowerCase())?.area||'Lainnya';};
  // Nama tampil mengikuti Master Data kalau cocok (huruf besar/kecil diabaikan)
  const namaBaku=(b:string)=>jenis.find(j=>String(j.nama).trim().toLowerCase()===b.toLowerCase())?.nama||b;
  const tambahan=(u:any):string[]=>(u.mesin_tambahan||[]).map((m:any)=>String(m.nama||'').trim()).filter(Boolean);
  const hasil=users.filter(cocok);
  // Akun admin dikelompokkan sendiri (terpisah dari teknisi), bagian/mesinnya tetap tampil di tabel
  const ADMIN='Admin', SEMUA_ADMIN='Semua admin';
  const grupKey=(u:any):[string,string]=>{if(u.role==='admin')return [ADMIN,SEMUA_ADMIN];const b=isi(u.bagian);return [areaOf(b),b?namaBaku(b):'-'];};
  // Satu orang bisa muncul di beberapa mesin: bagian utama + mesin tambahan
  const semuaKey=(u:any):string[]=>{const k=[grupKey(u).join('|')];if(u.role!=='admin')tambahan(u).forEach(n=>{const x=areaOf(n)+'|'+namaBaku(n);if(!k.includes(x))k.push(x);});return k;};
  const grup:Record<string,Record<string,any[]>>={};
  hasil.forEach(u=>semuaKey(u).forEach(key=>{const [a,b]=key.split('|');(grup[a]=grup[a]||{});(grup[a][b]=grup[a][b]||[]).push(u);}));
  const urutanArea=[ADMIN,'Tim maintenance','Molding','Non-molding','Lainnya','Belum ada bagian'].filter(a=>grup[a]);

  const ada=pilih==='*'||hasil.some(u=>semuaKey(u).includes(pilih));
  const aktif=ada?pilih:'*';
  const daftar=(aktif==='*'?hasil:hasil.filter(u=>semuaKey(u).includes(aktif))).slice().sort((x,y)=>String(x.nama||'').localeCompare(String(y.nama||'')));
  const [areaAktif,bagianAktif]=aktif==='*'?['','']:aktif.split('|');
  const nTanpaRfid=users.filter(u=>!isi(u.rfid_tag)).length;
  const itemKiri=(k:string,label:string,n:number)=>(
    <button key={k} type="button" onClick={()=>setPilih(k)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',width:'100%',padding:'8px 12px',border:'none',borderRadius:'6px',background:aktif===k?'var(--mcc-blue-soft,#e7f0fd)':'transparent',color:aktif===k?'var(--mcc-blue)':'var(--mcc-text)',font:'inherit',fontSize:'14px',fontWeight:aktif===k?700:500,cursor:'pointer',textAlign:'left'}}>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span>
      <span style={{fontSize:'12px',fontWeight:600,minWidth:'26px',textAlign:'center',padding:'1px 8px',borderRadius:'10px',background:aktif===k?'#fff':'#eef1f5',color:'var(--mcc-text-muted)'}}>{n}</span>
    </button>
  );
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
      <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
        <input style={{...G.inp,maxWidth:'380px'}} placeholder="Cari nama, employee ID, RFID, mesin..." value={cari} onChange={e=>setCari(e.target.value)}/>
        <label style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'13px',color:nTanpaRfid?'#c62828':'var(--mcc-text-muted)',cursor:'pointer'}}>
          <input type="checkbox" checked={tanpaRfid} onChange={e=>setTanpaRfid(e.target.checked)}/>Hanya yang belum ada RFID ({nTanpaRfid})
        </label>
        <span style={{flex:1}}/>
        <span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{hasil.length} dari {users.length} pengguna</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'260px minmax(0,1fr)',gap:'16px',alignItems:'start'}}>
        <nav style={{...G.card,padding:'8px',display:'flex',flexDirection:'column',gap:'2px',position:'sticky',top:'16px',maxHeight:'calc(100vh - 140px)',overflowY:'auto'}} aria-label="Kelompok pengguna">
          {itemKiri('*','Semua pengguna',hasil.length)}
          {urutanArea.map(a=>(
            <div key={a} style={{display:'flex',flexDirection:'column',gap:'2px',marginTop:'8px'}}>
              <div style={{fontSize:'11px',fontWeight:700,letterSpacing:'0.6px',textTransform:'uppercase',color:'var(--mcc-text-muted)',padding:'4px 12px'}}>{a}</div>
              {Object.entries(grup[a]).sort((x,y)=>x[0].localeCompare(y[0])).map(([b,list])=>itemKiri(a+'|'+b,b==='-'?'Belum diisi':b,list.length))}
            </div>
          ))}
        </nav>
        <section style={{...G.card,overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'baseline',gap:'10px',padding:'14px 16px',borderBottom:'1px solid var(--mcc-border)',background:'#f8f9fb'}}>
            <h3 style={{margin:0,fontSize:'17px',fontWeight:700}}>{aktif==='*'?'Semua pengguna':areaAktif===ADMIN?'Akun admin':bagianAktif==='-'?'Belum diisi':bagianAktif}</h3>
            {aktif!=='*'&&areaAktif!==ADMIN&&<span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{areaAktif}</span>}
            {areaAktif===ADMIN&&<span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>role admin · bagian boleh diisi mesin mana saja</span>}
            <span style={{flex:1}}/>
            <span style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{daftar.length} orang</span>
          </div>
          {daftar.length===0?<div style={{padding:'24px',textAlign:'center',color:'var(--mcc-text-muted)'}}>Tidak ada pengguna yang cocok.</div>:(
            <table className="mcc-table" style={{width:'100%'}}>
              <thead><tr>
                <th>Nama</th><th style={{width:'130px'}}>Employee ID</th>
                {(aktif==='*'||areaAktif===ADMIN)&&<th>Bagian</th>}
                <th style={{width:'130px'}}>RFID</th><th style={{width:'120px'}}>No. mesin</th><th style={{width:'100px'}}>Role</th><th style={{width:'110px',textAlign:'right'}}>Aksi</th>
              </tr></thead>
              <tbody>
                {daftar.map((u:any)=>{const rc=roleColor(u.role);return(
                  <tr key={u.id} style={{opacity:u.is_active===false||u.is_active===0?0.55:1}}>
                    <td style={{fontWeight:600}}>{u.nama}{(u.is_active===false||u.is_active===0)&&<span style={{marginLeft:'6px',fontSize:'11px',fontWeight:600,color:'#c62828'}}>nonaktif</span>}
                      {tambahan(u).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'3px'}}>{tambahan(u).map(n=><span key={n} style={{fontSize:'11px',fontWeight:600,color:'#0b5ed7',background:'#e7f0fd',borderRadius:'8px',padding:'1px 7px'}}>+ {n}</span>)}</div>}</td>
                    <td style={{fontFamily:'ui-monospace,monospace',fontSize:'13px'}}>{isi(u.employee_id)||'-'}</td>
                    {(aktif==='*'||areaAktif===ADMIN)&&<td>{isi(u.bagian)||<span style={{color:'var(--mcc-text-muted)'}}>Belum diisi</span>}</td>}
                    <td>{isi(u.rfid_tag)?<span style={{fontFamily:'ui-monospace,monospace',fontSize:'13px'}}>{isi(u.rfid_tag)}</span>:<span style={{color:'#c62828',fontSize:'13px',fontWeight:600}}>belum ada</span>}</td>
                    <td>{isi(u.nomor_mesin)||<span style={{color:'var(--mcc-text-muted)'}}>-</span>}</td>
                    <td><span style={{background:rc.bg,color:rc.color,fontSize:'11px',fontWeight:700,padding:'2px 8px',borderRadius:'10px',textTransform:'uppercase'}}>{u.role}</span></td>
                    <td style={{textAlign:'right',whiteSpace:'nowrap'}}>
                      <button type="button" className="mcc-link-btn" onClick={()=>onEdit(u)}>Edit</button>
                      <span style={{color:'#d0d6df'}}> · </span><button type="button" className="mcc-link-btn" style={{color:'#c62828'}} onClick={()=>onHapus(u.id,u.nama)}>Hapus</button>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function LokasiRak() {
  const [rak,setRak]=useState<RakInfo[]>([]);
  const [bins,setBins]=useState<BinInfo[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [pesan,setPesan]=useState<{type:'ok'|'err';text:string}|null>(null);
  const [pola,setPola]=useState('semua');
  const [tampil,setTampil]=useState<'belum'|'sudah'|'semua'>('belum');
  const [cari,setCari]=useState('');
  const [dipilih,setDipilih]=useState<Set<string>>(new Set());
  const [rakAktif,setRakAktif]=useState<number|null>(null);
  const [tingkat,setTingkat]=useState('');
  const [jumlahSusun,setJumlahSusun]=useState('');
  const [simpan,setSimpan]=useState(false);
  const [modeEdit,setModeEdit]=useState(false);

  const muat=()=>{
    setLoading(true);
    fetch('/api/lokasi-rak').then(r=>r.json()).then(d=>{
      if(d.success){setRak(d.rak||[]);setBins(d.bins||[]);setError('');}
      else setError(d.error||'Gagal memuat data rak');
    }).catch(()=>setError('Gagal memuat data rak')).finally(()=>setLoading(false));
  };
  useEffect(()=>{muat();},[]);
  const kabar=(type:'ok'|'err',text:string)=>{setPesan({type,text});setTimeout(()=>setPesan(null),3500);};

  const rakDipilih = rak.find(r=>r.id===rakAktif)||null;
  useEffect(()=>{setJumlahSusun(rakDipilih?.jumlah_tingkat?String(rakDipilih.jumlah_tingkat):'');setTingkat('');},[rakAktif]); // eslint-disable-line react-hooks/exhaustive-deps

  const q=cari.trim().toLowerCase();
  const terlihat = bins.filter(b=>{
    if(pola!=='semua'&&polaDari(b.nomor_bin)!==pola)return false;
    if(tampil==='belum'&&b.rak_id)return false;
    if(tampil==='sudah'&&!b.rak_id)return false;
    if(q&&!b.nomor_bin.toLowerCase().includes(q)&&!String(b.contoh_part||'').toLowerCase().includes(q))return false;
    return true;
  });
  const sudah = bins.filter(b=>b.rak_id).length;
  const persen = bins.length?Math.round(sudah/bins.length*100):0;
  const semuaTerpilih = terlihat.length>0&&terlihat.every(b=>dipilih.has(b.nomor_bin));
  const toggle=(bin:string)=>setDipilih(s=>{const n=new Set(s);if(n.has(bin))n.delete(bin);else n.add(bin);return n;});
  const toggleSemua=()=>setDipilih(s=>{const n=new Set(s);if(semuaTerpilih)terlihat.forEach(b=>n.delete(b.nomor_bin));else terlihat.forEach(b=>n.add(b.nomor_bin));return n;});

  const kirim=async(rakId:number|null)=>{
    if(!dipilih.size)return kabar('err','Pilih bin dulu di daftar');
    if(rakId!=null&&rakDipilih?.jumlah_tingkat&&!tingkat)return kabar('err','Pilih susun ke berapa');
    if(rakId==null&&!await tanya(`Lepas ${dipilih.size} bin dari raknya?`))return;
    setSimpan(true);
    try{
      const d=await fetch('/api/lokasi-rak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bins:Array.from(dipilih),rak_id:rakId,tingkat:tingkat||null})}).then(r=>r.json());
      if(d.success){kabar('ok',d.message);setDipilih(new Set());muat();}else kabar('err',d.error||'Gagal menyimpan');
    }catch{kabar('err','Gagal menyimpan');}
    setSimpan(false);
  };
  const simpanSusun=async()=>{
    if(!rakDipilih)return;
    try{
      const d=await fetch('/api/lokasi-rak',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rak_id:rakDipilih.id,jumlah_tingkat:jumlahSusun||null})}).then(r=>r.json());
      if(d.success){kabar('ok',d.message);muat();}else kabar('err',d.error||'Gagal menyimpan');
    }catch{kabar('err','Gagal menyimpan');}
  };

  const isiRak = rakDipilih ? bins.filter(b=>b.rak_id===rakDipilih.id).sort((a,b)=>(a.tingkat||0)-(b.tingkat||0)||a.nomor_bin.localeCompare(b.nomor_bin)) : [];
  const pilihanSusun = rakDipilih?.jumlah_tingkat ? Array.from({length:rakDipilih.jumlah_tingkat},(_,i)=>i+1) : [];
  const lblStyle = {display:'flex',flexDirection:'column' as const,gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'};

  if(loading&&!rak.length)return <div style={{padding:'32px',color:'var(--mcc-text-muted)'}}>Memuat data rak...</div>;
  if(error)return <div style={{padding:'32px'}}><div style={{...G.card,padding:'20px',color:'#c62828'}}>{error}. Pastikan migrasi 03 dan 05 sudah dijalankan.</div></div>;

  return (
    <div style={{padding:'28px 32px',display:'flex',flexDirection:'column',gap:'20px'}}>
      {pesan&&<div role="status" className="mcc-fade-in" style={{position:'fixed',top:'20px',right:'24px',zIndex:1000,padding:'10px 16px',borderRadius:'8px',fontSize:'14px',fontWeight:600,background:pesan.type==='ok'?'#e8f4ec':'#fdecec',color:pesan.type==='ok'?'#1e7e34':'#c62828',border:`1px solid ${pesan.type==='ok'?'#b9dcc4':'#f3c2c2'}`}}>{pesan.text}</div>}

      <section style={{...G.card,padding:'16px 20px',display:'flex',alignItems:'center',gap:'20px',flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>Bin sudah dipetakan</div>
          <div style={{fontSize:'26px',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{sudah} <span style={{fontSize:'16px',color:'var(--mcc-text-muted)',fontWeight:600}}>/ {bins.length}</span></div>
        </div>
        <div style={{flex:1,minWidth:'200px'}}>
          <div style={{height:'8px',background:'#eef1f5',borderRadius:'4px',overflow:'hidden'}}><div style={{width:`${persen}%`,height:'100%',background:'var(--mcc-blue)',transition:'width .4s ease'}}/></div>
          <div style={{fontSize:'13px',color:'var(--mcc-text-muted)',marginTop:'6px'}}>{persen}% · Pilih bin di kiri, klik rak di peta, lalu simpan. Semua part di bin itu ikut lokasinya.</div>
        </div>
      </section>

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,5fr) minmax(0,6fr)',gap:'20px',alignItems:'start'}}>
        {/* Daftar bin */}
        <section style={{...G.card,padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <input style={{...G.inp,flex:'1 1 160px',width:'auto'}} placeholder="Cari bin atau nama part" value={cari} onChange={e=>setCari(e.target.value)}/>
            <select style={{...G.inp,width:'150px',cursor:'pointer'}} value={pola} onChange={e=>setPola(e.target.value)}>{POLA_BIN.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <select style={{...G.inp,width:'150px',cursor:'pointer'}} value={tampil} onChange={e=>setTampil(e.target.value as any)}>
              <option value="belum">Belum ada rak</option><option value="sudah">Sudah ada rak</option><option value="semua">Semua bin</option>
            </select>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'13px',color:'var(--mcc-text-muted)'}}>
            <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}><input type="checkbox" checked={semuaTerpilih} onChange={toggleSemua}/>Pilih semua yang tampil ({terlihat.length})</label>
            <span>{dipilih.size} bin dipilih{dipilih.size>0&&<> · <button type="button" className="mcc-link-btn" onClick={()=>setDipilih(new Set())}>kosongkan</button></>}</span>
          </div>
          <div style={{maxHeight:'520px',overflowY:'auto',border:'1px solid var(--mcc-border)',borderRadius:'6px'}}>
            <table className="mcc-table" style={{width:'100%'}}>
              <thead><tr><th style={{width:'32px'}}></th><th>Bin</th><th>Part</th><th>Lokasi</th></tr></thead>
              <tbody>
                {terlihat.length===0&&<tr><td colSpan={4} style={{textAlign:'center',color:'var(--mcc-text-muted)',padding:'20px'}}>Tidak ada bin</td></tr>}
                {terlihat.map(b=>(
                  <tr key={b.nomor_bin} onClick={()=>toggle(b.nomor_bin)} style={{cursor:'pointer',background:dipilih.has(b.nomor_bin)?'var(--mcc-blue-soft)':undefined}}>
                    <td><input type="checkbox" checked={dipilih.has(b.nomor_bin)} onChange={()=>toggle(b.nomor_bin)} onClick={e=>e.stopPropagation()} aria-label={`Pilih ${b.nomor_bin}`}/></td>
                    <td style={{fontWeight:600,whiteSpace:'nowrap'}}>{b.nomor_bin}</td>
                    <td><div style={{fontSize:'13px'}}>{b.jumlah_part} part{b.jumlah_warning>0&&<span style={{color:'#c62828'}}> · {b.jumlah_warning} warning</span>}</div><div style={{fontSize:'12px',color:'var(--mcc-text-muted)',maxWidth:'220px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.contoh_part}</div></td>
                    <td style={{whiteSpace:'nowrap'}}>{b.rak_kode?`Rak ${b.rak_kode}${b.tingkat?` · S${b.tingkat}`:''}`:<span style={{color:'var(--mcc-text-muted)'}}>-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Peta + aksi */}
        <section style={{display:'flex',flexDirection:'column',gap:'16px'}}>
          <PetaRak rak={rak} terpilih={rakAktif} onPilih={setRakAktif} ruangEkstra={modeEdit?3:0}/>
          <div style={{display:'flex',gap:'16px',fontSize:'12px',color:'var(--mcc-text-muted)',alignItems:'center',flexWrap:'wrap'}}>
            <span><span style={{display:'inline-block',width:'10px',height:'10px',background:'#e8f1fd',border:'1px solid #9cc0f0',borderRadius:'2px',marginRight:'6px'}}/>Rak biru</span>
            <span><span style={{display:'inline-block',width:'10px',height:'10px',background:'#eef1f5',border:'1px solid #c4ccd6',borderRadius:'2px',marginRight:'6px'}}/>Rak abu-abu</span>
            <span><span style={{display:'inline-block',width:'8px',height:'8px',background:'#c62828',borderRadius:'50%',marginRight:'6px'}}/>Ada part warning</span>
            <span style={{flex:1}}/>
            <button type="button" className={modeEdit?'mcc-btn-primary':'mcc-btn-secondary'} onClick={()=>setModeEdit(m=>!m)}>{modeEdit?'Selesai ubah tata letak':'Ubah tata letak rak'}</button>
          </div>

          {modeEdit&&<RakEditor rak={rak} terpilih={rakDipilih} onPilih={setRakAktif} onBerubah={muat} kabar={kabar}/>}
          {modeEdit?null:!rakDipilih?(
            <div style={{...G.card,padding:'20px',color:'var(--mcc-text-muted)',fontSize:'14px'}}>Klik salah satu rak di peta.</div>
          ):(
            <div style={{...G.card,padding:'20px',display:'flex',flexDirection:'column',gap:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
                <div style={{fontSize:'18px',fontWeight:700}}>Rak {rakDipilih.kode}</div>
                <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{rakDipilih.jumlah_bin} bin · {rakDipilih.jumlah_part} part · <span style={{color:rakDipilih.jumlah_warning?'#c62828':undefined}}>{rakDipilih.jumlah_warning} warning</span></div>
              </div>

              <div style={{display:'flex',gap:'12px',alignItems:'flex-end',flexWrap:'wrap'}}>
                <label style={lblStyle}>Jumlah susun rak
                  <input type="number" min={1} max={20} style={{...G.inp,width:'120px'}} value={jumlahSusun} onChange={e=>setJumlahSusun(e.target.value)} placeholder="mis. 5"/></label>
                <button type="button" className="mcc-btn-secondary" onClick={simpanSusun}>Simpan jumlah susun</button>
              </div>

              <div style={{borderTop:'1px solid var(--mcc-border)',paddingTop:'16px',display:'flex',gap:'12px',alignItems:'flex-end',flexWrap:'wrap'}}>
                <label style={lblStyle}>Susun ke
                  {pilihanSusun.length>0
                    ?<select style={{...G.inp,width:'120px',cursor:'pointer'}} value={tingkat} onChange={e=>setTingkat(e.target.value)}><option value="">Pilih</option>{pilihanSusun.map(n=><option key={n} value={n}>{n}{n===1?' (bawah)':''}</option>)}</select>
                    :<input type="number" min={1} max={20} style={{...G.inp,width:'120px'}} value={tingkat} onChange={e=>setTingkat(e.target.value)} placeholder="opsional"/>}
                </label>
                <button type="button" className="mcc-btn-primary" disabled={simpan||!dipilih.size} onClick={()=>kirim(rakDipilih.id)}>{simpan?'Menyimpan...':`Simpan ${dipilih.size||''} bin ke Rak ${rakDipilih.kode}`}</button>
                <button type="button" className="mcc-btn-secondary" disabled={simpan||!dipilih.size} onClick={()=>kirim(null)}>Lepas dari rak</button>
              </div>

              <div>
                <div style={{fontSize:'14px',fontWeight:600,marginBottom:'8px'}}>Isi rak {rakDipilih.kode}</div>
                {isiRak.length===0?<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Belum ada bin di rak ini.</div>:(
                  <div style={{display:'flex',flexWrap:'wrap',gap:'6px',maxHeight:'180px',overflowY:'auto'}}>
                    {isiRak.map(b=>(
                      <button key={b.nomor_bin} type="button" onClick={()=>toggle(b.nomor_bin)} title={`${b.jumlah_part} part`}
                        style={{border:`1px solid ${dipilih.has(b.nomor_bin)?'var(--mcc-blue)':b.jumlah_warning?'#f3c2c2':'var(--mcc-border)'}`,background:dipilih.has(b.nomor_bin)?'var(--mcc-blue-soft)':'#fff',borderRadius:'6px',padding:'4px 8px',font:'inherit',fontSize:'12px',cursor:'pointer',color:b.jumlah_warning?'#c62828':'var(--mcc-text)'}}>
                        {b.tingkat?`S${b.tingkat} · `:''}{b.nomor_bin}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{fontSize:'12px',color:'var(--mcc-text-muted)',marginTop:'6px'}}>Klik bin di sini untuk memilihnya (mis. untuk dipindah atau dilepas).</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type JenisLaporan = 'periode'|'audit'|'stok_semua'|'stok_harian'|'stok'|'pemakaian'|'pinjam';
const LAPORAN_TABS: {id:JenisLaporan; label:string; ket:string}[] = [
  { id:'periode',   label:'Laporan periode (4 halaman)', ket:'Laporan lengkap siap cetak: ringkasan KPI, analisa per mesin & tim maintenance, biaya pemakaian (harga × qty), status stok & order, lembar pengesahan. Pilih "Minggu ini" untuk laporan mingguan.' },
  { id:'audit',     label:'Audit pengambilan part', ket:'Semua part yang sudah disetujui keluar, lengkap dengan teknisi, WO, dan jumlah foto bukti.' },
  { id:'stok_semua',label:'Stok semua part',        ket:'Semua spare part dengan stok saat ini, min stok, jumlah yang sedang dipesan teknisi (belum keluar), harga, dan nilai stok. Bisa dicari dan diunduh.' },
  { id:'stok_harian',label:'Stok harian',          ket:'Per part per hari: stok awal hari (sebelum transaksi), masuk, keluar, return, dan stok akhir. Hanya hari yang ada transaksinya. Bisa dicari dan diunduh Excel.' },
  { id:'stok',      label:'Stok kritis & reorder',   ket:'Part dengan stok di bawah reorder point, dengan rekomendasi jumlah pesan dan pemakaian 30 hari terakhir.' },
  { id:'pemakaian', label:'Pemakaian per mesin',     ket:'Jumlah permintaan dan item keluar per mesin/area pada periode yang dipilih.' },
  { id:'pinjam',    label:'Pinjam jatah antar mesin', ket:'Riwayat part yang diambil dari jatah mesin lain karena jatah mesinnya sendiri habis (untuk audit). Tercatat otomatis saat teknisi verifikasi.' },
];
const tglInput=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fmtWaktu=(v:any)=>v?tglDb(v).toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'-';

function unduhCSV(nama:string, header:string[], baris:(string|number|null|undefined)[][]) {
  // Pemisah titik koma agar langsung terbaca rapi di Excel berbahasa Indonesia
  const esc=(v:any)=>`"${String(v??'').replace(/"/g,'""')}"`;
  const isi='﻿'+[header,...baris].map(r=>r.map(esc).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([isi],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download=nama; a.click(); URL.revokeObjectURL(url);
}

// Unduh Excel asli (.xlsx): judul, info filter, lebar kolom otomatis, filter di baris judul kolom
async function unduhXLSX(nama:string, judul:string, info:string, header:string[], baris:(string|number|null|undefined)[][]) {
  const XLSX:any=await import('xlsx');
  const aoa:any[][]=[[judul],[info],[],header,...baris.map(r=>r.map(v=>v==null?'':v))];
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=header.map((h,i)=>({wch:Math.min(60,Math.max(String(h).length,...baris.slice(0,500).map(r=>String(r[i]??'').length))+2)}));
  ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:3,c:0},e:{r:3+baris.length,c:header.length-1}})};
  ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:Math.max(0,header.length-1)}},{s:{r:1,c:0},e:{r:1,c:Math.max(0,header.length-1)}}];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,judul.slice(0,31).replace(/[\\/?*:\[\]]/g,' '));
  XLSX.writeFile(wb,nama);
}

function LaporanV2() {
  const now=new Date();
  const [tab,setTab]=useState<JenisLaporan>('periode');
  const [dari,setDari]=useState(tglInput(new Date(now.getFullYear(),now.getMonth(),1)));
  const [sampai,setSampai]=useState(tglInput(now));
  const [area,setArea]=useState<'semua'|'molding'|'nonmolding'>('semua');
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [unduhPdf,setUnduhPdf]=useState(false);
  const [cari,setCari]=useState('');
  const [statusStok,setStatusStok]=useState<'semua'|'aman'|'warning'|'habis'>('semua');

  const query=`jenis=${tab}&dari=${dari}&sampai=${sampai}&area=${area}`;
  useEffect(()=>{
    if(tab==='periode'){setLoading(false);return;}
    let batal=false; setLoading(true); setError('');
    const url=tab==='pinjam'?`/api/jatah?riwayat=1&dari=${dari}&sampai=${sampai}`:`/api/laporan-v2?${query}`;
    fetch(url).then(r=>r.json()).then(d=>{ if(batal)return;
      if(tab==='pinjam'&&d.success){const rs=d.data||[];setData({jenis:'pinjam',rows:rs,ringkasan:{transaksi:rs.length,qty:rs.reduce((a:number,r:any)=>a+(r.qty||0),0)}});return;}
      if(d.success)setData(d); else {setData(null);setError(d.error||'Gagal memuat laporan');} })
      .catch(e=>{ if(!batal){setData(null);setError(e.message);} }).finally(()=>{ if(!batal)setLoading(false); });
    return()=>{batal=true;};
  },[query]);

  const semuaRows:any[]=data?.jenis===tab?data.rows:[];
  // Pencarian (semua kolom teks/angka) + filter status untuk tab Stok semua part
  const q=cari.trim().toLowerCase();
  const rows:any[]=semuaRows.filter((r:any)=>(!q||Object.values(r).some(v=>v!=null&&typeof v!=='object'&&String(v).toLowerCase().includes(q)))&&(tab!=='stok_semua'||statusStok==='semua'||r.status===statusStok));
  const rk=data?.jenis===tab?data.ringkasan:null;
  const periodeLabel=`${new Date(dari+'T00:00:00').toLocaleDateString('id-ID')} s/d ${new Date(sampai+'T00:00:00').toLocaleDateString('id-ID')}`;

  // Data unduhan per tab (CSV & Excel memakai data yang sama, mengikuti pencarian/filter)
  const dataEkspor=():{nama:string;judul:string;header:string[];baris:any[][]}|null=>{
    if(tab==='audit') return {nama:`Audit_Pengambilan_${dari}_sd_${sampai}.csv`,judul:'Audit pengambilan part',header:['No','Tanggal & jam disetujui','No. WO','Mesin / area','Kode 12NC','Nama part','Jumlah','Mendesak','Teknisi','Alasan pengambilan','Dipesan','Disiapkan','Jumlah foto'],baris:rows.map((r,i)=>[i+1,fmtWaktu(r.approved_at||r.created_at),r.nomor_wo,r.mesin_area,r.kode_12nc,r.part_nama,r.jumlah,r.is_urgent?'Ya':'Tidak',r.teknisi_nama,r.alasan_ambil||'',fmtWaktu(r.created_at),fmtWaktu(r.prepared_at),r.jumlah_foto])};
    if(tab==='stok') return {nama:`Stok_Kritis_${tglInput(new Date())}.csv`,judul:'Stok kritis & reorder',header:['No','Kode 12NC','Nama part','Kategori','Mesin','Lokasi','Bin','Stok','Reorder point','Keluar 30 hari','Rekomendasi pesan'],baris:rows.map((r,i)=>[i+1,r.kode_12nc,r.nama_part,r.is_critical?'Critical':'Normal',r.mesin,r.lokasi_simpan,r.nomor_bin,r.stok_saat_ini,r.reorder_point,r.keluar_30_hari,r.rekomendasi_pesan])};
    if(tab==='stok_semua') return {nama:`Stok_Semua_Part_${tglInput(new Date())}${statusStok!=='semua'?'_'+statusStok:''}.csv`,judul:'Stok semua part',header:['No','Kode 12NC','Nama part','Mesin','Bin','Rak','Stok','Min stok','Sedang dipesan','Stok tersedia','Status','Consumable','Harga satuan','Nilai stok','Jatah per mesin'],baris:rows.map((r,i)=>[i+1,r.kode_12nc,r.nama_part,r.mesin,r.nomor_bin,r.rak_kode?`${r.rak_kode}${r.rak_tingkat?' S'+r.rak_tingkat:''}`:'',r.stok_saat_ini,r.reorder_point,r.dipesan,r.tersedia,r.status==='habis'?'Habis':r.status==='warning'?'Warning':'Aman',r.is_consumable?'Ya':'Tidak',r.harga_satuan,r.nilai_stok,r.jatah_teks||''])};
    if(tab==='pinjam') return {nama:`Pinjam_Jatah_${dari}_sd_${sampai}.csv`,judul:'Pinjam jatah antar mesin',header:['No','Tanggal','Part','12NC','Qty','Mesin pengambil','Diambil dari jatah','Teknisi','Area request','ID request'],baris:rows.map((r,i)=>[i+1,fmtWaktu(r.created_at),r.nama_part,r.kode_12nc,r.qty,r.ke_mesin,r.dari_mesin,r.teknisi_nama,r.mesin_area,r.request_id])};
    if(tab==='stok_harian') return {nama:`Stok_Harian_${dari}_sd_${sampai}.csv`,judul:'Stok harian',header:['No','Hari','Tanggal','Kode 12NC','Nama part','Rak','Area','Mesin','Stok awal hari','Masuk','Keluar','Return','Stok akhir','Min stok','Status'],baris:rows.map((r,i)=>[i+1,r.hari,r.tanggal.split('-').reverse().join('/'),r.kode_12nc,r.nama_part,r.nomor_bin,r.area==='molding'?'Molding':r.area==='nonmolding'?'Non-molding':'Consumable / lainnya',r.mesin,r.stok_awal,r.masuk,r.keluar,r.retur,r.stok_akhir,r.min_stok,r.stok_akhir<=0?'Habis':r.di_bawah_min?'Di bawah min':'Aman'])};
    if(tab==='pemakaian') return {nama:`Pemakaian_per_Mesin_${dari}_sd_${sampai}.csv`,judul:'Pemakaian per mesin',header:['No','Mesin / area','Area','Jumlah permintaan','Total item','Part terbanyak'],baris:rows.map((r,i)=>[i+1,r.mesin,r.area==='molding'?'Molding':r.area==='nonmolding'?'Non-molding':'Consumable / lainnya',r.jumlah_permintaan,r.total_item,r.part_teratas])};
    return null;
  };
  const infoEkspor=()=>[tab==='stok'||tab==='stok_semua'?`Kondisi stok per ${new Date().toLocaleString('id-ID')}`:`Periode ${periodeLabel}`,
    tab!=='pinjam'?`Area: ${area==='semua'?'Semua area':area==='molding'?'Molding':'Non-molding'}`:'',tab==='stok_semua'&&statusStok!=='semua'?`Status: ${statusStok}`:'',
    q?`Pencarian: "${cari.trim()}"`:'',`${rows.length} baris`].filter(Boolean).join(' · ');
  const exportCSV=()=>{const d=dataEkspor();if(d)unduhCSV(d.nama,d.header,d.baris);};
  // Audit: file dibuat server supaya foto bukti ikut masuk (PDF + foto / Excel + foto)
  const unduhServer=async(format:'pdf'|'xlsx',foto:boolean)=>{
    setUnduhPdf(true);setError('');
    try{
      const res=await fetch(`/api/laporan-v2?${query}&format=${format}${foto?'&foto=1':''}`);
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Gagal membuat file');}
      const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`Audit_Pengambilan_${dari}_sd_${sampai}${foto&&format==='pdf'?'_foto':''}.${format}`;a.click();URL.revokeObjectURL(url);
    }catch(e:any){setError(e.message);}finally{setUnduhPdf(false);}
  };
  const exportXLSX=async()=>{if(tab==='audit')return unduhServer('xlsx',true);const d=dataEkspor();if(!d)return;try{await unduhXLSX(d.nama.replace(/\.csv$/i,'.xlsx'),`${d.judul} - Store MCC`,infoEkspor(),d.header,d.baris);}catch(e:any){setError('Gagal membuat file Excel: '+(e?.message||e));}};
  const exportPDF=async()=>{
    setUnduhPdf(true);
    try{
      const res=await fetch(`/api/laporan-v2?${query}&format=pdf`);
      if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.error||'Gagal membuat PDF');}
      const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`Audit_Pengambilan_${dari}_sd_${sampai}.pdf`;a.click();URL.revokeObjectURL(url);
    }catch(e:any){setError(e.message);}finally{setUnduhPdf(false);}
  };

  const kpis:{label:string;value:any;color?:string}[] =
    tab==='audit'&&rk?[
      {label:'Permintaan masuk',value:rk.total_permintaan},
      {label:'Disetujui',value:rk.disetujui,color:'var(--mcc-success)'},
      {label:'Ditolak',value:rk.ditolak,color:'var(--mcc-danger)'},
      {label:'Total item keluar',value:rk.total_item_keluar},
      {label:'Rata-rata respons',value:rk.rata_respons_menit===null?'-':`${rk.rata_respons_menit} menit`},
    ]:tab==='stok_semua'&&rk?[
      {label:'Total part',value:rk.total},
      {label:'Aman',value:rk.aman,color:'var(--mcc-success)'},
      {label:'Warning',value:rk.warning,color:'var(--mcc-warning)'},
      {label:'Habis',value:rk.habis,color:'var(--mcc-danger)'},
      {label:'Sedang dipesan',value:`${rk.dipesan} pcs`},
      {label:'Nilai stok',value:rk.nilai_stok?'Rp '+Math.round(rk.nilai_stok).toLocaleString('id-ID'):'-'},
    ]:tab==='stok'&&rk?[
      {label:'Part di bawah reorder',value:rk.total,color:'var(--mcc-warning)'},
      {label:'Stok habis',value:rk.habis,color:'var(--mcc-danger)'},
      {label:'Part kritis',value:rk.kritis,color:'var(--mcc-danger)'},
    ]:tab==='pinjam'&&rk?[
      {label:'Kejadian pinjam',value:rk.transaksi,color:rk.transaksi?'var(--mcc-warning)':undefined},
      {label:'Total pcs dipinjam',value:rk.qty},
    ]:tab==='stok_harian'&&rk?[
      {label:'Part bergerak',value:rk.part},
      {label:'Hari ada transaksi',value:rk.hari},
      {label:'Total masuk',value:rk.masuk,color:'#1e7e34'},
      {label:'Total keluar + return',value:rk.keluar+rk.retur,color:'#c62828'},
    ]:tab==='pemakaian'&&rk?[
      {label:'Mesin / area tercatat',value:rk.total_mesin},
      {label:'Total item keluar',value:rk.total_item},
    ]:[];
  const maxItem=Math.max(1,...rows.map((r:any)=>r.total_item||0));

  return (
    <div style={{padding:'28px 32px',display:'flex',flexDirection:'column',gap:'20px'}}>
      <div role="tablist" aria-label="Jenis laporan" style={{display:'flex',gap:'4px',borderBottom:'1px solid var(--mcc-border)'}}>
        {LAPORAN_TABS.map(t=>(
          <button key={t.id} role="tab" aria-selected={tab===t.id} onClick={()=>setTab(t.id)}
            style={{padding:'10px 16px',border:'none',borderBottom:`2px solid ${tab===t.id?'var(--mcc-blue)':'transparent'}`,marginBottom:'-1px',background:'transparent',color:tab===t.id?'var(--mcc-blue)':'var(--mcc-text-muted)',font:'inherit',fontSize:'15px',fontWeight:600,cursor:'pointer'}}>
            {t.label}
          </button>
        ))}
      </div>
      <p style={{margin:0,fontSize:'15px',color:'var(--mcc-text-muted)'}}>{LAPORAN_TABS.find(t=>t.id===tab)?.ket}</p>

      <div style={{display:'flex',flexWrap:'wrap',alignItems:'flex-end',gap:'12px'}}>
        {tab!=='stok'&&tab!=='stok_semua'&&(<>
          <label style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Dari tanggal
            <input type="date" value={dari} max={sampai} onChange={e=>e.target.value&&setDari(e.target.value)} style={{...G.inp,width:'170px'}}/></label>
          <label style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Sampai tanggal
            <input type="date" value={sampai} min={dari} onChange={e=>e.target.value&&setSampai(e.target.value)} style={{...G.inp,width:'170px'}}/></label>
        </>)}
        {tab!=='periode'&&tab!=='pinjam'&&<label style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Area
          <select value={area} onChange={e=>setArea(e.target.value as any)} style={{...G.inp,width:'170px',cursor:'pointer'}}>
            <option value="semua">Semua area</option><option value="molding">Molding</option><option value="nonmolding">Non-molding</option>
          </select></label>}
        {tab==='periode'&&<div style={{display:'flex',gap:'6px'}}>
          <button type="button" className="mcc-btn-secondary" onClick={()=>{const n=new Date();const sen=new Date(n.getFullYear(),n.getMonth(),n.getDate()-((n.getDay()+6)%7));setDari(tglInput(sen));setSampai(tglInput(n));}}>Minggu ini</button>
          <button type="button" className="mcc-btn-secondary" onClick={()=>{const n=new Date();const sen=new Date(n.getFullYear(),n.getMonth(),n.getDate()-((n.getDay()+6)%7)-7);setDari(tglInput(sen));setSampai(tglInput(new Date(sen.getFullYear(),sen.getMonth(),sen.getDate()+6)));}}>Minggu lalu</button>
          <button type="button" className="mcc-btn-secondary" onClick={()=>{const n=new Date();setDari(tglInput(new Date(n.getFullYear(),n.getMonth(),1)));setSampai(tglInput(n));}}>Bulan ini</button>
          <button type="button" className="mcc-btn-secondary" onClick={()=>{const n=new Date();setDari(tglInput(new Date(n.getFullYear(),n.getMonth()-1,1)));setSampai(tglInput(new Date(n.getFullYear(),n.getMonth(),0)));}}>Bulan lalu</button>
        </div>}
        {tab==='stok_semua'&&<label style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Status stok
          <select value={statusStok} onChange={e=>setStatusStok(e.target.value as any)} style={{...G.inp,width:'150px',cursor:'pointer'}}>
            <option value="semua">Semua</option><option value="aman">Aman</option><option value="warning">Warning</option><option value="habis">Habis</option>
          </select></label>}
        {tab!=='periode'&&<label style={{display:'flex',flexDirection:'column',gap:'6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>Cari
          <input type="search" value={cari} onChange={e=>setCari(e.target.value)} placeholder="Nama part, 12NC, mesin, bin..." style={{...G.inp,width:'260px'}}/></label>}
        <div style={{flex:1}}/>
        {tab!=='periode'&&<button type="button" className="mcc-btn-primary" disabled={!rows.length||unduhPdf} onClick={exportXLSX}>{tab==='audit'?'Unduh Excel + foto':'Unduh Excel (.xlsx)'}{q||(tab==='stok_semua'&&statusStok!=='semua')?` · ${rows.length} baris`:''}</button>}
        {tab!=='periode'&&<button type="button" className="mcc-btn-secondary" disabled={!rows.length} onClick={exportCSV}>CSV</button>}
        {tab==='audit'&&<button type="button" className="mcc-btn-secondary" disabled={unduhPdf} onClick={()=>unduhServer('pdf',true)} title="PDF dengan lampiran foto bukti (admin siapkan & verifikasi teknisi)">{unduhPdf?'Menyiapkan...':'Unduh PDF + foto'}</button>}
        {tab==='audit'&&<button type="button" className="mcc-btn-primary" disabled={unduhPdf} onClick={exportPDF}>{unduhPdf?'Menyiapkan PDF...':'Unduh PDF untuk cetak'}</button>}
      </div>

      {tab==='periode'&&<LaporanPeriode dari={dari} sampai={sampai}/>}
      {tab!=='periode'&&kpis.length>0&&(
        <section aria-label="Ringkasan" style={{display:'grid',gridTemplateColumns:`repeat(${kpis.length},minmax(0,1fr))`,background:'var(--mcc-surface)',border:'1px solid var(--mcc-border)',borderRadius:'8px'}}>
          {kpis.map((k,i)=>(
            <div key={k.label} style={{padding:'16px 20px',borderLeft:i>0?'1px solid #e6eaf0':'none'}}>
              <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{k.label}</div>
              <div style={{fontSize:'26px',fontWeight:700,color:k.color||'var(--mcc-text)',fontVariantNumeric:'tabular-nums'}}>{k.value}</div>
            </div>
          ))}
        </section>
      )}
      {tab==='audit'&&rk&&Object.keys(rk.alasan_tolak||{}).length>0&&(
        <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>
          Alasan penolakan: {Object.entries(rk.alasan_tolak).map(([a,n])=>`${a} (${n})`).join(', ')}
        </div>
      )}
      {tab==='audit'&&rk&&rk.data_respons>0&&rk.data_respons<rk.disetujui&&(
        <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Rata-rata respons dihitung dari {rk.data_respons} permintaan yang punya catatan waktu. Permintaan lama belum tercatat waktunya.</div>
      )}

      {tab!=='periode'&&<section aria-label="Isi laporan" style={{background:'var(--mcc-surface)',border:'1px solid var(--mcc-border)',borderRadius:'8px',overflow:'hidden'}}>
        <div style={{padding:'14px 24px',borderBottom:'1px solid #e6eaf0',display:'flex',justifyContent:'space-between',gap:'12px',fontSize:'14px',color:'var(--mcc-text-muted)'}}>
          <span>{tab==='stok'||tab==='stok_semua'?'Kondisi stok saat ini':periodeLabel}</span>
          <span>{loading?'Memuat...':rows.length!==semuaRows.length?`${rows.length} dari ${semuaRows.length} baris`:`${rows.length} baris`}</span>
        </div>
        {error?(
          <div role="alert" style={{padding:'24px',color:'var(--mcc-danger)',fontSize:'15px'}}>{error}</div>
        ):!loading&&rows.length===0?(
          <div style={{padding:'32px 24px',fontSize:'15px',color:'var(--mcc-text-muted)'}}>Tidak ada data untuk filter ini.</div>
        ):(
          <div style={{overflowX:'auto',maxHeight:'560px',overflowY:'auto',opacity:loading?0.5:1,transition:'opacity 150ms'}}>
            {tab==='audit'&&(
              <table className="mcc-table"><thead><tr><th>Tanggal disetujui</th><th>No. WO</th><th>Mesin / area</th><th>Kode 12NC</th><th>Nama part</th><th style={{textAlign:'right'}}>Jml</th><th>Teknisi</th><th>Alasan</th><th style={{textAlign:'right'}}>Foto</th></tr></thead>
                <tbody>{rows.map((r:any)=>(
                  <tr key={r.id}>
                    <td style={{whiteSpace:'nowrap'}}>{fmtWaktu(r.approved_at||r.created_at)}</td>
                    <td>{r.nomor_wo||'-'}</td><td>{r.mesin_area||'-'}</td>
                    <td style={{color:r.kode_12nc?'var(--mcc-text)':'var(--mcc-text-muted)'}}>{r.kode_12nc||'-'}</td>
                    <td style={{fontWeight:600}}>{r.part_nama}{r.is_urgent?<span className="mcc-badge mcc-badge-danger" style={{marginLeft:'8px'}}>Mendesak</span>:null}</td>
                    <td style={{textAlign:'right'}}>{r.jumlah}</td><td>{r.teknisi_nama}</td><td style={{maxWidth:'220px'}}>{r.alasan_ambil||'-'}</td>
                    <td style={{textAlign:'right',color:r.jumlah_foto?'var(--mcc-text)':'var(--mcc-danger)'}}>{r.jumlah_foto}</td>
                  </tr>))}</tbody></table>
            )}
            {tab==='stok_semua'&&(
              <table className="mcc-table"><thead><tr><th>Kode 12NC</th><th>Nama part</th><th>Mesin</th><th>Bin · rak</th><th style={{textAlign:'right'}}>Stok</th><th style={{textAlign:'right'}}>Min</th><th style={{textAlign:'right'}}>Dipesan</th><th style={{textAlign:'right'}}>Tersedia</th><th style={{textAlign:'right'}}>Harga</th><th>Status</th><th>Jatah per mesin</th></tr></thead>
                <tbody>{rows.map((r:any)=>(
                  <tr key={r.id}>
                    <td>{r.kode_12nc||'-'}</td>
                    <td style={{fontWeight:600}}>{r.nama_part}{r.is_consumable?<span style={{marginLeft:'6px',fontSize:'11px',color:'#b45309'}}>consumable</span>:null}</td>
                    <td>{r.mesin||'-'}</td>
                    <td style={{whiteSpace:'nowrap'}}>{r.nomor_bin||'-'}{r.rak_kode?` · Rak ${r.rak_kode}${r.rak_tingkat?` S${r.rak_tingkat}`:''}`:''}</td>
                    <td style={{textAlign:'right',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{r.stok_saat_ini}</td>
                    <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{r.reorder_point}</td>
                    <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:r.dipesan?'var(--mcc-blue)':'var(--mcc-text-muted)'}}>{r.dipesan||'-'}</td>
                    <td style={{textAlign:'right',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{r.tersedia}</td>
                    <td style={{textAlign:'right',whiteSpace:'nowrap',color:r.harga_satuan==null?'var(--mcc-text-muted)':undefined}}>{r.harga_satuan==null?'-':'Rp '+Number(r.harga_satuan).toLocaleString('id-ID')}</td>
                    <td><span style={{fontSize:'12px',fontWeight:700,color:r.status==='habis'?'var(--mcc-danger)':r.status==='warning'?'var(--mcc-warning)':'var(--mcc-success)'}}>{r.status==='habis'?'Habis':r.status==='warning'?'Warning':'Aman'}</span></td>
                    <td style={{fontSize:'12px',color:'var(--mcc-text-muted)'}}>{r.jatah_teks||'-'}</td>
                  </tr>))}</tbody></table>
            )}
            {tab==='stok'&&(
              <table className="mcc-table"><thead><tr><th>Kode 12NC</th><th>Nama part</th><th>Mesin</th><th>Bin</th><th style={{textAlign:'right'}}>Stok / reorder</th><th style={{textAlign:'right'}}>Keluar 30 hari</th><th style={{textAlign:'right'}}>Rekomendasi pesan</th></tr></thead>
                <tbody>{rows.map((r:any)=>(
                  <tr key={r.id}>
                    <td>{r.kode_12nc||'-'}</td>
                    <td style={{fontWeight:600}}>{r.nama_part}{r.is_critical?<span className="mcc-badge mcc-badge-danger" style={{marginLeft:'8px'}}>Kritis</span>:null}</td>
                    <td>{r.mesin||'-'}</td><td>{[r.lokasi_simpan,r.nomor_bin].filter(Boolean).join(', ')||'-'}</td>
                    <td style={{textAlign:'right',fontWeight:700,color:r.stok_saat_ini===0?'var(--mcc-danger)':'var(--mcc-warning)'}}>{r.stok_saat_ini} / {r.reorder_point}</td>
                    <td style={{textAlign:'right'}}>{r.keluar_30_hari}</td>
                    <td style={{textAlign:'right',fontWeight:600,color:'var(--mcc-blue)'}}>{r.rekomendasi_pesan}</td>
                  </tr>))}</tbody></table>
            )}
            {tab==='stok_harian'&&(
              <table className="mcc-table"><thead><tr><th>Tanggal</th><th>Nama part</th><th>Kode 12NC</th><th>Rak</th><th>Area</th><th style={{textAlign:'right'}}>Stok awal hari</th><th style={{textAlign:'right'}}>Masuk</th><th style={{textAlign:'right'}}>Keluar</th><th style={{textAlign:'right'}}>Return</th><th style={{textAlign:'right'}}>Stok akhir</th></tr></thead>
              <tbody>{rows.map((r:any,i:number)=>(
                <tr key={`${r.part_id}-${r.tanggal}-${i}`}>
                  <td style={{whiteSpace:'nowrap'}}>{r.hari}, {r.tanggal.split('-').reverse().join('/')}</td>
                  <td>{r.nama_part}</td><td>{r.kode_12nc||'-'}</td><td>{r.nomor_bin||'-'}</td>
                  <td>{r.area==='molding'?'Molding':r.area==='nonmolding'?'Non-molding':'Consumable / lainnya'}</td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{r.stok_awal}</td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:r.masuk?'#1e7e34':undefined}}>{r.masuk?`+${r.masuk}`:'-'}</td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:r.keluar?'#c62828':undefined}}>{r.keluar?`-${r.keluar}`:'-'}</td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',color:r.retur?'#8a5a00':undefined}}>{r.retur?`-${r.retur}`:'-'}</td>
                  <td style={{textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:700,color:r.di_bawah_min?'#c62828':undefined}}>{r.stok_akhir}</td>
                </tr>))}</tbody></table>
            )}
            {tab==='pinjam'&&(
              <table className="mcc-table"><thead><tr><th>Tanggal</th><th>Part</th><th style={{textAlign:'right'}}>Qty</th><th>Mesin pengambil</th><th>Dari jatah</th><th>Teknisi</th><th>Area request</th></tr></thead>
                <tbody>{rows.map((r:any)=>(
                  <tr key={r.id}>
                    <td style={{whiteSpace:'nowrap'}}>{fmtWaktu(r.created_at)}</td>
                    <td style={{fontWeight:600}}>{r.nama_part}{r.kode_12nc?<div style={{fontSize:'12px',fontWeight:400,color:'var(--mcc-text-muted)'}}>{r.kode_12nc}</div>:null}</td>
                    <td style={{textAlign:'right',fontWeight:700}}>{r.qty}</td>
                    <td>{r.ke_mesin||'-'}</td><td style={{color:'#8a5a00',fontWeight:600}}>{r.dari_mesin||'-'}</td>
                    <td>{r.teknisi_nama||'-'}</td><td style={{color:'var(--mcc-text-muted)'}}>{r.mesin_area||'-'}</td>
                  </tr>))}</tbody></table>
            )}
            {tab==='pemakaian'&&(
              <table className="mcc-table"><thead><tr><th>Mesin / area</th><th>Area</th><th style={{textAlign:'right'}}>Permintaan</th><th style={{width:'32%'}}>Total item keluar</th><th>Part terbanyak</th></tr></thead>
                <tbody>{rows.map((r:any)=>(
                  <tr key={r.mesin}>
                    <td style={{fontWeight:600}}>{r.mesin}</td>
                    <td>{r.area==='molding'?'Molding':r.area==='nonmolding'?'Non-molding':'Consumable / lainnya'}</td>
                    <td style={{textAlign:'right'}}>{r.jumlah_permintaan}</td>
                    <td><div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <div style={{flex:1,height:'8px',background:'#eef1f5',borderRadius:'4px'}}><div style={{width:`${Math.max(3,(r.total_item/maxItem)*100)}%`,height:'8px',borderRadius:'4px',background:'var(--mcc-blue)'}}/></div>
                      <span style={{minWidth:'36px',textAlign:'right',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{r.total_item}</span>
                    </div></td>
                    <td style={{color:'var(--mcc-text-muted)'}}>{r.part_teratas}</td>
                  </tr>))}</tbody></table>
            )}
          </div>
        )}
      </section>}
    </div>
  );
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

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [loginNama,  setLoginNama]    = useState('');
  const [loginRole,  setLoginRole]    = useState('');
  const [loginTime,  setLoginTime]    = useState('');
  const [loginPerms, setLoginPerms]   = useState<string[]>([]);
  const [loginMesin, setLoginMesin]   = useState('');
  const [showLogout, setShowLogout]   = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string|null>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);

  const [showPrepareModal, setShowPrepareModal] = useState<{ requestId: number; requestData: any } | null>(null);
  const [preparePhoto, setPreparePhoto] = useState<string>('');
  const [prepareNote, setPrepareNote] = useState<string>('');
  const [prepareError, setPrepareError] = useState<string>('');
  const [preparingRequestId, setPreparingRequestId] = useState<number | null>(null);

  useEffect(() => {
    // Load persisted leader data
    try {
      const savedMoldingSup = localStorage.getItem('mcc_moldingSupervisor');
      const savedNMSup = localStorage.getItem('mcc_nmSupervisor');
      if (savedMoldingSup) setMoldingSupervisor(savedMoldingSup);
      if (savedNMSup) setNonMoldingSupervisor(savedNMSup);
      const savedMolding = localStorage.getItem('mcc_moldingTL');
      const savedNonMolding = localStorage.getItem('mcc_nonMoldingTeknisi');
      if (savedMolding) setMoldingTLList(JSON.parse(savedMolding));
      if (savedNonMolding) setNonMoldingTeknisi(JSON.parse(savedNonMolding));
      // Load mesin data
      const savedMesinMolding = localStorage.getItem('mcc_mesinMolding');
      const savedMesinNM = localStorage.getItem('mcc_mesinNonMolding');
      if (savedMesinMolding) setMesinMoldingData(JSON.parse(savedMesinMolding));
      if (savedMesinNM) setMesinNonMoldingData(JSON.parse(savedMesinNM));
    } catch {}
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem('mcc_login');
    if (saved) { const data = JSON.parse(saved); setIsLoggedIn(true); setLoginNama(data.nama); setLoginRole(data.role); setLoginTime(data.time); setLoginPerms(data.perms||['all']); setLoginMesin(data.mesin||''); }
  }, []);

  const handleLogin = (nama: string, role: string, perms: string[], mesin: string) => {
    const time = new Date().toLocaleString('id-ID');
    sessionStorage.setItem('mcc_login', JSON.stringify({nama,role,time,perms,mesin}));
    setLoginNama(nama); setLoginRole(role); setLoginTime(time); setLoginPerms(perms); setLoginMesin(mesin);
    setTransitioning(true);
    setTimeout(() => { setIsLoggedIn(true); setActivePage('dashboard'); setTimeout(() => setTransitioning(false), 200); }, 2200);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('mcc_login'); setShowLogout(false); setTransitioning(true);
    setTimeout(() => { setIsLoggedIn(false); setLoginNama(''); setLoginRole(''); setLoginPerms([]); setLoginMesin(''); setActivePage('dashboard'); setTransitioning(false); }, 400);
  };

  const [activePage, setActivePage] = useState('dashboard');
  const [, setVersiJam] = useState(0);
  // Daftar lengkap part aktif dari master (sama dengan Kelola part) untuk Part In
  const [partsMaster, setPartsMaster] = useState<any[]|null>(null);
  const muatPartsMaster=()=>fetch('/api/mesin?parts=all',{cache:'no-store'}).then(r=>r.json()).then(d=>{if(d?.success&&Array.isArray(d.data))setPartsMaster(d.data);}).catch(()=>{});
  useEffect(()=>{fetch('/api/waktu').then(r=>r.json()).then(d=>{const k=Number(d?.koreksi_ms)||0;if(k!==KOREKSI_DB_MS){KOREKSI_DB_MS=k;setVersiJam(v=>v+1);}}).catch(()=>{});},[]);
  const [pageAnim, setPageAnim]     = useState('in');
  const prevPage = useRef('dashboard');
  const navigateTo = (page: string) => {
    if (page === activePage) return;
    setPageAnim('out');
    setTimeout(() => { prevPage.current = activePage; setActivePage(page); setPageAnim('in'); }, 200);
  };

  const [msg, setMsg]               = useState<{type:'ok'|'err';text:string}|null>(null);
  const [requests, setRequests]     = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [showNotif, setShowNotif]   = useState(false);
  const [newNotif, setNewNotif]     = useState(false);
  const prevPending = useRef(0);
  const rejectTahu = useRef<Set<number>|null>(null);
  const sudahMuatReq = useRef(false);
  const [rejectAlert,setRejectAlert]=useState<any[]>([]);
  const [izinNotif,setIzinNotif]=useState<'ok'|'minta'|'tidak_bisa'|'ditolak'|'tutup'>('ok');
  useEffect(()=>{try{
    if(localStorage.getItem('mcc_notif_banner')==='tutup'){setIzinNotif('tutup');return;}
    if(!('Notification' in window)||!(window as any).isSecureContext){setIzinNotif('tidak_bisa');return;}
    setIzinNotif(Notification.permission==='granted'?'ok':Notification.permission==='denied'?'ditolak':'minta');
  }catch{setIzinNotif('tidak_bisa');}},[]);
  const [partsList, setPartsList]   = useState<any[]>([]);
  const [searchPart, setSearchPart] = useState('');
  const [filterKat, setFilterKat]   = useState('Semua');
  const [partsJenis, setPartsJenis] = useState<'semua'|'molding'|'nonmolding'>('semua');
  const [partsDrillMesin, setPartsDrillMesin] = useState<string|null>(null);
  const [masterTab, setMasterTab] = useState<'part'|'mesin'>('part');
  const versiBaru = useVersiBaru();
  const [masterLama, setMasterLama] = useState(false);
  const [riwayatLama, setRiwayatLama] = useState(false);
  const [katalogLama, setKatalogLama] = useState(false); // Katalog baru (Master Data) sebagai default
  const [mesinJenisList, setMesinJenisList] = useState<any[]>([]); // Tahap 4: Riwayat per mesin sebagai default // Tahap 2: Master Data baru (DB) sebagai default
  const [mesinTab, setMesinTab] = useState<'molding'|'nonmolding'>('molding');
  const [showTambahMesin, setShowTambahMesin] = useState(false);
  const [partImportFiles, setPartImportFiles] = useState<{name:string;size:string;progress:number;status:'uploading'|'done'|'error';rows?:any[]}[]>([]);
  const [isDragOverPart, setIsDragOverPart] = useState(false);
  const [partImportTab, setPartImportTab] = useState<'manual'|'import'>('manual');
  const partImportRef = useRef<HTMLInputElement>(null);
  const [selectedMesinGroup, setSelectedMesinGroup] = useState<string|null>(null);
  const [editMesin, setEditMesin] = useState<any|null>(null);
  const [formMesin, setFormMesin] = useState({nama:'',emoji:'⚙️',color:'#0b5ed7',jenis:'molding' as 'molding'|'nonmolding',tl:'',keterangan:''});
  const [mesinMoldingData, setMesinMoldingData] = useState([
    {nama:'Soother B2',emoji:'🧸',color:'#0b5ed7',jenis:'molding',tl:'TL Soother B2',keterangan:'Mesin assembly soother utama'},
    {nama:'LSR',emoji:'💧',color:'#1e7e34',jenis:'molding',tl:'TL Soother B2',keterangan:'Liquid Silicone Rubber'},
    {nama:'Aoki',emoji:'💨',color:'#8a5a00',jenis:'molding',tl:'TL AOKI',keterangan:'Stretch blow molding'},
    {nama:'Haitian 1K',emoji:'🏭',color:'#6d28d9',jenis:'molding',tl:'TL AOKI',keterangan:'Injection molding 1 komponen'},
    {nama:'Haitian 2K',emoji:'🏭',color:'#6d28d9',jenis:'molding',tl:'TL AOKI',keterangan:'Injection molding 2 komponen'},
    {nama:'Maintenance Mold',emoji:'🔩',color:'#1e7e34',jenis:'molding',tl:'TL Maintenance Mold',keterangan:'Perawatan cetakan mold'},
    {nama:'Maintenance Machine',emoji:'⚙️',color:'#8a5a00',jenis:'molding',tl:'TL Maintenance Mold',keterangan:'Perawatan mesin umum'},
    {nama:'Feeder',emoji:'📦',color:'#0b5ed7',jenis:'molding',tl:'TL Soother B2',keterangan:'Pengisian material'},
  ]);
  const [mesinNonMoldingData, setMesinNonMoldingData] = useState([
    {nama:'CMYK 1',emoji:'🖨️',color:'#c2410c',jenis:'nonmolding',tl:'EDI SUSILO',keterangan:'Mesin cetak CMYK unit 1'},
    {nama:'CMYK 2',emoji:'🖨️',color:'#c2410c',jenis:'nonmolding',tl:'EDI SUSILO',keterangan:'Mesin cetak CMYK unit 2'},
    {nama:'GAIYA MANUAL 1',emoji:'🤖',color:'#0e7490',jenis:'nonmolding',tl:'EDI SUSILO',keterangan:'Gaiya manual unit 1'},
    {nama:'GAIYA MANUAL 2',emoji:'🤖',color:'#0e7490',jenis:'nonmolding',tl:'EDI SUSILO',keterangan:'Gaiya manual unit 2'},
    {nama:'GAIYA AUTO',emoji:'🤖',color:'#0e7490',jenis:'nonmolding',tl:'EDI SUSILO',keterangan:'Gaiya otomatis'},

    {nama:'TAMPON 1',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 1'},
    {nama:'TAMPON 2',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 2'},
    {nama:'TAMPON 3',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 3'},
    {nama:'TAMPON 4',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 4'},
    {nama:'TAMPON 5',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 5'},
    {nama:'TAMPON 6',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 6'},
    {nama:'TAMPON 7',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 7'},
    {nama:'TAMPON 8',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 8'},
    {nama:'TAMPON 9',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 9'},
    {nama:'TAMPON 10',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 10'},
    {nama:'TAMPON 11',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 11'},
    {nama:'TAMPON 12',emoji:'🖱️',color:'#6d28d9',jenis:'nonmolding',tl:'RIDWAN HUTASOIT',keterangan:'Tampon printing unit 12'},
    {nama:'Batch Down',emoji:'🔧',color:'#0b5ed7',jenis:'nonmolding',tl:'ARDIAN KURNIAWAN',keterangan:'Batch down assembly'},
    {nama:'Flowthrough',emoji:'🔧',color:'#0b5ed7',jenis:'nonmolding',tl:'ARDIAN KURNIAWAN',keterangan:'Flowthrough assembly'},
    {nama:'External Siliting 1',emoji:'✂️',color:'#0f766e',jenis:'nonmolding',tl:'ARDIAN KURNIAWAN',keterangan:'External slitting unit 1'},
    {nama:'External Siliting 2',emoji:'✂️',color:'#0f766e',jenis:'nonmolding',tl:'ARDIAN KURNIAWAN',keterangan:'External slitting unit 2'},
    {nama:'External Siliting 3',emoji:'✂️',color:'#0f766e',jenis:'nonmolding',tl:'ARDIAN KURNIAWAN',keterangan:'External slitting unit 3'},
    {nama:'External Siliting 4',emoji:'✂️',color:'#0f766e',jenis:'nonmolding',tl:'ARDIAN KURNIAWAN',keterangan:'External slitting unit 4'},
    {nama:'External Siliting 5',emoji:'✂️',color:'#0f766e',jenis:'nonmolding',tl:'ARDIAN KURNIAWAN',keterangan:'External slitting unit 5'},
  ]);
  const [showPartForm, setShowPartForm] = useState(false);
  const [editPart, setEditPart]     = useState<any|null>(null);
  const [formPart, setFormPart]     = useState({ nama_part:'',nama:'',kode_12nc:'',kategori:'Mold',mesin:'',lokasi_simpan:'Spare Part Rack',nomor_bin:'',stok_saat_ini:'',reorder_point:'',is_critical:false });
  // ── Lokasi rak untuk form (Tahap 1) ──
  const [lokasiData, setLokasiData] = useState<{rak:RakInfo[];bins:BinInfo[]}>({rak:[],bins:[]});
  const [partRak, setPartRak]       = useState({kode:'',tingkat:''});
  const [partInRak, setPartInRak]   = useState({kode:'',tingkat:''});
  const [partOutText, setPartOutText] = useState('');
  const muatLokasi = () => fetch('/api/lokasi-rak').then(r=>r.json()).then(d=>{if(d.success)setLokasiData({rak:d.rak||[],bins:d.bins||[]});}).catch(()=>{});
  const binInfoOf = (bin:string) => { const b=bin.trim().toLowerCase(); return b?lokasiData.bins.find(x=>x.nomor_bin.toLowerCase()===b):undefined; };
  // Bin yang sudah dipetakan langsung mengisi rak-nya (admin tetap bisa menggantinya setelah itu)
  const isiRakDariBin = (bin:string, setter:(v:{kode:string;tingkat:string})=>void, _sekarang:{kode:string;tingkat:string}) => {
    const info=binInfoOf(bin);
    if(info?.rak_kode)setter({kode:info.rak_kode,tingkat:info.tingkat?String(info.tingkat):''});
  };
  // Simpan lokasi bin ke rak (dipanggil setelah part / Part In tersimpan). Return pesan tambahan.
  const simpanLokasiBin = async (bin:string, nilai:{kode:string;tingkat:string}):Promise<string> => {
    const nb=bin.trim(); const kode=nilai.kode.trim().replace(/^rak\s*/i,'').toUpperCase();
    if(!nb||!kode)return '';
    const rak=lokasiData.rak.find(r=>r.kode===kode); if(!rak)return ' (rak tidak ditemukan, lokasi tidak disimpan)';
    const info=binInfoOf(nb); const tingkat=nilai.tingkat?Number(nilai.tingkat):null;
    if(info?.rak_id===rak.id&&(info?.tingkat??null)===tingkat)return '';
    try{
      const d=await fetch('/api/lokasi-rak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bins:[nb],rak_id:rak.id,tingkat})}).then(r=>r.json());
      muatLokasi();
      return d.success?` · Bin ${nb} → Rak ${kode}`:` (lokasi rak gagal: ${d.error||'error'})`;
    }catch{return ' (lokasi rak gagal disimpan)';}
  };
  const [users, setUsers]           = useState<User[]>(usersData);
  const [showForm, setShowForm]     = useState(false);
  const [editUser, setEditUser]     = useState<User|null>(null);
  const [scanMode, setScanMode]     = useState(false);
  const [form, setForm]             = useState({ nama:'',employee_id:'',role:'teknisi',rfid_tag:'',password:'',gender:'male' });
  const rfidBuf = useRef(''); const rfidTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const showMsg = (type:'ok'|'err', text:string) => { setMsg({type,text}); setTimeout(()=>setMsg(null),3500); };

  const [formPartIn,   setFormPartIn]   = useState({ is_consumable:false, nama_part:'', kode_12nc:'', nomor_do:'', jumlah:'', nama_supplier:'', brand:'', nomor_bin:'', kategori:'', kondisi:'Baik', catatan:'', foto_url:'', jenis:'molding', nama_mesin:'', leader_teknisi:'', harga_satuan:'', mesin_bagi:[] as MesinBagi[], pindah_rak:false, spare_part_id:'' });
  const mesinLeaderMap: Record<string,{leader:string,jenis:string}> = {
    'Soother B2':{leader:'TL Soother B2',jenis:'molding'},
    'LSR':{leader:'TL Soother B2',jenis:'molding'},
    'Feeder':{leader:'TL Soother B2',jenis:'molding'},
    'Aoki':{leader:'TL AOKI',jenis:'molding'},
    'Haitian 1K':{leader:'TL AOKI',jenis:'molding'},
    'Haitian 2K':{leader:'TL AOKI',jenis:'molding'},
    'Maintenance Mold':{leader:'TL Maintenance Mold',jenis:'molding'},
    'Maintenance Machine':{leader:'TL Maintenance Mold',jenis:'molding'},
    'Tampon Printing':{leader:'RIDWAN HUTASOIT',jenis:'nonmolding'},
    'Hairobotic':{leader:'EDI SUSILO',jenis:'nonmolding'},
    'CMYK + Auto + Motorcable + GAIA':{leader:'EDI SUSILO',jenis:'nonmolding'},
    'Lambert + Slitting + Fartech':{leader:'ARDIAN KURNIAWAN',jenis:'nonmolding'},
  };
  const allMesinList = ['Soother B2','LSR','Feeder','Aoki','Haitian 1K','Haitian 2K','Maintenance Mold','Maintenance Machine','Tampon Printing','Hairobotic','CMYK + Auto + Motorcable + GAIA','Lambert + Slitting + Fartech'];
  const [loadingPartIn, setLoadingPartIn] = useState(false);
  const [monitoringJenis, setMonitoringJenis] = useState<'semua'|'molding'|'nonmolding'>('semua');
  const [monitoringSemua, setMonitoringSemua] = useState(false); // false = hanya part warning, true = stok aktual semua part
  const [monitoringSearch, setMonitoringSearch] = useState('');
  const [openLowGroup, setOpenLowGroup] = useState<string|null>(null);
  const [monitoringMesin, setMonitoringMesin] = useState('semua');
  const [catalogJenis, setCatalogJenis] = useState<'semua'|'molding'|'nonmolding'>('semua');
  const [catalogDrillMesin, setCatalogDrillMesin] = useState<string|null>(null);
  const [orderJenis, setOrderJenis] = useState<'semua'|'molding'|'nonmolding'>('semua');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFiles, setImportFiles]   = useState<{name:string; size:string; progress:number; status:'uploading'|'done'|'error'}[]>([]);
  const [isDragOver, setIsDragOver]     = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [formPartOut,  setFormPartOut]  = useState({ spare_part_nama:'', spare_part_id:'', teknisi_id:'', nomor_wo:'', jumlah:'', mesin_area:'', keterangan:'', jenis:'Koreksi salah input' });
  const [loadingPartOut,setLoadingPartOut]=useState(false);
  const [historyPartIn, setHistoryPartIn]= useState<any[]>([]);
  const [historyPartOut,setHistoryPartOut]=useState<any[]>([]);
  const [formReturn,   setFormReturn]   = useState({ ...RETURN_EMPTY });
  const [returnPartText, setReturnPartText] = useState('');
  const [showReturnCamera, setShowReturnCamera] = useState(false);
  const [returnFotoView, setReturnFotoView] = useState<{loading:boolean; src:string; judul:string}|null>(null);
  const [loadingReturn, setLoadingReturn]=useState(false);
  const [historyReturn, setHistoryReturn]=useState<any[]>([]);
  const [orderCart, setOrderCart]       = useState<{part:any; qty:number; supplier:string; catatan:string}[]>([]);
  const [orders, setOrders]             = useState<any[]>([]);
  const [orderFilter, setOrderFilter]   = useState<'semua'|'draft'|'dipesan'|'diterima'|'request'|'request'>('semua');
  const [showOrderCart, setShowOrderCart] = useState(false);
  const [orderStatus, setOrderStatus] = useState<Record<string,'draft'|'dipesan'|'diterima'|'request'|'request'>>(()=>{try{const s=localStorage.getItem('mcc_orderStatus');return s?JSON.parse(s):{}}catch{return {}}});
  const saveOrderStatus = (id:string, status:'draft'|'dipesan'|'diterima'|'request'|'request'|null) => {
    setOrderStatus(p=>{const n={...p};if(status===null)delete n[id];else n[id]=status;try{localStorage.setItem('mcc_orderStatus',JSON.stringify(n));}catch{}return n;});
  };
  const [selectedMesin, setSelectedMesin] = useState<string|null>(null);
  const [mesinCovers, setMesinCovers]     = useState<Record<string,string>>({});
  const mesinCoverRef = useRef<HTMLInputElement>(null);
  const [editingCoverMesin, setEditingCoverMesin] = useState<string|null>(null);
  // ── NON MOLDING + EMAIL STATE ──────────────────────────────────────────────
  const [selectedTeknisi, setSelectedTeknisi] = useState<string|null>(null);
  const [teknisiCovers, setTeknisiCovers]     = useState<Record<string,string>>({});
  const teknisiFileRef                          = useRef<Record<string,HTMLInputElement|null>>({});
  const [emailSending, setEmailSending]         = useState(false);
  // ──────────────────────────────────────────────────────────────────────────
  const [laporanBulan, setLaporanBulan] = useState(new Date().getMonth() + 1);
  const [histFilter, setHistFilter] = useState<'semua'|'in'|'out'|'return'>('semua');
  const [editPartIn, setEditPartIn] = useState<any|null>(null);
  const [histSearch, setHistSearch] = useState('');
  const [laporanTahun, setLaporanTahun] = useState(new Date().getFullYear());
  const [laporanLoading, setLaporanLoading] = useState(false);
  const [subMesinMap, setSubMesinMap] = useState<Record<string,{nama:string,emoji:string,color:string}[]>>(()=>{try{const s=localStorage.getItem('mcc_submesin');return s?JSON.parse(s):{}}catch{return {}}});
  const [showTambahSubMesin, setShowTambahSubMesin] = useState(false);
  const [subMesinParent, setSubMesinParent] = useState('');
  const [formSubMesin, setFormSubMesin] = useState({nama:'',emoji:'⚙️',color:'#0b5ed7'});
  const [subMesinDrill, setSubMesinDrill] = useState<string|null>(null);
  const saveSubMesinMap = (map: Record<string,{nama:string,emoji:string,color:string}[]>) => {
    setSubMesinMap(map);
    try{localStorage.setItem('mcc_submesin',JSON.stringify(map));}catch{}
  };
  const [mesinImages, setMesinImages] = useState<Record<string,string>>(()=>{try{const s=localStorage.getItem('mcc_mesinImages');return s?JSON.parse(s):{}}catch{return {}}});
  const [hiddenMesin, setHiddenMesin] = useState<string[]>(()=>{try{const s=localStorage.getItem('mcc_hiddenMesin');return s?JSON.parse(s):[]}catch{return []}});
  const mesinImgRef = useRef<Record<string,HTMLInputElement|null>>({});
  const saveMesinImage = (nama:string, url:string) => {
    setMesinImages(p=>{const n={...p,[nama]:url};try{localStorage.setItem('mcc_mesinImages',JSON.stringify(n));}catch{}return n;});
  };
  const deleteMesin = async (nama:string) => {
    if(!await tanya(`Hapus mesin "${nama}" dari tampilan?`))return;
    setHiddenMesin(p=>{const n=[...p,nama];try{localStorage.setItem('mcc_hiddenMesin',JSON.stringify(n));}catch{}return n;});
    showMsg('ok',`✅ ${nama} dihapus`);
  };
  const [lang, setLang] = useState<'id'|'en'>('id');
  const t = (id:string, en:string) => lang==='id'?id:en;

 useEffect(()=>{
    const go=async()=>{
      try{const r=await fetch('/api/requests');const d=await r.json();if(d.success){setRequests(d.data);setPendingCount(d.pending);if(d.pending>prevPending.current){setNewNotif(true);setTimeout(()=>setNewNotif(false),5000);if(sudahMuatReq.current){try{bunyiBel();}catch{}notifDesktop('Request Part OUT baru',`${d.pending} request menunggu disiapkan`,'mcc-request');}}sudahMuatReq.current=true;prevPending.current=d.pending;
        // Request ditolak teknisi saat verifikasi ("Tidak sesuai") -> kotak notifikasi + bel
        const semua:any[]=Array.isArray(d.data)?d.data:[];const adaAlasan=semua.some((r:any)=>'alasan_tolak' in r);
        const rej=semua.filter((r:any)=>String(r.status||'').toLowerCase()==='rejected'&&(!adaAlasan||/verifikasi/i.test(String(r.alasan_tolak||''))));
        if(rejectTahu.current===null){let tahu:number[]=[];try{tahu=JSON.parse(localStorage.getItem('mcc_reject_tahu')||'null')||rej.map((r:any)=>Number(r.id));}catch{tahu=rej.map((r:any)=>Number(r.id));}rejectTahu.current=new Set(tahu.map(Number));}
        const baru=rej.filter((r:any)=>!rejectTahu.current!.has(Number(r.id)));
        if(baru.length){baru.forEach((r:any)=>rejectTahu.current!.add(Number(r.id)));try{localStorage.setItem('mcc_reject_tahu',JSON.stringify([...rejectTahu.current].slice(-500)));}catch{}
          setRejectAlert(x=>[...baru,...x].slice(0,20));try{bunyiBel();}catch{}notifDesktop('Teknisi menolak barang',baru.map((r:any)=>`${r.teknisi_nama||'Teknisi'}: ${r.part_nama||'-'} x${r.jumlah??'-'}`).join('\n'),'mcc-reject');}
      }}catch{}
    };
    go();
    const timer=setInterval(go,10000);
    return()=>clearInterval(timer);
  },[]);
  
  useEffect(()=>{
    if(activePage==='users')muatRole();
    if(activePage==='users')muatUsers();
    if(activePage==='parts'||activePage==='partin')muatLokasi();
    if(activePage==='users'||activePage==='partin')fetch('/api/mesin').then(r=>r.json()).then(d=>{if(d.success)setMesinJenisList(d.jenis||[]);}).catch(()=>{});
    if(activePage==='parts'||activePage==='dashboard'||activePage==='catalog'||activePage==='partin')fetch('/api/parts').then(r=>r.json()).then(d=>{const arr=toArr(d.data??d);if(arr.length>0)setPartsList(arr);}).catch(()=>{});
  },[activePage]);

  useEffect(()=>{
    if(!scanMode)return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Enter'){const rfid=rfidBuf.current.trim();if(rfid){if(editUser)setEditUser((u:any)=>u?{...u,rfid_tag:rfid}:null);else setForm(f=>({...f,rfid_tag:rfid}));showMsg('ok',`RFID: ${rfid}`);setScanMode(false);}rfidBuf.current='';}
      else if(e.key.length===1){rfidBuf.current+=e.key;if(rfidTimer.current)clearTimeout(rfidTimer.current);rfidTimer.current=setTimeout(()=>{rfidBuf.current='';},500);}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[scanMode,editUser]);

  const handleApprove=async(id:number)=>{
    const req=requests.find((r:any)=>r.id===id);
    setShowPrepareModal({ requestId: id, requestData: req || null });
    setPreparePhoto('');
    setPrepareNote('');
    setPrepareError('');
  };

  const handlePrepareSave = async () => {
    if (!showPrepareModal) return;
    if (!preparePhoto) {
      setPrepareError('Foto kondisi barang wajib diambil sebelum simpan dokumentasi.');
      return;
    }

    setPreparingRequestId(showPrepareModal.requestId);
    setPrepareError('');

    try {
      const payload = {
        request_id: showPrepareModal.requestId,
        tipe_foto: 'siapkan',
        catatan: prepareNote || `Dokumentasi persiapan barang oleh admin untuk request ${showPrepareModal.requestId}`,
        uploaded_by: loginNama || 'admin',
        foto_base64: preparePhoto,
      };

      const saveRes = await fetch('/api/request-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData?.error || 'Gagal upload foto dokumentasi.');

      await fetch('/api/requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showPrepareModal.requestId, status: 'Prepared' }),
      });

      setRequests(p => p.map((r: any) => r.id === showPrepareModal.requestId ? { ...r, status: 'Prepared' } : r));
      setPendingCount(p => Math.max(0, p - 1));
      setShowPrepareModal(null);
      setPreparePhoto('');
      setPrepareNote('');
      showMsg('ok', `✅ ${showPrepareModal.requestData?.part_nama || 'Part'} berhasil disiapkan dan didokumentasi.`);
    } catch (err: any) {
      setPrepareError(err?.message || 'Gagal menyimpan dokumentasi foto admin.');
    } finally {
      setPreparingRequestId(null);
    }
  };

  // Tolak permintaan: admin wajib memilih alasan (disimpan ke kolom alasan_tolak untuk laporan)
  const [rejectTarget,setRejectTarget]=useState<number|null>(null);
  const [rejectReason,setRejectReason]=useState('');
  const [rejectNote,setRejectNote]=useState('');
  const [rejecting,setRejecting]=useState(false);
  const handleReject=(id:number)=>{setRejectTarget(id);setRejectReason('');setRejectNote('');};
  const confirmReject=async()=>{
    if(rejectTarget===null||!rejectReason)return;
    const id=rejectTarget;
    const alasan=rejectReason==='Lainnya'?`Lainnya: ${rejectNote.trim()}`:rejectReason;
    setRejecting(true);
    try{
      await fetch('/api/requests',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status:'Rejected',alasan_tolak:alasan})});
      setRequests(p=>p.map((r:any)=>r.id===id?{...r,status:'Rejected',alasan_tolak:alasan}:r));setPendingCount(p=>Math.max(0,p-1));showMsg('err','Ditolak');
      setRejectTarget(null);
    }finally{setRejecting(false);}
  };

  const handleTambahPart=async()=>{
    if(!formPart.nama_part||!formPart.nomor_bin)return showMsg('err','Nama & Bin wajib!');
    if(!kategoriList.includes(formPart.kategori))return showMsg('err','Kategori harus dipilih dari daftar!');
    const mesinVal = subMesinDrill&&partsDrillMesin ? `${partsDrillMesin} > ${subMesinDrill}` : (formPart.mesin||partsDrillMesin||'');
    const body={...formPart,nama_part:formPart.nama_part,nama:formPart.nama_part,mesin:mesinVal};
    const np={...body,id:Date.now(),stok_saat_ini:parseInt(formPart.stok_saat_ini)||0,reorder_point:parseInt(formPart.reorder_point)||0};
    setPartsList(p=>[np,...p]);
    try{await fetch('/api/parts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}catch{}
    const infoRak=await simpanLokasiBin(formPart.nomor_bin,partRak);
    setFormPart({nama_part:'',nama:'',kode_12nc:'',kategori:'Mold',mesin:'',lokasi_simpan:'Spare Part Rack',nomor_bin:'',stok_saat_ini:'',reorder_point:'',is_critical:false});
    setPartRak({kode:'',tingkat:''});
    setShowPartForm(false);showMsg('ok',`${formPart.nama_part} ditambahkan!${infoRak}`);
  };
  const handleHapusPart=async (id:number,nama:string)=>{if(!await tanya(`Hapus "${nama}"?`))return;setPartsList(p=>p.filter(x=>x.id!==id));showMsg('ok','Part dihapus!');};
  const handleImageUpload=async(id:number,url:string)=>{
    setPartsList(p=>p.map(x=>x.id===id?{...x,foto_url:url}:x));
    try{await fetch('/api/parts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,foto_url:url,update_foto_only:true})});showMsg('ok','Foto berhasil disimpan!');}
    catch{showMsg('err','Foto gagal disimpan');}
  };
  const handleSaveEditPart=()=>{setPartsList(p=>p.map(x=>x.id===editPart.id?{...editPart,stok_saat_ini:parseInt(editPart.stok_saat_ini)||0,reorder_point:parseInt(editPart.reorder_point)||0}:x));try{fetch('/api/parts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(editPart)});}catch{}setEditPart(null);showMsg('ok','Part diupdate!');};

  // Part yang sudah terdaftar (12NC dulu, lalu nama tanpa beda huruf besar/kecil & spasi ganda) — sama dengan aturan di server
  const normNamaPart=(v:any)=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  const cariPartAda=(nama:string,kode:string):any=>{
    const nm=normNamaPart(nama), kd=String(kode||'').trim();
    return (kd&&partsList.find((x:any)=>String(x.kode_12nc||'').trim()===kd))||(nm?partsList.find((x:any)=>normNamaPart(x.nama_part)===nm):null)||null;
  };
  const handleSavePartIn=async()=>{
    if(!formPartIn.spare_part_id)return showMsg('err','Pilih spare part dari master data dulu. Part baru ditambahkan di Kelola part.');
    if(!(parseInt(formPartIn.jumlah)>0))return showMsg('err','Jumlah wajib diisi (lebih dari 0).');
    setLoadingPartIn(true);
    try{const res=await fetch('/api/partin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({spare_part_id:formPartIn.spare_part_id,jumlah:formPartIn.jumlah,nomor_do:formPartIn.nomor_do,nama_supplier:formPartIn.nama_supplier,brand:formPartIn.brand,kondisi:formPartIn.kondisi,catatan:formPartIn.catatan})});const d=await res.json();if(d.success){showMsg('ok',d.message);muatPartsMaster();setFormPartIn({is_consumable:false,nama_part:'',kode_12nc:'',nomor_do:'',jumlah:'',nama_supplier:'',brand:'',nomor_bin:'',kategori:'',kondisi:'Baik',catatan:'',foto_url:'',jenis:'molding',nama_mesin:'',leader_teknisi:'',harga_satuan:'',mesin_bagi:[],pindah_rak:false,spare_part_id:''});fetch('/api/partin').then(r=>r.json()).then(d=>{if(d.success)setHistoryPartIn(toArr(d.data));});fetch('/api/parts').then(r=>r.json()).then(d=>{const arr=toArr(d.data??d);if(arr.length>0)setPartsList(arr);});}else showMsg('err',d.error);}catch{showMsg('err','Gagal menyimpan');}
    setLoadingPartIn(false);
  };
  const handleSavePartOut=async()=>{
    if(!formPartOut.spare_part_nama||!formPartOut.jumlah)return showMsg('err','Nama part dan jumlah wajib diisi!');
    if(!formPartOut.spare_part_id)return showMsg('err','Pilih spare part dari daftar yang muncul saat mengetik!');
    if(!formPartOut.keterangan.trim())return showMsg('err','Alasan / keterangan wajib diisi supaya tercatat di kartu stok.');
    {const sp=partsList.find(x=>String(x.id)===String(formPartOut.spare_part_id));const q=parseInt(formPartOut.jumlah)||0;
     if(q<=0)return showMsg('err','Jumlah harus lebih dari 0.');
     if(sp&&q>(Number(sp.stok_saat_ini)||0))return showMsg('err',`Stok ${sp.nama_part} hanya ${sp.stok_saat_ini??0}. Jumlah tidak boleh melebihi stok.`);}
    setLoadingPartOut(true);
    try{const res=await fetch('/api/partout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...formPartOut,admin_nama:loginNama})});const d=await res.json();if(d.success){showMsg('ok',d.message);setPartOutText('');setFormPartOut({spare_part_nama:'',spare_part_id:'',teknisi_id:'',nomor_wo:'',jumlah:'',mesin_area:'',keterangan:'',jenis:'Koreksi salah input'});fetch('/api/partout').then(r=>r.json()).then(d=>{if(d.success)setHistoryPartOut(toArr(d.data));});fetch('/api/parts').then(r=>r.json()).then(d=>{const arr=toArr(d.data??d);if(arr.length>0)setPartsList(arr);});}else showMsg('err',d.error);}catch{showMsg('err','Gagal menyimpan');}
    setLoadingPartOut(false);
  };
  const resetReturnForm=()=>{setFormReturn({ ...RETURN_EMPTY });setReturnPartText('');setShowReturnCamera(false);};
  const pilihPartReturn=(teks:string)=>{
    setReturnPartText(teks);
    const t=teks.trim().toLowerCase();
    let found=partsList.find(p=>partLabel(p).toLowerCase()===t);
    if(!found){const sama=partsList.filter(p=>String(p.nama_part||'').trim().toLowerCase()===t);if(sama.length===1)found=sama[0];}
    setFormReturn(f=>({...f,spare_part_id:found?String(found.id):'',nama_part:found?found.nama_part:teks.trim()}));
  };
  const lihatFotoReturn=async(r:any)=>{
    setReturnFotoView({loading:true,src:'',judul:`${r.nama_part||'-'} · ${r.nomor_do}`});
    try{const d=await fetch(`/api/return?foto_id=${r.id}`).then(x=>x.json());
      if(d.success)setReturnFotoView({loading:false,src:d.foto,judul:`${r.nama_part||'-'} · ${r.nomor_do}`});
      else{setReturnFotoView(null);showMsg('err',d.error||'Foto tidak ditemukan');}
    }catch{setReturnFotoView(null);showMsg('err','Gagal memuat foto');}
  };
  const handleSaveReturn=async()=>{
    if(!formReturn.nomor_do||!formReturn.jumlah)return showMsg('err','Nomor DO dan jumlah wajib diisi!');
    if(!formReturn.foto)return showMsg('err','Foto alasan return wajib dilampirkan!');
    if(!formReturn.spare_part_id)return showMsg('err','Pilih spare part dari daftar yang muncul saat mengetik!');
    setLoadingReturn(true);
    try{
      const foto=await kecilkanFoto(formReturn.foto);
      const res=await fetch('/api/return',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nomor_do:formReturn.nomor_do,spare_part_id:formReturn.spare_part_id||null,nama_part:formReturn.nama_part,nama_supplier:formReturn.nama_supplier,jumlah:formReturn.jumlah,alasan:formReturn.alasan,catatan:formReturn.catatan,foto_alasan:foto})});
      const d=await res.json();
      if(d.success){showMsg('ok',d.message);resetReturnForm();fetch('/api/return').then(r=>r.json()).then(d=>{if(d.success)setHistoryReturn(toArr(d.data));});}else showMsg('err',d.error);
    }catch{showMsg('err','Gagal menyimpan');}
    setLoadingReturn(false);
  };

  useEffect(()=>{
    if(activePage==='partin')muatPartsMaster();
    if(activePage==='partin'||activePage==='monitoring'||activePage==='catalog')fetch('/api/partin').then(r=>r.json()).then(d=>{if(d.success)setHistoryPartIn(toArr(d.data));}).catch(()=>{});
    if(activePage==='partout')fetch('/api/partout').then(r=>r.json()).then(d=>{if(d.success)setHistoryPartOut(toArr(d.data));}).catch(()=>{});
    if(activePage==='return')fetch('/api/return').then(r=>r.json()).then(d=>{if(d.success)setHistoryReturn(toArr(d.data));}).catch(()=>{});
  },[activePage]);

  useEffect(()=>{
    const refreshAll=async()=>{
      try{const[rParts,rOut]=await Promise.all([fetch('/api/parts').then(r=>r.json()),fetch('/api/partout').then(r=>r.json())]);const arr=toArr(rParts.data??rParts);if(arr.length>0)setPartsList(arr);if(rOut.success)setHistoryPartOut(toArr(rOut.data));}catch{}
    };
    refreshAll();const iv=setInterval(refreshAll,5000);return()=>clearInterval(iv);
  },[]);

  // ── Notifikasi stok mencapai batas minimum (kotak + bunyi bel sekali per part) ──
  // Part dicatat "sudah diberi tahu" (disimpan di PC ini). Kalau stoknya naik lagi di atas min lalu turun lagi, bunyi lagi.
  const stokMinTahu=useRef<Set<number>|null>(null);
  const [stokAlert,setStokAlert]=useState<any[]>([]);
  const bunyiBel=()=>{try{const AC=(window as any).AudioContext||(window as any).webkitAudioContext;if(!AC)return;const ctx=new AC();const t0=ctx.currentTime+0.05;
    [[0,1318.5],[0.32,1046.5],[0.64,1318.5]].forEach(([dt,f])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t0+dt);g.gain.exponentialRampToValueAtTime(0.4,t0+dt+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t0+dt+1.1);o.connect(g);g.connect(ctx.destination);o.start(t0+dt);o.stop(t0+dt+1.15);});
    setTimeout(()=>{try{ctx.close();}catch{}},2500);}catch{}};
  useEffect(()=>{
    if(!partsList.length)return;
    const low=partsList.filter((p:any)=>(p.is_active==null||!!p.is_active)&&Number(p.reorder_point)>0&&Number(p.stok_saat_ini??0)<=Number(p.reorder_point));
    if(stokMinTahu.current===null){let tahu:number[]=[];try{tahu=JSON.parse(localStorage.getItem('mcc_stok_min_tahu')||'[]');}catch{}stokMinTahu.current=new Set(tahu.map(Number));}
    const baru=low.filter((p:any)=>!stokMinTahu.current!.has(Number(p.id)));
    stokMinTahu.current=new Set(low.map((p:any)=>Number(p.id)));
    try{localStorage.setItem('mcc_stok_min_tahu',JSON.stringify([...stokMinTahu.current]));}catch{}
    if(baru.length){setStokAlert(a=>[...baru,...a.filter((x:any)=>!baru.some((b:any)=>b.id===x.id))].slice(0,30));bunyiBel();notifDesktop('Stok mencapai batas minimum',baru.slice(0,5).map((p:any)=>`${p.nama_part}: ${p.stok_saat_ini??0} / min ${p.reorder_point}`).join('\n')+(baru.length>5?`\n+${baru.length-5} part lain`:''),'mcc-stok');}
  },[partsList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kelola pengguna lewat /api/pengguna (role ikut tersimpan, hapus sungguhan, cek RFID & Employee ID ganda)
  const muatUsers=()=>fetch('/api/pengguna').then(r=>r.json()).then(d=>{if(d.success)setUsers(toArr(d.data));else showMsg('err',d.error||'Gagal memuat pengguna');}).catch(()=>{});
  const kirimPengguna=async(body:any)=>{try{return await fetch('/api/pengguna',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());}catch{return {success:false,error:'Tidak bisa menghubungi server'};}};
  const handleTambahUser=async()=>{
    if(!form.nama||!form.employee_id)return showMsg('err','Nama & Employee ID wajib!');
    if(form.role==='admin'&&!form.password)return showMsg('err','Akun admin wajib diberi password untuk login di halaman Admin');
    const d=await kirimPengguna({aksi:'simpan',...form});
    if(d.success){showMsg('ok',d.message||`${form.nama} ditambahkan!`);setShowForm(false);setForm({nama:'',employee_id:'',role:'teknisi',rfid_tag:'',password:'',gender:'male'});muatUsers();}else showMsg('err',d.error||'Gagal');
  };
  const handleUpdateUser=async()=>{
    if(!editUser)return;const u:any=editUser;
    const d=await kirimPengguna({aksi:'simpan',id:u.id,nama:u.nama,employee_id:u.employee_id,role:u.role||'teknisi',rfid_tag:u.rfid_tag,is_active:u.is_active,gender:u.gender||'male',bagian:u.bagian||null,nomor_mesin:u.nomor_mesin||null,password:u.password_baru||'',mesin_tambahan_ids:u.mesin_tambahan_ids??(u.mesin_tambahan||[]).map((m:any)=>m.id)});
    if(d.success){setEditUser(null);showMsg('ok',d.message||'Tersimpan');muatUsers();}else showMsg('err',d.error||'Gagal');
  };
  const handleHapusUser=async(id:number,nama:string)=>{
    if(!await tanya({judul:'Hapus pengguna',pesan:`Hapus "${nama}"? Kartu RFID-nya tidak bisa dipakai lagi. Kalau orang ini pernah mengambil part, riwayatnya tetap tersimpan di laporan.`,oke:'Hapus',bahaya:true}))return;
    const d=await kirimPengguna({aksi:'hapus',id});
    showMsg(d.success?'ok':'err',d.success?(d.message||`${nama} dihapus`):(d.error||'Gagal menghapus'));
    if(d.success)muatUsers();
  };
  const handleSetEditUser=(u:User|null)=>{setShowLogout(false);setEditUser(u);};

  const handlePartImport = async (files: File[]) => {
    const validFiles = files.filter((f:File) => f.name.match(/\.(xlsx|xls|csv)$/i));
    if(!validFiles.length){ showMsg('err','Format tidak didukung! Gunakan .xlsx, .xls, atau .csv'); return; }
    
    // Use installed xlsx package
    const XLSX = await import('xlsx');

    for(const file of validFiles){
      const idx = Date.now() + Math.random();
      const fileObj = {id:idx, name:file.name, size:file.size>1024*1024?`${(file.size/1024/1024).toFixed(1)}MB`:`${(file.size/1024).toFixed(0)}KB`, progress:20, status:'uploading' as const, rows:[] as any[]};
      setPartImportFiles(p=>[...p, fileObj]);
      
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
        
        setPartImportFiles(p=>p.map((f:any)=>f.id===idx?{...f,progress:60}:f));

        if(rawData.length < 2){ 
          setPartImportFiles(p=>p.map((f:any)=>f.id===idx?{...f,status:'error',progress:100}:f)); 
          continue; 
        }

        // Find header row (first row with text)
        const headerRow = rawData[0].map((h:any)=>String(h||'').toLowerCase().trim());
        const rows: any[] = [];
        
        // Auto-detect columns - support various header formats
        const findCol = (keywords: string[]) => headerRow.findIndex((h:string)=>keywords.some(k=>h.replace(/[\s\/\-_]/g,'').includes(k.replace(/[\s\/\-_]/g,''))));
        const colNama   = findCol(['sparepart','namapart','namapart','itemname','item','nama','sparepartitems']);
        const colKode   = findCol(['type','model','tipe','kode','12nc','typemodel']);
        const colBin    = findCol(['bin','nomorbin','location']);
        const colStok   = findCol(['initialstock','remainingstock','remaining','stok','stock','jumlah']);
        const colMin    = findCol(['min','reorder','minimum']);
        const colMesin  = findCol(['equipment','mesin','machine','machinename']);
        const colKat    = findCol(['kategori','category']);
        const colNo     = findCol(['no']);

        console.log('Headers detected:', headerRow);
        console.log('Col indices - nama:',colNama,'kode:',colKode,'stok:',colStok,'mesin:',colMesin);

        let currentMesin = '';
        let autoIdx = 0;
        for(let i=1; i<rawData.length; i++){
          const row = rawData[i];
          if(!row || row.every((c:any)=>!c)) continue; // skip empty rows
          
          // Track equipment/mesin grouping
          if(colMesin>=0 && row[colMesin] && String(row[colMesin]).trim()){
            currentMesin = String(row[colMesin]).trim();
          }

          // Get part name - try detected col first, then scan all cols for likely name
          let namaPart = colNama>=0 ? String(row[colNama]||'').trim() : '';
          if(!namaPart) {
            // fallback: find non-numeric, non-empty cell that's not the no/equipment col
            for(let ci=0;ci<row.length;ci++){
              if(ci===colNo||ci===colMesin||ci===colStok||ci===colKode) continue;
              const val = String(row[ci]||'').trim();
              if(val && isNaN(Number(val)) && val.length>2){ namaPart=val; break; }
            }
          }
          if(!namaPart) continue;
          // skip header-like rows
          const skipWords = ['spare part items','nama part','item name','equipment','no'];
          if(skipWords.some(w=>namaPart.toLowerCase()===w)) continue;
          
          // Get stock - handle cases like "1+4 BARU =5"
          let stok: any = colStok>=0 ? row[colStok] : 0;
          const stokStr = String(stok||'0');
          try {
            // Try to extract last number after = or just parse first number
            const match = stokStr.match(/(\d+)\s*$/);
            stok = match ? parseInt(match[1]) : (parseInt(stokStr)||0);
          } catch { stok=0; }
          
          autoIdx++;
          rows.push({
            nama_part: namaPart,
            nama: namaPart,
            kode_12nc: colKode>=0 && row[colKode] ? String(row[colKode]).trim() : 'IMP-'+Date.now()+'-'+autoIdx,
            mesin: currentMesin,
            kategori: colKat>=0 && row[colKat] ? String(row[colKat]).trim() : 'Machine',
            nomor_bin: colBin>=0 && row[colBin] ? String(row[colBin]).trim() : 'WH-'+String(autoIdx).padStart(3,'0'),
            stok_saat_ini: Math.max(0, Number(stok)||0),
            reorder_point: colMin>=0 && row[colMin] ? (parseInt(String(row[colMin]))||1) : 1,
            lokasi_simpan: 'Spare Part Rack',
          });
        }
        console.log('Parsed rows:', rows.length, rows[0]);

        setPartImportFiles(p=>p.map((f:any)=>f.id===idx?{...f,progress:100,status:'done',rows}:f));
      } catch(e:any) {
        console.error('Import error:',e);
        setPartImportFiles(p=>p.map((f:any)=>f.id===idx?{...f,status:'error',progress:100}:f));
        showMsg('err','Gagal membaca file: '+e.message);
      }
    }
  };

  const handleImportFiles=(files:File[])=>{
    const validTypes=['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv'];
    const newFiles=files.filter(f=>validTypes.includes(f.type)||f.name.match(/\.(pdf|xlsx|xls|csv)$/i)).map(f=>({name:f.name,size:f.size>1024*1024?`${(f.size/1024/1024).toFixed(1)}MB`:`${(f.size/1024).toFixed(0)}KB`,progress:0,status:'uploading' as const}));
    if(newFiles.length===0){showMsg('err','Format tidak didukung!');return;}
    setImportFiles(p=>[...p,...newFiles]);
    newFiles.forEach((_,idx)=>{const totalIdx=importFiles.length+idx;let prog=0;const interval=setInterval(()=>{prog+=Math.random()*20+5;if(prog>=100){clearInterval(interval);setImportFiles(p=>p.map((f,i)=>i===totalIdx?{...f,progress:100,status:'done'}:f));}else{setImportFiles(p=>p.map((f,i)=>i===totalIdx?{...f,progress:Math.round(prog)}:f));}},200);});
  };

  // ── EMAIL HANDLERS ─────────────────────────────────────────────────────────
  const handleSendEmailAllTL=async()=>{
    setEmailSending(true);
    showMsg('ok','📧 Mengirim email ke semua Team Leader...');
    try{
      const res=await fetch('/api/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({manual:true})});
      const data=await res.json();
      if(data.success){
        const sent=data.results.filter((r:any)=>r.status==='sent').length;
        const failed=data.results.filter((r:any)=>r.status==='failed').length;
        showMsg('ok',`✅ Email terkirim ke ${sent} TL${failed>0?` · ${failed} gagal`:''} — ${data.weekRange}`);
      }else showMsg('err',data.error||'Gagal mengirim email');
    }catch(e:any){showMsg('err','Gagal: '+e.message);}
    setEmailSending(false);
  };

  const handleSendEmailOneTL=async(namaTL:string)=>{
    const tlMap:Record<string,string>={'ARDIAN KURNIAWAN':'tl_nonmold','EDI SUSILO':'tl_edi','RIDWAN HUTASOIT':'tl_ridwan','TL Soother B2':'tl_soother','TL AOKI':'tl_aoki','TL Maintenance Mold':'tl_mold'};
    const tlId=tlMap[namaTL];
    if(!tlId){showMsg('err','TL tidak terdaftar di konfigurasi email');return;}
    setEmailSending(true);
    showMsg('ok',`📧 Mengirim email ke ${namaTL}...`);
    try{
      const res=await fetch('/api/email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tlId,manual:true})});
      const data=await res.json();
      if(data.success){const r=data.results[0];showMsg(r?.status==='sent'?'ok':'err',r?.status==='sent'?`✅ Email berhasil dikirim ke ${namaTL}`:`❌ Gagal: ${r?.error}`);}
      else showMsg('err',data.error||'Gagal');
    }catch(e:any){showMsg('err','Gagal: '+e.message);}
    setEmailSending(false);
  };
  // ──────────────────────────────────────────────────────────────────────────

  // ── NON MOLDING DATA ───────────────────────────────────────────────────────
  const [nonMoldingTeknisi, setNonMoldingTeknisi] = useState([
    { nama:'ARDIAN KURNIAWAN', inisial:'AK', warna:'#ffffff', aksen:'#0b5ed7', emoji:'⚙️', mesin:['Batch Down','Flowthrough','External Siliting 1','External Siliting 2','External Siliting 3','External Siliting 4','External Siliting 5','Semi Auto Assembly Soother 1 (Lambert)','Semi Auto Assembly Soother 2 (Fartech)','Semi Auto Assembly Soother 3 (Fartech)','Semi Auto Assembly Soother 4 (Fartech)','Full Auto Assembly Soother (Lambert)'] },
    { nama:'EDI SUSILO',       inisial:'ES', warna:'#ffffff', aksen:'#1e7e34', emoji:'🖨️', mesin:['CMYK 1','CMYK 2','GAIYA MANUAL 1','GAIYA MANUAL 2','GAIYA AUTO','Semi Auto Assembly Soother 1 (Lambert)'] },
    { nama:'RIDWAN HUTASOIT',  inisial:'RH', warna:'#ffffff', aksen:'#6d28d9', emoji:'🖱️', mesin:['TAMPON 1','TAMPON 2','TAMPON 3','TAMPON 4','TAMPON 5','TAMPON 6','TAMPON 7','TAMPON 8','TAMPON 9','TAMPON 10','TAMPON 11','TAMPON 12'] },
  ]);
  const [moldingTLList, setMoldingTLList] = useState([
    {nama:'TL Soother B2', inisial:'SB', warna:'#ffffff', aksen:'#0b5ed7', mesin:['Soother B2','LSR','Feeder']},
    {nama:'TL AOKI', inisial:'AK', warna:'#ffffff', aksen:'#1e7e34', mesin:['Aoki','Haitian 1K','Haitian 2K']},
    {nama:'TL Maintenance Mold', inisial:'MM', warna:'#ffffff', aksen:'#c62828', mesin:['Maintenance Mold','Maintenance Machine']},
  ]);
  const [moldingSupervisor, setMoldingSupervisor] = useState('Supervisor MCC');
  const [nonMoldingSupervisor, setNonMoldingSupervisor] = useState('Supervisor Non Molding');
  const [editingMoldingSup, setEditingMoldingSup] = useState(false);
  const [editingNMSup, setEditingNMSup] = useState(false);
  const [showTambahLeader, setShowTambahLeader] = useState(false);
  const [editLeader, setEditLeader] = useState<any|null>(null);
  const [editLeaderArea, setEditLeaderArea] = useState<'molding'|'nonmolding'>('molding');
  const [formLeader, setFormLeader] = useState({nama:'', area:'molding', aksen:'#0b5ed7', mesinInput:'', mesinList:[] as string[]});
  const autoInisial = (nama: string) => nama.trim().split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,3) || '??';
  // ──────────────────────────────────────────────────────────────────────────

  const filteredParts=partsList.filter(p=>(filterKat==='Semua'||p.kategori===filterKat)&&(p.nama_part?.toLowerCase().includes(searchPart.toLowerCase())||p.kode_12nc?.toLowerCase().includes(searchPart.toLowerCase())));
  // Pilihan Bagian: tim maintenance + semua mesin di Master Data + nilai lama yang sudah dipakai
  const bagianOpsi=Array.from(new Set(['Maintenance Mold','Maintenance Machine',...mesinJenisList.filter((j:any)=>j.is_active!==false).map((j:any)=>j.nama),...users.map((u:any)=>String(u.bagian||'').trim()).filter(Boolean)]));
  const [roleList,setRoleList]=useState<any[]>(ROLE_BAWAAN);
  const [roleErr,setRoleErr]=useState('');
  const [showRole,setShowRole]=useState(false);
  const muatRole=()=>fetch('/api/role').then(r=>r.json()).then(d=>{if(d.success&&Array.isArray(d.data)&&d.data.length){setRoleList(d.data);setRoleErr('');}else setRoleErr(d.error||'');}).catch(()=>{});
  const roleColor=(r:string)=>{const x=roleList.find((k:any)=>k.kode===r);if(x&&/^#[0-9a-fA-F]{6}$/.test(x.warna))return {bg:x.warna+'1f',color:x.warna};return r==='admin'?{bg:'rgba(11,94,215,0.12)',color:'#0b5ed7'}:r==='TL'?{bg:'rgba(109,40,217,0.12)',color:'#6d28d9'}:r==='TO'?{bg:'rgba(15,118,110,0.12)',color:'#0f766e'}:{bg:'rgba(30,126,52,0.12)',color:'#1e7e34'};};
  const opsiRole=(nilai?:string)=>{const daftar=[...roleList];if(nilai&&!daftar.some((r:any)=>r.kode===nilai))daftar.push({kode:nilai,nama:nilai});return daftar.map((r:any)=><option key={r.kode} value={r.kode}>{r.kode===r.nama?r.nama:`${r.kode} — ${r.nama}`}</option>);};

  const handleExportExcel=async()=>{
    showMsg('ok','Menyiapkan data export mingguan...');
    const now=new Date();const nowStr=now.toLocaleDateString('id-ID');
    let allParts=partsList,allPartIn:any[]=historyPartIn,allPartOut:any[]=historyPartOut,allReturn:any[]=historyReturn;
    try{const[rP,rI,rO,rR]=await Promise.all([fetch('/api/parts').then(r=>r.json()),fetch('/api/partin').then(r=>r.json()),fetch('/api/partout').then(r=>r.json()),fetch('/api/return').then(r=>r.json())]);const ap=toArr(rP.data??rP);if(ap.length>0)allParts=ap;if(rI.success)allPartIn=toArr(rI.data);if(rO.success)allPartOut=toArr(rO.data);if(rR.success)allReturn=toArr(rR.data);}catch{}
    const esc=(v:any)=>`"${String(v??'-').replace(/"/g,'""')}"`;
    const hariArr=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const fmtLengkap=(dateStr:string)=>{try{const d=tglDb(dateStr);return`${hariArr[d.getDay()]}, ${d.toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})} — ${d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`;}catch{return'-';}};
    const getWeekNum=(dateStr:string)=>{try{const d=tglDb(dateStr);const start=new Date(d.getFullYear(),0,1);return Math.ceil(((d.getTime()-start.getTime())/86400000+start.getDay()+1)/7);}catch{return 0;}};
    const getWeekRange=(dateStr:string)=>{try{const d=tglDb(dateStr);const day=d.getDay();const mon=new Date(d);mon.setDate(d.getDate()-(day===0?6:day-1));const sun=new Date(mon);sun.setDate(mon.getDate()+6);return`${mon.toLocaleDateString('id-ID')} s/d ${sun.toLocaleDateString('id-ID')}`;}catch{return'-';}};
    const freqMap:Record<string,any>={};
    allPartOut.forEach((r:any)=>{const key=r.teknisi_nama||'Manual';if(!freqMap[key])freqMap[key]={nama:key,jumlah_transaksi:0,total_item:0,parts:[],lastDate:r.tanggal_keluar};freqMap[key].jumlah_transaksi++;freqMap[key].total_item+=(r.jumlah_keluar||0);if(!freqMap[key].parts.includes(r.nama_part))freqMap[key].parts.push(r.nama_part);if(tglDb(r.tanggal_keluar)>new Date(freqMap[key].lastDate))freqMap[key].lastDate=r.tanggal_keluar;});
    const rekapFreq=Object.values(freqMap).sort((a:any,b:any)=>b.jumlah_transaksi-a.jumlah_transaksi);
    const weekMap:Record<string,any>={};
    allPartOut.forEach((r:any)=>{const wk=getWeekNum(r.tanggal_keluar);const yr=tglDb(r.tanggal_keluar).getFullYear();const key=`${yr}-W${wk}`;if(!weekMap[key])weekMap[key]={week:wk,range:getWeekRange(r.tanggal_keluar),tahun:yr,transaksi:[]};weekMap[key].transaksi.push(r);});
    const rekapMinggu=Object.values(weekMap).sort((a:any,b:any)=>b.tahun-a.tahun||b.week-a.week);
    const rows:any[]=[
      [esc('PT PHILIPS INDUSTRIES BATAM — MCC SPARE PART SYSTEM')],
      [esc(`Laporan Mingguan: ${fmtLengkap(now.toISOString())}`)],
      [esc(`Diekspor oleh: ${loginNama} (${loginRole})`)],[],
      [esc('SECTION 1 — REKAP FREKUENSI PEMINJAMAN')],
      ['No','Nama Teknisi','Jumlah Transaksi','Total Item','Terakhir'].map(esc).join(','),
      ...rekapFreq.map((t:any,i:number)=>[esc(i+1),esc(t.nama),esc(t.jumlah_transaksi),esc(t.total_item),esc(fmtLengkap(t.lastDate))].join(',')),[],
      [esc('SECTION 2 — REKAP PER MINGGU')],
      ...rekapMinggu.flatMap((wk:any)=>{
        return[[`MINGGU KE-${wk.week} ${wk.tahun} (${wk.range})`].map(esc).join(','),['No','Hari','Tanggal','Jam','Teknisi','Part','Jml','WO'].map(esc).join(','),...wk.transaksi.map((r:any,i:number)=>{const d=tglDb(r.tanggal_keluar);return[esc(i+1),esc(hariArr[d.getDay()]),esc(d.toLocaleDateString('id-ID')),esc(d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})),esc(r.teknisi_nama||'Manual'),esc(r.nama_part),esc(r.jumlah_keluar),esc(r.nomor_wo||'-')].join(',');}),[]];
      }),
      [esc('SECTION 3 — MASTER SPARE PARTS')],
      ['No','Nama Part','Kategori','Bin','Stok','Min','Status'].map(esc).join(','),
      ...allParts.map((p:any,i:number)=>[esc(i+1),esc(p.nama_part),esc(p.is_critical?'Critical':'Normal'),esc(p.nomor_bin),esc(p.stok_saat_ini),esc(p.reorder_point),esc(p.stok_saat_ini<=p.reorder_point?'Low Stock':'OK')].join(',')),
    ];
    const csvContent=rows.map(r=>Array.isArray(r)?r.join(','):r).join('\n');
    const blob=new Blob(['\uFEFF'+csvContent],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`MCC_Rekap_${nowStr.replace(/\//g,'-')}.csv`;a.click();URL.revokeObjectURL(url);
    showMsg('ok',`✅ Export berhasil! ${rekapFreq.length} teknisi · ${rekapMinggu.length} minggu`);
  };

  if (!isLoggedIn) return (
    <>
      <div style={{animation:transitioning?'loginFadeOut 300ms var(--mcc-ease) forwards':'none'}}><LoginModal onLogin={handleLogin}/></div>
      {transitioning&&(
        <div role="status" style={{position:'fixed',inset:0,zIndex:99999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px',background:'var(--mcc-navy)',color:'#ffffff',fontFamily:'var(--mcc-font)',animation:'overlayIn 300ms var(--mcc-ease) both'}}>
          <div style={{fontSize:'22px',fontWeight:700,letterSpacing:'1px',marginBottom:'8px'}}>PHILIPS</div>
          <div className="mcc-fade-in" style={{fontSize:'26px',fontWeight:600,animationDelay:'150ms'}}>Selamat datang, {loginNama}</div>
          <div style={{fontSize:'15px',color:'#9fb0c8'}}>Memuat dashboard...</div>
          <div style={{width:'200px',height:'3px',background:'rgba(255,255,255,0.15)',borderRadius:'2px',overflow:'hidden',marginTop:'8px'}}>
            <div style={{height:'100%',background:'var(--mcc-blue)',animation:'loadingBar 1.8s var(--mcc-ease) forwards'}}/>
          </div>
        </div>
      )}
      <style>{`@keyframes loginFadeOut{to{opacity:0;}} @keyframes overlayIn{from{opacity:0;}to{opacity:1;}} @keyframes loadingBar{from{width:0%;}to{width:100%;}}`}</style>
    </>
  );

  const mesinList = ['Soother B2','LSR','Aoki','Haitian 1K','Haitian 2K','Tampon Printing','CMYK + Auto + Motorcable + GAIA','Lambert + Slitting + Fartech','Hairobotic','Maintenance Mold','Maintenance Machine','Feeder'];
  const mesinMolding = ['Soother B2','LSR','Aoki','Haitian 1K','Haitian 2K','Maintenance Mold','Maintenance Machine','Feeder'];
  const mesinNonMolding = ['Tampon Printing','CMYK + Auto + Motorcable + GAIA','Lambert + Slitting + Fartech','Hairobotic'];
  const mesinEmoji:any = {'Soother B2':'🧸','LSR':'💧','Aoki':'💨','Haitian 1K':'🏭','Haitian 2K':'🏭','Tampon Printing':'🖨️','CMYK + Auto + Motorcable + GAIA':'🤖','Lambert + Slitting + Fartech':'✂️','Hairobotic':'🦾','Maintenance Mold':'🔩','Maintenance Machine':'⚙️','Feeder':'📦'};
  const mesinColor:any = {'Soother B2':'#0b5ed7','LSR':'#1e7e34','Aoki':'#8a5a00','Haitian 1K':'#6d28d9','Haitian 2K':'#6d28d9','Tampon Printing':'#c62828','CMYK + Auto + Motorcable + GAIA':'#0e7490','Lambert + Slitting + Fartech':'#c2410c','Hairobotic':'#6d28d9','Maintenance Mold':'#1e7e34','Maintenance Machine':'#8a5a00','Feeder':'#0b5ed7'};

  // ===== Kerangka Admin (desain baru): sidebar + header. Logika menu & login tidak diubah. =====
  const allowedMenu = menuItems.filter(item=>loginRole==='admin'||loginPerms.includes('all')||loginPerms.includes(item.id));
  const navGroups = NAV_GROUPS
    .map(g=>({label:g.label, items:g.ids.map(id=>allowedMenu.find(m=>m.id===id)).filter(Boolean) as typeof menuItems}))
    .concat([{label:'Lainnya', items:allowedMenu.filter(m=>!NAV_GROUPS.some(g=>g.ids.includes(m.id)))}])
    .filter(g=>g.items.length>0);
  const todayLabel = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const initials = (loginNama||'A').split(' ').filter(Boolean).map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="mcc-admin" style={{display:'flex',minHeight:'100vh',background:'var(--mcc-bg)',color:'var(--mcc-text)',fontFamily:'var(--mcc-font)'}}>
      <DialogHost/>
      <aside aria-label="Menu utama" style={{width:'248px',flexShrink:0,background:'var(--mcc-navy)',display:'flex',flexDirection:'column',gap:'24px',padding:'24px 16px',boxSizing:'border-box',position:'sticky',top:0,height:'100vh',overflowY:'auto',zIndex:100}}>
        <div style={{display:'flex',flexDirection:'column',gap:'2px',padding:'0 8px'}}>
          <div style={{fontSize:'22px',fontWeight:700,color:'#ffffff',letterSpacing:'1px'}}>PHILIPS</div>
          <div style={{fontSize:'14px',color:'#9fb0c8'}}>Store MCC</div>
        </div>

        <nav style={{display:'flex',flexDirection:'column',gap:'20px'}}>
          {navGroups.map(g=>(
            <div key={g.label||'utama'} style={{display:'flex',flexDirection:'column',gap:'2px'}}>
              {g.label&&<div style={{fontSize:'13px',color:'#9fb0c8',padding:'0 12px 6px'}}>{g.label}</div>}
              {g.items.map(item=>{
                const active=activePage===item.id;
                return (
                  <button key={item.id} onClick={()=>navigateTo(item.id)} aria-current={active?'page':undefined} className={'mcc-nav-item'+(active?' is-active':'')}>
                    <NavIcon id={item.id}/>
                    <span>{NAV_LABEL[item.id]||item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={{marginTop:'auto',position:'relative'}}>
          <input ref={profileFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const file=e.target.files?.[0];if(!file)return;setProfilePhoto(URL.createObjectURL(file));setShowLogout(false);showMsg('ok','Foto profil berhasil diupload!');}}/>
          {showLogout&&(
            <>
              <div style={{position:'fixed',inset:0,zIndex:198}} onClick={()=>setShowLogout(false)}/>
              <div className="mcc-fade-in" style={{position:'absolute',bottom:'calc(100% + 8px)',left:0,right:0,background:'var(--mcc-surface)',border:'1px solid var(--mcc-border)',borderRadius:'8px',boxShadow:'0 8px 24px rgba(19,41,75,0.16)',zIndex:199,overflow:'hidden'}}>
                <div style={{padding:'14px 16px',borderBottom:'1px solid var(--mcc-border)',display:'flex',flexDirection:'column',gap:'2px'}}>
                  <div style={{fontSize:'15px',fontWeight:600,color:'var(--mcc-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{loginNama}</div>
                  <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{loginRole}{loginMesin?` · ${loginMesin}`:''}</div>
                  <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>Login: {loginTime}</div>
                </div>
                <button onClick={()=>{profileFileRef.current?.click();setShowLogout(false);}} className="mcc-menu-row">
                  {profilePhoto?'Ganti foto profil':'Upload foto profil'}
                </button>
                <button onClick={handleLogout} className="mcc-menu-row" style={{color:'var(--mcc-danger)',fontWeight:600}}>
                  Keluar
                </button>
              </div>
            </>
          )}
          <button onClick={()=>setShowLogout(!showLogout)} aria-expanded={showLogout} className="mcc-profile-btn">
            <span style={{width:'36px',height:'36px',borderRadius:'18px',background:'#2a4066',color:'#ffffff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:600,overflow:'hidden',flexShrink:0}}>
              {profilePhoto?<img src={profilePhoto} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:initials}
            </span>
            <span style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',textAlign:'left'}}>
              <span style={{fontSize:'14px',fontWeight:600,color:'#ffffff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{loginNama}</span>
              <span style={{fontSize:'13px',color:'#9fb0c8'}}>{loginRole}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>
          </button>
        </div>
      </aside>

      <main style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',position:'relative'}}>
        <header style={{height:'72px',flexShrink:0,background:'var(--mcc-surface)',borderBottom:'1px solid var(--mcc-border)',display:'flex',alignItems:'center',gap:'12px',padding:'0 32px',boxSizing:'border-box',position:'sticky',top:0,zIndex:90}}>
          <div style={{flex:1,minWidth:0}}>
            <h1 style={{margin:0,fontSize:'22px',fontWeight:700,color:'var(--mcc-text)'}}>{NAV_LABEL[activePage]||'Dashboard'}</h1>
            <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{todayLabel}</div>
          </div>
          <button onClick={()=>setLang(l=>l==='id'?'en':'id')} className="mcc-icon-btn" style={{width:'auto',padding:'0 12px',fontSize:'14px',fontWeight:600}} aria-label="Ganti bahasa">
            {lang==='id'?'ID':'EN'}
          </button>
          <button onClick={()=>setShowNotif(!showNotif)} className="mcc-icon-btn" aria-label={`Permintaan part${pendingCount>0?`, ${pendingCount} menunggu`:''}`} aria-expanded={showNotif} style={{position:'relative',borderColor:newNotif?'var(--mcc-blue)':undefined}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>
            {pendingCount>0&&<span style={{position:'absolute',top:'-6px',right:'-6px',minWidth:'20px',height:'20px',padding:'0 5px',boxSizing:'border-box',borderRadius:'10px',background:'var(--mcc-danger)',color:'#ffffff',fontSize:'12px',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{pendingCount}</span>}
          </button>
        </header>

      {/* NOTIF DROPDOWN */}
      {showNotif&&(
        <div style={{position:'fixed',top:'80px',right:'24px',width:'370px',...G.card,zIndex:999,boxShadow:'0 20px 60px rgba(19,41,75,0.12)',animation:'dropDown 0.25s cubic-bezier(0.2,0,0,1) both'}}>
          <div style={{padding:'14px 16px',borderBottom:'1px solid #e6eaf0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:'14px',fontWeight:700,color:'#13294b'}}>🔔 Request Part OUT</div>
            {pendingCount>0&&<span style={{background:'rgba(198,40,40,0.15)',color:'#c62828',fontSize:'10px',fontWeight:700,padding:'2px 8px',borderRadius:'10px'}}>{pendingCount} Pending</span>}
          </div>
          <div style={{maxHeight:'360px',overflowY:'auto'}}>
            {requests.length===0?<div style={{padding:'24px',textAlign:'center',color:'#8a97a8',fontSize:'12px'}}>Belum ada request</div>
            :requests.map((r:any)=>(
              <div key={r.id} style={{padding:'12px 16px',borderBottom:'1px solid #e6eaf0',background:r.is_urgent&&r.status==='Pending'?'rgba(198,40,40,0.08)':r.status==='Pending'?'rgba(11,94,215,0.07)':'transparent'}}>
                {r.is_urgent&&r.status==='Pending'&&<div style={{background:'rgba(198,40,40,0.15)',border:'1px solid rgba(198,40,40,0.4)',borderRadius:'6px',padding:'3px 10px',fontSize:'9px',fontWeight:800,color:'#c62828',marginBottom:'7px',display:'inline-flex',alignItems:'center',gap:'4px'}}>🚨 URGENT — MESIN SHUTDOWN!</div>}
                {r.status==='Pending'&&<BannerLuarTugas area={r.mesin_area}/>}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:700,color:'#13294b'}}>{r.teknisi_nama}</div>
                    <div style={{fontSize:'11px',color:r.is_urgent?'#c62828':'#0b5ed7',marginTop:'2px'}}>{r.part_nama} <span style={{color:'#8a5a00'}}>x{r.jumlah}</span></div>
                    {r.nomor_wo&&<div style={{fontSize:'9px',color:'#5b6b80',marginTop:'2px'}}>WO: {r.nomor_wo}</div>}
                    {r.alasan_ambil&&<div style={{fontSize:'10px',color:'#13294b',marginTop:'2px'}}>Alasan: {r.alasan_ambil}</div>}
                  </div>
                  <span style={{fontSize:'9px',fontWeight:700,padding:'2px 7px',borderRadius:'10px',background:r.status==='Pending'?r.is_urgent?'rgba(198,40,40,0.15)':'rgba(154,103,0,0.12)':r.status==='Approved'?'rgba(30,126,52,0.12)':'rgba(198,40,40,0.12)',color:r.status==='Pending'?r.is_urgent?'#c62828':'#8a5a00':r.status==='Approved'?'#1e7e34':'#c62828'}}>{r.status}</span>
                </div>
                {r.status==='Pending'&&<div style={{display:'flex',gap:'6px',marginTop:'8px'}}>
                  <button onClick={()=>handleApprove(r.id)} style={{flex:1,background:r.is_urgent?'rgba(198,40,40,0.15)':'rgba(30,126,52,0.12)',border:`1px solid ${r.is_urgent?'rgba(198,40,40,0.35)':'rgba(30,126,52,0.25)'}`,borderRadius:'6px',padding:'6px',color:r.is_urgent?'#c62828':'#1e7e34',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>
                    {r.is_urgent?'� Siapkan Barang':'📷 Siapkan Barang'}
                  </button>
                  <button onClick={()=>handleReject(r.id)} style={{flex:1,background:'rgba(198,40,40,0.12)',border:'1px solid rgba(198,40,40,0.25)',borderRadius:'6px',padding:'6px',color:'#c62828',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>❌ Reject</button>
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {rejectAlert.length>0&&<div role="alert" style={{position:'fixed',top:stokAlert.length?'auto':'20px',bottom:stokAlert.length?'24px':'auto',right:'24px',width:'380px',maxWidth:'calc(100vw - 48px)',background:'#ffffff',border:'2px solid #b45309',borderRadius:'12px',padding:'14px 16px',zIndex:9500,boxShadow:'0 20px 60px rgba(19,41,75,0.18)',animation:'notifPop 0.4s cubic-bezier(0.2,0,0,1) both'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
          <span style={{fontSize:'22px'}} aria-hidden="true">⚠️</span>
          <div style={{flex:1}}><div style={{fontSize:'15px',fontWeight:700,color:'#b45309'}}>Teknisi menolak barang (tidak sesuai)</div><div style={{fontSize:'12px',color:'#5b6b80'}}>{rejectAlert.length} request perlu dicek</div></div>
        </div>
        <div style={{maxHeight:'220px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'6px'}}>
          {rejectAlert.map((r:any)=>(
            <div key={r.id} style={{fontSize:'13px',padding:'6px 8px',borderRadius:'6px',background:'#fff8e6'}}>
              <b>{r.teknisi_nama||'Teknisi'}</b> · {r.part_nama||'-'} ×{r.jumlah??'-'}
              {r.alasan_tolak&&<span style={{display:'block',fontSize:'12px',color:'#5b6b80'}}>{String(r.alasan_tolak)}</span>}
            </div>))}
        </div>
        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}}>
          <button type="button" className="mcc-btn-secondary" onClick={()=>setRejectAlert([])}>Tutup</button>
          <button type="button" className="mcc-btn-primary" onClick={()=>{setShowNotif(true);setRejectAlert([]);}}>Lihat request</button>
        </div>
      </div>}
      {izinNotif!=='ok'&&izinNotif!=='tutup'&&<div style={{position:'fixed',left:'24px',bottom:'24px',width:'400px',maxWidth:'calc(100vw - 48px)',background:'#ffffff',border:'1px solid rgba(11,94,215,0.35)',borderRadius:'10px',padding:'12px 14px',zIndex:9400,boxShadow:'0 12px 40px rgba(19,41,75,0.14)',fontSize:'13px',lineHeight:1.5}}>
        <div style={{fontWeight:700,marginBottom:'4px'}}>Notifikasi saat aplikasi di-minimize</div>
        {izinNotif==='minta'&&<div>Supaya request baru, stok minimum, dan reject teknisi tetap muncul di pojok Windows walaupun aplikasi di-minimize, klik <b>Aktifkan</b> lalu pilih <b>Allow / Izinkan</b>.</div>}
        {izinNotif==='ditolak'&&<div>Notifikasi pernah diblokir. Klik ikon gembok di kiri alamat → <b>Notifications: Allow</b>, lalu muat ulang halaman.</div>}
        {izinNotif==='tidak_bisa'&&<div>Browser hanya mengizinkan notifikasi Windows di alamat aman. Di Admin PC: buka <b>chrome://flags/#unsafely-treat-insecure-origin-as-secure</b>, pastikan alamat <b>{typeof window!=='undefined'?window.location.origin:''}</b> ada di daftar (sama seperti setting kamera), lalu Relaunch. Sementara itu judul tab akan berkedip saat ada notifikasi.</div>}
        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'8px'}}>
          <button type="button" className="mcc-btn-secondary" onClick={()=>{try{localStorage.setItem('mcc_notif_banner','tutup');}catch{}setIzinNotif('tutup');}}>Tutup</button>
          {izinNotif==='minta'&&<button type="button" className="mcc-btn-primary" onClick={async()=>{try{const h=await Notification.requestPermission();setIzinNotif(h==='granted'?'ok':h==='denied'?'ditolak':'minta');if(h==='granted')notifDesktop('Notifikasi MCC aktif','Notifikasi akan muncul di sini walaupun aplikasi di-minimize.','mcc-tes');}catch{setIzinNotif('tidak_bisa');}}}>Aktifkan</button>}
        </div>
      </div>}
      {stokAlert.length>0&&<div role="alert" style={{position:'fixed',top:'20px',right:'24px',width:'380px',maxWidth:'calc(100vw - 48px)',background:'#ffffff',border:'2px solid #c62828',borderRadius:'12px',padding:'14px 16px',zIndex:9500,boxShadow:'0 20px 60px rgba(19,41,75,0.18)',animation:'notifPop 0.4s cubic-bezier(0.2,0,0,1) both'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
          <span style={{fontSize:'22px'}} aria-hidden="true">🔔</span>
          <div style={{flex:1}}><div style={{fontSize:'15px',fontWeight:700,color:'#c62828'}}>Stok mencapai batas minimum</div><div style={{fontSize:'12px',color:'#5b6b80'}}>{stokAlert.length} part perlu dipesan ulang</div></div>
        </div>
        <div style={{maxHeight:'220px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'6px'}}>
          {stokAlert.map((p:any)=>(
            <div key={p.id} style={{display:'flex',justifyContent:'space-between',gap:'10px',fontSize:'13px',padding:'6px 8px',borderRadius:'6px',background:'#fdecec'}}>
              <span style={{minWidth:0}}><b>{p.nama_part}</b><span style={{display:'block',fontSize:'11px',color:'#5b6b80'}}>Rak {p.nomor_bin||'-'}</span></span>
              <span style={{whiteSpace:'nowrap',fontWeight:700,color:'#c62828',fontVariantNumeric:'tabular-nums'}}>{p.stok_saat_ini??0} / min {p.reorder_point}</span>
            </div>))}
        </div>
        <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'10px'}}>
          <button type="button" className="mcc-btn-secondary" onClick={()=>setStokAlert([])}>Tutup</button>
          <button type="button" className="mcc-btn-primary" onClick={()=>{setActivePage('monitoring');setStokAlert([]);}}>Lihat di Monitoring</button>
        </div>
      </div>}

      {newNotif&&<div style={{position:'fixed',bottom:'24px',right:'24px',...G.card,padding:'14px 18px',zIndex:999,display:'flex',alignItems:'center',gap:'12px',boxShadow:'0 20px 60px rgba(19,41,75,0.12)',animation:'notifPop 0.4s cubic-bezier(0.2,0,0,1) both',border:'1px solid rgba(11,94,215,0.35)'}}>
        <span style={{fontSize:'24px'}}>🔔</span>
        <div><div style={{fontSize:'13px',fontWeight:700,color:'#0b5ed7'}}>Request Part OUT Baru!</div><div style={{fontSize:'11px',color:'#5b6b80'}}>Menunggu persetujuan</div></div>
        <button onClick={()=>{setShowNotif(true);setNewNotif(false);}} style={{background:'#0b5ed7',border:'none',borderRadius:'6px',padding:'6px 12px',color:'#fff',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>Lihat</button>
      </div>}

      {showPrepareModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 680, background: '#ffffff', border: '1px solid rgba(11,94,215,0.25)', borderRadius: 16, padding: 20, boxShadow: '0 30px 80px rgba(19,41,75,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#0b5ed7', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase' }}>Admin Documentation</div>
                <div style={{ fontSize: 20, color: '#13294b', fontWeight: 800, marginTop: 4 }}>{showPrepareModal.requestData?.part_nama || 'Siapkan Barang'}</div>
              </div>
              <button onClick={() => { setShowPrepareModal(null); setPreparePhoto(''); setPrepareNote(''); setPrepareError(''); }} style={{ background: '#f8f9fb', border: '1px solid #d9dee5', borderRadius: 8, padding: '6px 12px', color: '#13294b', cursor: 'pointer' }}>Tutup</button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ fontSize: 12, color: '#13294b' }}>
                <strong>Request ID:</strong> {showPrepareModal.requestId}
              </div>

              <CameraCapture
                label="📷 Foto kondisi barang saat disiapkan"
                onCapture={(base64) => {
                  setPreparePhoto(base64);
                  if (base64) setPrepareError('');
                }}
                onError={(message) => setPrepareError(message)}
              />

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#dbeafe', marginBottom: 6 }}>Catatan kondisi / dokumen</label>
                <textarea
                  value={prepareNote}
                  onChange={(e) => setPrepareNote(e.target.value)}
                  placeholder="Contoh: Part siap dengan kondisi baik, label aman, dimasukkan ke rack A2..."
                  style={{ width: '100%', minHeight: 90, resize: 'vertical', background: '#f8f9fb', border: '1px solid #d9dee5', borderRadius: 8, color: '#13294b', padding: 12, fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>

              {prepareError && (
                <div style={{ background: 'rgba(198,40,40,0.12)', border: '1px solid rgba(198,40,40,0.3)', borderRadius: 8, padding: '10px 12px', color: '#c62828', fontSize: 11 }}>❌ {prepareError}</div>
              )}

              <button
                onClick={handlePrepareSave}
                disabled={preparingRequestId === showPrepareModal.requestId || !preparePhoto}
                style={{
                  background: preparingRequestId === showPrepareModal.requestId || !preparePhoto ? 'rgba(148,163,184,0.2)' : '#1e7e34',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: preparingRequestId === showPrepareModal.requestId || !preparePhoto ? 'not-allowed' : 'pointer',
                }}
              >
                {preparingRequestId === showPrepareModal.requestId ? '⏳ Menyimpan...' : '💾 Simpan & Dokumen Siap'}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg&&<div style={{background:msg.type==='ok'?'rgba(30,126,52,0.1)':'rgba(198,40,40,0.1)',borderBottom:`1px solid ${msg.type==='ok'?'rgba(30,126,52,0.25)':'rgba(198,40,40,0.25)'}`,padding:'10px 24px',color:msg.type==='ok'?'#1e7e34':'#c62828',fontSize:'12px',display:'flex',alignItems:'center',gap:'8px',animation:'slideDown 0.3s ease both'}}>
        {msg.type==='ok'?'✅':'❌'} {msg.text}
      </div>}

      {scanMode&&<div style={{background:'rgba(11,94,215,0.12)',borderBottom:'1px solid rgba(11,94,215,0.25)',padding:'12px 24px',display:'flex',alignItems:'center',gap:'14px'}}>
        <span style={{fontSize:'24px'}}>📛</span><div><div style={{fontSize:'13px',fontWeight:700,color:'#0b5ed7'}}>Tempelkan Badge RFID...</div></div>
        <button onClick={()=>setScanMode(false)} style={{marginLeft:'auto',background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'6px',padding:'5px 14px',color:'#5b6b80',fontSize:'11px',cursor:'pointer'}}>Batal</button>
      </div>}

      <div style={{position:'relative',zIndex:1,flex:1,animation:pageAnim==='in'?'pageSlideIn 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both':'pageSlideOut 0.2s ease forwards'}}>

      {/* ══ DASHBOARD ══ */}
      {activePage==='dashboard'&&(
        <div style={{padding:'28px 32px'}}>
          {(()=>{
            // ===== Ringkasan dashboard (desain baru). Data diambil dari state yang sudah ada. =====
            const lowList=partsList.filter(p=>p.stok_saat_ini<=p.reorder_point)
              .sort((a:any,b:any)=>(a.stok_saat_ini/(a.reorder_point||1))-(b.stok_saat_ini/(b.reorder_point||1)));
            const criticalCount=partsList.filter(p=>p.is_critical).length;
            const kpis=[
              {label:'Total part',value:partsList.length,note:'Terdaftar di katalog',color:'var(--mcc-text)'},
              {label:'Stok rendah',value:lowList.length,note:'Di bawah reorder point',color:'var(--mcc-warning)'},
              {label:'Part kritis',value:criticalCount,note:'Ditandai critical',color:'var(--mcc-danger)'},
              {label:'Permintaan menunggu',value:pendingCount,note:'Perlu ditinjau admin',color:'var(--mcc-blue)'},
            ];
            return (
              <>
                <section aria-label="Ringkasan" className="mcc-fade-in" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',background:'var(--mcc-surface)',border:'1px solid var(--mcc-border)',borderRadius:'8px',marginBottom:'24px'}}>
                  {kpis.map((k,i)=>(
                    <div key={k.label} style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'4px',borderLeft:i>0?'1px solid #e6eaf0':'none'}}>
                      <div style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{k.label}</div>
                      <div style={{fontSize:'32px',fontWeight:700,lineHeight:1.2,color:k.color,fontVariantNumeric:'tabular-nums'}}>{k.value}</div>
                      <div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{k.note}</div>
                    </div>
                  ))}
                </section>

                <div style={{marginBottom:'32px'}}>
                  <section aria-label="Perlu diisi ulang" style={{background:'var(--mcc-surface)',border:'1px solid var(--mcc-border)',borderRadius:'8px',display:'flex',flexDirection:'column'}}>
                    <div style={{padding:'16px 24px',borderBottom:'1px solid #e6eaf0',display:'flex',alignItems:'center',gap:'8px'}}>
                      <h2 style={{margin:0,fontSize:'17px',fontWeight:700,flex:1}}>Perlu diisi ulang</h2>
                      {lowList.length>0&&<span style={{fontSize:'14px',color:'var(--mcc-text-muted)'}}>{lowList.length} part</span>}
                    </div>
                    {lowList.length===0?(
                      <div style={{padding:'24px',fontSize:'15px',color:'var(--mcc-text-muted)'}}>Semua stok di atas reorder point.</div>
                    ):(
                      <div style={{maxHeight:'420px',overflowY:'auto',display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',columnGap:'1px',background:'#eef1f5'}}>
                        {lowList.slice(0,12).map((p:any,i:number)=>{
                          const ratio=Math.min(1,(p.stok_saat_ini||0)/(p.reorder_point||1));
                          const urgent=(p.stok_saat_ini||0)===0||ratio<0.5;
                          return (
                            <div key={p.id} style={{padding:'14px 24px',background:'var(--mcc-surface)',borderTop:i>1?'1px solid #eef1f5':'none',display:'flex',flexDirection:'column',gap:'6px'}}>
                              <div style={{display:'flex',justifyContent:'space-between',gap:'12px'}}>
                                <div style={{fontSize:'15px',fontWeight:600,minWidth:0}}>{p.nama_part}</div>
                                <div style={{fontSize:'15px',fontWeight:700,whiteSpace:'nowrap',fontVariantNumeric:'tabular-nums',color:urgent?'var(--mcc-danger)':'var(--mcc-warning)'}}>{p.stok_saat_ini} / {p.reorder_point}</div>
                              </div>
                              <div style={{height:'4px',borderRadius:'2px',background:'#eef1f5'}}>
                                <div style={{width:`${Math.max(4,ratio*100)}%`,height:'4px',borderRadius:'2px',background:urgent?'var(--mcc-danger)':'#b7791f'}}/>
                              </div>
                              {(p.lokasi_simpan||p.nomor_bin)&&<div style={{fontSize:'13px',color:'var(--mcc-text-muted)'}}>{[p.lokasi_simpan,p.nomor_bin].filter(Boolean).join(', ')}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{padding:'14px 24px',borderTop:'1px solid #e6eaf0'}}>
                      <button onClick={()=>navigateTo('monitoring')} className="mcc-link-btn">Buka monitoring stok</button>
                    </div>
                  </section>
                </div>

                <DashboardRak onBukaLokasi={()=>navigateTo('lokasi')}/>
              </>
            );
          })()}

          <div style={{margin:'0 0 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'16px'}}>
            <h2 style={{margin:0,fontSize:'17px',fontWeight:700,color:'var(--mcc-text)'}}>Leader per area mesin</h2>
            <button onClick={()=>navigateTo('parts')} className="mcc-btn-secondary">Tambah part</button>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',alignItems:'start'}}>

            {/* ── KOLOM MOLDING ── */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',padding:'11px 16px',background:'rgba(67,56,202,0.06)',borderRadius:'8px',border:'1px solid rgba(67,56,202,0.25)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'15px',fontWeight:700,color:'#4338ca'}}>Molding</div>
                  <div style={{fontSize:'13px',color:'rgba(67,56,202,0.45)',marginTop:'2px'}}>{moldingTLList.length} TL · {mesinMolding.length} mesin</div>
                  <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'5px'}}>
                    <span style={{fontSize:'12px',color:'rgba(67,56,202,0.5)',fontWeight:700}}>Supervisor:</span>
                    {editingMoldingSup
                      ?<input autoFocus style={{background:'rgba(67,56,202,0.15)',border:'1px solid rgba(67,56,202,0.4)',borderRadius:'5px',padding:'2px 7px',color:'#4338ca',fontSize:'13px',outline:'none',fontFamily:'inherit',width:'160px'}}
                        value={moldingSupervisor}
                        onChange={e=>setMoldingSupervisor(e.target.value)}
                        onBlur={()=>{setEditingMoldingSup(false);try{localStorage.setItem('mcc_moldingSupervisor',moldingSupervisor);}catch{}}}
                        onKeyDown={e=>{if(e.key==='Enter'){setEditingMoldingSup(false);try{localStorage.setItem('mcc_moldingSupervisor',moldingSupervisor);}catch{};}}}/>
                      :<span onClick={()=>setEditingMoldingSup(true)} style={{fontSize:'13px',fontWeight:600,color:'#4338ca',cursor:'pointer',borderBottom:'1px dashed rgba(67,56,202,0.3)',paddingBottom:'1px'}} title="Klik untuk edit">{moldingSupervisor}</span>
                    }
                  </div>
                </div>
                <button onClick={()=>{setFormLeader({nama:'',area:'molding',aksen:'#0b5ed7',mesinInput:'',mesinList:[]});setShowTambahLeader(true);}} title="Tambah Team Leader" aria-label="Tambah Team Leader" style={{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(67,56,202,0.12)',border:'1px solid rgba(67,56,202,0.4)',color:'#4338ca',fontSize:'20px',fontWeight:700,lineHeight:1,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0}}>+</button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {moldingTLList.map((tl,ti)=>{
                  const allParts=tl.mesin.flatMap(m=>partsList.filter((p:any)=>(p.mesin&&p.mesin.toLowerCase().includes(m.toLowerCase().split(' ')[0].toLowerCase()))||(p.kategori&&p.kategori.toLowerCase()===m.toLowerCase().split(' ')[0].toLowerCase())));
                  const uniqueParts=[...new Map(allParts.map(p=>[p.id,p])).values()];
                  const lowParts=uniqueParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point);
                  const isSelected=selectedMesin===`tl_${tl.inisial}`;
                  return(
                    <div key={tl.nama} onClick={()=>setSelectedMesin(isSelected?null:`tl_${tl.inisial}`)}
                      style={{background:'#f8f9fb',border:`1.5px solid ${isSelected?tl.aksen:'#e6eaf0'}`,borderRadius:'8px',overflow:'hidden',cursor:'pointer',transition:'all 0.25s',boxShadow:'none',animation:'cardPop 0.4s ease both',animationDelay:`${ti*80}ms`}}
                      onMouseEnter={e=>{if(!isSelected){e.currentTarget.style.borderColor=tl.aksen;e.currentTarget.style.transform='none';}}}
                      onMouseLeave={e=>{if(!isSelected){e.currentTarget.style.borderColor='#e6eaf0';e.currentTarget.style.transform='translateY(0)';}}} >
                      <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',background:isSelected?`${tl.aksen}11`:'transparent',borderBottom:'1px solid #e6eaf0'}}>
                        <div style={{width:'44px',height:'44px',borderRadius:'50%',background:tl.warna,border:`2px solid ${tl.aksen}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',fontWeight:700,color:tl.aksen,flexShrink:0,overflow:'hidden',cursor:'pointer'}}
                          onClick={e=>{e.stopPropagation();teknisiFileRef.current[tl.nama]?.click();}}>
                          {teknisiCovers[tl.nama]?<img src={teknisiCovers[tl.nama]} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{tl.inisial}</span>}
                        </div>
                        <input type="file" accept="image/*" style={{display:'none'}} ref={el=>{teknisiFileRef.current[tl.nama]=el;}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;setTeknisiCovers((p:any)=>({...p,[tl.nama]:URL.createObjectURL(f)}));}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:'15px',fontWeight:700,color:'#13294b'}}>{tl.nama}</div>
                          <div style={{fontSize:'13px',color:'#5b6b80',marginTop:'2px'}}>Molding · {tl.mesin.length} mesin · {uniqueParts.length} part</div>
                        </div>
                        {lowParts.length>0&&<span style={{background:'rgba(198,40,40,0.15)',border:'1px solid rgba(198,40,40,0.3)',borderRadius:'20px',padding:'2px 8px',fontSize:'12px',fontWeight:700,color:'#c62828'}}>{lowParts.length} stok rendah</span>}
                        <button onClick={e=>{e.stopPropagation();setEditLeader({...tl,mesinList:[...tl.mesin],_originalNama:tl.nama});setEditLeaderArea('molding');}} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.3)',borderRadius:'6px',padding:'3px 8px',color:'#0b5ed7',fontSize:'12px',fontWeight:600,cursor:'pointer'}} aria-label="Ubah leader" title="Ubah leader"><IconEdit/></button>
                        <button onClick={async e=>{e.stopPropagation();e.preventDefault();if(!await tanya(`Hapus ${tl.nama}?`))return;const updated=moldingTLList.filter((_:any,i:number)=>i!==ti);setMoldingTLList(updated);try{localStorage.setItem('mcc_moldingTL',JSON.stringify(updated));}catch{}showMsg('ok',`${tl.nama} dihapus`);setSelectedMesin(null);}} style={{background:'rgba(198,40,40,0.12)',border:'1px solid rgba(198,40,40,0.25)',borderRadius:'6px',padding:'3px 8px',color:'#c62828',fontSize:'12px',fontWeight:600,cursor:'pointer'}} aria-label="Hapus leader" title="Hapus leader"><IconTrash/></button>
                        <span style={{fontSize:'13px',color:'#8a97a8',display:'inline-flex',transition:'transform 0.2s',transform:isSelected?'rotate(90deg)':'rotate(0deg)'}}><IconChevron/></span>
                      </div>
                      <div style={{padding:'10px 16px',display:'flex',flexWrap:'wrap',gap:'6px'}}>
                        {tl.mesin.map(m=>{
                          const mParts=partsList.filter((p:any)=>(p.mesin&&p.mesin.toLowerCase().includes(m.toLowerCase().split(' ')[0].toLowerCase()))||(p.kategori&&p.kategori.toLowerCase()===m.toLowerCase().split(' ')[0].toLowerCase()));
                          const mLow=mParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                          return(
                            <div key={m} style={{background:`${tl.aksen}12`,border:`1px solid ${tl.aksen}30`,borderRadius:'8px',padding:'5px 10px',display:'flex',alignItems:'center',gap:'6px'}}>
                              
                              <div>
                                <div style={{fontSize:'13px',fontWeight:600,color:'#13294b'}}>{m}</div>
                                <div style={{fontSize:'12px',color:mLow>0?'#c62828':tl.aksen}}>{mParts.length} part{mLow>0?` · ${mLow} rendah`:''}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {isSelected&&uniqueParts.length>0&&(
                        <div style={{padding:'10px 16px',borderTop:'1px solid #e6eaf0',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px',background:'rgba(19,41,75,0.07)'}}>
                          {uniqueParts.map((p:any)=>{
                            const isLow=p.stok_saat_ini<=p.reorder_point;
                            return(
                              <div key={p.id} style={{padding:'8px 10px',background:'#f8f9fb',borderRadius:'8px',border:`1px solid ${isLow?'rgba(198,40,40,0.2)':'#e6eaf0'}`}}>
                                <div style={{fontSize:'13px',fontWeight:600,color:'#13294b',marginBottom:'3px',lineHeight:1.3}}>{p.nama_part}</div>
                                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'12px',color:'#8a97a8',fontFamily:'inherit'}}>{p.nomor_bin||'-'}</span><span style={{fontSize:'14px',fontWeight:700,color:isLow?'#c62828':tl.aksen}}>{p.stok_saat_ini}</span></div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── KOLOM NON MOLDING ── */}
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',padding:'11px 16px',background:'rgba(15,118,110,0.06)',borderRadius:'8px',border:'1px solid rgba(15,118,110,0.25)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'15px',fontWeight:700,color:'#0f766e'}}>Non-molding</div>
                  <div style={{fontSize:'13px',color:'rgba(15,118,110,0.45)',marginTop:'2px'}}>{nonMoldingTeknisi.length} teknisi · {mesinNonMolding.length} mesin</div>
                  <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'5px'}}>
                    <span style={{fontSize:'12px',color:'rgba(15,118,110,0.5)',fontWeight:700}}>Supervisor:</span>
                    {editingNMSup
                      ?<input autoFocus style={{background:'rgba(15,118,110,0.15)',border:'1px solid rgba(15,118,110,0.4)',borderRadius:'5px',padding:'2px 7px',color:'#0f766e',fontSize:'13px',outline:'none',fontFamily:'inherit',width:'160px'}}
                        value={nonMoldingSupervisor}
                        onChange={e=>setNonMoldingSupervisor(e.target.value)}
                        onBlur={()=>{setEditingNMSup(false);try{localStorage.setItem('mcc_nmSupervisor',nonMoldingSupervisor);}catch{}}}
                        onKeyDown={e=>{if(e.key==='Enter'){setEditingNMSup(false);try{localStorage.setItem('mcc_nmSupervisor',nonMoldingSupervisor);}catch{};}}}/>
                      :<span onClick={()=>setEditingNMSup(true)} style={{fontSize:'13px',fontWeight:600,color:'#0f766e',cursor:'pointer',borderBottom:'1px dashed rgba(15,118,110,0.3)',paddingBottom:'1px'}} title="Klik untuk edit">{nonMoldingSupervisor}</span>
                    }
                  </div>
                </div>
                <button onClick={()=>{setFormLeader({nama:'',area:'nonmolding',aksen:'#0f766e',mesinInput:'',mesinList:[]});setShowTambahLeader(true);}} title="Tambah teknisi" aria-label="Tambah teknisi" style={{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(15,118,110,0.12)',border:'1px solid rgba(15,118,110,0.4)',color:'#0f766e',fontSize:'20px',fontWeight:700,lineHeight:1,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',padding:0}}>+</button>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                {nonMoldingTeknisi.map((tek,ti)=>{
                  const allParts=tek.mesin.flatMap((m:string)=>partsList.filter((p:any)=>(p.mesin&&p.mesin.toLowerCase().includes(m.toLowerCase().split(' ')[0].toLowerCase()))||(p.kategori&&p.kategori.toLowerCase()===m.toLowerCase().split(' ')[0].toLowerCase())));
                  const uniqueParts=[...new Map(allParts.map((p:any)=>[p.id,p])).values()];
                  const lowParts=(uniqueParts as any[]).filter((p:any)=>p.stok_saat_ini<=p.reorder_point);
                  const cover=teknisiCovers[tek.nama];
                  const isSelected=selectedTeknisi===tek.nama;
                  return(
                    <div key={tek.nama} onClick={()=>setSelectedTeknisi(isSelected?null:tek.nama)}
                      style={{background:'#f8f9fb',border:`1.5px solid ${isSelected?tek.aksen:'#e6eaf0'}`,borderRadius:'8px',overflow:'hidden',cursor:'pointer',transition:'all 0.25s',boxShadow:'none',animation:'cardPop 0.4s ease both',animationDelay:`${ti*80}ms`}}
                      onMouseEnter={e=>{if(!isSelected){e.currentTarget.style.borderColor=tek.aksen;e.currentTarget.style.transform='none';}}}
                      onMouseLeave={e=>{if(!isSelected){e.currentTarget.style.borderColor='#e6eaf0';e.currentTarget.style.transform='translateY(0)';}}} >
                      <div style={{padding:'14px 16px',display:'flex',alignItems:'center',gap:'12px',background:isSelected?`${tek.aksen}11`:'transparent',borderBottom:'1px solid #e6eaf0'}}>
                        <div style={{width:'44px',height:'44px',borderRadius:'50%',background:tek.warna,border:`2px solid ${tek.aksen}55`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,cursor:'pointer'}} onClick={e=>{e.stopPropagation();teknisiFileRef.current[tek.nama]?.click();}}>
                          {cover?<img src={cover} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'15px',fontWeight:700,color:tek.aksen}}>{tek.inisial}</span>}
                        </div>
                        <input type="file" accept="image/*" style={{display:'none'}} ref={el=>{teknisiFileRef.current[tek.nama]=el;}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;setTeknisiCovers((p:any)=>({...p,[tek.nama]:URL.createObjectURL(f)}));}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:'15px',fontWeight:700,color:'#13294b'}}>{tek.nama}</div>
                          {(tek as any).sistem&&<div style={{fontSize:'12px',background:`${tek.aksen}22`,color:tek.aksen,padding:'1px 7px',borderRadius:'8px',display:'inline-block',marginTop:'2px',fontWeight:700}}>Sistem: {(tek as any).sistem}</div>}
                          <div style={{fontSize:'13px',color:'#5b6b80',marginTop:'2px'}}>Non-molding · {tek.mesin.length} mesin · {uniqueParts.length} part</div>
                        </div>
                        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                          {lowParts.length>0&&<span style={{background:'rgba(198,40,40,0.15)',border:'1px solid rgba(198,40,40,0.3)',borderRadius:'20px',padding:'2px 8px',fontSize:'12px',fontWeight:700,color:'#c62828'}}>{lowParts.length} stok rendah</span>}
                          <button onClick={e=>{e.stopPropagation();handleSendEmailOneTL(tek.nama);}} style={{background:`${tek.aksen}22`,border:`1px solid ${tek.aksen}44`,borderRadius:'6px',padding:'3px 8px',color:tek.aksen,fontSize:'12px',fontWeight:600,cursor:'pointer'}} aria-label="Kirim email ke leader" title="Kirim email ke leader"><IconMail/></button>
                          <button onClick={e=>{e.stopPropagation();setEditLeader({...tek,mesinList:[...tek.mesin],_originalNama:tek.nama});setEditLeaderArea('nonmolding');}} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.3)',borderRadius:'6px',padding:'3px 8px',color:'#0b5ed7',fontSize:'12px',fontWeight:600,cursor:'pointer'}} aria-label="Ubah leader" title="Ubah leader"><IconEdit/></button>
                          <button onClick={async e=>{e.stopPropagation();e.preventDefault();if(!await tanya(`Hapus ${tek.nama}?`))return;const updated=(nonMoldingTeknisi as any[]).filter((_:any,i:number)=>i!==ti);setNonMoldingTeknisi(updated as any);try{localStorage.setItem('mcc_nonMoldingTeknisi',JSON.stringify(updated));}catch{}showMsg('ok',`${tek.nama} dihapus`);setSelectedTeknisi(null);}} style={{background:'rgba(198,40,40,0.12)',border:'1px solid rgba(198,40,40,0.25)',borderRadius:'6px',padding:'3px 8px',color:'#c62828',fontSize:'12px',fontWeight:600,cursor:'pointer'}} aria-label="Hapus leader" title="Hapus leader"><IconTrash/></button>
                          <span style={{fontSize:'13px',color:'#8a97a8',display:'inline-flex',transition:'transform 0.2s',transform:isSelected?'rotate(90deg)':'rotate(0deg)'}}><IconChevron/></span>
                        </div>
                      </div>
                      <div style={{padding:'10px 16px',display:'flex',flexWrap:'wrap',gap:'6px'}}>
                        {tek.mesin.slice(0,6).map((m:string)=>(
                          <div key={m} style={{background:`${tek.aksen}12`,border:`1px solid ${tek.aksen}30`,borderRadius:'8px',padding:'4px 8px'}}>
                            <span style={{fontSize:'13px',fontWeight:600,color:'#13294b'}}>{m}</span>
                          </div>
                        ))}
                        {tek.mesin.length>6&&<div style={{background:'#f8f9fb',borderRadius:'8px',padding:'4px 8px'}}><span style={{fontSize:'13px',color:'#5b6b80'}}>+{tek.mesin.length-6} lainnya</span></div>}
                      </div>
                      {isSelected&&(
                        <div style={{padding:'10px 16px',borderTop:'1px solid #e6eaf0',background:'rgba(19,41,75,0.07)'}}>
                          <div style={{fontSize:'13px',fontWeight:700,color:'#5b6b80',marginBottom:'8px'}}>Semua mesin tanggung jawab</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'5px'}}>
                            {tek.mesin.map((m:string,i:number)=>(
                              <div key={m} style={{padding:'6px 8px',background:'#f8f9fb',borderRadius:'6px',border:`1px solid ${tek.aksen}22`,display:'flex',alignItems:'center',gap:'6px'}}>
                                <span style={{width:'18px',height:'18px',borderRadius:'50%',background:`${tek.aksen}22`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:tek.aksen,flexShrink:0}}>{i+1}</span>
                                <span style={{fontSize:'12px',color:'#13294b',lineHeight:1.3}}>{m}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          
        </div>
      )}

      {/* ══ MASTER DATA ══ */}
      {activePage==='parts'&&!masterLama&&(
        <MasterMesin kategoriList={kategoriList} onTampilanLama={()=>setMasterLama(true)}
          onPartsBerubah={()=>fetch('/api/parts').then(r=>r.json()).then(d=>{const arr=toArr(d.data??d);if(arr.length>0)setPartsList(arr);}).catch(()=>{})}/>
      )}
      {activePage==='parts'&&masterLama&&(
        <div style={{padding:'24px'}}>
          {/* Header */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
            <div>
              <button type="button" className="mcc-link-btn" style={{marginBottom:'6px'}} onClick={()=>setMasterLama(false)}>← Kembali ke Master Data baru</button>
              <div style={{fontSize:'9px',fontWeight:700,color:'#0b5ed7',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'4px'}}>Master Data (tampilan lama)</div>
              <div style={{fontSize:'26px',fontWeight:800,color:'#13294b'}}>📋 Master <span style={{color:'#0b5ed7'}}>Data</span></div>
              {masterTab==='part'&&<div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'5px',fontSize:'11px',color:'#5b6b80'}}>
                <span onClick={()=>{setPartsJenis('semua');setPartsDrillMesin(null);setFilterKat('Semua');}} style={{cursor:'pointer',color:partsJenis==='semua'?'#0b5ed7':'#5b6b80'}}>Semua</span>
                {partsJenis!=='semua'&&<><span>›</span><span onClick={()=>setPartsDrillMesin(null)} style={{cursor:'pointer',color:!partsDrillMesin?'#0b5ed7':'#5b6b80'}}>{partsJenis==='molding'?'🏭 Molding':'⚙️ Non Molding'}</span></>}
                {partsDrillMesin&&<><span>›</span><span style={{color:'#0b5ed7',fontWeight:700}}>{partsDrillMesin}</span></>}
              </div>}
            </div>
            {!partsDrillMesin&&<button onClick={()=>{
                if(partsJenis!=='semua'){
                  setFormMesin({nama:'',emoji:'⚙️',color:'#0b5ed7',jenis:partsJenis==='molding'?'molding':'nonmolding',tl:'',keterangan:''});
                  setEditMesin(null);setShowTambahMesin(true);
                }else{
                  setShowPartForm(true);setEditPart(null);
                }
              }} style={{background:'#0b5ed7',border:'none',borderRadius:'8px',padding:'10px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
                + {partsJenis!=='semua'?t('Tambah Mesin','Add Machine'):t('Tambah Part','Add Part')}
              </button>}
          </div>

          {/* Unified view - no tab switcher */}

          {/* ── KELOLA MESIN (hidden, managed inline) ── */}
          {false&&(()=>{
            // Group non-molding machines by prefix
            const getGroupKey = (nama:string) => {
              if(nama.startsWith('TAMPON')) return 'TAMPON';
              if(nama.startsWith('CMYK')) return 'CMYK';
              if(nama.startsWith('GAIYA')) return 'GAIYA';
              if(nama.startsWith('External Siliting')) return 'External Siliting';
              if(nama.startsWith('Semi Auto Assembly')) return 'Semi Auto Assembly Soother';
              if(nama.startsWith('Full Auto Assembly')) return 'Full Auto Assembly Soother';
              return nama; // unique
            };
            const nmGroups = mesinNonMoldingData.reduce((acc:any, m, mi) => {
              const key = getGroupKey(m.nama);
              if(!acc[key]) acc[key] = {key, emoji:m.emoji, color:m.color, tl:m.tl, items:[]};
              acc[key].items.push({...m, _idx:mi});
              return acc;
            }, {} as any);
            const nmGroupList = Object.values(nmGroups) as any[];

            const renderMesinCard = (m:any, mi:number, isGrouped:boolean=false) => {
              const partCount = partsList.filter((p:any)=>
                p.mesin?.toLowerCase().includes(m.nama.toLowerCase().split(' ')[0].toLowerCase()) ||
                p.kategori?.toLowerCase()===m.nama.toLowerCase().split(' ')[0].toLowerCase()
              ).length;
              return(
                <div key={m.nama} style={{...G.card,overflow:'hidden',transition:'all 0.2s',animation:'cardPop 0.4s ease both',animationDelay:`${mi*40}ms`}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 12px 32px ${m.color}25`;e.currentTarget.style.borderColor=`${m.color}66`;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='#d9dee5';}}>
                  <div style={{height:'80px',background:`linear-gradient(135deg,${m.color}22,${m.color}08)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'36px',position:'relative'}}>
                    {m.emoji}
                    <div style={{position:'absolute',top:'5px',right:'5px',display:'flex',gap:'3px'}}>
                      <button onClick={e=>{e.stopPropagation();setEditMesin({...m,_idx:m._idx??mi,_jenis:mesinTab});}} style={{background:'rgba(11,94,215,0.2)',border:'1px solid rgba(11,94,215,0.3)',borderRadius:'5px',padding:'2px 5px',color:'#0b5ed7',fontSize:'8px',cursor:'pointer'}}>✏️</button>
                      <button onClick={async e=>{e.stopPropagation();if(!await tanya(`Hapus ${m.nama}?`))return;if(mesinTab==='molding'){setMesinMoldingData(p=>{const n=p.filter((_,i)=>i!==(m._idx??mi));try{localStorage.setItem('mcc_mesinMolding',JSON.stringify(n));}catch{}return n;});}else{setMesinNonMoldingData(p=>{const n=p.filter((_,i)=>i!==(m._idx??mi));try{localStorage.setItem('mcc_mesinNonMolding',JSON.stringify(n));}catch{}return n;});}showMsg('ok',`✅ ${m.nama} dihapus`);}} style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.25)',borderRadius:'5px',padding:'2px 5px',color:'#c62828',fontSize:'8px',cursor:'pointer'}}>🗑️</button>
                    </div>
                  </div>
                  <div style={{padding:'10px'}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:'#13294b',marginBottom:'2px'}}>{m.nama}</div>
                    <div style={{fontSize:'9px',color:'#5b6b80',marginBottom:'6px',lineHeight:1.3}}>{m.keterangan}</div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:'8px',background:`${m.color}15`,color:m.color,padding:'2px 6px',borderRadius:'8px',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'90px'}}>👷 {m.tl}</span>
                      <span style={{fontSize:'11px',fontWeight:700,color:m.color,flexShrink:0}}>{partCount} part</span>
                    </div>
                  </div>
                </div>
              );
            };

            return(
              <div>
                <div style={{display:'flex',gap:'12px',marginBottom:'20px',alignItems:'center'}}>
                  {([{val:'molding',label:'🏭 Molding',color:'#4338ca',bg:'rgba(67,56,202,0.12)',border:'rgba(67,56,202,0.3)'},{val:'nonmolding',label:'⚙️ Non Molding',color:'#0f766e',bg:'rgba(15,118,110,0.12)',border:'rgba(15,118,110,0.3)'}] as const).map(j=>(
                    <button key={j.val} onClick={()=>{setMesinTab(j.val);setSelectedMesinGroup(null);}} style={{padding:'10px 24px',borderRadius:'10px',fontWeight:700,fontSize:'13px',cursor:'pointer',border:`1px solid ${mesinTab===j.val?j.border:'#e6eaf0'}`,background:mesinTab===j.val?j.bg:'#f8f9fb',color:mesinTab===j.val?j.color:'#5b6b80',transition:'all 0.2s'}}>
                      {j.label} <span style={{background:'#f8f9fb',borderRadius:'20px',padding:'1px 8px',fontSize:'11px',marginLeft:'4px'}}>{j.val==='molding'?mesinMoldingData.length:mesinNonMoldingData.length}</span>
                    </button>
                  ))}
                  {selectedMesinGroup&&<button onClick={()=>setSelectedMesinGroup(null)} style={{background:'#f8f9fb',border:'1px solid #d9dee5',borderRadius:'8px',padding:'8px 14px',color:'#5b6b80',fontSize:'11px',fontWeight:600,cursor:'pointer',marginLeft:'auto'}}>← Kembali</button>}
                </div>

                {/* MOLDING - flat grid */}
                {mesinTab==='molding'&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
                    {mesinMoldingData.map((m,mi)=>renderMesinCard(m,mi))}
                  </div>
                )}

                {/* NON MOLDING - grouped */}
                {mesinTab==='nonmolding'&&!selectedMesinGroup&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px'}}>
                    {nmGroupList.map((grp:any,gi:number)=>{
                      const totalParts = grp.items.reduce((a:number,m:any)=>a+partsList.filter((p:any)=>p.mesin?.toLowerCase().includes(m.nama.toLowerCase().split(' ')[0].toLowerCase())).length,0);
                      const isGroup = grp.items.length > 1;
                      return(
                        <div key={grp.key} onClick={()=>isGroup?setSelectedMesinGroup(grp.key):null}
                          style={{...G.card,overflow:'hidden',cursor:isGroup?'pointer':'default',transition:'all 0.2s',animation:'cardPop 0.4s ease both',animationDelay:`${gi*40}ms`,border:`1px solid ${grp.color}22`}}
                          onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 12px 32px ${grp.color}25`;e.currentTarget.style.borderColor=`${grp.color}66`;}}
                          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=`${grp.color}22`;}}>
                          <div style={{height:'80px',background:`linear-gradient(135deg,${grp.color}22,${grp.color}08)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'36px',position:'relative'}}>
                            {grp.emoji}
                            {isGroup&&<div style={{position:'absolute',top:'5px',right:'5px',background:`${grp.color}30`,border:`1px solid ${grp.color}55`,borderRadius:'20px',padding:'1px 7px',fontSize:'9px',fontWeight:700,color:grp.color}}>{grp.items.length} unit ›</div>}
                            {!isGroup&&<div style={{position:'absolute',top:'5px',right:'5px',display:'flex',gap:'3px'}}>
                              <button onClick={e=>{e.stopPropagation();setEditMesin({...grp.items[0],_idx:grp.items[0]._idx,_jenis:'nonmolding'});}} style={{background:'rgba(11,94,215,0.2)',border:'1px solid rgba(11,94,215,0.3)',borderRadius:'5px',padding:'2px 5px',color:'#0b5ed7',fontSize:'8px',cursor:'pointer'}}>✏️</button>
                              <button onClick={async e=>{e.stopPropagation();const idx=grp.items[0]._idx;if(!await tanya(`Hapus ${grp.key}?`))return;setMesinNonMoldingData(p=>p.filter((_,i)=>i!==idx));showMsg('ok',`✅ ${grp.key} dihapus`);}} style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.25)',borderRadius:'5px',padding:'2px 5px',color:'#c62828',fontSize:'8px',cursor:'pointer'}}>🗑️</button>
                            </div>}
                          </div>
                          <div style={{padding:'10px'}}>
                            <div style={{fontSize:'12px',fontWeight:700,color:'#13294b',marginBottom:'3px'}}>{grp.key}</div>
                            <div style={{fontSize:'9px',color:'#5b6b80',marginBottom:'6px'}}>{isGroup?`${grp.items.length} unit mesin`:grp.items[0]?.keterangan}</div>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontSize:'8px',background:`${grp.color}15`,color:grp.color,padding:'2px 6px',borderRadius:'8px',fontWeight:600}}>👷 {grp.tl}</span>
                              <span style={{fontSize:'11px',fontWeight:700,color:grp.color}}>{totalParts} part</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* NON MOLDING - show sub-machines after group click */}
                {mesinTab==='nonmolding'&&selectedMesinGroup&&(()=>{
                 const grp = nmGroups[selectedMesinGroup!];  // non-null assertion
                  if(!grp) return null;
                  return(
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',padding:'12px 16px',background:`${grp.color}12`,borderRadius:'12px',border:`1px solid ${grp.color}30`}}>
                        <span style={{fontSize:'24px'}}>{grp.emoji}</span>
                        <div>
                          <div style={{fontSize:'14px',fontWeight:700,color:'#13294b'}}>{grp.key}</div>
                          <div style={{fontSize:'10px',color:'#5b6b80'}}>{grp.items.length} unit · pilih unit untuk edit atau hapus</div>
                        </div>
                        <button onClick={()=>{setFormMesin({nama:'',emoji:grp.emoji,color:grp.color,jenis:'nonmolding',tl:grp.tl,keterangan:''});setShowTambahMesin(true);}} style={{marginLeft:'auto',background:`${grp.color}20`,border:`1px solid ${grp.color}44`,borderRadius:'8px',padding:'6px 14px',color:grp.color,fontSize:'11px',fontWeight:700,cursor:'pointer'}}>+ Tambah Unit</button>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
                        {grp.items.map((m:any,mi:number)=>renderMesinCard(m,mi,true))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ── KELOLA PART (unified) ── */}
          {true&&(
            <div>
              {/* JENIS SELECTOR - Level 1 */}
              {partsJenis==='semua'&&!partsDrillMesin&&(
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'24px'}}>
                  {[{jenis:'molding' as const,label:'Molding',emoji:'🏭',color:'#4338ca',bg:'rgba(67,56,202,0.12)',border:'rgba(67,56,202,0.25)'},{jenis:'nonmolding' as const,label:'Non - Molding',emoji:'⚙️',color:'#0f766e',bg:'rgba(15,118,110,0.12)',border:'rgba(15,118,110,0.25)'}].map(opt=>(
                    <div key={opt.jenis} onClick={()=>setPartsJenis(opt.jenis)} style={{...G.card,padding:'28px',cursor:'pointer',border:`1px solid ${opt.border}`,background:`linear-gradient(135deg,${opt.bg},transparent)`,transition:'all 0.25s',minHeight:'180px',display:'flex',alignItems:'center'}}
                      onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 16px 48px ${opt.color}22`;e.currentTarget.style.borderColor=opt.color;}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=opt.border;}}>
                      <div style={{display:'flex',alignItems:'center',gap:'16px',width:'100%'}}>
                        <div style={{fontSize:'40px'}}>{opt.emoji}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:'20px',fontWeight:800,color:opt.color,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'4px'}}>{opt.label}</div>
                          <div style={{fontSize:'12px',color:'#5b6b80'}}>{partsList.filter(p=>{const nmMesinList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];const isNM=p.mesin&&nmMesinList.some(m=>p.mesin.toLowerCase().includes(m.toLowerCase()));return opt.jenis==='molding'?!isNM:!!isNM;}).length} part · {partsList.filter(p=>{const nmMesinList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];const isNM=p.mesin&&nmMesinList.some(m=>p.mesin.toLowerCase().includes(m.toLowerCase()));return opt.jenis==='molding'?!isNM:!!isNM;}).filter(p=>p.stok_saat_ini<=p.reorder_point).length} low stock</div>
                        </div>
                        <span style={{fontSize:'24px',color:opt.color,opacity:0.4}}>›</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Back button */}
              {(partsJenis!=='semua'||partsDrillMesin)&&(
                <div style={{display:'flex',gap:'8px',marginBottom:'16px',alignItems:'center'}}>
                  <button onClick={()=>{if(partsDrillMesin)setPartsDrillMesin(null);else setPartsJenis('semua');}} style={{background:'#f8f9fb',border:'1px solid #d9dee5',borderRadius:'8px',padding:'7px 14px',color:'#13294b',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
                  <input value={searchPart} onChange={e=>setSearchPart(e.target.value)} placeholder="🔍 Cari nama part, kode..." style={{...G.inp,maxWidth:'260px'}}/>
                </div>
              )}

              {/* Part form */}
              {showPartForm&&(
                <div style={{...G.card,padding:'20px',marginBottom:'20px',border:'1px solid rgba(11,94,215,0.18)',animation:'cardPop 0.3s cubic-bezier(0.2,0,0,1) both'}}>
                  {/* Tab Manual / Import */}
                  <div style={{display:'flex',gap:'4px',marginBottom:'18px',background:'#f8f9fb',borderRadius:'10px',padding:'3px',width:'fit-content'}}>
                    {([{val:'manual',label:'✍️ Input Manual'},{val:'import',label:'📂 Upload Excel'}] as const).map(t=>(
                      <button key={t.val} onClick={()=>setPartImportTab(t.val)} style={{padding:'7px 18px',borderRadius:'8px',fontWeight:700,fontSize:'11px',cursor:'pointer',border:'none',background:partImportTab===t.val?'#0b5ed7':'transparent',color:partImportTab===t.val?'#fff':'#5b6b80',transition:'all 0.2s'}}>{t.label}</button>
                    ))}
                    <button onClick={()=>{setShowPartForm(false);setPartImportFiles([]);}} style={{marginLeft:'8px',background:'none',border:'none',color:'#5b6b80',fontSize:'18px',cursor:'pointer',padding:'0 8px',lineHeight:1}}>✕</button>
                  </div>

                  {/* MANUAL INPUT */}
                  {partImportTab==='manual'&&(
                    <>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                        <div><label style={G.lbl}>Nama Spare Part *</label><input style={G.inp} value={formPart.nama_part} onChange={e=>setFormPart(f=>({...f,nama_part:e.target.value,nama:e.target.value}))} placeholder="Nozzle Tip Husky..."/></div>
                        <div><label style={G.lbl}>Kode / 12NC</label><input style={G.inp} value={formPart.kode_12nc} onChange={e=>setFormPart(f=>({...f,kode_12nc:e.target.value}))} placeholder="2895876"/></div>
                        <div><label style={G.lbl}>Kategori / Mesin *</label>
                          <input list="kp-kategori-list" style={{...G.inp,borderColor:formPart.kategori&&!kategoriList.includes(formPart.kategori)?'#c62828':undefined}} value={formPart.kategori} onChange={e=>{const v=e.target.value;const pas=kategoriList.find(k=>k.toLowerCase()===v.trim().toLowerCase());setFormPart(f=>({...f,kategori:pas||v}));}} placeholder="Ketik untuk mencari kategori"/>
                          <datalist id="kp-kategori-list">{kategoriList.map(k=><option key={k} value={k}/>)}</datalist></div>
                        <div><label style={G.lbl}>Mesin Spesifik</label>
                          <input list="kp-mesin-list" style={G.inp} value={formPart.mesin} onChange={e=>setFormPart(f=>({...f,mesin:e.target.value}))} placeholder="Ketik untuk mencari mesin"/>
                          <datalist id="kp-mesin-list">{Array.from(new Set([...allMesinList,...partsList.map((p:any)=>String(p.mesin||'').trim()).filter(Boolean)])).sort().map(m=><option key={m} value={m}/>)}</datalist></div>
                        <div><label style={G.lbl}>Nomor Bin *</label><input list="kp-bin-list" style={G.inp} value={formPart.nomor_bin} onChange={e=>{const v=e.target.value;setFormPart(f=>({...f,nomor_bin:v}));isiRakDariBin(v,setPartRak,partRak);}} placeholder="BIN A1.01"/>
                          <datalist id="kp-bin-list">{lokasiData.bins.map(b=><option key={b.nomor_bin} value={b.nomor_bin}/>)}</datalist></div>
                        <RakField idList="kp-rak-list" rakList={lokasiData.rak} binInfo={binInfoOf(formPart.nomor_bin)} nomorBin={formPart.nomor_bin} nilai={partRak} onUbah={setPartRak}/>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                          <div><label style={G.lbl}>Stok</label><input type="number" style={G.inp} value={formPart.stok_saat_ini} onChange={e=>setFormPart(f=>({...f,stok_saat_ini:e.target.value}))} placeholder="0"/></div>
                          <div><label style={G.lbl}>Min Stok</label><input type="number" style={G.inp} value={formPart.reorder_point} onChange={e=>setFormPart(f=>({...f,reorder_point:e.target.value}))} placeholder="0"/></div>
                        </div>
                        <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:'10px'}}>
                          <input type="checkbox" id="crit2" checked={formPart.is_critical} onChange={e=>setFormPart(f=>({...f,is_critical:e.target.checked}))} style={{width:'16px',height:'16px',cursor:'pointer',accentColor:'#c62828'}}/>
                          <label htmlFor="crit2" style={{fontSize:'12px',color:'#5b6b80',cursor:'pointer'}}>Part ini CRITICAL</label>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                        <button onClick={()=>setShowPartForm(false)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'8px 18px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
                        <button onClick={handleTambahPart} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'8px 18px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>✅ Simpan</button>
                      </div>
                    </>
                  )}

                  {/* IMPORT EXCEL */}
                  {partImportTab==='import'&&(
                    <>
                      <div style={{marginBottom:'12px',padding:'10px 14px',background:'rgba(67,56,202,0.08)',borderRadius:'8px',border:'1px solid rgba(67,56,202,0.2)'}}>
                        <div style={{fontSize:'11px',color:'rgba(67,56,202,0.8)',marginBottom:'4px',fontWeight:600}}>📋 Format kolom Excel/CSV yang didukung:</div>
                        <div style={{fontSize:'10px',color:'#5b6b80',fontFamily:'inherit'}}>Nama Part | Kode/12NC | Kategori | Nomor Bin | Stok | Min Stok | Mesin Spesifik</div>
                      </div>
                      <div onDragOver={e=>{e.preventDefault();setIsDragOverPart(true);}} onDragLeave={()=>setIsDragOverPart(false)} onDrop={e=>{e.preventDefault();setIsDragOverPart(false);handlePartImport(Array.from(e.dataTransfer.files));}} onClick={()=>partImportRef.current?.click()}
                        style={{border:`2px dashed ${isDragOverPart?'#4338ca':'rgba(67,56,202,0.3)'}`,borderRadius:'12px',padding:'28px 20px',textAlign:'center',cursor:'pointer',background:isDragOverPart?'rgba(67,56,202,0.08)':'rgba(67,56,202,0.03)',transition:'all 0.2s',marginBottom:'14px'}}>
                        <div style={{fontSize:'32px',marginBottom:'8px'}}>📂</div>
                        <div style={{fontSize:'13px',color:'#13294b',marginBottom:'4px'}}><span style={{color:'#4338ca',fontWeight:600}}>Klik untuk upload</span> atau drag & drop</div>
                        <div style={{fontSize:'10px',color:'#8a97a8'}}>Excel (.xlsx, .xls) atau CSV — kolom: Nama Part, Kode, Kategori, Bin, Stok, Min</div>
                        <input ref={partImportRef} type="file" multiple accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handlePartImport(Array.from(e.target.files||[]))}/>
                      </div>

                      {/* File list & preview */}
                      {partImportFiles.map((f:any,fi:number)=>(
                        <div key={f.id||fi} style={{background:'#f8f9fb',borderRadius:'10px',padding:'12px 16px',marginBottom:'10px',border:`1px solid ${f.status==='done'?'rgba(30,126,52,0.2)':f.status==='error'?'rgba(198,40,40,0.2)':'#e6eaf0'}`}}>
                          <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                            <span style={{fontSize:'20px'}}>{f.name.endsWith('.csv')?'📊':'📋'}</span>
                            <div style={{flex:1}}><div style={{fontSize:'12px',fontWeight:600,color:'#13294b'}}>{f.name}</div><div style={{fontSize:'10px',color:'#5b6b80'}}>{f.size}{f.rows?.length?` · ${f.rows.length} part ditemukan`:''}</div></div>
                            <span style={{fontSize:'11px',fontWeight:700,color:f.status==='done'?'#1e7e34':f.status==='error'?'#c62828':'#0b5ed7'}}>{f.status==='done'?'✓ Siap':f.status==='error'?'✕ Gagal':f.progress+'%'}</span>
                            <button onClick={()=>setPartImportFiles(p=>p.filter((_:any,i:number)=>i!==fi))} style={{background:'none',border:'none',color:'#5b6b80',cursor:'pointer',fontSize:'14px',padding:0}}>✕</button>
                          </div>
                          <div style={{height:'3px',background:'#f8f9fb',borderRadius:'4px',overflow:'hidden',marginBottom:'8px'}}><div style={{height:'100%',width:`${f.progress}%`,background:f.status==='done'?'#1e7e34':f.status==='error'?'#c62828':'#4338ca',borderRadius:'4px',transition:'width 0.3s'}}/></div>
                          {f.status==='done'&&f.rows&&f.rows.length>0&&(
                            <div style={{maxHeight:'120px',overflowY:'auto'}}>
                              {f.rows.slice(0,5).map((r: any, ri: number)=>(
                                <div key={ri} style={{display:'flex',gap:'8px',fontSize:'10px',color:'#5b6b80',marginBottom:'3px'}}>
                                  <span style={{color:'#4338ca',minWidth:'20px'}}>{ri+1}.</span>
                                  <span style={{flex:1,color:'#13294b'}}>{r.nama}</span>
                                  <span style={{color:'#5b6b80',fontFamily:'inherit'}}>{r.kode_12nc||'-'}</span>
                                  <span style={{color:'#1e7e34'}}>stok: {r.stok_saat_ini}</span>
                                </div>
                              ))}
                              {f.rows.length>5&&<div style={{fontSize:'10px',color:'#5b6b80'}}>+{f.rows.length-5} baris lainnya...</div>}
                            </div>
                          )}
                        </div>
                      ))}

                      <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                        <button onClick={()=>{setPartImportFiles([]);}} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'8px 16px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Reset</button>
                        <button disabled={!partImportFiles.some(f=>f.status==='done'&&f.rows?.length)} onClick={()=>{
                          const allRows=partImportFiles.filter(f=>f.status==='done'&&f.rows?.length).flatMap(f=>f.rows||[]);
                          if(!allRows.length)return;
                          const newParts=allRows.map((r:any,ri:number)=>({
                            ...r,
                            nama_part: r.nama_part||r.nama||'',
                            id:Date.now()+ri,
                            kode_12nc: r.kode_12nc && r.kode_12nc!==allRows[ri-1]?.kode_12nc ? r.kode_12nc : ('IMP-'+Date.now()+'-'+ri),
                            is_critical:false,foto_url:'',lokasi_simpan:'Spare Part Rack'
                          }));
                          setPartsList(p=>[...newParts,...p]);
                          newParts.forEach((np:any)=>{ try{fetch('/api/parts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(np)});}catch{} });
                          showMsg('ok',`✅ ${allRows.length} spare part berhasil diimport!`);
                          setPartImportFiles([]);setShowPartForm(false);
                        }} style={{background:partImportFiles.some(f=>f.status==='done'&&f.rows?.length)?'#1e7e34':'#f8f9fb',border:'none',borderRadius:'7px',padding:'8px 18px',color:partImportFiles.some(f=>f.status==='done'&&f.rows?.length)?'#fff':'#8a97a8',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:partImportFiles.some(f=>f.status==='done'&&f.rows?.length)?1:0.5}}>
                          📥 Import {partImportFiles.filter(f=>f.status==='done').reduce((a,f)=>a+(f.rows?.length||0),0)} Part
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Parts drill-down render */}
              {partsJenis!=='semua'&&(()=>{
                // Mesin per teknisi dari data Excel
                const nmByTeknisi = [
                  {teknisi:'ARDIAN KURNIAWAN', aksen:'#0b5ed7', emoji:'⚙️', mesin:[
                    {nama:'Batch Down',emoji:'🔧',color:'#0b5ed7',units:[]},
                    {nama:'Flowthrough',emoji:'🔧',color:'#0b5ed7',units:[]},
                    {nama:'External Siliting',emoji:'✂️',color:'#0f766e',
                     subMesin:[
                       {nama:'External Siliting 1',emoji:'✂️',color:'#0f766e',units:[]},
                       {nama:'External Siliting 2',emoji:'✂️',color:'#0f766e',units:[]},
                       {nama:'External Siliting 3',emoji:'✂️',color:'#0f766e',units:[]},
                       {nama:'External Siliting 4',emoji:'✂️',color:'#0f766e',units:[]},
                       {nama:'External Siliting 5',emoji:'✂️',color:'#0f766e',units:[]},
                     ]
                    },
                    {nama:'Semi Auto Assembly Soother',emoji:'🧸',color:'#c2410c',
                     subMesin:[
                       {nama:'Semi Auto Assembly Soother 1 (Lambert)',emoji:'🧸',color:'#c2410c',units:[]},
                       {nama:'Semi Auto Assembly Soother 2 (Fartech)',emoji:'🧸',color:'#c2410c',units:[]},
                       {nama:'Semi Auto Assembly Soother 3 (Fartech)',emoji:'🧸',color:'#c2410c',units:[]},
                       {nama:'Semi Auto Assembly Soother 4 (Fartech)',emoji:'🧸',color:'#c2410c',units:[]},
                       {nama:'Full Auto Assembly Soother 5 (Lambert)',emoji:'🧸',color:'#c2410c',units:[]},
                     ]
                    },
                  ]},
                  {teknisi:'EDI SUSILO', aksen:'#1e7e34', emoji:'🖨️', mesin:[
                    {nama:'CMYK',emoji:'🖨️',color:'#c2410c',
                     subMesin:[
                       {nama:'CMYK 1',emoji:'🖨️',color:'#c2410c',units:[]},
                       {nama:'CMYK 2',emoji:'🖨️',color:'#c2410c',units:[]},
                     ]
                    },
                    {nama:'GAIYA',emoji:'🤖',color:'#0e7490',
                     subMesin:[
                       {nama:'GAIYA MANUAL 1',emoji:'🤖',color:'#0e7490',units:[]},
                       {nama:'GAIYA MANUAL 2',emoji:'🤖',color:'#0e7490',units:[]},
                       {nama:'GAIYA AUTO',emoji:'🤖',color:'#0e7490',units:[]},
                     ]
                    },
                    {nama:'Semi Auto Assembly Soother 1 (Lambert)',emoji:'🧸',color:'#c2410c',units:[]},
                    {nama:'Semi Auto Assembly Soother 2 (Fartech)',emoji:'🧸',color:'#c2410c',units:[]},
                  ]},
                  {teknisi:'RIDWAN HUTASOIT', aksen:'#6d28d9', emoji:'🖱️', mesin:[
                    {nama:'TAMPON',emoji:'🖱️',color:'#6d28d9',
                     subMesin:[
                       {nama:'TAMPON 1',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 2',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 3',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 4',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 5',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 6',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 7',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 8',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 9',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 10',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 11',emoji:'🖱️',color:'#6d28d9',units:[]},
                       {nama:'TAMPON 12',emoji:'🖱️',color:'#6d28d9',units:[]},
                     ]
                    },
                    {nama:'PRINTER BARCODE',emoji:'📦',color:'#4d7c0f',units:[]},
                    {nama:'RECYCLE SOFLEN',emoji:'♻️',color:'#1e7e34',units:[]},
                  ]},
                  {teknisi:'WAHIDUL ARNAS', aksen:'#6d28d9', emoji:'🦾', sistem:'HAIRROBOTIC',
                   // Show as 1 HAIRROBOTIC system card
                   mesin:[{nama:'HAIRROBOTIC',emoji:'🦾',color:'#6d28d9',
                    subMesin:[
                      {nama:'MLP Robot',emoji:'🦾',color:'#6d28d9',units:['MLP Robot 1','MLP Robot 2','MLP Robot 3','MLP Robot 4','MLP Robot 5','MLP Robot 6','MLP Robot 7','MLP Robot 8']},
                      {nama:'Seer Carry AGV',emoji:'🚗',color:'#5b6b80',units:['Seer Carry AGV 1','Seer Carry AGV 2','Seer Carry AGV 3','Seer Carry AGV 4','Seer Carry AGV 5','Seer Carry AGV 6','Seer Carry AGV 7','Seer Carry AGV 8','Seer Carry AGV 9']},
                      {nama:'Conveyor',emoji:'📦',color:'#0b5ed7',units:['Conveyor 1','Conveyor 2','Conveyor 3']},
                      {nama:'Cable Car',emoji:'🚡',color:'#8a5a00',units:[]},
                      {nama:'Panel Conveyor Hairou',emoji:'🖥️',color:'#6d28d9',units:[]},
                    ]
                   }]},
                ];
                const mesinStruktur: Record<string,{jenis:'molding'|'nonmolding',emoji:string,color:string,subMesin:string[],kategori:string[]}> = {
                  'Soother B2':{jenis:'molding',emoji:'🧸',color:'#0b5ed7',subMesin:[],kategori:['Molding','Machine']},
                  'LSR':{jenis:'molding',emoji:'💧',color:'#1e7e34',subMesin:[],kategori:['Mold LSR','Machine']},
                  'Aoki':{jenis:'molding',emoji:'💨',color:'#8a5a00',subMesin:[],kategori:['AOKI','Machine']},
                  'Haitian 1K':{jenis:'molding',emoji:'🏭',color:'#6d28d9',subMesin:[],kategori:['Molding','Machine']},
                  'Haitian 2K':{jenis:'molding',emoji:'🏭',color:'#6d28d9',subMesin:[],kategori:['Molding','Machine']},
                  'Maintenance Mold':{jenis:'molding',emoji:'🔩',color:'#1e7e34',subMesin:[],kategori:['Mold','Machine']},
                  'Maintenance Machine':{jenis:'molding',emoji:'⚙️',color:'#8a5a00',subMesin:[],kategori:['Machine']},
                  'Feeder':{jenis:'molding',emoji:'📦',color:'#0b5ed7',subMesin:[],kategori:['Machine']},
                };
                const moldingMesinKeys=['Soother B2','LSR','Aoki','Haitian 1K','Haitian 2K','Maintenance Mold','Maintenance Machine','Feeder'];
                const nmMesinKeys:string[] = nmByTeknisi.flatMap(t=>t.mesin.map(m=>m.nama));
                const getPartsForMesin=(mk:string)=>{
                  const info=mesinStruktur[mk];
                  if(!info){
                    // Non-molding individual machine - match by name or group prefix
                    const cleanName=mk.toLowerCase().replace(/\s*\(.*\)$/,'').trim();
                    const baseName=cleanName.replace(/\s*\d+$/, '').trim(); // e.g. 'mlp robot 1' -> 'mlp robot'
                    return partsList.filter((p:any)=>{
                      if(!p.mesin) return false;
                      const pm=p.mesin.toLowerCase();
                      return pm.includes(cleanName) || pm===baseName || pm.includes(baseName);
                    });
                  }
                  return partsList.filter((p:any)=>info.kategori.some(k=>p.kategori===k)||(info.subMesin.length>0?info.subMesin.some(sm=>p.mesin&&p.mesin.toLowerCase().includes(sm.toLowerCase().split(' ')[0].toLowerCase())):(p.mesin&&p.mesin.toLowerCase().includes(mk.toLowerCase().split(' ')[0].toLowerCase()))));
                };
                const mesinKeys=partsJenis==='molding'?moldingMesinKeys:nmMesinKeys;
                const accentColor=partsJenis==='molding'?'#4338ca':'#0f766e';

                if(!partsDrillMesin) return(
                  partsJenis==='nonmolding'
                  // NON MOLDING: Group by teknisi
                  ?<div style={{display:'flex',flexDirection:'column',gap:'20px'}}>
                    {nmByTeknisi.map((grp,gi)=>(
                      <div key={grp.teknisi}>
                        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px',padding:'8px 14px',background:`${grp.aksen}10`,borderRadius:'8px',border:`1px solid ${grp.aksen}30`}}>
                          <span style={{fontSize:'16px'}}>{grp.emoji}</span>
                          <span style={{fontSize:'12px',fontWeight:700,color:grp.aksen}}>{grp.teknisi}</span>
                          <span style={{fontSize:'10px',color:'#5b6b80',marginLeft:'4px'}}>{grp.mesin.length} mesin</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'10px'}}>
                          {grp.mesin.map((m:any,mi:number)=>{
                            // Check if this machine has sub-machines (like HAIRROBOTIC)
                            const hasSubMesin = m.subMesin && m.subMesin.length > 0;
                            const allSubNames = hasSubMesin ? m.subMesin.map((s:any)=>s.nama) : [m.nama];
                            const mParts=partsList.filter((p:any)=>{
                              if(!p.mesin) return false;
                              const pm=p.mesin.toLowerCase();
                              return allSubNames.some((mn:string)=>{
                                const mnl=mn.toLowerCase();
                                const base=mnl.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/,'').trim();
                                return pm.includes(mnl)||pm===base||pm.includes(base);
                              });
                            });
                            const low=mParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                            if(hiddenMesin.includes(m.nama)) return null;
                            return(
                              <div key={m.nama} style={{...G.card,border:`1px solid ${m.color}33`,transition:'all 0.2s',textAlign:'center',animation:'cardPop 0.4s ease both',animationDelay:`${mi*30}ms`,position:'relative',overflow:'hidden'}}
                                onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 8px 24px ${m.color}25`;e.currentTarget.style.borderColor=m.color;}}
                                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=`${m.color}33`;}}>
                                {/* Action buttons */}
                                <div style={{position:'absolute',top:'5px',right:'5px',display:'flex',gap:'3px',zIndex:2}}>
                                  <button onClick={e=>{e.stopPropagation();mesinImgRef.current[m.nama]?.click();}} style={{background:'rgba(11,94,215,0.3)',border:'none',borderRadius:'4px',padding:'2px 5px',color:'#0b5ed7',fontSize:'9px',cursor:'pointer'}}>📷</button>
                                  <button onClick={e=>{e.stopPropagation();deleteMesin(m.nama);}} style={{background:'rgba(198,40,40,0.2)',border:'none',borderRadius:'4px',padding:'2px 5px',color:'#c62828',fontSize:'9px',cursor:'pointer'}}>🗑️</button>
                                </div>
                                <input type="file" accept="image/*" style={{display:'none'}} ref={el=>{mesinImgRef.current[m.nama]=el;}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const url=URL.createObjectURL(f);saveMesinImage(m.nama,url);}}/>
                                {/* Clickable area */}
                                <div onClick={()=>{if(hasSubMesin){setPartsDrillMesin(m.nama+':SISTEM');}else{setSubMesinDrill(null);setPartsDrillMesin(m.nama);}}} style={{cursor:'pointer',padding:'12px'}}>
                                  {/* Image or emoji */}
                                  <div style={{width:'60px',height:'60px',borderRadius:'10px',margin:'0 auto 8px',overflow:'hidden',background:`${m.color}15`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                    {mesinImages[m.nama]
                                      ?<img src={mesinImages[m.nama]} style={{width:'100%',height:'100%',objectFit:'cover'}} alt={m.nama}/>
                                      :<span style={{fontSize:'28px'}}>{m.emoji}</span>
                                    }
                                  </div>
                                  <div style={{fontSize:'10px',fontWeight:700,color:'#13294b',marginBottom:'4px',lineHeight:1.3}}>{m.nama}</div>
                                  {hasSubMesin&&<div style={{fontSize:'9px',color:m.color,marginBottom:'2px'}}>{m.subMesin.length} sub-mesin</div>}
                                  <div style={{fontSize:'10px',fontWeight:700,color:m.color}}>{mParts.length} part</div>
                                  {low>0&&<div style={{fontSize:'9px',color:'#c62828'}}>⚠ {low} low</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  // MOLDING: render from mesinMoldingData state (supports add/delete)
                  :<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
                    {mesinMoldingData.filter(m=>!hiddenMesin.includes(m.nama)).map((m,mi)=>{
                      const info=mesinStruktur[m.nama];
                      const mColor=m.color||info?.color||'#0b5ed7';
                      const mEmoji=m.emoji||info?.emoji||'⚙️';
                      const mParts=partsList.filter((p:any)=>{
                        const pm=(p.mesin||'').toLowerCase();
                        const mn=m.nama.toLowerCase();
                        return pm.includes(mn)||pm===mn||(info?.kategori?.some((k:string)=>p.kategori===k&&k!=='Machine'));
                      });
                      const low=mParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                      return(
                        <div key={m.nama} style={{...G.card,border:`1px solid ${mColor}33`,transition:'all 0.25s',animation:'cardPop 0.4s ease both',animationDelay:`${mi*50}ms`,position:'relative',overflow:'hidden'}}
                          onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 12px 40px ${mColor}25`;e.currentTarget.style.borderColor=mColor;}}
                          onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=`${mColor}33`;}}>
                          <div style={{position:'absolute',top:'6px',right:'6px',display:'flex',gap:'4px',zIndex:2}}>
                            <button onClick={e=>{e.stopPropagation();setEditMesin({...m,_idx:mesinMoldingData.indexOf(m),_jenis:'molding'});setShowTambahMesin(true);}} style={{background:'rgba(11,94,215,0.3)',border:'1px solid rgba(11,94,215,0.4)',borderRadius:'5px',padding:'2px 6px',color:'#0b5ed7',fontSize:'9px',cursor:'pointer',fontWeight:700}}>✏️</button>
                            <button onClick={e=>{e.stopPropagation();deleteMesin(m.nama);}} style={{background:'rgba(198,40,40,0.2)',border:'1px solid rgba(198,40,40,0.3)',borderRadius:'5px',padding:'2px 6px',color:'#c62828',fontSize:'9px',cursor:'pointer',fontWeight:700}}>🗑️</button>
                          </div>
                          <div onClick={()=>{setSubMesinDrill(null);setPartsDrillMesin(m.nama);}} style={{padding:'16px',cursor:'pointer',textAlign:'center'}}>
                            <div style={{width:'60px',height:'60px',borderRadius:'10px',margin:'0 auto 8px',background:`${mColor}15`,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                              {mesinImages[m.nama]?<img src={mesinImages[m.nama]} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:'32px'}}>{mEmoji}</span>}
                            </div>
                            <div style={{fontSize:'12px',fontWeight:700,color:'#13294b',marginBottom:'4px'}}>{m.nama}</div>
                            <div style={{fontSize:'11px',fontWeight:700,color:mColor}}>{mParts.length} part</div>
                            {low>0&&<div style={{fontSize:'10px',color:'#c62828',marginTop:'2px'}}>⚠ {low} low</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );

                // Handle GRUP drill-down (e.g. GRUP:HAIRROBOTIC:MLP Robot)
                if(partsDrillMesin.startsWith('GRUP:')){
                  const parts2=partsDrillMesin.split(':');
                  const sistemNamaG=parts2[1];
                  const grupNama=parts2[2];
                  // Find the grup
                  const sistemM=nmByTeknisi.flatMap((g:any)=>g.mesin).find((m:any)=>m.nama===sistemNamaG);
                  const grup=sistemM?.subMesin?.find((s:any)=>s.nama===grupNama);
                  const units:string[]=grup?.units||[];
                  return(
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',padding:'12px 16px',background:`${grup?.color||'#0b5ed7'}15`,borderRadius:'12px',border:`1px solid ${grup?.color||'#0b5ed7'}33`}}>
                        <span style={{fontSize:'24px'}}>{grup?.emoji||'⚙️'}</span>
                        <div>
                          <div style={{fontSize:'15px',fontWeight:700,color:'#13294b'}}>{grupNama}</div>
                          <div style={{fontSize:'10px',color:'#5b6b80'}}>{units.length} unit · klik untuk lihat part</div>
                        </div>
                        <button onClick={()=>setPartsDrillMesin(sistemNamaG+':SISTEM')} style={{marginLeft:'auto',background:'#f8f9fb',border:'1px solid #d9dee5',borderRadius:'8px',padding:'6px 14px',color:'#5b6b80',fontSize:'11px',cursor:'pointer'}}>← Kembali</button>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'10px'}}>
                        {units.map((unitNama:string,ui:number)=>{
                          const uParts=partsList.filter((p:any)=>{
                            if(!p.mesin) return false;
                            const pm=p.mesin.toLowerCase();
                            const mn=unitNama.toLowerCase();
                            const base=mn.replace(/\s*\d+$/, '').trim();
                            return pm.includes(mn)||pm===base||pm.includes(base);
                          });
                          const low=uParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                          return(
                            <div key={unitNama} onClick={()=>{setSubMesinDrill(null);setPartsDrillMesin(unitNama);}} style={{...G.card,padding:'12px',cursor:'pointer',border:`1px solid ${grup?.color||'#0b5ed7'}33`,transition:'all 0.2s',textAlign:'center'}}
                              onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=grup?.color||'#0b5ed7';}}
                              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=`${grup?.color||'#0b5ed7'}33`;}}>
                              <div style={{fontSize:'24px',marginBottom:'6px'}}>{grup?.emoji||'⚙️'}</div>
                              <div style={{fontSize:'10px',fontWeight:700,color:'#13294b',marginBottom:'4px'}}>{unitNama}</div>
                              <div style={{fontSize:'10px',fontWeight:700,color:grup?.color||'#0b5ed7'}}>{uParts.length} part</div>
                              {low>0&&<div style={{fontSize:'9px',color:'#c62828'}}>⚠ {low} low</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                // Handle SISTEM drill-down (e.g. HAIRROBOTIC:SISTEM)
                if(partsDrillMesin.endsWith(':SISTEM')){
                  const sistemNama=partsDrillMesin.replace(':SISTEM','');
                  // Find this sistem in nmByTeknisi
                  const sistemMesin=nmByTeknisi.flatMap((g:any)=>g.mesin).find((m:any)=>m.nama===sistemNama);
                  const subMesinList:any[]=sistemMesin?.subMesin||[];
                  return(
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px',padding:'12px 16px',background:'rgba(109,40,217,0.1)',borderRadius:'12px',border:'1px solid rgba(109,40,217,0.3)'}}>
                        <span style={{fontSize:'24px'}}>{sistemMesin?.emoji||'🦾'}</span>
                        <div>
                          <div style={{fontSize:'15px',fontWeight:700,color:'#13294b'}}>{sistemNama}</div>
                          <div style={{fontSize:'10px',color:'#5b6b80'}}>{subMesinList.length} sub-mesin · klik untuk lihat part</div>
                        </div>
                        <button onClick={()=>setPartsDrillMesin(null)} style={{marginLeft:'auto',background:'#f8f9fb',border:'1px solid #d9dee5',borderRadius:'8px',padding:'6px 14px',color:'#5b6b80',fontSize:'11px',cursor:'pointer'}}>← Kembali</button>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'10px'}}>
                        {subMesinList.map((sm:any,si:number)=>{
                          const isGroup = sm.units && sm.units.length > 0;
                          // Count parts: if group, count all units; if single, count by name
                          const allNames = isGroup ? sm.units : [sm.nama];
                          const smParts=partsList.filter((p:any)=>{
                            if(!p.mesin) return false;
                            const pm=p.mesin.toLowerCase();
                            return allNames.some((mn:string)=>{
                              const mnl=mn.toLowerCase();
                              const base=mnl.replace(/\s*\d+$/, '').replace(/\s*\(.*\)$/,'').trim();
                              return pm.includes(mnl)||pm===base||pm.includes(base);
                            });
                          });
                          const low=smParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                          if(hiddenMesin.includes(sm.nama)) return null;
                          return(
                            <div key={sm.nama} style={{...G.card,border:`1px solid ${sm.color}33`,transition:'all 0.2s',textAlign:'center',position:'relative',overflow:'hidden'}}
                              onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=sm.color;}}
                              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=`${sm.color}33`;}}>
                              <div style={{position:'absolute',top:'5px',right:'5px',display:'flex',gap:'3px',zIndex:2}}>
                                <button onClick={e=>{e.stopPropagation();mesinImgRef.current[sm.nama]?.click();}} style={{background:'rgba(11,94,215,0.3)',border:'none',borderRadius:'4px',padding:'2px 5px',color:'#0b5ed7',fontSize:'9px',cursor:'pointer'}}>📷</button>
                                <button onClick={e=>{e.stopPropagation();deleteMesin(sm.nama);}} style={{background:'rgba(198,40,40,0.2)',border:'none',borderRadius:'4px',padding:'2px 5px',color:'#c62828',fontSize:'9px',cursor:'pointer'}}>🗑️</button>
                              </div>
                              <input type="file" accept="image/*" style={{display:'none'}} ref={el=>{mesinImgRef.current[sm.nama]=el;}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;saveMesinImage(sm.nama,URL.createObjectURL(f));}}/>
                              <div onClick={()=>{if(isGroup)setPartsDrillMesin('GRUP:'+sistemNama+':'+sm.nama);else setPartsDrillMesin(sm.nama);}} style={{cursor:'pointer',padding:'12px'}}>
                                <div style={{width:'56px',height:'56px',borderRadius:'10px',margin:'0 auto 8px',overflow:'hidden',background:`${sm.color}15`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                                  {mesinImages[sm.nama]
                                    ?<img src={mesinImages[sm.nama]} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                    :<span style={{fontSize:'26px'}}>{sm.emoji}</span>
                                  }
                                </div>
                                <div style={{fontSize:'10px',fontWeight:700,color:'#13294b',marginBottom:'4px',lineHeight:1.3}}>{sm.nama}</div>
                                {isGroup&&<div style={{fontSize:'9px',color:sm.color,marginBottom:'2px'}}>{sm.units.length} unit ›</div>}
                                <div style={{fontSize:'10px',fontWeight:700,color:sm.color}}>{smParts.length} part</div>
                                {low>0&&<div style={{fontSize:'9px',color:'#c62828'}}>⚠ {low} low</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                const selInfo=mesinStruktur[partsDrillMesin]||{emoji:'⚙️',color:'#0b5ed7',subMesin:[] as string[],kategori:[] as string[],jenis:'nonmolding' as const};
                const mySubMesin = subMesinMap[partsDrillMesin]||[];
                // If has sub-mesin and no sub-mesin selected, show sub-mesin grid
                if(mySubMesin.length>0&&!subMesinDrill) return(
                  <div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <span style={{fontSize:'24px'}}>{selInfo?.emoji}</span>
                        <div><div style={{fontSize:'15px',fontWeight:700,color:'#13294b'}}>{partsDrillMesin}</div><div style={{fontSize:'10px',color:'#5b6b80'}}>{mySubMesin.length} sub mesin</div></div>
                      </div>
                      <button onClick={()=>{setSubMesinParent(partsDrillMesin);setFormSubMesin({nama:'',emoji:'⚙️',color:'#0b5ed7'});setShowTambahSubMesin(true);}} style={{background:'#0b5ed7',border:'none',borderRadius:'8px',padding:'7px 16px',color:'#fff',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>+ Sub Mesin</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
                      {mySubMesin.map((sm,si)=>{
                        const smParts=partsList.filter((p:any)=>p.mesin&&p.mesin.toLowerCase().includes((partsDrillMesin+'|'+sm.nama).toLowerCase().split('|')[1].toLowerCase())&&p.mesin.toLowerCase().includes(partsDrillMesin.toLowerCase()));
                        const low=smParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                        return(
                          <div key={sm.nama} style={{...G.card,padding:'16px',cursor:'pointer',border:`1px solid ${sm.color}33`,transition:'all 0.2s',textAlign:'center',position:'relative'}}
                            onClick={()=>setSubMesinDrill(sm.nama)}
                            onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.borderColor=sm.color;}}
                            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=`${sm.color}33`;}}>
                            <div style={{position:'absolute',top:'6px',right:'6px',display:'flex',gap:'3px'}}>
                              <button onClick={async e=>{e.stopPropagation();if(!await tanya(`Hapus ${sm.nama}?`))return;const updated={...subMesinMap,[partsDrillMesin]:mySubMesin.filter((_,i)=>i!==si)};saveSubMesinMap(updated);}} style={{background:'rgba(198,40,40,0.2)',border:'none',borderRadius:'4px',padding:'2px 5px',color:'#c62828',fontSize:'9px',cursor:'pointer'}}>🗑️</button>
                            </div>
                            <div style={{fontSize:'32px',marginBottom:'8px'}}>{sm.emoji}</div>
                            <div style={{fontSize:'11px',fontWeight:700,color:'#13294b',marginBottom:'4px'}}>{sm.nama}</div>
                            <div style={{fontSize:'11px',fontWeight:700,color:sm.color}}>{smParts.length} part</div>
                            {low>0&&<div style={{fontSize:'9px',color:'#c62828'}}>⚠ {low} low</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
                // If sub-mesin selected, show parts for that sub-mesin
                const activeMesinKey = subMesinDrill ? `${partsDrillMesin} > ${subMesinDrill}` : partsDrillMesin;
                const mesinParts=(subMesinDrill
                  ? partsList.filter((p:any)=>p.mesin&&p.mesin===activeMesinKey)
                  : getPartsForMesin(partsDrillMesin)
                ).filter((p:any)=>!searchPart||p.nama_part?.toLowerCase().includes(searchPart.toLowerCase())||p.kode_12nc?.toLowerCase().includes(searchPart.toLowerCase()));
                return(
                  <div>
                    {subMesinDrill&&(
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px',padding:'8px 14px',background:'#f8f9fb',borderRadius:'8px',border:'1px solid #e6eaf0'}}>
                        <button onClick={()=>setSubMesinDrill(null)} style={{background:'#f8f9fb',border:'1px solid #d9dee5',borderRadius:'6px',padding:'4px 10px',color:'#5b6b80',fontSize:'10px',cursor:'pointer'}}>← Kembali</button>
                        <span style={{fontSize:'12px',color:'#5b6b80'}}>{partsDrillMesin} › <strong style={{color:'#13294b'}}>{subMesinDrill}</strong></span>
                      </div>
                    )}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                        <span style={{fontSize:'24px'}}>{selInfo?.emoji}</span>
                        <div><div style={{fontSize:'15px',fontWeight:700,color:'#13294b'}}>{subMesinDrill||partsDrillMesin}</div><div style={{fontSize:'10px',color:'#5b6b80'}}>{mesinParts.length} spare part</div></div>
                      </div>
                      {!subMesinDrill
                        ?<button onClick={()=>{setSubMesinParent(partsDrillMesin);setFormSubMesin({nama:'',emoji:'⚙️',color:'#0b5ed7'});setShowTambahSubMesin(true);}} style={{background:'#0b5ed7',border:'none',borderRadius:'8px',padding:'7px 16px',color:'#fff',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>+ Sub Mesin</button>
                        :<button onClick={()=>{setShowPartForm(true);setEditPart(null);}} style={{background:'#1e7e34',border:'none',borderRadius:'8px',padding:'7px 16px',color:'#fff',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>+ Tambah Part</button>
                      }
                    </div>
                    {mesinParts.length===0
                      ?<div style={{...G.card,padding:'48px',textAlign:'center',border:`1px solid ${selInfo?.color}22`}}>
                        <div style={{fontSize:'32px',marginBottom:'10px'}}>{selInfo?.emoji}</div>
                        <div style={{fontSize:'13px',color:'#5b6b80',marginBottom:'14px'}}>Belum ada spare part untuk mesin ini</div>
                        <button onClick={()=>setShowPartForm(true)} style={{background:'#0b5ed7',border:'none',borderRadius:'8px',padding:'8px 18px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>➕ Tambah Part Pertama</button>
                      </div>
                      :<div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
                        {mesinParts.map((p:any,pi:number)=>{const c=KC[p.kategori]||selInfo?.color||'#0b5ed7';return(<div key={p.id} style={{animation:'cardPop 0.4s ease both',animationDelay:`${pi*40}ms`}}><PartCard p={p} c={c} onEdit={()=>setEditPart(p)} onHapus={()=>handleHapusPart(p.id,p.nama_part)} onImageUpload={handleImageUpload}/></div>);})}
                      </div>
                    }
                  </div>
                );
              })()}
            </div>
          )}

          {/* Modal Tambah Sub Mesin */}
          {showTambahSubMesin&&(
            <div style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.45)',backdropFilter:'none',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShowTambahSubMesin(false);}}>
              <div style={{...G.card,padding:'28px',width:'420px',boxShadow:'0 40px 100px rgba(19,41,75,0.14)',animation:'cardPop 0.3s ease both'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
                  <div style={{fontSize:'16px',fontWeight:700,color:'#13294b'}}>➕ Tambah Sub Mesin</div>
                  <div style={{fontSize:'11px',color:'#5b6b80'}}>{subMesinParent}</div>
                  <button onClick={()=>setShowTambahSubMesin(false)} style={{background:'none',border:'none',color:'#5b6b80',fontSize:'20px',cursor:'pointer'}}>✕</button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
                  <div><label style={G.lbl}>Nama Sub Mesin *</label>
                    <input style={G.inp} value={formSubMesin.nama} onChange={e=>setFormSubMesin(f=>({...f,nama:e.target.value}))} placeholder="Cylinder, Electrical, Pneumatic..."/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:'10px'}}>
                    <div><label style={G.lbl}>Emoji</label>
                      <input style={{...G.inp,textAlign:'center',fontSize:'20px'}} value={formSubMesin.emoji} onChange={e=>setFormSubMesin(f=>({...f,emoji:e.target.value}))}/>
                    </div>
                    <div><label style={G.lbl}>Warna</label>
                      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'6px'}}>
                        {['#0b5ed7','#1e7e34','#c62828','#8a5a00','#6d28d9','#c2410c','#6d28d9','#0f766e','#0b5ed7','#6d28d9'].map(c=>(
                          <div key={c} onClick={()=>setFormSubMesin(f=>({...f,color:c}))} style={{width:'22px',height:'22px',borderRadius:'50%',background:c,cursor:'pointer',border:formSubMesin.color===c?'3px solid #fff':'3px solid transparent'}}/>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{padding:'12px',background:`${formSubMesin.color}15`,borderRadius:'10px',border:`1px solid ${formSubMesin.color}30`,textAlign:'center'}}>
                    <span style={{fontSize:'28px'}}>{formSubMesin.emoji}</span>
                    <div style={{fontSize:'12px',fontWeight:700,color:formSubMesin.color,marginTop:'4px'}}>{formSubMesin.nama||'Preview Sub Mesin'}</div>
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                  <button onClick={()=>setShowTambahSubMesin(false)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'9px 20px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
                  <button onClick={()=>{
                    if(!formSubMesin.nama.trim())return showMsg('err','Nama wajib!');
                    const updated={...subMesinMap,[subMesinParent]:[...(subMesinMap[subMesinParent]||[]),{nama:formSubMesin.nama,emoji:formSubMesin.emoji,color:formSubMesin.color}]};
                    saveSubMesinMap(updated);
                    setShowTambahSubMesin(false);
                    showMsg('ok',`✅ Sub Mesin "${formSubMesin.nama}" ditambahkan ke ${subMesinParent}!`);
                  }} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'9px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>💾 Simpan</button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Part Modal */}
          {editPart&&(
            <div style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.45)',backdropFilter:'none',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{...G.card,padding:'24px',width:'540px',maxHeight:'80vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(19,41,75,0.14)',animation:'cardPop 0.3s ease both'}}>
                <div style={{fontSize:'16px',fontWeight:700,color:'#13294b',marginBottom:'18px'}}>✏️ Edit — {editPart.nama_part}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'16px'}}>
                  <div><label style={G.lbl}>Nama Part</label><input style={G.inp} value={editPart.nama_part||''} onChange={e=>setEditPart((p:any)=>({...p,nama_part:e.target.value}))}/></div>
                  <div><label style={G.lbl}>Kode / 12NC</label><input style={G.inp} value={editPart.kode_12nc||''} onChange={e=>setEditPart((p:any)=>({...p,kode_12nc:e.target.value}))}/></div>
                  <div><label style={G.lbl}>Kategori</label><select style={{...G.inp,cursor:'pointer'}} value={editPart.kategori||''} onChange={e=>setEditPart((p:any)=>({...p,kategori:e.target.value}))}>{kategoriList.map(k=><option key={k} value={k}>{k}</option>)}</select></div>
                  <div><label style={G.lbl}>Mesin Spesifik</label><input style={G.inp} value={editPart.mesin||''} onChange={e=>setEditPart((p:any)=>({...p,mesin:e.target.value}))}/></div>
                  <div><label style={G.lbl}>Nomor Bin</label><input style={G.inp} value={editPart.nomor_bin||''} onChange={e=>setEditPart((p:any)=>({...p,nomor_bin:e.target.value}))}/></div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                    <div><label style={G.lbl}>Stok</label><input type="number" style={G.inp} value={editPart.stok_saat_ini||0} onChange={e=>setEditPart((p:any)=>({...p,stok_saat_ini:e.target.value}))}/></div>
                    <div><label style={G.lbl}>Min Stok</label><input type="number" style={G.inp} value={editPart.reorder_point||0} onChange={e=>setEditPart((p:any)=>({...p,reorder_point:e.target.value}))}/></div>
                  </div>
                  <div style={{gridColumn:'1/-1',display:'flex',alignItems:'center',gap:'10px'}}>
                    <input type="checkbox" checked={editPart.is_critical||false} onChange={e=>setEditPart((p:any)=>({...p,is_critical:e.target.checked}))} style={{width:'16px',height:'16px',cursor:'pointer',accentColor:'#c62828'}}/>
                    <span style={{fontSize:'12px',color:'#5b6b80'}}>Part ini CRITICAL</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                  <button onClick={()=>setEditPart(null)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'8px 16px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
                  <button onClick={handleSaveEditPart} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'8px 16px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Simpan</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Tambah/Edit Mesin */}
          {(showTambahMesin||editMesin)&&(
            <div style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.45)',backdropFilter:'none',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget){setShowTambahMesin(false);setEditMesin(null);}}}>
              <div style={{...G.card,padding:'28px',width:'480px',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(19,41,75,0.14)',animation:'cardPop 0.3s ease both'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
                  <div style={{fontSize:'16px',fontWeight:700,color:'#13294b'}}>{editMesin?'✏️ Edit Mesin':'➕ Tambah Mesin Baru'}</div>
                  <button onClick={()=>{setShowTambahMesin(false);setEditMesin(null);}} style={{background:'none',border:'none',color:'#5b6b80',fontSize:'20px',cursor:'pointer'}}>✕</button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
                  <div style={{display:'flex',gap:'8px'}}>
                    {([{val:'molding',label:'🏭 Molding'},{val:'nonmolding',label:'⚙️ Non Molding'}] as const).map(j=>(
                      <button key={j.val} type="button" onClick={()=>{editMesin?setEditMesin((p:any)=>({...p,jenis:j.val})):setFormMesin(f=>({...f,jenis:j.val}));}} style={{flex:1,padding:'8px',borderRadius:'8px',border:`1px solid ${(editMesin?editMesin.jenis:formMesin.jenis)===j.val?(j.val==='molding'?'rgba(67,56,202,0.5)':'rgba(15,118,110,0.5)'):'#d9dee5'}`,background:(editMesin?editMesin.jenis:formMesin.jenis)===j.val?(j.val==='molding'?'rgba(67,56,202,0.15)':'rgba(15,118,110,0.15)'):'#f8f9fb',color:(editMesin?editMesin.jenis:formMesin.jenis)===j.val?(j.val==='molding'?'#4338ca':'#0f766e'):'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>{j.label}</button>
                    ))}
                  </div>
                  <div><label style={G.lbl}>Nama Mesin *</label><input style={G.inp} value={editMesin?editMesin.nama:formMesin.nama} onChange={e=>editMesin?setEditMesin((p:any)=>({...p,nama:e.target.value})):setFormMesin(f=>({...f,nama:e.target.value}))} placeholder="TAMPON 13, CMYK 3..."/></div>
                  <div style={{display:'grid',gridTemplateColumns:'80px 1fr',gap:'10px'}}>
                    <div><label style={G.lbl}>Emoji</label><input style={{...G.inp,textAlign:'center',fontSize:'20px'}} value={editMesin?editMesin.emoji:formMesin.emoji} onChange={e=>editMesin?setEditMesin((p:any)=>({...p,emoji:e.target.value})):setFormMesin(f=>({...f,emoji:e.target.value}))}/></div>
                    <div><label style={G.lbl}>Keterangan</label><input style={G.inp} value={editMesin?editMesin.keterangan:formMesin.keterangan} onChange={e=>editMesin?setEditMesin((p:any)=>({...p,keterangan:e.target.value})):setFormMesin(f=>({...f,keterangan:e.target.value}))} placeholder="Deskripsi singkat..."/></div>
                  </div>
                  <div><label style={G.lbl}>Leader Penanggung Jawab</label>
                    <select style={{...G.inp,cursor:'pointer'}} value={editMesin?editMesin.tl:formMesin.tl} onChange={e=>editMesin?setEditMesin((p:any)=>({...p,tl:e.target.value})):setFormMesin(f=>({...f,tl:e.target.value}))}>
                      <option value="">-- Pilih Leader --</option>
                      {(editMesin?editMesin.jenis:formMesin.jenis)==='molding'
                        ?moldingTLList.map((tl:any)=><option key={tl.nama} value={tl.nama}>{tl.nama}</option>)
                        :(nonMoldingTeknisi as any[]).map((t:any)=><option key={t.nama} value={t.nama}>{t.nama}</option>)}
                    </select>
                  </div>
                  <div><label style={G.lbl}>Warna</label>
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                      {['#0b5ed7','#1e7e34','#c62828','#8a5a00','#6d28d9','#c2410c','#6d28d9','#0f766e','#0b5ed7','#6d28d9','#1e7e34','#8a5a00'].map(c=>(
                        <div key={c} onClick={()=>editMesin?setEditMesin((p:any)=>({...p,color:c})):setFormMesin(f=>({...f,color:c}))} style={{width:'26px',height:'26px',borderRadius:'50%',background:c,cursor:'pointer',border:(editMesin?editMesin.color:formMesin.color)===c?'3px solid #fff':'3px solid transparent'}}/>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                  <button onClick={()=>{setShowTambahMesin(false);setEditMesin(null);}} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'9px 20px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
                  <button onClick={()=>{
                    const d=editMesin?{...editMesin}:{...formMesin};
                    if(!d.nama?.trim())return showMsg('err','Nama mesin wajib!');
                    const entry={nama:d.nama,emoji:d.emoji||'⚙️',color:d.color||'#0b5ed7',jenis:d.jenis,tl:d.tl,keterangan:d.keterangan};
                    if(editMesin){
                      const idx=editMesin._idx;
                      if(editMesin._jenis==='molding'){
                        setMesinMoldingData(p=>{const n=p.map((m,i)=>i===idx?entry:m);try{localStorage.setItem('mcc_mesinMolding',JSON.stringify(n));}catch{}return n;});
                      }else{
                        setMesinNonMoldingData(p=>{const n=p.map((m,i)=>i===idx?entry:m);try{localStorage.setItem('mcc_mesinNonMolding',JSON.stringify(n));}catch{}return n;});
                      }
                    }else{
                      if(d.jenis==='molding'){
                        setMesinMoldingData(p=>{const n=[...p,entry];try{localStorage.setItem('mcc_mesinMolding',JSON.stringify(n));}catch{}return n;});
                      }else{
                        setMesinNonMoldingData(p=>{const n=[...p,entry];try{localStorage.setItem('mcc_mesinNonMolding',JSON.stringify(n));}catch{}return n;});
                      }
                    }
                    showMsg('ok',`✅ ${d.nama} ${editMesin?'diupdate':'ditambahkan'}!`);
                    setShowTambahMesin(false);setEditMesin(null);
                  }} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'9px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>💾 Simpan</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activePage==='users'&&loginRole==='admin'&&(
        <div style={{padding:'24px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
            <div><div style={{fontSize:'9px',fontWeight:700,color:'#0b5ed7',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'4px'}}>Akses & RFID</div><div style={{fontSize:'26px',fontWeight:800,color:'#13294b'}}>👥 Kelola <span style={{color:'#0b5ed7'}}>Pengguna</span></div></div>
            <div style={{display:'flex',gap:'8px'}}>
            <button type="button" className="mcc-btn-secondary" onClick={()=>setShowRole(s=>!s)}>Kelola role</button>
            <button type="button" className="mcc-btn-secondary" onClick={()=>{setForm(f=>({...f,role:'admin'}));setShowForm(true);setEditUser(null);}}>+ Tambah Admin</button>
            <button onClick={()=>{setForm(f=>({...f,role:f.role==='admin'?'teknisi':f.role}));setShowForm(true);setEditUser(null);}} style={{background:'#0b5ed7',border:'none',borderRadius:'8px',padding:'10px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>+ Tambah Pengguna</button>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
            {[{num:users.filter((u:any)=>u.is_active).length,label:'Total Aktif',color:'#0b5ed7',icon:'👥'},{num:users.filter((u:any)=>u.role==='admin'&&u.is_active).length,label:'Admin aktif',color:'#1e7e34',icon:'🛡️'},{num:users.filter((u:any)=>u.role==='TL').length,label:'Team Leader',color:'#6d28d9',icon:'👑'},{num:users.filter((u:any)=>!u.rfid_tag&&u.role!=='admin').length,label:'Belum RFID',color:'#c62828',icon:'📛'}].map((s,i)=>(
              <div key={i}><StatCard num={s.num} label={s.label} color={s.color} icon={s.icon}/></div>
            ))}
          </div>
          {showRole&&<KelolaRole roles={roleList} error={roleErr} onBerubah={muatRole} onTutup={()=>setShowRole(false)}/>}
          {showForm&&(
            <div style={{...G.card,padding:'20px',marginBottom:'20px',border:'1px solid rgba(11,94,215,0.18)',animation:'cardPop 0.3s cubic-bezier(0.2,0,0,1) both'}}>
              <div style={{fontSize:'15px',fontWeight:700,color:'#13294b',marginBottom:'16px'}}>➕ {form.role==='admin'?'Tambah Admin':'Tambah Pengguna'}</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div><label style={G.lbl}>Nama *</label><input style={G.inp} value={form.nama} onChange={e=>setForm(f=>({...f,nama:e.target.value}))} placeholder="Nama lengkap..."/></div>
                <div><label style={G.lbl}>Employee ID *</label><input style={G.inp} value={form.employee_id} onChange={e=>setForm(f=>({...f,employee_id:e.target.value}))} placeholder="EMP-005"/></div>
                <div><label style={G.lbl}>Role</label><select style={{...G.inp,cursor:'pointer'}} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>{opsiRole(form.role)}</select></div>
                <div/>
                <div style={{gridColumn:'1/-1'}}><label style={G.lbl}>Bagian / Mesin (★ utama, ✓ tambahan)</label><PilihBagianMesin jenis={mesinJenisList} bagian={(form as any).bagian||''} nilai={(form as any).mesin_tambahan_ids||[]} onUbah={(bg,ids)=>setForm(f=>({...f,bagian:bg,mesin_tambahan_ids:ids} as any))}/></div>
                <div><label style={G.lbl}>Nomor Mesin</label><input style={G.inp} value={(form as any).nomor_mesin||''} onChange={e=>setForm(f=>({...f,nomor_mesin:e.target.value}))} placeholder="Tampon #3..."/></div>
                <div><label style={G.lbl}>Gender</label><select style={{...G.inp,cursor:'pointer'}} value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}><option value="male">👨 Laki-laki</option><option value="female">👩 Perempuan</option></select></div>
                {form.role==='admin'&&<div style={{gridColumn:'1/-1'}}><label style={G.lbl}>Password login Admin *</label><input type="text" autoComplete="new-password" style={G.inp} value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Password untuk masuk ke halaman Admin"/><div style={{fontSize:'12px',color:'var(--mcc-text-muted)',marginTop:'4px'}}>Bagian / Mesin boleh diisi mesin mana saja.</div></div>}
                <div style={{gridColumn:'1/-1'}}><label style={G.lbl}>RFID Badge</label><div style={{display:'flex',gap:'8px'}}><input style={{...G.inp,fontFamily:'inherit'}} value={form.rfid_tag} onChange={e=>setForm(f=>({...f,rfid_tag:e.target.value}))} placeholder="Scan badge..."/><button onClick={()=>setScanMode(true)} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.25)',borderRadius:'7px',padding:'8px 14px',color:'#0b5ed7',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>📛 Scan</button></div></div>
              </div>
              <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                <button onClick={()=>setShowForm(false)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'8px 18px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
                <button onClick={handleTambahUser} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'8px 18px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>✅ Simpan</button>
              </div>
            </div>
          )}
          <UserPerMesin users={users} jenis={mesinJenisList} onEdit={handleSetEditUser} onHapus={handleHapusUser} roleColor={roleColor}/>
        </div>
      )}

      {activePage==='catalog'&&!katalogLama&&<KatalogMaster partsList={partsList} riwayatMasuk={historyPartIn} onTampilanLama={()=>setKatalogLama(true)}/>}
      {activePage==='catalog'&&katalogLama&&(
        <div style={{padding:'24px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
            <div>
              <button type="button" className="mcc-link-btn" style={{marginBottom:'6px'}} onClick={()=>setKatalogLama(false)}>← Kembali ke Katalog baru</button>
              <div style={{fontSize:'9px',fontWeight:700,color:'#0b5ed7',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'4px'}}>Master Catalog</div>
              <div style={{fontSize:'26px',fontWeight:800,color:'#13294b'}}>📦 Spare Parts <span style={{color:'#0b5ed7'}}>Catalog</span></div>
              {/* Breadcrumb */}
              <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'5px',fontSize:'11px'}}>
                <span onClick={()=>{setCatalogJenis('semua');setCatalogDrillMesin(null);}} style={{cursor:'pointer',color:catalogJenis==='semua'?'#0b5ed7':'#5b6b80',fontWeight:catalogJenis==='semua'?700:400}}>Semua</span>
                {catalogJenis!=='semua'&&<><span style={{color:'#8a97a8'}}>›</span><span onClick={()=>setCatalogDrillMesin(null)} style={{cursor:'pointer',color:!catalogDrillMesin?'#0b5ed7':'#5b6b80',fontWeight:!catalogDrillMesin?700:400}}>{catalogJenis==='molding'?'🏭 Molding':'⚙️ Non Molding'}</span></>}
                {catalogDrillMesin&&<><span style={{color:'#8a97a8'}}>›</span><span style={{color:'#0b5ed7',fontWeight:700}}>{catalogDrillMesin}</span></>}
              </div>
            </div>
            {(catalogJenis!=='semua'||catalogDrillMesin)&&(
              <button onClick={()=>{catalogDrillMesin?setCatalogDrillMesin(null):setCatalogJenis('semua');}} style={{background:'#f8f9fb',border:'1px solid #d9dee5',borderRadius:'8px',padding:'8px 16px',color:'#13294b',fontSize:'12px',fontWeight:600,cursor:'pointer'}}>← Kembali</button>
            )}
          </div>

          {(()=>{
            const mesinStruktur2: Record<string,{jenis:'molding'|'nonmolding',emoji:string,color:string,subMesin:string[],kategori:string[]}> = {
              'Soother B2':{jenis:'molding',emoji:'🧸',color:'#0b5ed7',subMesin:[],kategori:['Molding','Machine']},
              'LSR':{jenis:'molding',emoji:'💧',color:'#1e7e34',subMesin:[],kategori:['Mold LSR','Machine']},
              'Aoki':{jenis:'molding',emoji:'💨',color:'#8a5a00',subMesin:[],kategori:['AOKI','Machine']},
              'Haitian 1K':{jenis:'molding',emoji:'🏭',color:'#6d28d9',subMesin:[],kategori:['Molding','Machine']},
              'Haitian 2K':{jenis:'molding',emoji:'🏭',color:'#6d28d9',subMesin:[],kategori:['Molding','Machine']},
              'Maintenance Mold':{jenis:'molding',emoji:'🔩',color:'#1e7e34',subMesin:[],kategori:['Mold','Machine']},
              'Maintenance Machine':{jenis:'molding',emoji:'⚙️',color:'#8a5a00',subMesin:[],kategori:['Machine']},
              'Feeder':{jenis:'molding',emoji:'📦',color:'#0b5ed7',subMesin:[],kategori:['Machine']},
              'CMYK':{jenis:'nonmolding',emoji:'🖨️',color:'#c2410c',subMesin:['CMYK 1','CMYK 2'],kategori:['Barcode','Machine']},
              'GAIYA':{jenis:'nonmolding',emoji:'🤖',color:'#0e7490',subMesin:['GAIYA MANUAL 1','GAIYA MANUAL 2','GAIYA AUTO'],kategori:['Gaia Auto','Machine']},
              'HAIRROBOTIC':{jenis:'nonmolding',emoji:'🦾',color:'#6d28d9',subMesin:[],kategori:['Fartech','Machine']},
              'MOTOR CABLE':{jenis:'nonmolding',emoji:'🔌',color:'#4d7c0f',subMesin:[],kategori:['Machine']},
              'AGV SEER':{jenis:'nonmolding',emoji:'🚗',color:'#5b6b80',subMesin:[],kategori:['Machine']},
              'Assembly Soother':{jenis:'nonmolding',emoji:'🧸',color:'#c2410c',subMesin:['Semi Auto Assembly Soother 1 (Lambert)','Semi Auto Assembly Soother 2 (Fartech)','Semi Auto Assembly Soother 3 (Fartech)','Semi Auto Assembly Soother 4 (Fartech)','Full Auto Assembly Soother (Lambert)'],kategori:['Lambert','Fartech']},
              'Slitting':{jenis:'nonmolding',emoji:'✂️',color:'#0f766e',subMesin:['External Siliting 1','External Siliting 2','External Siliting 3','External Siliting 4','External Siliting 5'],kategori:['Slitting']},
              'TAMPON':{jenis:'nonmolding',emoji:'🖱️',color:'#6d28d9',subMesin:['TAMPON 1','TAMPON 2','TAMPON 3','TAMPON 4','TAMPON 5','TAMPON 6','TAMPON 7','TAMPON 8','TAMPON 9','TAMPON 10','TAMPON 11','TAMPON 12'],kategori:['Tampon Printing']},
              'Batch/Flow':{jenis:'nonmolding',emoji:'🔧',color:'#0b5ed7',subMesin:['Batch Down','Flowthrough'],kategori:['Machine']},
              'MLP Robot':{jenis:'nonmolding',emoji:'🦾',color:'#6d28d9',subMesin:['MLP Robot 1','MLP Robot 2','MLP Robot 3','MLP Robot 4','MLP Robot 5','MLP Robot 6','MLP Robot 7','MLP Robot 8'],kategori:['Machine']},
              'Seer Carry AGV':{jenis:'nonmolding',emoji:'🚗',color:'#5b6b80',subMesin:['Seer Carry AGV 1','Seer Carry AGV 2','Seer Carry AGV 3','Seer Carry AGV 4','Seer Carry AGV 5','Seer Carry AGV 6','Seer Carry AGV 7','Seer Carry AGV 8','Seer Carry AGV 9'],kategori:['Machine']},
              'Conveyor':{jenis:'nonmolding',emoji:'📦',color:'#0b5ed7',subMesin:['Conveyor 1','Conveyor 2','Conveyor 3'],kategori:['Machine']},
              'Cable Car':{jenis:'nonmolding',emoji:'🚡',color:'#8a5a00',subMesin:[],kategori:['Machine']},
              'Panel Conveyor Hairou':{jenis:'nonmolding',emoji:'🖥️',color:'#6d28d9',subMesin:[],kategori:['Machine']},
            };
            const catMoldingList = Object.keys(mesinStruktur2).filter(k=>mesinStruktur2[k].jenis==='molding');
            const catNmList = Object.keys(mesinStruktur2).filter(k=>mesinStruktur2[k].jenis==='nonmolding');
            const getPartsForMesin2 = (mk:string) => {
              const info=mesinStruktur2[mk]; if(!info) return [];
              // Match by mesin field first (most accurate)
              // For machines with subMesin, check if part's mesin matches any subMesin
              // For machines without subMesin, check if mesin matches the machine group
              const baseMk = mk.toLowerCase();
              return partsList.filter((p:any)=>{
                if(!p.mesin && !p.kategori) return false;
                const pm = (p.mesin||'').toLowerCase();
                // Check subMesin match
                if(info.subMesin.length>0){
                  const matchesSub = info.subMesin.some(sm=>{
                    const smBase = sm.toLowerCase().replace(/\s*\d+$/,'').replace(/\s*\(.*\)$/,'').trim();
                    return pm===sm.toLowerCase() || pm.includes(smBase) || pm===smBase;
                  });
                  if(matchesSub) return true;
                }
                // Check direct mesin match
                const mkBase = baseMk.replace(/\s*\d+$/,'').trim();
                if(pm && (pm===baseMk || pm.includes(baseMk) || pm===mkBase || pm.includes(mkBase))) return true;
                // Fallback to kategori ONLY for molding machines (not Machine category)
                if(info.jenis==='molding' && p.kategori && info.kategori.some(k=>p.kategori===k && k!=='Machine')) return true;
                return false;
              });
            };

            const renderTable = (parts:any[]) => (
              <div style={{...G.card,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:'1px solid #e6eaf0',display:'flex',gap:'8px',alignItems:'center'}}>
                  <input placeholder="🔍 Cari nama part atau kode..." style={{...G.inp,maxWidth:'260px'}} onChange={e=>{const v=e.target.value;document.querySelectorAll('[data-catrow]').forEach((el:any)=>{el.style.display=el.dataset.name?.toLowerCase().includes(v.toLowerCase())||el.dataset.kode?.toLowerCase().includes(v.toLowerCase())?'':'none';});}}/>
                  <span style={{fontSize:'11px',color:'#5b6b80',marginLeft:'auto'}}>{parts.length} part</span>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#f8f9fb',borderBottom:'1px solid #e6eaf0'}}>
                    {['Nama Part','Kode/12NC','Kategori','Mesin','Bin','Stok','Min','Status'].map(h=><th key={h} style={{fontSize:'9px',fontWeight:700,color:'#8a97a8',textTransform:'uppercase',letterSpacing:'0.8px',padding:'10px 14px',textAlign:'left'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {parts.map((p:any,i:number)=>{const isLow=p.stok_saat_ini<=p.reorder_point;const c=KC[p.kategori]||'#0b5ed7';return(
                      <tr key={p.id} data-catrow data-name={p.nama_part} data-kode={p.kode_12nc} onMouseEnter={e=>(e.currentTarget.style.background='#f8f9fb')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')} style={{borderBottom:'1px solid #e6eaf0',transition:'background 0.15s'}}>
                        <td style={{padding:'10px 14px'}}><div style={{display:'flex',alignItems:'center',gap:'6px'}}>{p.is_critical&&<span style={{background:'rgba(198,40,40,0.12)',color:'#c62828',fontSize:'8px',fontWeight:700,padding:'1px 5px',borderRadius:'6px'}}>🔴</span>}<span style={{fontSize:'11px',fontWeight:600,color:'#13294b'}}>{p.nama_part}</span></div></td>
                        <td style={{padding:'10px 14px',fontSize:'10px',color:'#5b6b80',fontFamily:'inherit'}}>{p.kode_12nc||'-'}</td>
                        <td style={{padding:'10px 14px'}}><KatBadge critical={!!p.is_critical}/></td>
                        <td style={{padding:'10px 14px',fontSize:'10px',color:'#5b6b80'}}>{p.mesin||'-'}</td>
                        <td style={{padding:'10px 14px'}}>
                        <div style={{fontSize:'10px',fontFamily:'inherit',color:p.nomor_bin?.startsWith('WH-')?'#6d28d9':'#5b6b80',fontWeight:p.nomor_bin?.startsWith('WH-')?700:400}}>{p.nomor_bin}</div>
                        <div style={{fontSize:'8px',color:'#8a97a8',marginTop:'1px'}}>{p.nomor_bin?.startsWith('WH-')?'📦 Box Wahid':'🏪 Store MCC'}</div>
                      </td>
                        <td style={{padding:'10px 14px',fontSize:'13px',fontWeight:700,color:isLow?'#8a5a00':'#0b5ed7'}}>{p.stok_saat_ini}</td>
                        <td style={{padding:'10px 14px',fontSize:'11px',color:'#5b6b80'}}>{p.reorder_point}</td>
                        <td style={{padding:'10px 14px'}}><span style={{background:isLow?'rgba(154,103,0,0.12)':'rgba(30,126,52,0.12)',color:isLow?'#8a5a00':'#1e7e34',fontSize:'9px',fontWeight:700,padding:'2px 7px',borderRadius:'8px'}}>{isLow?'⚠️ Low':'✅ OK'}</span></td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            );

            // LEVEL 1 - Pilih Jenis
            if(catalogJenis==='semua') return(
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
                {[{jenis:'molding' as const,label:'Molding',emoji:'🏭',color:'#4338ca',bg:'rgba(67,56,202,0.12)',border:'rgba(67,56,202,0.25)',count:partsList.filter(p=>{const nmList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];return!(p.mesin&&nmList.some(m=>p.mesin.toLowerCase().includes(m.toLowerCase())));}).length},{jenis:'nonmolding' as const,label:'Non - Molding',emoji:'⚙️',color:'#0f766e',bg:'rgba(15,118,110,0.12)',border:'rgba(15,118,110,0.25)',count:partsList.filter(p=>{const nmList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];return !!(p.mesin&&nmList.some(m=>p.mesin.toLowerCase().includes(m.toLowerCase())));}).length}].map(opt=>(
                  <div key={opt.jenis} onClick={()=>setCatalogJenis(opt.jenis)} style={{...G.card,padding:'40px 36px',cursor:'pointer',border:`1px solid ${opt.border}`,background:`linear-gradient(135deg,${opt.bg},transparent)`,transition:'all 0.25s',minHeight:'220px',display:'flex',alignItems:'center'}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 20px 60px ${opt.color}30`;e.currentTarget.style.borderColor=opt.color;}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=opt.border;}}>
                    <div style={{display:'flex',alignItems:'center',gap:'24px',width:'100%'}}>
                      <div style={{width:'80px',height:'80px',borderRadius:'20px',background:`${opt.color}22`,border:`2px solid ${opt.color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'44px',flexShrink:0}}>{opt.emoji}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:'24px',fontWeight:800,color:opt.color,textTransform:'uppercase',letterSpacing:'2px',marginBottom:'8px'}}>{opt.label}</div>
                        <div style={{fontSize:'14px',color:'#5b6b80',marginBottom:'6px'}}>{opt.count} spare part terdaftar</div>
                        <div style={{display:'flex',gap:'12px',marginTop:'12px'}}>
                          <div style={{background:`${opt.color}15`,border:`1px solid ${opt.color}30`,borderRadius:'8px',padding:'6px 14px'}}>
                            <div style={{fontSize:'18px',fontWeight:700,color:opt.color}}>{opt.count}</div>
                            <div style={{fontSize:'9px',color:'#5b6b80',textTransform:'uppercase',letterSpacing:'0.5px'}}>Total Part</div>
                          </div>
                          <div style={{background:'rgba(198,40,40,0.1)',border:'1px solid rgba(198,40,40,0.2)',borderRadius:'8px',padding:'6px 14px'}}>
                            <div style={{fontSize:'18px',fontWeight:700,color:'#c62828'}}>{partsList.filter(p=>{const nmList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];const isNM=p.mesin&&nmList.some(m=>p.mesin.toLowerCase().includes(m.toLowerCase()));return opt.jenis==='molding'?!isNM:!!isNM;}).filter(p=>p.stok_saat_ini<=p.reorder_point).length}</div>
                            <div style={{fontSize:'9px',color:'#5b6b80',textTransform:'uppercase',letterSpacing:'0.5px'}}>Low Stock</div>
                          </div>
                          <div style={{background:'rgba(30,126,52,0.1)',border:'1px solid rgba(30,126,52,0.2)',borderRadius:'8px',padding:'6px 14px'}}>
                            <div style={{fontSize:'18px',fontWeight:700,color:'#1e7e34'}}>{partsList.filter(p=>{const nmList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];const isNM=p.mesin&&nmList.some(m=>p.mesin.toLowerCase().includes(m.toLowerCase()));return opt.jenis==='molding'?!isNM:!!isNM;}).filter(p=>p.stok_saat_ini>p.reorder_point).length}</div>
                            <div style={{fontSize:'9px',color:'#5b6b80',textTransform:'uppercase',letterSpacing:'0.5px'}}>Stok Aman</div>
                          </div>
                        </div>
                      </div>
                      <span style={{fontSize:'32px',color:opt.color,opacity:0.4,flexShrink:0}}>›</span>
                    </div>
                  </div>
                ))}
              </div>
            );

            // LEVEL 2 - Pilih Mesin
            // For non-molding: use mesinNonMoldingData (same as Kelola Mesin) grouped by prefix
            const getGroupKeyC = (nama:string) => {
              if(nama.startsWith('TAMPON')) return 'TAMPON';
              if(nama.startsWith('CMYK')) return 'CMYK';
              if(nama.startsWith('GAIYA')) return 'GAIYA';
              if(nama.startsWith('External Siliting')) return 'External Siliting';
              if(nama.startsWith('Semi Auto Assembly')) return 'Semi Auto Assembly Soother';
              if(nama.startsWith('Full Auto Assembly')) return 'Full Auto Assembly Soother';
              if(nama.startsWith('MLP Robot')) return 'MLP Robot';
              if(nama.startsWith('Seer Carry AGV')) return 'Seer Carry AGV';
              if(nama.startsWith('Conveyor')) return 'Conveyor';
              return nama;
            };
            const nmGroupsC = mesinNonMoldingData.reduce((acc:any, m) => {
              const key = getGroupKeyC(m.nama);
              if(!acc[key]) acc[key] = {key, emoji:m.emoji, color:m.color, tl:m.tl, items:[], jenis:'nonmolding'};
              acc[key].items.push(m);
              return acc;
            }, {} as any);
            const catMoldingList2 = Object.keys(mesinStruktur2).filter(k=>mesinStruktur2[k].jenis==='molding');
            
            if(!catalogDrillMesin) return(
              <div>
                <div style={{fontSize:'12px',fontWeight:700,color:'#5b6b80',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'14px'}}>
                  Pilih Mesin — {catalogJenis==='molding'?'🏭 Molding':'⚙️ Non Molding'}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px'}}>
                  {catalogJenis==='molding'
                    ? catMoldingList2.map((m,mi)=>{
                        const info=mesinStruktur2[m];
                        const mParts=getPartsForMesin2(m);
                        const low=mParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                        return(
                          <div key={m} onClick={()=>setCatalogDrillMesin(m)} style={{...G.card,padding:'18px',cursor:'pointer',border:`1px solid ${info.color}33`,transition:'all 0.25s',animation:'cardPop 0.4s ease both',animationDelay:`${mi*40}ms`,textAlign:'center'}}
                            onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 12px 40px ${info.color}25`;e.currentTarget.style.borderColor=info.color;}}
                            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=`${info.color}33`;}}>
                            <div style={{fontSize:'36px',marginBottom:'8px'}}>{info.emoji}</div>
                            <div style={{fontSize:'12px',fontWeight:700,color:'#13294b',marginBottom:'4px'}}>{m}</div>
                            <div style={{fontSize:'11px',fontWeight:700,color:info.color}}>{mParts.length} part</div>
                            {low>0&&<div style={{fontSize:'10px',color:'#c62828',marginTop:'2px'}}>⚠ {low} low stock</div>}
                          </div>
                        );
                      })
                    : Object.values(nmGroupsC).map((grp:any,gi:number)=>{
                        const mParts=getPartsForMesin2(grp.key);
                        const low=mParts.filter((p:any)=>p.stok_saat_ini<=p.reorder_point).length;
                        const isGroup=grp.items.length>1;
                        return(
                          <div key={grp.key} onClick={()=>setCatalogDrillMesin(grp.key)} style={{...G.card,padding:'18px',cursor:'pointer',border:`1px solid ${grp.color}33`,transition:'all 0.25s',animation:'cardPop 0.4s ease both',animationDelay:`${gi*40}ms`,textAlign:'center'}}
                            onMouseEnter={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow=`0 12px 40px ${grp.color}25`;e.currentTarget.style.borderColor=grp.color;}}
                            onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor=`${grp.color}33`;}}>
                            <div style={{fontSize:'36px',marginBottom:'8px'}}>{grp.emoji}</div>
                            <div style={{fontSize:'12px',fontWeight:700,color:'#13294b',marginBottom:'4px'}}>{grp.key}</div>
                            {isGroup&&<div style={{fontSize:'9px',color:'#5b6b80',marginBottom:'4px'}}>{grp.items.length} unit mesin</div>}
                            <div style={{fontSize:'11px',fontWeight:700,color:grp.color}}>{mParts.length} part</div>
                            {low>0&&<div style={{fontSize:'10px',color:'#c62828',marginTop:'2px'}}>⚠ {low} low</div>}
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            );

            // LEVEL 3 - Spare parts
            const selInfo2 = mesinStruktur2[catalogDrillMesin];
            const finalParts = getPartsForMesin2(catalogDrillMesin);
            return(
              <div>
                {selInfo2?.subMesin.length>0&&(
                  <div style={{...G.card,padding:'12px 16px',marginBottom:'14px',border:`1px solid ${selInfo2.color}33`}}>
                    <div style={{fontSize:'10px',color:'#5b6b80',marginBottom:'6px',fontWeight:700,textTransform:'uppercase'}}>Sub-mesin:</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                      {selInfo2.subMesin.map(sm=><span key={sm} style={{background:`${selInfo2.color}15`,border:`1px solid ${selInfo2.color}40`,borderRadius:'20px',padding:'3px 10px',fontSize:'10px',color:selInfo2.color}}>{sm}</span>)}
                    </div>
                  </div>
                )}
                {renderTable(finalParts)}
              </div>
            );
          })()}
        </div>
      )}

      {activePage==='partin'&&(
        <div style={{padding:'28px 32px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',alignItems:'start',marginBottom:'24px'}}>
            <div style={{...G.card,padding:'24px'}}>
              <div style={{fontSize:'15px',fontWeight:700,color:'#13294b',marginBottom:'16px'}}>Input barang masuk</div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <PilihPartIn parts={partsMaster||partsList} nilai={formPartIn.spare_part_id} onPilih={p=>setFormPartIn(f=>({...f,spare_part_id:p?String(p.id):'',nama_part:p?String(p.nama_part||''):'',kode_12nc:p?String(p.kode_12nc||''):'',brand:''}))} onKeMaster={()=>setActivePage('parts')}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <div><label style={G.lbl}>Jumlah masuk *</label><input type="number" min={1} style={G.inp} value={formPartIn.jumlah} onChange={e=>setFormPartIn(f=>({...f,jumlah:e.target.value}))} placeholder="0"/></div>
                  <div><label style={G.lbl}>Kondisi</label><select style={{...G.inp,cursor:'pointer'}} value={formPartIn.kondisi} onChange={e=>setFormPartIn(f=>({...f,kondisi:e.target.value}))}><option>Baik</option><option>Ada selisih jumlah</option><option>Barang rusak</option></select></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <div><label style={G.lbl}>Nomor DO</label><input style={G.inp} value={formPartIn.nomor_do} onChange={e=>setFormPartIn(f=>({...f,nomor_do:e.target.value}))} placeholder="DO-2026-0001"/></div>
                  <div><label style={G.lbl}>Nama Supplier</label><input style={G.inp} value={formPartIn.nama_supplier} onChange={e=>setFormPartIn(f=>({...f,nama_supplier:e.target.value}))} placeholder="PT Husky..."/></div>
                </div>
                {(()=>{const p=(partsMaster||partsList).find((x:any)=>String(x.id)===String(formPartIn.spare_part_id));const daftar=String(p?.merk||'').split(',').map(x=>x.trim()).filter(Boolean);
                  return <div><label style={G.lbl}>Merk barang yang datang</label>{daftar.length
                    ?<select style={{...G.inp,cursor:'pointer'}} value={formPartIn.brand} onChange={e=>setFormPartIn(f=>({...f,brand:e.target.value}))}><option value="">-- Pilih merk --</option>{daftar.map(m=><option key={m} value={m}>{m}</option>)}</select>
                    :<div style={{fontSize:'12px',color:'var(--mcc-text-muted)',padding:'8px 0'}}>{p?'Part ini belum punya daftar merk. Merk diisi di Kelola part.':'Pilih part dulu.'}</div>}</div>;})()}
                <div><label style={G.lbl}>Catatan</label><textarea style={{...G.inp,height:'60px',resize:'none' as const}} value={formPartIn.catatan} onChange={e=>setFormPartIn(f=>({...f,catatan:e.target.value}))} placeholder="Catatan tambahan..."/></div>
              </div>
              <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'16px'}}>
                <button onClick={()=>setFormPartIn({is_consumable:false,nama_part:'',kode_12nc:'',nomor_do:'',jumlah:'',nama_supplier:'',brand:'',nomor_bin:'',kategori:'',kondisi:'Baik',catatan:'',foto_url:'',jenis:'molding',nama_mesin:'',leader_teknisi:'',harga_satuan:'',mesin_bagi:[],pindah_rak:false,spare_part_id:''})} className="mcc-btn-secondary">Kosongkan form</button>
                <button onClick={handleSavePartIn} disabled={loadingPartIn} className="mcc-btn-primary" style={{opacity:loadingPartIn?0.7:1}}>{loadingPartIn?'Menyimpan...':'Simpan Part In'}</button>
              </div>
            </div>
            <div style={{...G.card,padding:'24px'}}>
              <div style={{fontSize:'15px',fontWeight:700,color:'#13294b',marginBottom:'4px'}}>Upload file Excel</div>
              <div style={{fontSize:'13px',color:'#5b6b80',marginBottom:'16px'}}>Import data penerimaan barang secara massal</div>
              <div onDragOver={e=>{e.preventDefault();setIsDragOver(true);}} onDragLeave={()=>setIsDragOver(false)} onDrop={e=>{e.preventDefault();setIsDragOver(false);handleImportFiles(Array.from(e.dataTransfer.files));}} onClick={()=>importFileRef.current?.click()}
                style={{border:`2px dashed ${isDragOver?'#0b5ed7':'rgba(11,94,215,0.3)'}`,borderRadius:'8px',padding:'28px 20px',textAlign:'center',cursor:'pointer',background:isDragOver?'rgba(11,94,215,0.08)':'rgba(11,94,215,0.03)',transition:'all 0.2s',marginBottom:'16px'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:'8px',color:'var(--mcc-blue)'}}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v4h16v-4"/></svg></div>
                <div style={{fontSize:'15px',color:'#13294b',marginBottom:'4px'}}><span style={{color:'#0b5ed7',fontWeight:600}}>Klik untuk upload</span> atau drag & drop</div>
                <div style={{fontSize:'13px',color:'#8a97a8'}}>Excel (.xlsx, .xls), CSV — maks 25MB</div>
                <input ref={importFileRef} type="file" multiple accept=".xlsx,.xls,.csv" style={{display:'none'}} onChange={e=>handleImportFiles(Array.from(e.target.files||[]))}/>
              </div>
              {importFiles.length>0&&(
                <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'14px',maxHeight:'200px',overflowY:'auto'}}>
                  {importFiles.map((f,i)=>(
                    <div key={i} style={{background:'#f8f9fb',borderRadius:'8px',padding:'10px 14px',border:`1px solid ${f.status==='done'?'rgba(30,126,52,0.2)':f.status==='error'?'rgba(198,40,40,0.2)':'#e6eaf0'}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'6px'}}>
                                                <div style={{flex:1,minWidth:0}}><div style={{fontSize:'13px',fontWeight:600,color:'#13294b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div><div style={{fontSize:'12px',color:'#5b6b80'}}>{f.size}</div></div>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',flexShrink:0}}>
                          <span style={{fontSize:'13px',fontWeight:700,color:f.status==='done'?'#1e7e34':f.status==='error'?'#c62828':'#0b5ed7'}}>{f.status==='done'?'Selesai':f.status==='error'?'Gagal':f.progress+'%'}</span>
                          <button onClick={()=>setImportFiles(p=>p.filter((_,j)=>j!==i))} style={{background:'none',border:'none',color:'#8a97a8',cursor:'pointer',fontSize:'15px'}} aria-label="Hapus file dari daftar">×</button>
                        </div>
                      </div>
                      <div style={{height:'3px',background:'#f8f9fb',borderRadius:'4px',overflow:'hidden'}}><div style={{height:'100%',width:`${f.progress}%`,background:f.status==='done'?'#1e7e34':f.status==='error'?'#c62828':'#0b5ed7',borderRadius:'4px',transition:'width 0.3s'}}/></div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>{if(!importFiles.length||!importFiles.every(f=>f.status==='done'))return;showMsg('ok',`${importFiles.length} file berhasil diimport`);setImportFiles([]);}} disabled={!importFiles.length||!importFiles.every(f=>f.status==='done')} style={{flex:1,background:importFiles.every(f=>f.status==='done')&&importFiles.length>0?'#0b5ed7':'rgba(11,94,215,0.15)',border:'none',borderRadius:'6px',padding:'9px',color:importFiles.every(f=>f.status==='done')&&importFiles.length>0?'#fff':'#0b5ed7',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:importFiles.length===0?0.5:1}}>Import ke sistem</button>
              </div>
            </div>
          </div>
          <div style={{...G.card,padding:'20px'}}>
            <div style={{fontSize:'15px',fontWeight:700,color:'#13294b',marginBottom:'14px'}}>Riwayat Part In</div>
            {historyPartIn.length===0?<div style={{textAlign:'center',padding:'32px',color:'#8a97a8',fontSize:'14px'}}>Belum ada data penerimaan</div>
              :<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                {historyPartIn.slice(0,12).map((r:any,i:number)=>(
                  <div key={r.id} style={{padding:'12px 14px',background:'#ffffff',borderRadius:'8px',border:'1px solid #e6eaf0',animation:'fadeInUp 0.3s ease both',animationDelay:`${i*30}ms`,position:'relative'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'4px'}}>
                      <div style={{fontSize:'14px',fontWeight:600,color:'#13294b',flex:1,marginRight:'8px'}}>{r.nama_part}</div>
                      <button onClick={()=>setEditPartIn({...r})} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.25)',borderRadius:'6px',padding:'3px 8px',color:'#0b5ed7',fontSize:'12px',fontWeight:600,cursor:'pointer',flexShrink:0}}>Ubah</button>
                    </div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                      <span style={{fontSize:'13px',color:'#5b6b80'}}>{r.nomor_do||'-'} • {r.kondisi}</span>
                      <span style={{fontSize:'14px',fontWeight:700,color:'#1e7e34'}}>+{r.jumlah_masuk} pcs</span>
                    </div>
                    {r.brand&&<div style={{fontSize:'12px',color:'#5b6b80',marginBottom:'3px'}}>{r.brand}</div>}
                    {(r.nama_mesin||r.jenis)&&<div style={{fontSize:'12px',marginBottom:'3px',display:'flex',gap:'6px'}}>
                      {r.jenis&&<span style={{background:r.jenis==='molding'?'rgba(11,94,215,0.15)':'rgba(11,94,215,0.15)',color:r.jenis==='molding'?'#0b5ed7':'#0b5ed7',padding:'1px 6px',borderRadius:'8px',fontWeight:600}}>{r.jenis==='molding'?'Molding':'Non-molding'}</span>}
                      {r.nama_mesin&&<span style={{color:'#5b6b80'}}>{r.nama_mesin}</span>}
                      {r.leader_teknisi&&<span style={{color:'#5b6b80'}}>Leader: {r.leader_teknisi}</span>}
                    </div>}
                    <div style={{fontSize:'12px',color:'#8a97a8'}}>{tglDb(r.tanggal_masuk).toLocaleString('id-ID')}</div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      )}

      {activePage==='partout'&&(
        <div style={{padding:'24px'}}>
          <div style={{marginBottom:'24px'}}><div style={{fontSize:'9px',fontWeight:700,color:'#0b5ed7',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'4px'}}>Pengeluaran Barang</div><div style={{fontSize:'26px',fontWeight:800,color:'#13294b'}}>📤 Part <span style={{color:'#0b5ed7'}}>OUT</span></div></div>
          <div style={{...G.card,padding:'20px',marginBottom:'20px'}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#13294b',marginBottom:'14px'}}>🔔 Request Pending <span style={{background:'rgba(198,40,40,0.15)',color:'#c62828',fontSize:'10px',padding:'2px 8px',borderRadius:'10px',marginLeft:'6px'}}>{requests.filter(r=>r.status==='Pending').length}</span></div>
            {requests.filter(r=>r.status==='Pending').length===0?<div style={{textAlign:'center',padding:'16px',color:'#8a97a8',fontSize:'12px'}}>Tidak ada request pending</div>
            :requests.filter(r=>r.status==='Pending').map((r:any,i:number)=>(
              <div key={r.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'rgba(11,94,215,0.08)',borderRadius:'8px',marginBottom:'8px',border:'1px solid rgba(11,94,215,0.15)'}}>
                <div><div style={{fontSize:'12px',fontWeight:600,color:'#13294b'}}>{r.teknisi_nama} — <span style={{color:'#0b5ed7'}}>{r.part_nama}</span> <span style={{color:'#8a5a00'}}>x{r.jumlah}</span></div><div style={{fontSize:'10px',color:'#5b6b80',marginTop:'2px'}}>{r.nomor_wo||'-'} • {r.mesin_area||'-'}</div>{r.alasan_ambil&&<div style={{fontSize:'11px',color:'#13294b',marginTop:'2px'}}>Alasan: {r.alasan_ambil}</div>}<BannerLuarTugas area={r.mesin_area}/></div>
                <div style={{display:'flex',gap:'6px'}}>
                  <button onClick={()=>handleApprove(r.id)} style={{background:'rgba(30,126,52,0.15)',border:'1px solid rgba(30,126,52,0.25)',borderRadius:'6px',padding:'5px 12px',color:'#1e7e34',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>✅ Approve</button>
                  <button onClick={()=>handleReject(r.id)} style={{background:'rgba(198,40,40,0.12)',border:'1px solid rgba(198,40,40,0.2)',borderRadius:'6px',padding:'5px 12px',color:'#c62828',fontSize:'11px',fontWeight:700,cursor:'pointer'}}>❌ Reject</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',alignItems:'start'}}>
            <div style={{...G.card,padding:'24px'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#13294b',marginBottom:'6px'}}>✍️ Input Manual Part OUT</div>
              <div style={{fontSize:'12px',color:'var(--mcc-text-muted)',marginBottom:'14px'}}>Untuk mengurangi stok di luar request teknisi, mis. koreksi salah input Part In. Alasan wajib diisi dan tercatat di kartu stok. Barang yang dikembalikan ke supplier pakai menu Return.</div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div><label style={G.lbl}>Nama Spare Part *</label>
                  <input list="po-part-list" style={G.inp} value={partOutText} placeholder="Ketik nama part atau kode 12NC"
                    onChange={e=>{const t=e.target.value;setPartOutText(t);const low=t.trim().toLowerCase();let p=partsList.find(x=>partLabel(x).toLowerCase()===low);if(!p){const sama=partsList.filter(x=>String(x.nama_part||'').trim().toLowerCase()===low);if(sama.length===1)p=sama[0];}setFormPartOut(f=>({...f,spare_part_nama:p?p.nama_part:t.trim(),spare_part_id:p?.id||''}));}}/>
                  <datalist id="po-part-list">{partsList.map(p=><option key={p.id} value={partLabel(p)}>{`Stok: ${p.stok_saat_ini??0}`}</option>)}</datalist>
                  {(()=>{const sp=formPartOut.spare_part_id?partsList.find(x=>String(x.id)===String(formPartOut.spare_part_id)):null;
                    if(sp)return <div style={{fontSize:'11px',color:(parseInt(formPartOut.jumlah)||0)>(Number(sp.stok_saat_ini)||0)?'#c62828':'var(--mcc-blue)',marginTop:'5px'}}>Stok {sp.stok_saat_ini??0} · Rak {sp.nomor_bin||'-'}{(parseInt(formPartOut.jumlah)||0)>(Number(sp.stok_saat_ini)||0)?' · jumlah melebihi stok':''}</div>;
                    if(partOutText.trim())return <div style={{fontSize:'11px',color:'#8a5a00',marginTop:'5px'}}>Pilih dari daftar yang muncul.</div>;
                    return null;})()}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}><div><label style={G.lbl}>Jumlah *</label><input type="number" style={G.inp} value={formPartOut.jumlah} onChange={e=>setFormPartOut(f=>({...f,jumlah:e.target.value}))} placeholder="0"/></div><div><label style={G.lbl}>No. Work Order</label><input style={G.inp} value={formPartOut.nomor_wo} onChange={e=>setFormPartOut(f=>({...f,nomor_wo:e.target.value}))} placeholder="WO-2026-0123"/></div></div>
                <div><label style={G.lbl}>Mesin / Area</label><input style={G.inp} value={formPartOut.mesin_area} onChange={e=>setFormPartOut(f=>({...f,mesin_area:e.target.value}))} placeholder="Injection #3"/></div>
                <div><label style={G.lbl}>Jenis pengeluaran *</label><select style={{...G.inp,cursor:'pointer'}} value={formPartOut.jenis} onChange={e=>setFormPartOut(f=>({...f,jenis:e.target.value}))}>{['Koreksi salah input','Dipakai tanpa request','Rusak / tidak layak pakai di Store','Lainnya'].map(j=><option key={j}>{j}</option>)}</select></div>
                <div><label style={G.lbl}>Alasan / keterangan *</label><textarea style={{...G.inp,height:'60px',resize:'none' as const}} value={formPartOut.keterangan} onChange={e=>setFormPartOut(f=>({...f,keterangan:e.target.value}))} placeholder="mis. Part In POWER SUPPLY tanggal 13/10 terinput dua kali"/></div>
              </div>
              <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'16px'}}>
                <button onClick={handleSavePartOut} disabled={loadingPartOut} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'9px 18px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:loadingPartOut?0.7:1}}>{loadingPartOut?'Menyimpan...':'📤 Konfirmasi Part OUT'}</button>
              </div>
            </div>
            <div style={{...G.card,padding:'20px'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#13294b',marginBottom:'14px'}}>📋 Riwayat Part OUT</div>
              {historyPartOut.length===0?<div style={{textAlign:'center',padding:'20px',color:'#8a97a8',fontSize:'12px'}}>Belum ada data</div>
              :historyPartOut.slice(0,8).map((r:any,i:number)=>(
                <div key={r.id} style={{padding:'10px 12px',background:'rgba(11,94,215,0.06)',borderRadius:'8px',marginBottom:'8px',border:'1px solid rgba(11,94,215,0.12)'}}>
                  <div style={{fontSize:'12px',fontWeight:600,color:'#13294b'}}>{r.nama_part}</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span style={{fontSize:'10px',color:'#5b6b80'}}>{r.teknisi_nama||'Manual'} • {r.nomor_wo||'-'}{r.keterangan?` • ${r.keterangan}`:''}</span><span style={{fontSize:'11px',fontWeight:700,color:'#c62828'}}>-{r.jumlah_keluar} pcs</span></div>
                  <div style={{fontSize:'9px',color:'#8a97a8',marginTop:'2px'}}>{tglDb(r.tanggal_keluar).toLocaleString('id-ID')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activePage==='monitoring'&&(
        <div style={{padding:'24px'}}>
          <div style={{marginBottom:'24px'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'4px'}}>
              <div><div style={{fontSize:'9px',fontWeight:700,color:'#0b5ed7',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'4px'}}>Monitoring Record 2026</div><div style={{fontSize:'26px',fontWeight:800,color:'#13294b'}}>📊 Monitoring <span style={{color:'#0b5ed7'}}>Spare Parts</span></div></div>
              <div style={{display:'flex',gap:'8px',marginTop:'4px',flexWrap:'wrap'}}>
                <button onClick={handleSendEmailAllTL} disabled={emailSending} style={{background:emailSending?'rgba(109,40,217,0.1)':'rgba(109,40,217,0.12)',border:'1px solid rgba(109,40,217,0.3)',borderRadius:'8px',padding:'8px 16px',color:'#6d28d9',fontSize:'11px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                  {emailSending?'⏳':'📧'} Email TL
                </button>
                <button onClick={handleExportExcel} style={{background:'rgba(30,126,52,0.1)',border:'1px solid rgba(30,126,52,0.25)',borderRadius:'8px',padding:'8px 16px',color:'#1e7e34',fontSize:'12px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>📊 Export Excel</button>
                <button onClick={()=>navigateTo('partin')} style={{background:'#0b5ed7',border:'none',borderRadius:'8px',padding:'8px 16px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>+ Part IN Baru</button>
              </div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
            {[{num:partsList.length,label:'Total Part',color:'#0b5ed7',icon:'🔩'},{num:partsList.filter(p=>p.stok_saat_ini<=p.reorder_point).length,label:'Low Stock',color:'#8a5a00',icon:'⚠️'},{num:requests.filter(r=>r.status==='Approved').length,label:'Part OUT Disetujui',color:'#1e7e34',icon:'✅'},{num:requests.filter(r=>r.status==='Pending').length,label:'Pending Request',color:'#c62828',icon:'🔔'}].map((s,i)=>(
              <div key={i}><StatCard num={s.num} label={s.label} color={s.color} icon={s.icon}/></div>
            ))}
          </div>
          {(()=>{
            // ===== Alert stok rendah, dikelompokkan: Area -> Mesin -> Part =====
            // Level "nomor unit" ditambahkan setelah tabel Mesin di database terisi.
            const nmList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];
            const low=partsList.filter(p=>p.stok_saat_ini<=p.reorder_point);
            if(low.length===0)return null;
            const areaOf=(p:any)=>!p.mesin?'Belum ada mesin':nmList.some(m=>String(p.mesin).toLowerCase().includes(m.toLowerCase()))?'Non-molding':'Molding';
            const tree:Record<string,Record<string,any[]>>={};
            low.forEach((p:any)=>{const a=areaOf(p);const m=p.mesin?String(p.mesin).trim():'Tanpa mesin';(tree[a]??={});(tree[a][m]??=[]).push(p);});
            const areas=['Molding','Non-molding','Belum ada mesin'].filter(a=>tree[a]);
            return (
              <section aria-label="Alert stok rendah" style={{...G.card,marginBottom:'20px',overflow:'hidden'}}>
                <div style={{padding:'16px 20px',borderBottom:'1px solid #e6eaf0',display:'flex',alignItems:'center',gap:'8px'}}>
                  <h2 style={{margin:0,fontSize:'17px',fontWeight:700,flex:1,color:'var(--mcc-text)'}}>Stok rendah per mesin</h2>
                  <span className="mcc-badge mcc-badge-warning">{low.length} part</span>
                </div>
                {areas.map(area=>(
                  <div key={area} style={{borderTop:'1px solid #eef1f5'}}>
                    <div style={{padding:'12px 20px 6px',fontSize:'13px',fontWeight:600,color:'var(--mcc-text-muted)'}}>{area}</div>
                    {Object.entries(tree[area]).sort((x,y)=>y[1].length-x[1].length).map(([mesin,items])=>{
                      const key=area+'|'+mesin; const open=openLowGroup===key;
                      const kritis=items.filter((p:any)=>p.is_critical||(p.stok_saat_ini||0)===0).length;
                      return (
                        <div key={key}>
                          <button type="button" onClick={()=>setOpenLowGroup(open?null:key)} aria-expanded={open} style={{width:'100%',display:'flex',alignItems:'center',gap:'10px',padding:'10px 20px',border:'none',background:open?'#f8f9fb':'transparent',cursor:'pointer',font:'inherit',textAlign:'left',color:'var(--mcc-text)'}}>
                            <span style={{display:'inline-flex',transition:'transform 150ms',transform:open?'rotate(90deg)':'none'}}><IconChevron/></span>
                            <span style={{flex:1,fontSize:'15px',fontWeight:600}}>{mesin}</span>
                            {kritis>0&&<span className="mcc-badge mcc-badge-danger">{kritis} kritis</span>}
                            <span className="mcc-badge mcc-badge-warning">{items.length} part</span>
                          </button>
                          {open&&(
                            <div className="mcc-fade-in" style={{padding:'0 20px 12px 48px'}}>
                              {items.map((p:any)=>(
                                <div key={p.id} style={{display:'flex',justifyContent:'space-between',gap:'12px',padding:'8px 0',borderBottom:'1px solid #eef1f5',fontSize:'14px'}}>
                                  <span style={{minWidth:0}}>{p.nama_part}{p.nomor_bin&&<span style={{color:'var(--mcc-text-muted)'}}> · {p.nomor_bin}</span>}</span>
                                  <span style={{whiteSpace:'nowrap',fontWeight:700,fontVariantNumeric:'tabular-nums',color:(p.stok_saat_ini||0)===0?'var(--mcc-danger)':'var(--mcc-warning)'}}>{p.stok_saat_ini} / {p.reorder_point}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            );
          })()}
          <div style={{...G.card,overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid #e6eaf0',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'10px'}}>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                {([[false,'Part warning'],[true,'Stok aktual semua part']] as const).map(([v,l])=>(
                  <button key={l} type="button" onClick={()=>setMonitoringSemua(v)} aria-pressed={monitoringSemua===v} style={{background:monitoringSemua===v?'#0b5ed7':'#f8f9fb',border:`1px solid ${monitoringSemua===v?'#0b5ed7':'#d9dee5'}`,borderRadius:'8px',padding:'6px 12px',color:monitoringSemua===v?'#fff':'#13294b',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>{l}</button>))}
              </div>
              <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                {(['semua','molding','nonmolding'] as const).map(j=>(
                  <button key={j} onClick={()=>setMonitoringJenis(j)} style={{background:monitoringJenis===j?(j==='molding'?'rgba(67,56,202,0.2)':j==='nonmolding'?'rgba(15,118,110,0.2)':'rgba(11,94,215,0.2)'):'#f8f9fb',border:`1px solid ${monitoringJenis===j?(j==='molding'?'rgba(67,56,202,0.5)':j==='nonmolding'?'rgba(15,118,110,0.5)':'rgba(11,94,215,0.5)'):'#e6eaf0'}`,borderRadius:'20px',padding:'4px 12px',color:monitoringJenis===j?(j==='molding'?'#4338ca':j==='nonmolding'?'#0f766e':'#0b5ed7'):'#5b6b80',fontSize:'10px',fontWeight:600,cursor:'pointer'}}>{j==='semua'?'🔍 Semua':j==='molding'?'🏭 Molding':'⚙️ Non Molding'}</button>
                ))}
              </div>
              <input type="search" value={monitoringSearch} onChange={e=>setMonitoringSearch(e.target.value)} placeholder="Cari nama part, kode 12NC, bin, atau mesin" aria-label="Cari part di tabel monitoring" style={{...G.inp,width:'300px',maxWidth:'100%'}}/>
              <div style={{fontSize:'12px',color:'#5b6b80'}}>Update otomatis setiap 5 detik</div>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#f8f9fb',borderBottom:'1px solid #e6eaf0'}}>
                {['No','Nama Part','Kategori','Bin / Lokasi','Stok Aktual','Min Stok','Masuk Terakhir','Keluar Minggu Ini','Status Stok','Rekomendasi','Aksi'].map(h=><th key={h} style={{fontSize:'9px',fontWeight:700,color:'#8a97a8',textTransform:'uppercase',padding:'10px 14px',textAlign:'left',whiteSpace:'nowrap'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {(()=>{const masukTerakhir=petaMasukTerakhir(historyPartIn);return partsList.filter(p=>{
                  if(!monitoringSemua&&!(p.stok_saat_ini<=p.reorder_point))return false; // mode 'Part warning': hanya part warning
                  const q=monitoringSearch.trim().toLowerCase();
                  if(q&&![p.nama_part,p.kode_12nc,p.nomor_bin,p.mesin,p.kategori].some(v=>String(v||'').toLowerCase().includes(q)))return false;
                  if(monitoringJenis==='semua')return true;
                  const nmMesinList=['CMYK','GAIYA','TAMPON','HAIRROBOTIC','MOTOR CABLE','AGV SEER','Batch Down','Flowthrough','External Siliting','Semi Auto','Full Auto','MLP Robot','Seer Carry AGV','Conveyor','Cable Car','Panel Conveyor'];
                  const isNonMolding=p.mesin&&nmMesinList.some(m=>p.mesin.toLowerCase().includes(m.toLowerCase()));
                  return monitoringJenis==='molding'?!isNonMolding:!!isNonMolding;
                }).map((p,i)=>{
                  const isLow=p.stok_saat_ini<=p.reorder_point;const isCritical=p.is_critical&&isLow;
                  const keluarMingguIni=historyPartOut.filter((r:any)=>{const d=tglDb(r.tanggal_keluar);return((new Date().getTime()-d.getTime())/(1000*60*60*24))<=7&&r.nama_part===p.nama_part;}).reduce((a:number,r:any)=>a+(r.jumlah_keluar||0),0);
                  const rekomendasiPesan=Math.max(0,(p.reorder_point*3)-p.stok_saat_ini);
                  return(
                    <tr key={p.id} onMouseEnter={e=>(e.currentTarget.style.background=isCritical?'rgba(198,40,40,0.05)':isLow?'rgba(154,103,0,0.05)':'#f8f9fb')} onMouseLeave={e=>(e.currentTarget.style.background=isCritical?'rgba(198,40,40,0.03)':isLow?'rgba(154,103,0,0.03)':'transparent')} style={{borderBottom:'1px solid #e6eaf0',transition:'background 0.15s',background:isCritical?'rgba(198,40,40,0.03)':isLow?'rgba(154,103,0,0.03)':'transparent'}}>
                      <td style={{padding:'10px 14px',fontSize:'11px',color:'#8a97a8'}}>{i+1}</td>
                      <td style={{padding:'10px 14px'}}><div style={{display:'flex',alignItems:'center',gap:'6px'}}>{isCritical&&<span style={{background:'rgba(198,40,40,0.15)',color:'#c62828',fontSize:'8px',fontWeight:700,padding:'1px 5px',borderRadius:'4px'}}>CRITICAL</span>}<span style={{fontSize:'11px',fontWeight:600,color:'#13294b'}}>{p.nama_part}</span></div></td>
                      <td style={{padding:'10px 14px'}}><KatBadge critical={!!p.is_critical}/></td>
                      <td style={{padding:'10px 14px',fontSize:'10px',color:'#5b6b80',fontFamily:'inherit'}}>{p.nomor_bin}</td>
                      <td style={{padding:'10px 14px'}}><span style={{fontSize:'16px',fontWeight:800,color:isCritical?'#c62828':isLow?'#8a5a00':'#0b5ed7'}}>{p.stok_saat_ini}</span></td>
                      <td style={{padding:'10px 14px',fontSize:'12px',fontWeight:600,color:'#5b6b80'}}>{p.reorder_point} pcs</td>
                      <td style={{padding:'10px 14px'}}><TeksMasuk x={masukTerakhir[p.id]}/></td>
                      <td style={{padding:'10px 14px'}}>{keluarMingguIni>0?<span style={{color:'#c62828',fontWeight:700,fontSize:'12px'}}>-{keluarMingguIni} pcs</span>:<span style={{color:'#8a97a8',fontSize:'11px'}}>—</span>}</td>
                      <td style={{padding:'10px 14px'}}>{isCritical?<span style={{background:'rgba(198,40,40,0.12)',color:'#c62828',fontSize:'9px',fontWeight:700,padding:'3px 8px',borderRadius:'8px'}}>🔴 KRITIS</span>:isLow?<span style={{background:'rgba(154,103,0,0.12)',color:'#8a5a00',fontSize:'9px',fontWeight:700,padding:'3px 8px',borderRadius:'8px'}}>⚠️ Low Stock</span>:<span style={{background:'rgba(30,126,52,0.12)',color:'#1e7e34',fontSize:'9px',fontWeight:700,padding:'3px 8px',borderRadius:'8px'}}>✅ Aman</span>}</td>
                      <td style={{padding:'10px 14px'}}>{isLow?<div><div style={{fontSize:'11px',fontWeight:700,color:'#0b5ed7'}}>Pesan {rekomendasiPesan} pcs</div><div style={{fontSize:'9px',color:'#5b6b80',marginTop:'2px'}}>ke supplier</div></div>:<span style={{fontSize:'10px',color:'#8a97a8'}}>Tidak perlu</span>}</td>
                      <td style={{padding:'10px 14px'}}>{isLow&&<button onClick={()=>showMsg('ok',`📋 Catat: ${p.nama_part} perlu dipesan ${rekomendasiPesan} pcs`)} style={{background:'rgba(11,94,215,0.12)',border:'1px solid rgba(11,94,215,0.25)',borderRadius:'6px',padding:'4px 10px',color:'#0b5ed7',fontSize:'10px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>📋 Catat</button>}</td>
                    </tr>
                  );
                });})()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {versiBaru&&(
        <div role="status" className="mcc-fade-in" style={{position:'fixed',bottom:'20px',left:'50%',transform:'translateX(-50%)',zIndex:2000,display:'flex',alignItems:'center',gap:'14px',padding:'12px 16px',borderRadius:'10px',background:'#13294b',color:'#ffffff',boxShadow:'0 8px 24px rgba(19,41,75,0.25)',fontSize:'14px'}}>
          <span>Versi baru aplikasi sudah tersedia.</span>
          <button type="button" onClick={()=>window.location.reload()} style={{border:'none',borderRadius:'6px',padding:'8px 14px',background:'#ffffff',color:'#13294b',font:'inherit',fontWeight:700,cursor:'pointer'}}>Muat ulang</button>
        </div>
      )}
      {activePage==='lokasi'&&<LokasiRak/>}

      {activePage==='laporan'&&(
        <div>
          <LaporanV2/>
          <div style={{padding:'0 32px 32px'}}>
          <div style={{...G.card,padding:'28px',marginBottom:'24px',maxWidth:'600px'}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#13294b',marginBottom:'20px'}}>Laporan bulanan (versi lama)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'24px'}}>
              <div><label style={G.lbl}>Bulan</label><select style={{...G.inp,cursor:'pointer'}} value={laporanBulan} onChange={e=>setLaporanBulan(parseInt(e.target.value))}>
                {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'].map((b,i)=><option key={i+1} value={i+1}>{b}</option>)}
              </select></div>
              <div><label style={G.lbl}>Tahun</label><select style={{...G.inp,cursor:'pointer'}} value={laporanTahun} onChange={e=>setLaporanTahun(parseInt(e.target.value))}>
                {[2024,2025,2026,2027].map(t=><option key={t} value={t}>{t}</option>)}
              </select></div>
            </div>
            <button onClick={async()=>{
              setLaporanLoading(true);showMsg('ok','Menyiapkan laporan PDF...');
              try{const res=await fetch(`/api/laporan?bulan=${laporanBulan}&tahun=${laporanTahun}`);if(!res.ok){const e=await res.json();showMsg('err',e.error||'Gagal generate PDF');setLaporanLoading(false);return;}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');const namaBulan=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][laporanBulan-1];a.href=url;a.download=`Laporan_MCC_${namaBulan}_${laporanTahun}.pdf`;a.click();URL.revokeObjectURL(url);showMsg('ok','✅ Laporan PDF berhasil didownload!');}catch(e:any){showMsg('err','Gagal: '+e.message);}
              setLaporanLoading(false);
            }} disabled={laporanLoading} style={{width:'100%',background:'#0b5ed7',border:'none',borderRadius:'10px',padding:'14px',color:'#fff',fontSize:'14px',fontWeight:700,cursor:laporanLoading?'wait':'pointer',opacity:laporanLoading?0.8:1,display:'flex',alignItems:'center',justifyContent:'center',gap:'10px',boxShadow:'none'}}>
              {laporanLoading?'⏳ Generating PDF...':'📥 Download Laporan PDF'}
            </button>
          </div>
          </div>
        </div>
      )}

      {activePage==='order'&&(
        <OrderPage partsList={partsList} namaUser={loginNama}
          onStokBerubah={()=>fetch('/api/parts').then(r=>r.json()).then(d=>{const arr=toArr(d.data??d);if(arr.length>0)setPartsList(arr);}).catch(()=>{})}/>
      )}

      {activePage==='return'&&(
        <div style={{padding:'24px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',alignItems:'start'}}>
            <div style={{...G.card,padding:'24px'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#13294b',marginBottom:'16px'}}>📋 Form Return ke Supplier</div>
              <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}><div><label style={G.lbl}>Nomor DO *</label><input style={G.inp} value={formReturn.nomor_do} onChange={e=>setFormReturn(f=>({...f,nomor_do:e.target.value}))} placeholder="DO-2026-0015"/></div><div><label style={G.lbl}>Jumlah Return *</label><input type="number" style={G.inp} value={formReturn.jumlah} onChange={e=>setFormReturn(f=>({...f,jumlah:e.target.value}))} placeholder="0"/></div></div>
                <div>
                  <label style={G.lbl}>Nama Spare Part</label>
                  <input list="return-part-list" style={G.inp} value={returnPartText} onChange={e=>pilihPartReturn(e.target.value)} placeholder="Ketik nama part atau kode 12NC"/>
                  <datalist id="return-part-list">{partsList.map(p=><option key={p.id} value={partLabel(p)}/>)}</datalist>
                  {(()=>{const sp=formReturn.spare_part_id?partsList.find(p=>String(p.id)===formReturn.spare_part_id):null;
                    if(sp)return <div style={{fontSize:'11px',color:'var(--mcc-blue)',marginTop:'5px'}}>Terhubung ke katalog · Bin {sp.nomor_bin||'-'} · Stok {sp.stok_saat_ini??'-'}</div>;
                    if(returnPartText.trim())return <div style={{fontSize:'11px',color:'#8a5a00',marginTop:'5px'}}>Belum cocok dengan katalog. Pilih dari daftar yang muncul.</div>;
                    return null;})()}
                </div>
                <div><label style={G.lbl}>Nama Supplier</label><input style={G.inp} value={formReturn.nama_supplier} onChange={e=>setFormReturn(f=>({...f,nama_supplier:e.target.value}))} placeholder="PT Husky Indonesia"/></div>
                <div><label style={G.lbl}>Alasan Return</label><select style={{...G.inp,cursor:'pointer'}} value={formReturn.alasan} onChange={e=>setFormReturn(f=>({...f,alasan:e.target.value}))}><option>Barang rusak / cacat</option><option>Selisih jumlah dengan DO</option><option>Part tidak sesuai spesifikasi</option><option>Salah kirim</option></select></div>
                <div><label style={G.lbl}>Catatan</label><textarea style={{...G.inp,height:'60px',resize:'none' as const}} value={formReturn.catatan} onChange={e=>setFormReturn(f=>({...f,catatan:e.target.value}))} placeholder="Detail alasan return..."/></div>
                <div>
                  <label style={G.lbl}>Foto alasan return *</label>
                  {formReturn.foto?(
                    <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                      <img src={formReturn.foto} alt="Foto alasan return" style={{width:'120px',height:'90px',objectFit:'cover',borderRadius:'8px',border:'1px solid #d9dee5'}}/>
                      <button type="button" className="mcc-btn-secondary" onClick={()=>{setFormReturn(f=>({...f,foto:''}));setShowReturnCamera(false);}}>Ganti foto</button>
                    </div>
                  ):showReturnCamera?(
                    <div style={{border:'1px solid #d9dee5',borderRadius:'8px',padding:'12px',background:'#13294b'}}>
                      <CameraCapture label="Foto bagian yang rusak / tidak sesuai" onCapture={(b64)=>{if(b64){setFormReturn(f=>({...f,foto:b64}));setShowReturnCamera(false);}}} onError={()=>{}}/>
                    </div>
                  ):(
                    <div style={{display:'flex',gap:'8px',flexWrap:'wrap' as const}}>
                      <button type="button" className="mcc-btn-secondary" onClick={()=>setShowReturnCamera(true)}>Ambil dengan kamera</button>
                      <label className="mcc-btn-secondary" style={{cursor:'pointer'}}>Pilih file foto
                        <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const file=e.target.files?.[0];if(!file)return;const rd=new FileReader();rd.onload=ev=>setFormReturn(f=>({...f,foto:String(ev.target?.result||'')}));rd.readAsDataURL(file);e.target.value='';}}/>
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'16px'}}>
                <button onClick={resetReturnForm} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'9px 18px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
                <button onClick={handleSaveReturn} disabled={loadingReturn} style={{background:'#b45309',border:'none',borderRadius:'7px',padding:'9px 18px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:loadingReturn?0.7:1}}>{loadingReturn?'Menyimpan...':'🔁 Simpan Return'}</button>
              </div>
            </div>
            <div style={{...G.card,padding:'20px'}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#13294b',marginBottom:'14px'}}>📋 Riwayat Return</div>
              {historyReturn.length===0?<div style={{textAlign:'center',padding:'20px',color:'#8a97a8',fontSize:'12px'}}>Belum ada data</div>
              :historyReturn.slice(0,8).map((r:any,i:number)=>(
                <div key={r.id} style={{padding:'10px 12px',background:'rgba(154,103,0,0.06)',borderRadius:'8px',marginBottom:'8px',border:'1px solid rgba(154,103,0,0.12)'}}>
                  <div style={{fontSize:'12px',fontWeight:600,color:'#13294b'}}>{r.nama_part||'-'}</div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:'4px'}}><span style={{fontSize:'10px',color:'#5b6b80'}}>{r.nomor_do} • {r.alasan}</span><span style={{fontSize:'11px',fontWeight:700,color:'#8a5a00'}}>-{r.jumlah_return} pcs</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'2px'}}>
                    <span style={{fontSize:'9px',color:'#8a97a8'}}>{tglDb(r.tanggal_return).toLocaleString('id-ID')}</span>
                    {r.ada_foto&&<button type="button" className="mcc-link-btn" style={{fontSize:'11px'}} onClick={()=>lihatFotoReturn(r)}>Lihat foto</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {returnFotoView&&(
        <div onClick={()=>setReturnFotoView(null)} style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'24px'}}>
          <div onClick={e=>e.stopPropagation()} className="mcc-fade-in" style={{background:'#fff',borderRadius:'12px',padding:'16px',maxWidth:'860px',width:'100%'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
              <div style={{fontSize:'14px',fontWeight:700,color:'#13294b'}}>Foto alasan return · {returnFotoView.judul}</div>
              <button type="button" className="mcc-btn-secondary" onClick={()=>setReturnFotoView(null)}>Tutup</button>
            </div>
            {returnFotoView.loading
              ?<div style={{padding:'40px',textAlign:'center',color:'#5b6b80',fontSize:'12px'}}>Memuat foto...</div>
              :<img src={returnFotoView.src} alt="Foto alasan return" style={{width:'100%',maxHeight:'70vh',objectFit:'contain',borderRadius:'8px'}}/>}
          </div>
        </div>
      )}

      {/* ══ HISTORY PAGE ══ */}
      {activePage==='history'&&!riwayatLama&&<RiwayatMesin onTampilanLama={()=>setRiwayatLama(true)}/>}
      {activePage==='history'&&riwayatLama&&(
        <div style={{padding:'24px'}}>
          <div style={{marginBottom:'24px'}}>
            <button type="button" className="mcc-link-btn" style={{marginBottom:'6px'}} onClick={()=>setRiwayatLama(false)}>← Kembali ke Riwayat per mesin</button>
            <div style={{fontSize:'9px',fontWeight:700,color:'#0b5ed7',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'4px'}}>Rekam Jejak</div>
            <div style={{fontSize:'26px',fontWeight:800,color:'#13294b'}}>📜 History <span style={{color:'#0b5ed7'}}>Transaksi</span></div>
            <div style={{fontSize:'11px',color:'#5b6b80',marginTop:'2px'}}>Part IN · Part OUT · Return — semua dalam satu halaman</div>
          </div>

          {/* Filter Tabs */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
            {([
              {type:'semua',label:'Semua Transaksi',color:'#0b5ed7'},
              {type:'in',label:'Part IN',color:'#1e7e34'},
              {type:'out',label:'Part OUT',color:'#c62828'},
              {type:'return',label:'Return',color:'#8a5a00'},
            ] as const).map(s=>{
              const num = s.type==='semua'
                ? historyPartIn.length+historyPartOut.length+historyReturn.length
                : s.type==='in'?historyPartIn.length
                : s.type==='out'?historyPartOut.length
                : historyReturn.length;
              return(
                <div key={s.type} onClick={()=>setHistFilter(s.type)} style={{...G.card,padding:'14px 18px',cursor:'pointer',border:`1px solid ${histFilter===s.type?s.color+'66':'#e6eaf0'}`,background:histFilter===s.type?s.color+'12':'#f8f9fb',transition:'all 0.2s'}}>
                  <div style={{fontSize:'11px',color:'#5b6b80',marginBottom:'6px'}}>{s.label}</div>
                  <div style={{fontSize:'28px',fontWeight:800,color:s.color}}>{num}</div>
                </div>
              );
            })}
          </div>

          {/* Search */}
          <div style={{display:'flex',gap:'10px',marginBottom:'16px',alignItems:'center'}}>
            <input value={histSearch} onChange={e=>setHistSearch(e.target.value)} placeholder="🔍 Cari nama part, teknisi, supplier..." style={{...G.inp,maxWidth:'340px'}}/>
            <div style={{marginLeft:'auto',fontSize:'11px',color:'#5b6b80'}}>
              {[
                ...historyPartIn.map((r:any)=>({...r,_type:'in'})),
                ...historyPartOut.map((r:any)=>({...r,_type:'out'})),
                ...historyReturn.map((r:any)=>({...r,_type:'return'})),
              ].filter(r=>(histFilter==='semua'||r._type===histFilter)&&(!histSearch||r.nama_part?.toLowerCase().includes(histSearch.toLowerCase())||(r.teknisi_nama||r.nama_supplier||'').toLowerCase().includes(histSearch.toLowerCase()))).length} transaksi
            </div>
          </div>

          {/* Timeline */}
          {(()=>{
            const combined = [
              ...historyPartIn.map((r:any)=>({...r,_type:'in',_date:r.tanggal_masuk,_label:`+${r.jumlah_masuk} pcs`,_color:'#1e7e34',_bg:'rgba(30,126,52,0.07)',_border:'rgba(30,126,52,0.15)',_icon:'📥',_nama:r.nama_part,_by:r.nama_supplier||'Supplier',_ref:r.nomor_do,_badge:'PART IN'})),
              ...historyPartOut.map((r:any)=>({...r,_type:'out',_date:r.tanggal_keluar,_label:`-${r.jumlah_keluar} pcs`,_color:'#c62828',_bg:'rgba(198,40,40,0.07)',_border:'rgba(198,40,40,0.15)',_icon:'📤',_nama:r.nama_part,_by:r.teknisi_nama||'Manual',_ref:r.nomor_wo,_badge:'PART OUT'})),
              ...historyReturn.map((r:any)=>({...r,_type:'return',_date:r.tanggal_return,_label:`-${r.jumlah_return} pcs`,_color:'#8a5a00',_bg:'rgba(154,103,0,0.07)',_border:'rgba(154,103,0,0.15)',_icon:'🔁',_nama:r.nama_part||'-',_by:r.nama_supplier||'-',_ref:r.nomor_do,_badge:'RETURN'})),
            ]
            .filter(r=>(histFilter==='semua'||r._type===histFilter)&&(!histSearch||r._nama?.toLowerCase().includes(histSearch.toLowerCase())||r._by?.toLowerCase().includes(histSearch.toLowerCase())))
            .sort((a:any,b:any)=>tglDb(b._date).getTime()-tglDb(a._date).getTime());

            if(combined.length===0) return(
              <div style={{...G.card,padding:'60px',textAlign:'center'}}>
                <div style={{fontSize:'48px',marginBottom:'12px'}}>📭</div>
                <div style={{fontSize:'14px',color:'#5b6b80',marginBottom:'4px'}}>Belum ada transaksi</div>
                <div style={{fontSize:'11px',color:'#8a97a8'}}>Data akan muncul setelah ada transaksi Part IN, Part OUT, atau Return</div>
              </div>
            );

            return(
              <div style={{...G.card,overflow:'hidden'}}>
                {combined.map((r:any,i:number)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'16px',padding:'13px 20px',borderBottom:'1px solid #e6eaf0',background:r._bg,transition:'all 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.background=r._color+'14'}
                    onMouseLeave={e=>e.currentTarget.style.background=r._bg}>
                    {/* Icon */}
                    <div style={{width:'40px',height:'40px',borderRadius:'10px',background:r._color+'22',border:`1px solid ${r._border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>{r._icon}</div>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#13294b',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r._nama}</div>
                      <div style={{fontSize:'10px',color:'#5b6b80',marginTop:'2px'}}>
                        {r._type==='in'?`📦 Dari: ${r._by}`:r._type==='out'?`👷 Oleh: ${r._by}`:`🔁 Return ke: ${r._by}`}
                        {r._ref&&<span style={{marginLeft:'8px',color:'#8a97a8'}}>• Ref: {r._ref}</span>}
                        {r.nama_mesin&&<span style={{marginLeft:'8px',color:'#0b5ed7'}}>• {r.nama_mesin}</span>}
                        {r.leader_teknisi&&<span style={{marginLeft:'8px',color:'#8a5a00'}}>• 👷 {r.leader_teknisi}</span>}
                      </div>
                    </div>
                    {/* Amount */}
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:'16px',fontWeight:700,color:r._color}}>{r._label}</div>
                      <div style={{fontSize:'9px',color:'#8a97a8',marginTop:'2px'}}>{tglDb(r._date).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                    {/* Badge */}
                    <span style={{background:r._color+'22',border:`1px solid ${r._border}`,borderRadius:'20px',padding:'3px 10px',fontSize:'9px',fontWeight:700,color:r._color,flexShrink:0}}>{r._badge}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      </div>

      {/* ══ MODAL EDIT LEADER/TEKNISI ══ */}
      {editLeader&&(
        <div style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.45)',backdropFilter:'none',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setEditLeader(null);}}>
          <div style={{...G.card,padding:'28px',width:'500px',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(19,41,75,0.14)',animation:'cardPop 0.3s cubic-bezier(0.2,0,0,1) both'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <div style={{fontSize:'16px',fontWeight:700,color:'#13294b'}}>✏️ Edit {editLeaderArea==='molding'?'Team Leader':'Teknisi'}</div>
              <button onClick={()=>setEditLeader(null)} style={{background:'none',border:'none',color:'#5b6b80',fontSize:'20px',cursor:'pointer'}}>✕</button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
              <div>
                <label style={G.lbl}>Nama</label>
                <input style={G.inp} value={editLeader.nama||''} onChange={e=>setEditLeader((p:any)=>({...p,nama:e.target.value.toUpperCase()}))} placeholder="Nama lengkap..."/>
              </div>
              <div>
                <label style={G.lbl}>Warna Aksen</label>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap',marginBottom:'8px'}}>
                  {['#0b5ed7','#1e7e34','#c62828','#8a5a00','#6d28d9','#c2410c','#6d28d9','#0f766e','#0b5ed7','#6d28d9'].map(c=>(
                    <div key={c} onClick={()=>setEditLeader((p:any)=>({...p,aksen:c}))} style={{width:'26px',height:'26px',borderRadius:'50%',background:c,cursor:'pointer',border:editLeader.aksen===c?'3px solid #fff':'3px solid transparent'}}/>
                  ))}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'34px',height:'34px',borderRadius:'50%',background:'#ffffff',border:`2px solid ${editLeader.aksen}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:editLeader.aksen}}>{autoInisial(editLeader.nama||'')}</div>
                  <span style={{fontSize:'10px',color:'#5b6b80'}}>Preview avatar</span>
                </div>
              </div>
              <div>
                <label style={G.lbl}>Mesin Tanggung Jawab</label>
                <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
                  <input style={{...G.inp,flex:1}} placeholder="Ketik nama mesin..." onKeyDown={e=>{if(e.key==='Enter'){const v=(e.target as HTMLInputElement).value.trim();if(v){setEditLeader((p:any)=>({...p,mesinList:[...p.mesinList,v]}));(e.target as HTMLInputElement).value='';}}} } id="editMesinInput"/>
                  <button onClick={()=>{const inp=document.getElementById('editMesinInput') as HTMLInputElement;const v=inp?.value.trim();if(v){setEditLeader((p:any)=>({...p,mesinList:[...p.mesinList,v]}));if(inp)inp.value='';}}} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.3)',borderRadius:'7px',padding:'8px 14px',color:'#0b5ed7',fontSize:'11px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>+ Tambah</button>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px',maxHeight:'150px',overflowY:'auto'}}>
                  {(editLeader.mesinList||[]).map((m:string,i:number)=>(
                    <div key={i} style={{background:`${editLeader.aksen}15`,border:`1px solid ${editLeader.aksen}40`,borderRadius:'20px',padding:'3px 10px',display:'flex',alignItems:'center',gap:'6px'}}>
                      <span style={{fontSize:'11px',color:'#13294b'}}>{m}</span>
                      <button onClick={()=>setEditLeader((p:any)=>({...p,mesinList:p.mesinList.filter((_:any,j:number)=>j!==i)}))} style={{background:'none',border:'none',color:'#5b6b80',cursor:'pointer',fontSize:'12px',padding:0,lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setEditLeader(null)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'9px 20px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
              <button onClick={()=>{
                if(!editLeader.nama?.trim())return showMsg('err','Nama wajib diisi!');
                const origNama=editLeader._originalNama||editLeader.nama;
                const updated={...editLeader,inisial:autoInisial(editLeader.nama),mesin:[...editLeader.mesinList]};
                delete updated._originalNama; delete updated.mesinList;
                if(editLeaderArea==='molding'){
                  const idx=moldingTLList.findIndex((tl:any)=>tl.nama===origNama);
                  const newList=idx>=0?moldingTLList.map((tl:any,i:number)=>i===idx?updated:tl):[...moldingTLList,updated];
                  setMoldingTLList(newList);
                  try{localStorage.setItem('mcc_moldingTL',JSON.stringify(newList));}catch{}
                }else{
                  const idx=(nonMoldingTeknisi as any[]).findIndex((t:any)=>t.nama===origNama);
                  const newList=idx>=0?(nonMoldingTeknisi as any[]).map((t:any,i:number)=>i===idx?updated:t):[...nonMoldingTeknisi,updated];
                  setNonMoldingTeknisi(newList as any);
                  try{localStorage.setItem('mcc_nonMoldingTeknisi',JSON.stringify(newList));}catch{}
                }
                setEditLeader(null);
                showMsg('ok',`✅ ${editLeader.nama} berhasil diupdate!`);
              }} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'9px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL TAMBAH LEADER/TEKNISI ══ */}
      {showTambahLeader&&(
        <div style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.45)',backdropFilter:'none',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShowTambahLeader(false);}}>
          <div style={{...G.card,padding:'28px',width:'500px',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(19,41,75,0.14)',animation:'cardPop 0.3s cubic-bezier(0.2,0,0,1) both'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <div style={{fontSize:'16px',fontWeight:700,color:'#13294b'}}>➕ Tambah {formLeader.area==='molding'?'Team Leader Molding':'Teknisi Non Molding'}</div>
              <button onClick={()=>setShowTambahLeader(false)} style={{background:'none',border:'none',color:'#5b6b80',fontSize:'20px',cursor:'pointer'}}>✕</button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
              {/* Area */}
              <div>
                <label style={G.lbl}>Area</label>
                <div style={{display:'flex',gap:'8px'}}>
                  {[{val:'molding',label:'🏭 Molding',color:'#4338ca'},{val:'nonmolding',label:'⚙️ Non Molding',color:'#0f766e'}].map(opt=>(
                    <button key={opt.val} onClick={()=>setFormLeader(f=>({...f,area:opt.val,aksen:opt.val==='molding'?'#0b5ed7':'#0f766e'}))} style={{flex:1,padding:'8px',borderRadius:'8px',border:`1px solid ${formLeader.area===opt.val?(opt.val==='molding'?'rgba(67,56,202,0.5)':'rgba(15,118,110,0.5)'):'#d9dee5'}`,background:formLeader.area===opt.val?(opt.val==='molding'?'rgba(67,56,202,0.15)':'rgba(15,118,110,0.15)'):'#f8f9fb',color:formLeader.area===opt.val?opt.color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Nama */}
              <div>
                <label style={G.lbl}>Nama Lengkap *</label>
                <input style={G.inp} value={formLeader.nama} onChange={e=>setFormLeader(f=>({...f,nama:e.target.value}))} placeholder="Contoh: TL Soother B2 / BUDI SANTOSO"/>
              </div>

              {/* Warna Aksen */}
              <div>
                <label style={G.lbl}>Warna Aksen</label>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {['#0b5ed7','#1e7e34','#c62828','#8a5a00','#6d28d9','#c2410c','#6d28d9','#0f766e','#0b5ed7','#6d28d9'].map(c=>(
                    <div key={c} onClick={()=>setFormLeader(f=>({...f,aksen:c}))} style={{width:'28px',height:'28px',borderRadius:'50%',background:c,cursor:'pointer',border:formLeader.aksen===c?`3px solid #fff`:'3px solid transparent',transition:'all 0.15s'}}/>
                  ))}
                  <input type="color" value={formLeader.aksen} onChange={e=>setFormLeader(f=>({...f,aksen:e.target.value}))} style={{width:'28px',height:'28px',borderRadius:'50%',border:'none',cursor:'pointer',background:'none',padding:0}}/>
                </div>
                <div style={{marginTop:'8px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'36px',height:'36px',borderRadius:'50%',background:`#ffffff`,border:`2px solid ${formLeader.aksen}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,color:formLeader.aksen}}>{autoInisial(formLeader.nama)}</div>
                  <span style={{fontSize:'11px',color:'#5b6b80'}}>Preview avatar</span>
                </div>
              </div>

              {/* Tambah Mesin */}
              <div>
                <label style={G.lbl}>Mesin Tanggung Jawab</label>
                <div style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
                  <input style={{...G.inp,flex:1}} value={formLeader.mesinInput} onChange={e=>setFormLeader(f=>({...f,mesinInput:e.target.value}))} placeholder="Ketik nama mesin..." onKeyDown={e=>{if(e.key==='Enter'&&formLeader.mesinInput.trim()){setFormLeader(f=>({...f,mesinList:[...f.mesinList,f.mesinInput.trim()],mesinInput:''}));}}}/>
                  <button onClick={()=>{if(formLeader.mesinInput.trim())setFormLeader(f=>({...f,mesinList:[...f.mesinList,f.mesinInput.trim()],mesinInput:''}));}} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.3)',borderRadius:'7px',padding:'8px 14px',color:'#0b5ed7',fontSize:'11px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>+ Tambah</button>
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                  {formLeader.mesinList.map((m,i)=>(
                    <div key={i} style={{background:`${formLeader.aksen}15`,border:`1px solid ${formLeader.aksen}40`,borderRadius:'20px',padding:'3px 10px',display:'flex',alignItems:'center',gap:'6px'}}>
                      <span style={{fontSize:'11px',color:'#13294b'}}>{m}</span>
                      <button onClick={()=>setFormLeader(f=>({...f,mesinList:f.mesinList.filter((_,j)=>j!==i)}))} style={{background:'none',border:'none',color:'#5b6b80',cursor:'pointer',fontSize:'12px',padding:0,lineHeight:1}}>✕</button>
                    </div>
                  ))}
                  {formLeader.mesinList.length===0&&<span style={{fontSize:'11px',color:'#8a97a8',fontStyle:'italic'}}>Belum ada mesin ditambahkan</span>}
                </div>
              </div>
            </div>

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setShowTambahLeader(false)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'9px 20px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
              <button onClick={()=>{
                if(!formLeader.nama)return showMsg('err','Nama wajib diisi!');
                const inisial=autoInisial(formLeader.nama);
                const newEntry={nama:formLeader.nama.toUpperCase(),inisial,warna:'#ffffff',aksen:formLeader.aksen,emoji:'⚙️',mesin:formLeader.mesinList};
                if(formLeader.area==='molding'){
                  const updated=[...moldingTLList,newEntry];
                  setMoldingTLList(updated);
                  try{localStorage.setItem('mcc_moldingTL',JSON.stringify(updated));}catch{}
                }else{
                  const updated=[...nonMoldingTeknisi,newEntry];
                  setNonMoldingTeknisi(updated as any);
                  try{localStorage.setItem('mcc_nonMoldingTeknisi',JSON.stringify(updated));}catch{}
                }
                setShowTambahLeader(false);
                showMsg('ok',`✅ ${formLeader.nama} berhasil ditambahkan & disimpan!`);
              }} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'9px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>✅ Simpan</button>
            </div>
          </div>
        </div>
      )}


      {/* ══ MODAL EDIT PART IN ══ */}
      {editPartIn&&(
        <div style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.45)',backdropFilter:'none',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setEditPartIn(null);}}>
          <div style={{...G.card,padding:'28px',width:'520px',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(19,41,75,0.14)',animation:'cardPop 0.3s cubic-bezier(0.2,0,0,1) both'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
              <div>
                <div style={{fontSize:'16px',fontWeight:700,color:'#13294b'}}>✏️ Edit Data Part IN</div>
                <div style={{fontSize:'11px',color:'#5b6b80',marginTop:'3px'}}>{editPartIn.nama_part}</div>
              </div>
              <button onClick={()=>setEditPartIn(null)} style={{background:'none',border:'none',color:'#5b6b80',fontSize:'20px',cursor:'pointer',lineHeight:1}}>✕</button>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
              <div style={{fontSize:'12px',lineHeight:1.5,color:'var(--mcc-text-muted)'}}>Data part (nama, rak, kategori, mesin pemakai) hanya bisa diubah di <b>Kelola part</b>. Di sini hanya data barang masuk.</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <div><label style={G.lbl}>Jumlah</label><input type="number" min={1} style={G.inp} value={editPartIn.jumlah_masuk||''} onChange={e=>setEditPartIn((p:any)=>({...p,jumlah_masuk:e.target.value}))}/></div>
                <div><label style={G.lbl}>Nomor DO</label><input style={G.inp} value={editPartIn.nomor_do||''} onChange={e=>setEditPartIn((p:any)=>({...p,nomor_do:e.target.value}))}/></div>
                <div><label style={G.lbl}>Nama Supplier</label><input style={G.inp} value={editPartIn.nama_supplier||''} onChange={e=>setEditPartIn((p:any)=>({...p,nama_supplier:e.target.value}))}/></div>
                <div><label style={G.lbl}>Merk barang</label><input style={G.inp} value={editPartIn.brand||''} onChange={e=>setEditPartIn((p:any)=>({...p,brand:e.target.value}))}/></div>
                <div><label style={G.lbl}>Kondisi</label><select style={{...G.inp,cursor:'pointer'}} value={editPartIn.kondisi||'Baik'} onChange={e=>setEditPartIn((p:any)=>({...p,kondisi:e.target.value}))}><option>Baik</option><option>Ada selisih jumlah</option><option>Barang rusak</option></select></div>
              </div>
              <div><label style={G.lbl}>Catatan</label><textarea style={{...G.inp,height:'60px',resize:'none' as const}} value={editPartIn.catatan||''} onChange={e=>setEditPartIn((p:any)=>({...p,catatan:e.target.value}))}/></div>
            </div>

            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setEditPartIn(null)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'9px 20px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
              <button onClick={async()=>{
                try{
                  const res=await fetch('/api/partin',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(editPartIn)});
                  const d=await res.json().catch(()=>({}));
                  if(!res.ok||!d.success){showMsg('err',d.error||'Gagal menyimpan perubahan');return;}
                  showMsg('ok',d.message||'✅ Data Part IN berhasil diupdate!');
                  setEditPartIn(null);
                  fetch('/api/partin').then(r=>r.json()).then(d=>{if(d.success)setHistoryPartIn(toArr(d.data));});
                  fetch('/api/parts').then(r=>r.json()).then(d=>{const arr=toArr(d.data??d);if(arr.length>0)setPartsList(arr);});
                }catch{
                  showMsg('err','Gagal terhubung ke server. Perubahan tidak disimpan.');
                }
              }} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'9px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>💾 Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden input cover mesin */}
      <input ref={mesinCoverRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
        const file=e.target.files?.[0];
        if(file&&editingCoverMesin){const reader=new FileReader();reader.onload=ev=>{setMesinCovers(prev=>({...prev,[editingCoverMesin]:ev.target?.result as string}));setEditingCoverMesin(null);};reader.readAsDataURL(file);}
        e.target.value='';
      }}/>

      {/* Modal Edit User */}
      {editUser&&(
        <div style={{position:'fixed',inset:0,background:'rgba(19,41,75,0.45)',backdropFilter:'none',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setEditUser(null);}}>
          <div style={{...G.card,padding:'28px',width:'480px',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 40px 100px rgba(19,41,75,0.14)',animation:'cardPop 0.3s cubic-bezier(0.2,0,0,1) both'}}>
            <div style={{fontSize:'16px',fontWeight:700,color:'#13294b',marginBottom:'20px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>✏️ Edit — {(editUser as any).nama}</span>
              <button onClick={()=>setEditUser(null)} style={{background:'none',border:'none',color:'#5b6b80',fontSize:'20px',cursor:'pointer',lineHeight:1}}>✕</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'14px',marginBottom:'20px'}}>
              <div><label style={G.lbl}>Nama</label><input style={G.inp} value={(editUser as any).nama} onChange={e=>setEditUser((u:any)=>u?{...u,nama:e.target.value}:null)}/></div>
              <div><label style={G.lbl}>Employee ID</label><input style={G.inp} value={(editUser as any).employee_id||''} onChange={e=>setEditUser((u:any)=>u?{...u,employee_id:e.target.value}:null)}/></div>
              <div><label style={G.lbl}>Role</label><select style={{...G.inp,cursor:'pointer'}} value={(editUser as any).role||'teknisi'} onChange={e=>setEditUser((u:any)=>u?{...u,role:e.target.value}:null)}>{opsiRole((editUser as any).role||'teknisi')}</select></div>
              {(editUser as any).role==='admin'&&<div><label style={G.lbl}>Password baru</label><input type="text" autoComplete="new-password" style={G.inp} value={(editUser as any).password_baru||''} onChange={e=>setEditUser((u:any)=>u?{...u,password_baru:e.target.value}:null)} placeholder="Kosongkan kalau tidak diganti"/></div>}
              <div><label style={G.lbl}>Bagian / Mesin (★ utama, ✓ tambahan)</label><PilihBagianMesin jenis={mesinJenisList} bagian={(editUser as any).bagian||''} nilai={(editUser as any).mesin_tambahan_ids??((editUser as any).mesin_tambahan||[]).map((m:any)=>m.id)} onUbah={(bg,ids)=>setEditUser((u:any)=>u?{...u,bagian:bg,mesin_tambahan_ids:ids}:null)}/></div>
              <div><label style={G.lbl}>Nomor Mesin</label><input style={G.inp} value={(editUser as any).nomor_mesin||''} onChange={e=>setEditUser((u:any)=>u?{...u,nomor_mesin:e.target.value}:null)} placeholder="Tampon #3..."/></div>
              <div><label style={G.lbl}>Gender</label><select style={{...G.inp,cursor:'pointer'}} value={(editUser as any).gender||'male'} onChange={e=>setEditUser((u:any)=>u?{...u,gender:e.target.value}:null)}><option value="male">👨 Laki-laki</option><option value="female">👩 Perempuan</option></select></div>
              <div><label style={G.lbl}>RFID</label><div style={{display:'flex',gap:'8px'}}><input style={{...G.inp,fontFamily:'inherit'}} value={(editUser as any).rfid_tag||''} onChange={e=>setEditUser((u:any)=>u?{...u,rfid_tag:e.target.value}:null)}/><button onClick={()=>setScanMode(true)} style={{background:'rgba(11,94,215,0.15)',border:'1px solid rgba(11,94,215,0.25)',borderRadius:'7px',padding:'8px 12px',color:'#0b5ed7',fontSize:'11px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>📛 Scan</button></div></div>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <input type="checkbox" checked={(editUser as any).is_active} onChange={e=>setEditUser((u:any)=>u?{...u,is_active:e.target.checked}:null)} style={{width:'16px',height:'16px',cursor:'pointer',accentColor:'#1e7e34'}}/>
                <span style={{fontSize:'12px',color:(editUser as any).is_active?'#1e7e34':'#c62828',fontWeight:600}}>{(editUser as any).is_active?'✅ Aktif':'❌ Nonaktif'}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button onClick={()=>setEditUser(null)} style={{background:'#f8f9fb',border:'1px solid #e6eaf0',borderRadius:'7px',padding:'9px 20px',color:'#5b6b80',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>Batal</button>
              <button onClick={handleUpdateUser} style={{background:'#0b5ed7',border:'none',borderRadius:'7px',padding:'9px 20px',color:'#fff',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>💾 Simpan</button>
            </div>
          </div>
        </div>
      )}

      <div style={{padding:'12px 24px',borderTop:'1px solid #e6eaf0',marginTop:'auto',position:'relative',zIndex:1}}>
        <span style={{fontSize:'10px',color:'#8a97a8'}}>PT Philips Industries Batam — MCC Spare Part System 2026</span>
      </div>

      {/* ===== Modal alasan penolakan (dipakai untuk laporan) ===== */}
      {rejectTarget!==null&&(
        <div role="dialog" aria-modal="true" aria-labelledby="reject-title" style={{position:'fixed',inset:0,zIndex:9000,background:'rgba(19,41,75,0.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}} onClick={()=>!rejecting&&setRejectTarget(null)}>
          <div className="mcc-fade-in" onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:'440px',background:'var(--mcc-surface)',borderRadius:'8px',border:'1px solid var(--mcc-border)',padding:'24px',display:'flex',flexDirection:'column',gap:'16px',color:'var(--mcc-text)'}}>
            <div>
              <h2 id="reject-title" style={{margin:0,fontSize:'20px',fontWeight:700}}>Tolak permintaan</h2>
              <p style={{margin:'4px 0 0',fontSize:'15px',color:'var(--mcc-text-muted)'}}>{(requests as any[]).find((r:any)=>r.id===rejectTarget)?.part_nama||'Part'}. Pilih alasan penolakan.</p>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {REJECT_REASONS.map(alasan=>(
                <label key={alasan} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',border:`1px solid ${rejectReason===alasan?'var(--mcc-blue)':'var(--mcc-border)'}`,borderRadius:'6px',cursor:'pointer',fontSize:'15px',background:rejectReason===alasan?'var(--mcc-blue-soft)':'transparent'}}>
                  <input type="radio" name="alasan-tolak" value={alasan} checked={rejectReason===alasan} onChange={()=>setRejectReason(alasan)}/>
                  {alasan}
                </label>
              ))}
            </div>
            {rejectReason==='Lainnya'&&(
              <input autoFocus value={rejectNote} onChange={e=>setRejectNote(e.target.value)} maxLength={90} placeholder="Tulis alasan singkat" aria-label="Alasan lainnya" style={G.inp}/>
            )}
            <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
              <button type="button" className="mcc-btn-secondary" disabled={rejecting} onClick={()=>setRejectTarget(null)}>Batal</button>
              <button type="button" disabled={!rejectReason||(rejectReason==='Lainnya'&&!rejectNote.trim())||rejecting} onClick={confirmReject}
                style={{height:'40px',padding:'0 16px',border:'none',borderRadius:'6px',background:'var(--mcc-danger)',color:'#ffffff',font:'inherit',fontSize:'15px',fontWeight:600,cursor:'pointer',opacity:(!rejectReason||(rejectReason==='Lainnya'&&!rejectNote.trim())||rejecting)?0.5:1}}>
                {rejecting?'Menyimpan...':'Tolak permintaan'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideDown{from{transform:translateY(-4px);opacity:0}to{transform:none;opacity:1}}
        @keyframes dropDown{from{transform:translateY(-4px);opacity:0}to{transform:none;opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pageSlideIn{from{transform:translateY(4px);opacity:0}to{transform:none;opacity:1}}
        @keyframes pageSlideOut{from{opacity:1}to{opacity:0}}
        @keyframes cardPop{from{transform:translateY(4px);opacity:0}to{transform:none;opacity:1}}
        @keyframes fadeInUp{from{transform:translateY(4px);opacity:0}to{transform:none;opacity:1}}
        @keyframes notifPop{from{transform:translateY(-4px);opacity:0}to{transform:none;opacity:1}}
        @keyframes notifPulse{0%,100%{transform:none}}
        @keyframes urgentPulse{0%,100%{background:rgba(198,40,40,0.06)}50%{background:rgba(198,40,40,0.12)}}
        @keyframes urgentBlink{0%,100%{opacity:1}50%{opacity:0.7}}
        @keyframes mccRakGlow{0%,100%{box-shadow:0 0 0 0 rgba(198,40,40,0.45);opacity:1}50%{box-shadow:0 0 0 4px rgba(198,40,40,0);opacity:0.75}}
        .mcc-rak-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#d32f2f;animation:mccRakGlow 2.4s ease-in-out infinite;}
        @keyframes mccRakSorot{0%,100%{box-shadow:0 0 0 0 rgba(11,94,215,0.45)}50%{box-shadow:0 0 0 6px rgba(11,94,215,0)}}
        @keyframes mccRakSorotUrgent{0%,100%{box-shadow:0 0 0 0 rgba(198,40,40,0.5)}50%{box-shadow:0 0 0 6px rgba(198,40,40,0)}}
        .mcc-rak-sorot{animation:mccRakSorot 2s ease-in-out infinite;}
        .mcc-rak-sorot-urgent{animation:mccRakSorotUrgent 1.4s ease-in-out infinite;}
        @media (prefers-reduced-motion: reduce){.mcc-rak-dot,.mcc-rak-sorot,.mcc-rak-sorot-urgent{animation:none;}}
        .mcc-admin input::placeholder,.mcc-admin textarea::placeholder{color:#8a97a8;}
        .mcc-admin select option{background:#ffffff;color:#13294b;}
        .mcc-admin input:focus,.mcc-admin select:focus,.mcc-admin textarea:focus{border-color:var(--mcc-blue)!important;box-shadow:0 0 0 3px var(--mcc-blue-soft);}
        .mcc-admin button{transition:background-color var(--mcc-dur-fast) var(--mcc-ease),border-color var(--mcc-dur-fast) var(--mcc-ease),color var(--mcc-dur-fast) var(--mcc-ease);}
        .mcc-nav-item{display:flex;align-items:center;gap:12px;height:40px;padding:0 12px;border:none;border-radius:6px;background:transparent;color:#dbe3ee;font:inherit;font-size:15px;text-align:left;cursor:pointer;}
        .mcc-nav-item:hover{background:rgba(255,255,255,0.07);color:#ffffff;}
        .mcc-nav-item.is-active{background:var(--mcc-blue);color:#ffffff;font-weight:600;}
        .mcc-nav-item:focus-visible,.mcc-profile-btn:focus-visible{outline:2px solid #ffffff;outline-offset:-2px;}
        .mcc-profile-btn{width:100%;display:flex;align-items:center;gap:12px;padding:12px 8px 4px;border:none;border-top:1px solid #2a4066;background:transparent;color:#dbe3ee;font:inherit;cursor:pointer;}
        .mcc-profile-btn:hover{color:#ffffff;}
        .mcc-icon-btn{width:40px;height:40px;border:1px solid var(--mcc-border);border-radius:6px;background:var(--mcc-surface);color:var(--mcc-text);display:flex;align-items:center;justify-content:center;cursor:pointer;font:inherit;}
        .mcc-icon-btn:hover{background:#f3f5f8;}
        .mcc-menu-row{width:100%;display:block;padding:11px 16px;border:none;border-bottom:1px solid var(--mcc-border);background:transparent;color:var(--mcc-text);font:inherit;font-size:15px;text-align:left;cursor:pointer;}
        .mcc-menu-row:last-child{border-bottom:none;}
        .mcc-menu-row:hover{background:#f3f5f8;}
        .mcc-table{width:100%;border-collapse:collapse;font-size:15px;font-variant-numeric:tabular-nums;}
        .mcc-table th{text-align:left;padding:10px 12px;font-size:13px;font-weight:600;color:var(--mcc-text-muted);border-bottom:1px solid #e6eaf0;white-space:nowrap;}
        .mcc-table td{padding:12px;border-bottom:1px solid #eef1f5;color:var(--mcc-text);vertical-align:middle;}
        .mcc-table th:first-child,.mcc-table td:first-child{padding-left:24px;}
        .mcc-table th:last-child,.mcc-table td:last-child{padding-right:24px;}
        .mcc-table tbody tr:last-child td{border-bottom:none;}
        .mcc-badge{display:inline-block;padding:2px 10px;border-radius:4px;font-size:13px;font-weight:600;line-height:1.5;white-space:nowrap;}
        .mcc-badge-warning{background:var(--mcc-warning-soft);color:var(--mcc-warning);}
        .mcc-badge-success{background:var(--mcc-success-soft);color:var(--mcc-success);}
        .mcc-badge-danger{background:var(--mcc-danger-soft);color:var(--mcc-danger);}
        .mcc-badge-info{background:var(--mcc-blue-soft);color:var(--mcc-blue);}
        .mcc-badge-neutral{background:#eef1f5;color:var(--mcc-text-muted);}
        .mcc-link-btn{border:none;background:none;padding:0;color:var(--mcc-blue);font:inherit;font-size:14px;font-weight:600;cursor:pointer;}
        .mcc-link-btn:hover{color:var(--mcc-blue-hover);text-decoration:underline;}
        .mcc-btn-primary{height:40px;padding:0 16px;border:none;border-radius:6px;background:var(--mcc-blue);color:#ffffff;font:inherit;font-size:15px;font-weight:600;cursor:pointer;}
        .mcc-btn-primary:hover{background:var(--mcc-blue-hover);}
        .mcc-btn-secondary{height:40px;padding:0 16px;border:1px solid var(--mcc-border);border-radius:6px;background:var(--mcc-surface);color:var(--mcc-text);font:inherit;font-size:15px;font-weight:600;cursor:pointer;}
        .mcc-btn-secondary:hover{background:#f3f5f8;}
      `}</style>
      </main>
    </div>
  );
}