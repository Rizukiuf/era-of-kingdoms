# Era of Kingdoms — v1.0.0 (prototipe)

Game strategi perang real-time bergaya *Age of Empires* yang berjalan sepenuhnya di browser.
8 peradaban, 4 zaman, lawan komputer dengan 4 tingkat kesulitan, tutorial, simpan/muat, dan 7 bahasa
(Inggris, Indonesia, Spanyol, Prancis, Jerman, Portugis, Jepang).

Tidak ada server, database, atau pustaka pihak ketiga. Grafis digambar dengan Canvas 2D, suara dan
musik disintesis dengan Web Audio API. Seluruh game terkumpul menjadi satu file `index.html` (±510 KB).

---

## 1. Isi paket

```
era-of-kingdoms/
├── index.html            ← GAME SIAP MAIN (hasil build). Cukup file ini untuk bermain/hosting.
├── README.md             ← dokumen ini
├── AGENTS.md             ← panduan kerja untuk AI agent (Claude Code, dll.)
├── .github/              ← CI (uji otomatis di GitHub), template issue & pull request
├── build.py              ← skrip build (Python 3): menggabungkan src/ menjadi index.html
├── build.mjs             ← skrip build alternatif (Node.js), hasilnya identik
├── src/                  ← SOURCE CODE (yang Anda ubah saat mengembangkan)
│   ├── shell.html        ← HTML, CSS, kerangka HUD
│   ├── data.js           ← data game: unit, bangunan, teknologi, peradaban
│   ├── util.js           ← matematika, RNG, noise, pathfinding A*
│   ├── i18n_ui.js        ← fungsi terjemahan t()/setLang() + teks antarmuka
│   ├── map.js            ← generator peta
│   ├── sim.js            ← simulasi inti
│   ├── cmd.js            ← perintah pemain/AI
│   ├── ai.js             ← lawan komputer
│   ├── art_units.js      ← tekstur medan + gambar unit
│   ├── art_bld.js        ← gambar bangunan, sumber daya, ikon
│   ├── render.js         ← renderer isometrik, kabut perang, peta mini
│   ├── i18n_game.js      ← nama & deskripsi konten game, panduan, tutorial
│   ├── ui.js             ← menu, HUD, panel perintah, input
│   ├── audio.js          ← efek suara & musik generatif
│   └── main.js           ← siklus game, loop utama, simpan/muat
└── tools/
    ├── sim-test.mjs      ← uji simulasi AI vs AI tanpa browser (tanpa instalasi apa pun)
    └── browser-smoke.mjs ← uji otomatis di browser (opsional, butuh Playwright)
```

---

## 2. Bermain offline (paling mudah)

1. Ekstrak file zip.
2. Klik dua kali **`index.html`**. Game terbuka di browser (Chrome, Edge, Firefox, atau Safari versi baru).
3. Selesai. Tidak perlu internet dan tidak perlu instalasi.

Catatan:
- **Font.** Saat online, game memuat dua font dari Google Fonts. Saat offline, game otomatis memakai font
  cadangan (serif dan sans-serif bawaan sistem). Tampilannya sedikit berbeda, permainannya sama.
- **Simpanan (save).** Disimpan di penyimpanan browser (localStorage), bukan di file. Simpanan hanya ada di
  browser dan perangkat yang sama. Menghapus data situs atau memakai mode penyamaran akan menghapusnya.
- Jika simpanan tidak tersimpan saat dibuka langsung dari file (beberapa browser membatasi penyimpanan untuk
  `file://`), gunakan server lokal di bagian 3.
- Untuk ponsel, cara paling praktis adalah hosting online (bagian 4) atau server lokal lewat Wi-Fi (bagian 3).

---

## 3. Bermain lewat server lokal (opsional)

Berguna agar penyimpanan selalu berfungsi, atau untuk memainkan game dari ponsel di jaringan Wi-Fi yang sama.

Buka terminal / Command Prompt di folder `era-of-kingdoms`, lalu jalankan **salah satu**:

```bash
python -m http.server 8000      # Python 3 (di Windows bisa juga: py -m http.server 8000)
npx serve .                     # Node.js
```

Lalu buka **http://localhost:8000** di browser.

Dari ponsel/tablet di Wi-Fi yang sama: buka `http://<IP-komputer-Anda>:8000`
(cari IP dengan `ipconfig` di Windows atau `ifconfig` / `ip addr` di macOS/Linux, misalnya `192.168.1.5`).
Jika tidak bisa terhubung, izinkan Python/Node di firewall komputer.

---

## 4. Online / hosting gratis

Game ini adalah situs statis: cukup unggah `index.html`. Tidak perlu server khusus atau backend.

### A. Netlify Drop — tercepat, tanpa akun
1. Buka **https://app.netlify.com/drop**.
2. Seret folder `era-of-kingdoms` (atau file zip-nya) ke halaman itu.
3. Beberapa detik kemudian Anda mendapat alamat seperti `https://nama-acak.netlify.app`.
4. Daftar akun gratis lalu *claim* situs tersebut agar tersimpan di dashboard dan bisa diperbarui.
   Untuk memperbarui: buka situsnya di dashboard → tab **Deploys** → seret folder versi baru.

### B. GitHub Pages — gratis, cocok untuk pengembangan berkelanjutan
1. Buat akun di github.com, lalu buat repository **publik** baru (misalnya `era-of-kingdoms`).
   Untuk akun gratis, GitHub Pages hanya tersedia di repository publik.
2. Unggah seluruh isi folder (**Add file → Upload files**). Pastikan `index.html` berada di root repository.
3. Buka **Settings → Pages**.
4. Di bagian *Build and deployment*, pilih **Source: Deploy from a branch**, branch **main**, folder **/ (root)**, lalu **Save**.
5. Setelah beberapa menit, game tersedia di `https://<username>.github.io/era-of-kingdoms/`.
6. Untuk memperbarui: unggah `index.html` baru ke repository; situs ikut diperbarui otomatis.

### C. itch.io — platform komunitas game indie
1. Buat akun di itch.io → **Upload new project**.
2. *Kind of project*: **HTML**.
3. Unggah **`index.html`** saja (file mandiri boleh diunggah tanpa zip), atau zip yang berisi `index.html`
   di level teratas. Tandai file itu untuk dimainkan di browser.
4. *Embed options*: pilih **Click to launch in fullscreen** (disarankan, karena tata letak game menyesuaikan
   ukuran layar). Jika memilih *Embed in page*, gunakan ukuran minimal 1280 × 720 dan aktifkan tombol fullscreen.
5. Centang **Mobile friendly** (game mendukung layar sentuh).
6. Atur visibilitas menjadi *Public* lalu simpan.

### D. Alternatif lain
Cloudflare Pages, Vercel, Firebase Hosting, atau hosting web biasa (cPanel/FTP): cukup unggah `index.html`
ke folder publik situs.

---

## 5. Mengembangkan & membangun ulang

Semua perubahan dilakukan di folder `src/`. Setelah mengubah kode, buat ulang `index.html`:

```bash
python3 build.py      # atau: python build.py   (Windows: py build.py)
node build.mjs        # alternatif jika memakai Node.js
```

Lalu buka ulang `index.html` di browser, atau unggah ke hosting untuk memperbarui versi online.

Saat pengembangan, buka konsol browser (F12) untuk melihat pesan error.

Urutan modul penting karena modul yang dimuat belakangan memakai variabel global dari modul sebelumnya.
Urutannya ada di `ORDER` dalam `build.py` dan `build.mjs`. Jika menambah file baru, tambahkan di kedua skrip.

`python3 build.py --fragment nama.html` menghasilkan versi tanpa tag `<html>/<head>`, untuk disisipkan
ke halaman lain.

---

## 6. Arsitektur singkat

| Modul | Tanggung jawab |
|---|---|
| `data.js` | Semua angka game: statistik unit (`U`), bangunan (`B`), teknologi (`T`), peradaban (`CIVS`), laju mengumpulkan (`GATHER`), jalur peningkatan unit (`LINES`). |
| `sim.js` | Simulasi deterministik dengan langkah tetap 30 kali per detik game (`STEP`). Entitas, perintah unit (`ORD.*`), ekonomi, pertempuran (armor jarak dekat/tusuk, bonus, proyektil yang bisa meleset), teknologi (`ST()` menghitung statistik setelah bonus), kabut perang, kondisi menang, skor. |
| `cmd.js` | `Cmd.*` adalah satu-satunya jalur bagi UI dan AI untuk mengubah simulasi: bergerak, menyerang, membangun, melatih, meneliti, pasar, upeti, lonceng kota. |
| `ai.js` | `AI.think(p)` dipanggil berkala untuk tiap pemain komputer: ekonomi, pembangunan, riset, produksi pasukan sesuai komposisi musuh, pertahanan, gelombang serangan. Tingkat kesulitan ada di `AI_LEVELS`. |
| `render.js` | Kamera isometrik (tile 64 × 32), medan sebagai satu tekstur besar, pengurutan kedalaman sprite, kabut, partikel, peta mini. |
| `art_*.js` | Semua gambar dibuat dengan kode Canvas lalu di-cache. Unit di `UNIT_ART`, bangunan di `drawBld()` dengan 4 gaya arsitektur (`ARCH`: west, nusa, east, mideast). |
| `ui.js` | Menu, pengaturan skirmish, HUD, panel perintah 5 × 3 (hotkey Q–B), tooltip, input mouse/keyboard/sentuh, modal (pohon teknologi, skor, layar akhir). |
| `main.js` | Loop `requestAnimationFrame` dengan akumulator langkah tetap, simpan/muat (`serializeGame`/`restoreGame`), pertempuran AI di latar menu. |

Kunci localStorage: `eok.settings`, `eok.setup`, `eok.save.<slot>`, `eok.meta.<slot>` (slot: `auto`, `1`, `2`, `3`).

---

## 7. Cara menambah konten

**Unit baru**
1. `data.js`: tambahkan entri di `U`, misalnya
   `pemanahGajah: { cls: ['cavalry','archer'], hp: 200, atk: 7, at: 'p', a: [1, 3], rng: 5, rof: 2.5, spd: .8, los: 6, cost: { food: 120, gold: 80 }, time: 35, from: 'castle', age: 2, r: .4, proj: 'arrow', acc: .8, weak: ['spear','monk'] }`.
   Kolom penting: `at` jenis serangan (`'m'` jarak dekat, `'p'` tusuk/proyektil), `a` armor `[jarak dekat, tusuk]`,
   `bonus` bonus serangan per kelas (misalnya `{ cavalry: 15 }`), `rng` jangkauan dalam tile, `spd` tile per detik.
2. Daftarkan di bangunan yang melatihnya: `B.<bangunan>.trains`.
3. `art_units.js`: tambahkan gaya gambar di `UNIT_ART` (helm, senjata, perisai, kuda, dan lain-lain), atau set `art:` ke unit yang sudah ada.
4. `i18n_game.js`: tambahkan nama di `addNames('unit.', { ... })` dengan format `'English|Indonesia|Español|Français|Deutsch|Português|日本語'`.

**Teknologi baru**: entri di `T` (`at` bangunan, `age`, `cost`, `time`, `icon`, `req`, `fx`). Jenis efek `fx`:
`stat` (ubah statistik, `add` atau `mul`), `gather`, `carry`, `line` (tingkatkan jalur unit), `cost`, `time`,
`build`, `farm`, `pop`, `flag`, `convRes`, `commission`, `tribute`, `elite`. Tambahkan id-nya ke `B.<bangunan>.techs`
dan namanya di `addNames('tech.', ...)`. Panel perintah menampilkan maksimal 10 tombol per bangunan.

**Peradaban baru**: entri di `CIVS` (`uu` unit khusus, `arch` gaya bangunan, `music` tangga nada di `SCALES` dalam
`audio.js`, `fx` bonus), unit khususnya di `U` (dengan `from: 'castle'` dan `elite`), teks `civ.<id>`, `civ.<id>.r`,
`civ.<id>.d`, `uu.<unit>` di `i18n_game.js`, preferensi pasukan AI di `AI_PREF` (`ai.js`), dan nama pemimpin di
`AI_NAMES` (`ui.js`).

**Bahasa baru**: tambahkan kode bahasa di akhir `LANG_ORDER` (`i18n_ui.js`) dan di `LANGS` (`ui.js`), lalu tambahkan
terjemahan sebagai kolom ke-8 di setiap entri `i18n_ui.js` dan `i18n_game.js`. Teks yang belum diterjemahkan
otomatis memakai bahasa Inggris.

**Peta baru**: tambahkan nama di `MAP_TYPES` (`map.js`), cabang pembuatan medan di `genMap()`, dan nama `map.<id>` di `i18n_ui.js`.

---

## 8. Pengujian

**Uji simulasi (tanpa browser, tanpa instalasi)** — menjalankan pertandingan AI vs AI dengan kode game asli,
lalu mencetak perkembangan, waktu naik zaman, dan performa:

```bash
node tools/sim-test.mjs                         # 30 menit, 2 pemain
node tools/sim-test.mjs 40 rivers 96 7 majapahit,japanese,ottomans hard,hardest,normal
```

Jalankan setiap kali mengubah `data.js`, `sim.js`, atau `ai.js`. Pesan `OK: no errors.` berarti simulasi berjalan
tanpa crash.

**Uji browser (opsional)** — membuka `index.html` di Chromium tanpa tampilan, memilih penduduk dengan drag,
memberi perintah, memakai hotkey, mempercepat 15 menit, dan menguji simpan/muat:

```bash
npm init -y
npm install --save-dev playwright
npx playwright install chromium
node build.mjs && node tools/browser-smoke.mjs
```

Tangkapan layar tersimpan di `tools/screenshots/`.

**Uji otomatis di GitHub (CI).** Setelah proyek ada di GitHub, `.github/workflows/ci.yml` menjalankan build,
tiga uji simulasi, dan uji browser pada setiap push ke `main` atau ke branch `claude/...`, setiap pull request,
dan kapan saja lewat tombol **Run workflow** di tab Actions. Hasilnya terlihat di tab
**Actions** dan sebagai tanda centang hijau/silang merah di pull request. Jangan menggabungkan pull request yang
CI-nya merah.

---

## 9. Kontrol

| Tombol | Fungsi |
|---|---|
| Klik kiri / seret | Pilih unit / pilih banyak |
| Klik kanan | Gerak, kumpulkan, serang, bangun, perbaiki (sesuai sasaran) |
| Shift | Antrekan perintah, tambah ke pilihan, latih 5 unit sekaligus |
| Klik dua kali / Ctrl+klik | Pilih semua unit sejenis di layar |
| Ctrl+1…9, lalu 1…9 | Buat grup, panggil grup (tekan dua kali untuk melompat ke grup) |
| Q W E R T / A S D F G / Z X C V B | Tombol panel perintah |
| A | Serbu sambil bergerak (untuk pasukan) |
| H | Pilih balai kota |
| . (titik) | Penduduk menganggur berikutnya |
| Spasi | Lompat ke lokasi serangan terakhir |
| Del | Hapus pilihan |
| P / F3 | Jeda |
| + / − | Kecepatan permainan |
| Panah / tepi layar / seret tombol tengah | Gulir peta |
| Roda mouse | Zoom |
| Alt + klik kanan | Masukkan unit ke dalam bangunan |
| Esc / F10 | Batal / menu permainan |

Layar sentuh: ketuk untuk memilih dan memberi perintah, geser satu jari untuk menggulir, cubit untuk zoom,
tekan lama lalu geser untuk memilih area.

---

## 10. Batasan versi 1.0 & ide pengembangan

- Belum ada multiplayer online (butuh server WebSocket untuk sinkronisasi perintah; simulasi sudah berbasis langkah tetap dan perintah, sehingga cocok untuk model *lockstep*).
- Belum ada kampanye bercerita (misalnya Gajah Mada dan Sumpah Palapa).
- Grafis digambar dengan kode, bukan sprite artis; bisa diganti dengan sprite sheet PNG di `art_*.js`.
- Belum ada unit pengangkut laut (kapal transport) dan perdagangan antarpasar.
- Simpanan hanya di browser lokal; ekspor/impor file simpanan bisa ditambahkan.
- Belum bisa dipasang sebagai aplikasi (PWA) atau dibungkus menjadi aplikasi desktop/Android (Electron, Tauri, Capacitor).

Seluruh kode, grafis, dan musik dibuat khusus untuk proyek ini. Satu-satunya sumber luar adalah dua font Google Fonts
(Marcellus SC dan Alegreya Sans, lisensi SIL Open Font License) yang dimuat dari internet saat tersedia.
