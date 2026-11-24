const GAME_CONFIG = {
  secretCode: "2403",

  hoodieColor: "#3b4252",

  otterPuzzle: {
    question:
      "Menurut protokol keamanan CEO Meow, kenapa otter selalu berpegangan tangan saat tidur?",
    options: [
      "Supaya tidak ada yang hanyut ke mimpi orang lain",
      "Karena pegangan tangan bikin sinyal Wi-Fi lebih kuat",
      "Biar tidak ada yang kabur saat kue dibagi",
      "Karena stok bantal di sungai sedang habis",
    ],
    correctIndex: 0,
    hint: "Petunjuk: jawabannya bukan yang paling manis. Pilih opsi paling absurd yang terdengar seperti prosedur darurat versi CEO Meow.",
  },

  dialogs: {
    chestOpen: [
      "Akhirnya peti terbuka. Isinya kue, satu hoodie, dan surat yang lebih panjang dari tutorial yt.",
      "Aku sudah mencium bau petualangan. Atau mungkin itu bau kue. Susah dibedakan.",
      "Peraturan pertama: jangan lupa bernapas. Peraturan kedua: kue dibagi rata. Peraturan ketiga: CEO Meow dapat potongan paling besar.",
    ],
    clue24:
      "Clue pertama: 24. Dua puluh empat adalah jumlah biskuit yang hilang selama proses pengiriman peti. Kebetulan sekali, bukan?",
    clue03:
      "Clue kedua: 03. Tiga nyawa, nol penjelasan. Kalau masih bingung, gabungkan dua angka itu dari kiri ke kanan.",
    fakeEnding: [
      "Selamat! Kamu menemukan dapur kosong. Kue ulang tahun sudah dipindahkan ke lokasi rahasia. Petunjuk: lihat album foto.",
      "Ini fake ending. Ending aslinya masih menunggu di balik pintu yang belum kamu buka. Atau mungkin di balik kalimat ini.",
      "Jangan berkecil hati. Setiap ending palsu adalah kesempatan untuk mengulang perjalanan dan memberi CEO Meow lebih banyak biskuit.",
    ],
  },

  birthdayMessage: `Hai {playerName},

Selamat ulang tahun. Kalau kamu sedang membaca ini di tengah layar yang berkedip dan suara otter yang mencurigakan, berarti seluruh rencana kecil ini berhasil sampai ke kamu.

Hari ini bukan cuma tentang kue, lilin, atau kode empat digit yang bikin frustrasi. Hari ini tentang kamu: orang yang tetap tersenyum bahkan ketika hidup mengirim notifikasi error bertubi-tubi. Kamu punya cara aneh untuk membuat hal-hal biasa terasa seperti petualangan, dan itu hadiah yang jarang dimiliki orang.

Terima kasih sudah bertahan, tumbuh, dan tetap jadi dirimu sendiri. Terima kasih untuk tawa yang kamu bagikan, untuk hal-hal kecil yang kamu ingat, dan untuk semua momen yang mungkin terasa biasa saat terjadi, tapi kemudian jadi kenangan yang hangat. Kalau tahun ini terasa berat, semoga kamu ingat bahwa kamu tidak harus menyelesaikannya sendirian. Ada otter kecil, ada CEO Meow, dan ada orang-orang yang diam-diam menyimpan versi terbaik dari dirimu di hati mereka.

Semoga tahun ini membawa lebih banyak hal yang membuatmu merasa hidup: pagi yang tenang, proyek yang menyenangkan, pertemanan yang tulus, dan kue yang tidak habis sebelum lilin dinyalakan. Semoga kamu berani mencoba hal baru, berani bilang tidak, dan berani memilih diri sendiri tanpa rasa bersalah.

Kode rahasianya memang 2403, tapi kode untuk bahagia selalu berubah-ubah. Untungnya, kamu cukup pintar untuk menebaknya setiap hari.

Selamat ulang tahun, {playerName}. Jangan lupa simpan satu potong kue untuk dirimu sendiri.

Dengan sayang,
YOUR LUPIN`,

  albumPhotos: [
    {
      url: "https://placehold.co/720x960/FFE3EA/332B3A?text=OTTER+MEMORY+01",
      caption: "Peti pertama yang berhasil dibuka tanpa bantuan kucing.",
    },
    {
      url: "https://placehold.co/720x960/C5E7FF/332B3A?text=OTTER+MEMORY+02",
      caption: "Ikan yang selamat dari sungai pastel, walau sempat protes.",
    },
    {
      url: "https://placehold.co/720x960/CDEEDD/332B3A?text=OTTER+MEMORY+03",
      caption:
        "Puncak gunung, dua menit sebelum kabutnya berubah jadi stroberi.",
    },
    {
      url: "https://placehold.co/720x960/E0D3F5/332B3A?text=OTTER+MEMORY+04",
      caption:
        "Selfie di photobooth yang sampai sekarang belum selesai dicetak.",
    },
  ],

  stickyNotes: [
    "Berani mencoba hal baru, minimal satu kali sebulan.",
    "Tidur lebih awal, tapi tetap lanjut nonton satu episode lagi.",
    "Menulis tiga hal yang membuatku bersyukur setiap malam.",
    "Jalan-jalan tanpa tujuan dan tidak merasa bersalah.",
    "Belajar satu resep yang bisa dibanggakan ke CEO Meow.",
    "Menjaga pertemanan yang membuatku merasa pulang.",
  ],

  musicUrl: "",
};

window.GAME_CONFIG = GAME_CONFIG;
