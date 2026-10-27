# Sistem Yuran

Sistem kutipan yuran sekolah menggunakan **Google Apps Script + Google Sheets**, dengan tema *Dark Luxury* (hitam & emas).

Fasa 1 (siap): **Panel Admin**. Fasa seterusnya: halaman ibu bapa.

## Pautan

Satu web app, dua pautan:

| Untuk | Pautan |
|---|---|
| Ibu bapa | `https://script.google.com/macros/s/XXXX/exec` |
| Admin | `https://script.google.com/macros/s/XXXX/exec?page=admin` |

Pautan ibu bapa boleh dikongsi dalam grup WhatsApp atau dijadikan kod QR. Pautan admin simpan untuk admin sahaja (tetap perlu log masuk).

## Ciri admin

1. **Log masuk:** e-mel + kata laluan. Disekat 15 minit selepas 5 cubaan gagal.
2. **Dashboard:** kutipan tahun/bulan, baki hutang, kadar bayaran, carta trend.
3. **Senarai Pelajar:** tapis kelas/tahun/cawangan, profil dan rekod 12 bulan.
4. **Rekod Transaksi:** sahkan atau tolak bukti bayaran. Resit rasmi dijana automatik.
5. **Matrix Bayaran:** pelajar × bulan, muat turun Excel/PDF.
6. **Yuran Lain-Lain:** caj tambahan kepada pelajar terpilih.
7. **Database Pelajar:** tambah/edit/padam, pilih kolum untuk eksport.
8. **Database Guru**
9. **Urus Admin:** Super Admin atau Admin yang dihadkan kepada satu cawangan.
10. **Log Masuk:** audit log masuk berjaya/gagal.
11. **Tetapan:** yuran bulanan (lalai RM60), bulan dikenakan, maklumat bank & sekolah.

Bil bulanan dikira automatik: setiap bulan yang dikenakan (dari tarikh daftar pelajar hingga bulan semasa) yang belum dibayar dikira sebagai hutang.

## Cara pasang

1. Buat **Google Sheet** baharu (contoh: "Sistem Yuran").
2. Buka **Extensions → Apps Script**.
3. Salin semua fail dalam folder `apps-script/` ke projek itu:
   - Fail `.js` → buat fail **Script** dengan nama sama (tanpa `.js`, contoh `Core`).
   - Fail `.html` → buat fail **HTML** dengan nama sama (contoh `Admin`, `Styles`).
   - `appsscript.json` → Project Settings → tanda "Show appsscript.json", kemudian ganti isinya.
4. Pilih fungsi **`setup`** dan tekan **Run**. Benarkan akses bila diminta.
   E-mel dan kata laluan Super Admin pertama akan dipaparkan dalam **Execution log**.
5. (Pilihan) Jalankan **`isiDataDemo`** untuk cuba dengan 30 pelajar contoh.
6. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Buka pautan + `?page=admin`, log masuk dan tukar kata laluan.

Selepas itu menu **Sistem Yuran** juga muncul dalam Google Sheet (setup, data demo, reset kata laluan Super Admin).

> Pengguna `clasp` boleh `clasp push` terus dari folder `apps-script/`.

## Pembangunan

```bash
npm test          # uji logik yuran, login, skop cawangan
npm run preview   # bina dist/preview.html dengan data demo
```

Preview boleh dibuka terus dalam pelayar. Log masuk: `admin@demo.my` / `demo1234`
(atau `timur@demo.my` untuk admin cawangan).
