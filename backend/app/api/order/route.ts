import { NextRequest, NextResponse } from 'next/server';
const { sql, getDbConfig } = require('@/src/config/db.js');

/* =====================================================================
   API Order spare part (alur status ala Shopee). Butuh migrasi 07.
   GET  /api/order                 -> semua order + item + riwayat status
   POST /api/order { aksi, ... }
     buat   { items:[{spare_part_id, qty}], catatan, oleh }
     maju   { id, oleh, supplier_nama?, harga?:{[item_id]:number}, nomor_pr?, nomor_po?, eta?, keterangan? }
     batal  { id, alasan, oleh }
     terima { id, nomor_do, oleh, items:[{item_id, qty_diterima}] }  -> stok bertambah + tercatat di Part In
   ===================================================================== */

const URUTAN = ['request', 'approval', 'submit', 'menunggu_buyer', 'pilih_supplier', 'pr', 'admin_order', 'po', 'selesai'] as const;
const str = (v: any, max: number) => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const ok = (message: string, extra: any = {}) => NextResponse.json({ success: true, message, ...extra });
const bad = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

export async function GET() {
  try {
    const pool = await sql.connect(getDbConfig());
    const o = await pool.request().query(`SELECT TOP 500 * FROM OrderSparePart ORDER BY created_at DESC`);
    const ids = o.recordset.map((r: any) => r.id);
    let items: any[] = [], logs: any[] = [];
    if (ids.length) {
      const daftar = ids.join(',');   // angka dari database sendiri, aman
      items = (await pool.request().query(`
        SELECT i.*, ISNULL(sp.stok_saat_ini,0) AS stok_saat_ini, ISNULL(sp.reorder_point,0) AS reorder_point, LTRIM(RTRIM(sp.nomor_bin)) AS nomor_bin
        FROM OrderSparePartItem i LEFT JOIN SpareParts sp ON sp.id = i.spare_part_id
        WHERE i.order_id IN (${daftar}) ORDER BY i.id`)).recordset;
      logs = (await pool.request().query(`SELECT * FROM OrderStatusLog WHERE order_id IN (${daftar}) ORDER BY waktu, id`)).recordset;
    }
    const data = o.recordset.map((r: any) => ({
      ...r,
      items: items.filter(i => i.order_id === r.id),
      log: logs.filter(l => l.order_id === r.id),
    }));
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const pool = await sql.connect(getDbConfig());
    const oleh = str(b.oleh, 100) || 'Admin';

    if (b.aksi === 'buat') {
      const items = (Array.isArray(b.items) ? b.items : [])
        .map((x: any) => ({ id: Number(x.spare_part_id), qty: parseInt(x.qty) }))
        .filter((x: any) => x.id > 0 && x.qty > 0);
      if (!items.length) return bad('Keranjang order masih kosong');
      if (items.length > 200) return bad('Terlalu banyak item dalam satu order');

      const trx = new sql.Transaction(pool);
      await trx.begin();
      try {
        const head = await new sql.Request(trx).input('cat', sql.NVarChar(500), str(b.catatan, 500)).input('oleh', sql.NVarChar(100), oleh)
          .query(`INSERT INTO OrderSparePart (status, catatan, dibuat_oleh) OUTPUT INSERTED.id VALUES ('request', @cat, @oleh)`);
        const id = head.recordset[0].id;
        await new sql.Request(trx).input('id', sql.Int, id)
          .query(`UPDATE OrderSparePart SET nomor_order = 'ORD-' + CAST(YEAR(GETDATE()) AS VARCHAR(4)) + '-' + RIGHT('0000' + CAST(@id AS VARCHAR(10)), 4) WHERE id = @id`);
        for (const it of items) {
          const ins = await new sql.Request(trx).input('oid', sql.Int, id).input('pid', sql.Int, it.id).input('qty', sql.Int, it.qty)
            .query(`INSERT INTO OrderSparePartItem (order_id, spare_part_id, nama_part, kode_12nc, qty)
                    SELECT @oid, id, nama_part, kode_12nc, @qty FROM SpareParts WHERE id = @pid`);
          if (!ins.rowsAffected[0]) throw new Error(`Part id ${it.id} tidak ditemukan`);
        }
        await new sql.Request(trx).input('id', sql.Int, id).input('oleh', sql.NVarChar(100), oleh)
          .query(`INSERT INTO OrderStatusLog (order_id, status, keterangan, oleh) VALUES (@id, 'request', N'Order dibuat', @oleh)`);
        await trx.commit();
        return ok('Order dibuat, menunggu persetujuan', { id });
      } catch (e) { await trx.rollback(); throw e; }
    }

    const id = Number(b.id);
    if (!id) return bad('Order tidak valid');
    const cur = await pool.request().input('id', sql.Int, id).query(`SELECT status, supplier_nama, nomor_po FROM OrderSparePart WHERE id = @id`);
    if (!cur.recordset.length) return bad('Order tidak ditemukan');
    const status: string = cur.recordset[0].status;
    if (status === 'selesai' || status === 'batal') return bad('Order ini sudah ditutup');

    if (b.aksi === 'batal') {
      const alasan = str(b.alasan, 200);
      if (!alasan) return bad('Alasan pembatalan wajib diisi');
      await pool.request().input('id', sql.Int, id).input('al', sql.NVarChar(200), alasan).input('oleh', sql.NVarChar(100), oleh).query(`
        UPDATE OrderSparePart SET status='batal', alasan_batal=@al, updated_at=GETDATE() WHERE id=@id;
        INSERT INTO OrderStatusLog (order_id, status, keterangan, oleh) VALUES (@id, 'batal', @al, @oleh);`);
      return ok('Order dibatalkan');
    }

    if (b.aksi === 'maju') {
      const idx = URUTAN.indexOf(status as any);
      const ke = URUTAN[idx + 1];
      if (!ke || ke === 'selesai') return bad('Gunakan "Terima barang" untuk menyelesaikan order');
      const ket: string[] = [];
      const trx = new sql.Transaction(pool);
      await trx.begin();
      try {
        const rq = new sql.Request(trx).input('id', sql.Int, id).input('ke', sql.VarChar(20), ke);
        let set = `status=@ke, updated_at=GETDATE()`;
        if (ke === 'pilih_supplier') {
          const sup = str(b.supplier_nama, 100);
          if (!sup) throw new Error('Nama supplier wajib diisi');
          rq.input('sup', sql.NVarChar(100), sup); set += `, supplier_nama=@sup`; ket.push(`Supplier: ${sup}`);
          const harga = b.harga && typeof b.harga === 'object' ? b.harga : {};
          for (const [itemId, h] of Object.entries(harga)) {
            const n = Number(h);
            if (!(n >= 0)) continue;
            await new sql.Request(trx).input('iid', sql.Int, Number(itemId)).input('oid', sql.Int, id).input('h', sql.Decimal(18, 2), n)
              .query(`UPDATE OrderSparePartItem SET harga_satuan=@h WHERE id=@iid AND order_id=@oid`);
          }
        }
        if (ke === 'pr') {
          const pr = str(b.nomor_pr, 50); if (!pr) throw new Error('Nomor PR wajib diisi');
          rq.input('pr', sql.VarChar(50), pr); set += `, nomor_pr=@pr`; ket.push(`PR: ${pr}`);
        }
        if (ke === 'po') {
          const po = str(b.nomor_po, 50); if (!po) throw new Error('Nomor PO wajib diisi');
          rq.input('po', sql.VarChar(50), po); set += `, nomor_po=@po`; ket.push(`PO: ${po}`);
          if (b.eta) { rq.input('eta', sql.Date, new Date(b.eta)); set += `, eta=@eta`; ket.push(`Perkiraan tiba: ${b.eta}`); }
        }
        const k = str(b.keterangan, 200); if (k) ket.push(k);
        await rq.query(`UPDATE OrderSparePart SET ${set} WHERE id=@id AND status='${status}'`);
        await new sql.Request(trx).input('id', sql.Int, id).input('ke', sql.VarChar(20), ke)
          .input('ket', sql.NVarChar(300), ket.join(' · ') || null).input('oleh', sql.NVarChar(100), oleh)
          .query(`INSERT INTO OrderStatusLog (order_id, status, keterangan, oleh) VALUES (@id, @ke, @ket, @oleh)`);
        await trx.commit();
      } catch (e: any) { await trx.rollback(); return bad(e.message); }
      return ok('Status order diperbarui');
    }

    if (b.aksi === 'terima') {
      if (status !== 'po') return bad('Barang hanya bisa diterima setelah status PO');
      const doNo = str(b.nomor_do, 50);
      const terima = (Array.isArray(b.items) ? b.items : [])
        .map((x: any) => ({ item: Number(x.item_id), qty: Math.max(0, parseInt(x.qty_diterima) || 0) }));
      if (!terima.some((x: any) => x.qty > 0)) return bad('Isi jumlah barang yang diterima');
      const trx = new sql.Transaction(pool);
      await trx.begin();
      try {
        const sup = cur.recordset[0].supplier_nama;
        const s = await new sql.Request(trx).input('n', sql.VarChar(100), sup || '')
          .query(`SELECT TOP 1 id FROM Suppliers WHERE LOWER(LTRIM(RTRIM(nama_supplier))) = LOWER(LTRIM(RTRIM(@n)))`);
        const supplierId = s.recordset[0]?.id ?? null;
        let total = 0;
        for (const t of terima) {
          const it = await new sql.Request(trx).input('iid', sql.Int, t.item).input('oid', sql.Int, id)
            .query(`SELECT spare_part_id FROM OrderSparePartItem WHERE id=@iid AND order_id=@oid`);
          if (!it.recordset.length) continue;
          await new sql.Request(trx).input('iid', sql.Int, t.item).input('q', sql.Int, t.qty)
            .query(`UPDATE OrderSparePartItem SET qty_diterima=@q WHERE id=@iid`);
          if (t.qty <= 0) continue;
          const pid = it.recordset[0].spare_part_id;
          total += t.qty;
          await new sql.Request(trx).input('pid', sql.Int, pid).input('q', sql.Int, t.qty).input('sid', sql.Int, supplierId)
            .input('do', sql.VarChar(50), doNo).input('oid', sql.Int, id)
            .input('cat', sql.VarChar(500), `Dari order #${id}${cur.recordset[0].nomor_po ? ` / PO ${cur.recordset[0].nomor_po}` : ''}`)
            .query(`INSERT INTO PartIn (spare_part_id, supplier_id, admin_id, jumlah_masuk, nomor_do, kondisi, catatan, tanggal_masuk, order_id)
                    VALUES (@pid, @sid, 1, @q, @do, 'Baik', @cat, GETDATE(), @oid);
                    UPDATE SpareParts SET stok_saat_ini = ISNULL(stok_saat_ini,0) + @q, updated_at = GETDATE() WHERE id = @pid;`);
        }
        await new sql.Request(trx).input('id', sql.Int, id).input('do', sql.VarChar(50), doNo).input('oleh', sql.NVarChar(100), oleh)
          .input('ket', sql.NVarChar(300), `Barang diterima: ${total} pcs${doNo ? ` · DO ${doNo}` : ''}`)
          .query(`UPDATE OrderSparePart SET status='selesai', nomor_do=@do, updated_at=GETDATE() WHERE id=@id;
                  INSERT INTO OrderStatusLog (order_id, status, keterangan, oleh) VALUES (@id, 'selesai', @ket, @oleh);`);
        await trx.commit();
        return ok(`Barang diterima, stok bertambah ${total} pcs`);
      } catch (e) { await trx.rollback(); throw e; }
    }

    return bad('Aksi tidak dikenal');
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
