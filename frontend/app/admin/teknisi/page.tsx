'use client';

import { useState, useEffect } from 'react';

type User = {
  id: number;
  nama: string;
  employee_id: string;
  role: string;
  rfid_tag: string | null;
  is_active: boolean;
  created_at: string;
};

export default function ManajemenTeknisi() {
  const [users, setUsers]         = useState<User[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editUser, setEditUser]   = useState<User | null>(null);
  const [scanMode, setScanMode]   = useState(false);
  const [msg, setMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    nama: '', employee_id: '', role: 'teknisi', rfid_tag: '', password: ''
  });

  useEffect(() => { fetchUsers(); }, []);

  // Listen RFID scan saat scanMode aktif
  useEffect(() => {
    if (!scanMode) return;
    let buf = '';
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (buf.trim()) {
          setForm(f => ({ ...f, rfid_tag: buf.trim() }));
          setScanMode(false);
          showMsg('ok', `RFID berhasil di-scan: ${buf.trim()}`);
        }
        buf = '';
      } else if (e.key.length === 1) {
        buf += e.key;
        clearTimeout(timer);
        timer = setTimeout(() => { buf = ''; }, 500);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(timer); };
  }, [scanMode]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teknisi');
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch { showMsg('err', 'Gagal mengambil data'); }
    setLoading(false);
  };

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSubmit = async () => {
    if (!form.nama || !form.employee_id) return showMsg('err', 'Nama dan Employee ID wajib diisi!');
    try {
      const res = await fetch('/api/teknisi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        showMsg('ok', data.message);
        setShowForm(false);
        setForm({ nama: '', employee_id: '', role: 'teknisi', rfid_tag: '', password: '' });
        fetchUsers();
      } else showMsg('err', data.error);
    } catch { showMsg('err', 'Gagal menyimpan data'); }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    try {
      const res = await fetch('/api/teknisi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editUser.id, nama: editUser.nama, rfid_tag: editUser.rfid_tag, is_active: editUser.is_active }),
      });
      const data = await res.json();
      if (data.success) { showMsg('ok', data.message); setEditUser(null); fetchUsers(); }
      else showMsg('err', data.error);
    } catch { showMsg('err', 'Gagal update data'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Nonaktifkan user ini?')) return;
    try {
      const res = await fetch('/api/teknisi', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) { showMsg('ok', data.message); fetchUsers(); }
      else showMsg('err', data.error);
    } catch { showMsg('err', 'Gagal nonaktifkan'); }
  };

  const roleColor = (role: string) => {
    if (role === 'admin') return { bg: '#0d2240', color: '#4d9fff' };
    if (role === 'teknisi') return { bg: '#0d2e1a', color: '#2ecc71' };
    return { bg: '#2e1a0d', color: '#f39c12' };
  };

  const inputStyle = { width: '100%', background: '#111d35', border: '1px solid #1e2a45', borderRadius: '6px', padding: '8px 12px', color: '#e8eaf0', fontSize: '12px', outline: 'none', boxSizing: 'border-box' as const };
  const labelStyle = { fontSize: '10px', fontWeight: 700 as const, color: '#5a7ab5', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: '5px', display: 'block' as const };

  return (
    <div style={{ background: '#0a0f1e', minHeight: '100vh', color: '#e8eaf0', fontFamily: "'Barlow', sans-serif", padding: '24px' }}>
      <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#0066cc', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Admin Store MCC</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '24px', fontWeight: 700, color: '#fff' }}>👥 Manajemen Pengguna & RFID</div>
          <div style={{ fontSize: '11px', color: '#5a7ab5' }}>Daftarkan teknisi dan assign RFID badge</div>
        </div>
        <button onClick={() => { setShowForm(true); setEditUser(null); }} style={{ background: '#0066cc', border: 'none', borderRadius: '6px', padding: '10px 20px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          + Tambah Pengguna
        </button>
      </div>

      {/* Notifikasi */}
      {msg && (
        <div style={{ background: msg.type === 'ok' ? '#0d2e1a' : '#2e0d0d', border: `1px solid ${msg.type === 'ok' ? '#2ecc71' : '#a32d2d'}`, borderRadius: '8px', padding: '10px 16px', color: msg.type === 'ok' ? '#2ecc71' : '#f09595', fontSize: '12px', marginBottom: '16px' }}>
          {msg.type === 'ok' ? '✅' : '❌'} {msg.text}
        </div>
      )}

      {/* Scan mode banner */}
      {scanMode && (
        <div style={{ background: '#0d2240', border: '2px solid #0066cc', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px', animation: 'pulse 1s infinite' }}>
          <span style={{ fontSize: '28px' }}>📛</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4d9fff' }}>Tempelkan Badge RFID ke Reader...</div>
            <div style={{ fontSize: '11px', color: '#5a7ab5' }}>Sistem sedang menunggu input dari RFID reader</div>
          </div>
          <button onClick={() => setScanMode(false)} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #1e2a45', borderRadius: '5px', padding: '5px 12px', color: '#7a8fb5', fontSize: '11px', cursor: 'pointer' }}>Batal</button>
        </div>
      )}

      {/* Form Tambah */}
      {showForm && (
        <div style={{ background: '#0d1529', border: '1px solid #1e2a45', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>Tambah Pengguna Baru</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={labelStyle}>Nama Lengkap *</label>
              <input style={inputStyle} value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="Nama lengkap..." />
            </div>
            <div>
              <label style={labelStyle}>Employee ID *</label>
              <input style={inputStyle} value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} placeholder="EMP-001" />
            </div>
            <div>
              <label style={labelStyle}>Role *</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="teknisi">Teknisi</option>
                <option value="admin">Admin</option>
                <option value="buyer">Buyer</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" style={inputStyle} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Password login..." />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>RFID Tag</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input style={{ ...inputStyle, fontFamily: 'monospace' }} value={form.rfid_tag} onChange={e => setForm(f => ({ ...f, rfid_tag: e.target.value }))} placeholder="Tap badge atau ketik manual..." />
                <button onClick={() => setScanMode(true)} style={{ background: '#0d2240', border: '1px solid #0066cc', borderRadius: '6px', padding: '8px 16px', color: '#4d9fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  📛 Scan Badge
                </button>
              </div>
              <div style={{ fontSize: '10px', color: '#3a4f75', marginTop: '4px' }}>Klik "Scan Badge" lalu tempelkan badge RFID ke reader, atau ketik ID manual</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: '1px solid #1e2a45', borderRadius: '6px', padding: '8px 18px', color: '#7a8fb5', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Batal</button>
            <button onClick={handleSubmit} style={{ background: '#0066cc', border: 'none', borderRadius: '6px', padding: '8px 18px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Simpan Pengguna</button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0d1529', border: '1px solid #1e2a45', borderRadius: '14px', padding: '24px', width: '480px' }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '18px' }}>✏️ Edit — {editUser.nama}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={labelStyle}>Nama</label>
                <input style={inputStyle} value={editUser.nama} onChange={e => setEditUser(u => u ? { ...u, nama: e.target.value } : null)} />
              </div>
              <div>
                <label style={labelStyle}>RFID Tag</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input style={{ ...inputStyle, fontFamily: 'monospace' }} value={editUser.rfid_tag || ''} onChange={e => setEditUser(u => u ? { ...u, rfid_tag: e.target.value } : null)} placeholder="Tap badge atau ketik..." />
                  <button onClick={() => { setScanMode(true); }} style={{ background: '#0d2240', border: '1px solid #0066cc', borderRadius: '6px', padding: '8px 12px', color: '#4d9fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>📛 Scan</button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ ...labelStyle, margin: 0 }}>Status Aktif</label>
                <input type="checkbox" checked={editUser.is_active} onChange={e => setEditUser(u => u ? { ...u, is_active: e.target.checked } : null)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <span style={{ fontSize: '11px', color: editUser.is_active ? '#2ecc71' : '#e24b4a' }}>{editUser.is_active ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditUser(null)} style={{ background: 'transparent', border: '1px solid #1e2a45', borderRadius: '6px', padding: '8px 16px', color: '#7a8fb5', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Batal</button>
              <button onClick={handleUpdate} style={{ background: '#0066cc', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Simpan Perubahan</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabel users */}
      <div style={{ background: '#0d1529', border: '1px solid #1e2a45', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111d35' }}>
              {['Nama', 'Employee ID', 'Role', 'RFID Tag', 'Status', 'Aksi'].map(h => (
                <th key={h} style={{ fontSize: '9px', fontWeight: 700, color: '#3a4f75', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #1e2a45' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#3a4f75', fontSize: '12px' }}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#3a4f75', fontSize: '12px' }}>Belum ada data pengguna</td></tr>
            ) : users.map(u => {
              const rc = roleColor(u.role);
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #0d1529' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#111d35')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#c5cedf' }}>{u.nama}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '11px', color: '#5a7ab5', fontFamily: 'monospace' }}>{u.employee_id}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: rc.bg, color: rc.color, fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {u.rfid_tag ? (
                      <span style={{ background: '#0d2240', color: '#4d9fff', fontSize: '10px', fontFamily: 'monospace', padding: '3px 8px', borderRadius: '5px' }}>📛 {u.rfid_tag}</span>
                    ) : (
                      <span style={{ color: '#3a4f75', fontSize: '10px' }}>— Belum didaftarkan</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: u.is_active ? '#0d2e1a' : '#2e0d0d', color: u.is_active ? '#2ecc71' : '#e24b4a', fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '10px' }}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setEditUser(u)} style={{ background: '#0d2240', border: '1px solid #0066cc22', borderRadius: '5px', padding: '4px 10px', color: '#4d9fff', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                      {u.is_active && <button onClick={() => handleDelete(u.id)} style={{ background: '#2e0d0d', border: '1px solid #a32d2d22', borderRadius: '5px', padding: '4px 10px', color: '#e24b4a', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>Nonaktifkan</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}`}</style>
    </div>
  );
}