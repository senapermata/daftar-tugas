# Dashboard Tugas Kuliah — versi PWA

## Deploy ke GitHub Pages
1. Ekstrak ZIP ini.
2. Unggah/replace file proyek di repository GitHub dengan seluruh isi folder ini (termasuk `manifest.json`, `sw.js`, dan folder `icons`).
3. Commit perubahan. Pastikan GitHub Pages aktif pada branch/folder yang benar.
4. Buka URL GitHub Pages melalui HTTPS. Tunggu beberapa detik dan refresh jika perlu.

## Pasang sebagai aplikasi
- Android/Chrome: buka website, tekan menu ⋮, lalu pilih **Install app** atau **Tambahkan ke layar utama**.
- iPhone/Safari: tekan tombol Share, lalu **Add to Home Screen**.
- Desktop Chrome/Edge: gunakan ikon install di address bar jika tersedia, atau menu browser.

## Catatan offline
Halaman utama, CSS, JavaScript, manifest, dan ikon disimpan untuk penggunaan offline setelah website pertama kali berhasil dibuka saat online. Data tugas disimpan menggunakan localStorage pada browser/perangkat masing-masing, bukan disinkronkan otomatis antarperangkat. Fitur yang mengambil data dari API/kutipan online memerlukan internet.
