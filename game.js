(function () {
  "use strict";

  var CONFIG = window.GAME_CONFIG || {};
  var STORAGE_KEY = "otterAlertProgress.v1";
  var STAGES = [
    "boot",
    "box",
    "puzzle",
    "minigame",
    "mountain",
    "keypad",
    "rpg",
  ];
  var DEFAULT_ERROR =
    "Terdeteksi satu otter mencurigakan membawa kue. Sistem kewalahan oleh kadar menggemaskan yang melebihi batas aman.";
  var READY_ERROR =
    "Sistem pulih. Otter sudah menunggu di balik layar dengan kue dan ekspektasi yang tinggi.";
  var DEFAULT_NOTE = "Geser atau sentuh untuk menggerakkan keranjang";
  var DEFAULT_KEYPAD_MESSAGE =
    "Belum ada percobaan hari ini. Semoga beruntung.";
  var TROLL_MESSAGES = [
    "Troll 1: Kami sudah menghubungi otter. Ia sedang sibuk mencuri biskuit dan tidak bisa diganggu.",
    "Troll 2: Error ini bukan bug. Ini fitur premium yang hanya muncul saat ulang tahun.",
    "Troll 3: Mencoba ulang... ternyata masalahnya cuma CEO Meow yang mengetik di keyboard.",
  ];
  var WRONG_CODE_MESSAGES = [
    "Kode ditolak. Pintu brankas pura-pura tidak mendengar.",
    "Salah. Otter di balik pintu menahan tawa.",
    "Bukan itu. Coba ingat dua angka dari dua clue.",
    "Kode salah. CEO Meow mencatat insiden ini di buku khusus.",
  ];
  var FISH = {
    width: 720,
    height: 960,
    playerY: 862,
    minX: 82,
    maxX: 638,
  };

  function byId(id) {
    return document.getElementById(id);
  }

  var dom = {
    game: document.querySelector(".game"),
    screens: Array.prototype.slice.call(
      document.querySelectorAll("[data-screen]"),
    ),
    boot: byId("screen-boot"),
    retry: byId("btn-retry"),
    start: byId("btn-start"),
    reset: byId("btn-reset-progress"),
    errorCopy: byId("boot-error-copy"),
    box: byId("screen-box"),
    mysteryBox: document.querySelector(".mystery-box"),
    boxCaption: byId("box-caption"),
    dialogText: byId("dialog-text"),
    playerForm: byId("player-form"),
    nameInput: byId("player-name-input"),
    enterButton: byId("btn-enter"),
    puzzle: byId("screen-puzzle"),
    puzzleQuestion: byId("puzzle-question"),
    puzzleOptions: Array.prototype.slice.call(
      document.querySelectorAll("#puzzle-options .option"),
    ),
    clueText: byId("clue-text"),
    hintButton: byId("btn-hint"),
    puzzleNext: byId("btn-puzzle-next"),
    minigame: byId("screen-minigame"),
    fishCanvas: byId("fish-canvas"),
    fishScore: byId("fish-score"),
    fishLives: byId("fish-lives"),
    hearts: Array.prototype.slice.call(
      document.querySelectorAll("#fish-lives .heart"),
    ),
    fishNote: document.querySelector(
      ".canvas-frame--fish .canvas-overlay-note",
    ),
    fishRetry: byId("btn-fish-retry"),
    fishExit: byId("btn-fish-exit"),
    mountain: byId("screen-mountain"),
    pathCards: Array.prototype.slice.call(
      document.querySelectorAll("[data-path]"),
    ),
    teaserTitle: document.querySelector(".keypad-teaser__title"),
    teaserHint: document.querySelector(".keypad-teaser__hint"),
    keypadOpen: byId("btn-keypad-open"),
    houseButton: byId("btn-house"),
    keypad: byId("screen-keypad"),
    keypadDisplay: byId("keypad-display"),
    keypadMessage: byId("keypad-message"),
    keypadKeys: Array.prototype.slice.call(
      document.querySelectorAll("#keypad .keypad__key"),
    ),
    rpg: byId("screen-rpg"),
    rpgCanvas: byId("rpg-canvas"),
    rpgLocation: byId("rpg-location"),
    rpgQuest: byId("rpg-quest"),
    rpgPrompt: byId("rpg-prompt"),
    modalOverlay: byId("modal-overlay"),
    modalClose: byId("modal-close"),
  };

  var fishCtx = dom.fishCanvas ? dom.fishCanvas.getContext("2d") : null;
  var rpgCtx = dom.rpgCanvas ? dom.rpgCanvas.getContext("2d") : null;

  var state = createDefaultState();
  var bootReady = false;
  var bootRetrying = false;
  var bootTimer = 0;
  var toastTimer = 0;
  var toastElement = null;
  var boxDialogIndex = -1;
  var pathTimer = 0;
  var keypadInput = "";
  var keypadLocked = false;
  var keypadOpenTimer = 0;
  var rpgSceneStarted = false;
  var saveWarningShown = false;
  var savedProgressRestored = false;
  var fishGame = {
    active: false,
    ended: false,
    won: false,
    score: 0,
    lives: 3,
    items: [],
    particles: [],
    playerX: FISH.width / 2,
    targetX: FISH.width / 2,
    spawnClock: 0,
    lastTime: 0,
    rafId: 0,
    invulnerable: 0,
    flash: 0,
  };

  function createDefaultState() {
    return {
      version: 1,
      playerName: "",
      stage: "boot",
      boxOpened: false,
      puzzleSolved: false,
      clueA: false,
      hasKey: false,
      clueB: false,
      minigameWon: false,
      path: "",
      vaultOpen: false,
    };
  }

  function getPublicState() {
    return {
      playerName: state.playerName,
      stage: state.stage,
      boxOpened: state.boxOpened,
      puzzleSolved: state.puzzleSolved,
      clueA: state.clueA,
      hasKey: state.hasKey,
      clueB: state.clueB,
      minigameWon: state.minigameWon,
      path: state.path,
      vaultOpen: state.vaultOpen,
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function stageIndex(name) {
    return STAGES.indexOf(name);
  }

  function readSavedProgress() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      return normalizeProgress(parsed);
    } catch (error) {
      return null;
    }
  }

  function normalizeProgress(raw) {
    var next = createDefaultState();
    var safeStage = STAGES.indexOf(raw.stage) >= 0 ? raw.stage : "boot";
    var currentIndex = stageIndex(safeStage);
    var playerName =
      typeof raw.playerName === "string"
        ? raw.playerName.replace(/\s+/g, " ").trim().slice(0, 16)
        : "";
    var path = raw.path === "cave" || raw.path === "lake" ? raw.path : "";
    var vaultOpen = Boolean(raw.vaultOpen);
    var hasKey = Boolean(raw.hasKey) || vaultOpen;
    var puzzleSolved = Boolean(raw.puzzleSolved) || hasKey;

    if (currentIndex >= stageIndex("minigame")) {
      puzzleSolved = true;
    }

    if (currentIndex >= stageIndex("keypad")) {
      hasKey = true;
      if (!path) {
        path = "cave";
      }
    }

    if (vaultOpen) {
      hasKey = true;
      puzzleSolved = true;
    }

    var boxOpened =
      Boolean(raw.boxOpened) ||
      Boolean(playerName) ||
      currentIndex > stageIndex("box");

    if (safeStage === "rpg" && !vaultOpen) {
      safeStage = hasKey && path ? "keypad" : "mountain";
    }

    if (safeStage === "keypad" && (!hasKey || !path)) {
      safeStage = "mountain";
    }

    if (safeStage === "keypad" && vaultOpen) {
      safeStage = "rpg";
    }

    if (safeStage === "puzzle" && !boxOpened) {
      safeStage = "box";
    }

    if (safeStage === "puzzle" && !playerName) {
      safeStage = "box";
    }

    next.playerName = playerName;
    next.stage = safeStage;
    next.boxOpened = boxOpened;
    next.puzzleSolved = puzzleSolved;
    next.clueA = puzzleSolved;
    next.hasKey = hasKey;
    next.clueB = hasKey;
    next.minigameWon = hasKey;
    next.path = path;
    next.vaultOpen = vaultOpen;
    return next;
  }

  function saveProgress() {
    state.clueA = state.puzzleSolved;
    state.clueB = state.hasKey;
    state.minigameWon = state.hasKey;

    var payload = {
      version: 1,
      playerName: state.playerName,
      stage: state.stage,
      boxOpened: state.boxOpened,
      puzzleSolved: state.puzzleSolved,
      clueA: state.clueA,
      hasKey: state.hasKey,
      clueB: state.clueB,
      minigameWon: state.minigameWon,
      path: state.path,
      vaultOpen: state.vaultOpen,
      updatedAt: Date.now(),
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      if (!saveWarningShown) {
        saveWarningShown = true;
        toast(
          "Browser menolak menyimpan progres. Coba matikan mode privat.",
          "error",
          3600,
        );
      }
    }

    if (window.otterAlert) {
      window.otterAlert.state = getPublicState();
    }
  }

  function getScreen(name) {
    for (var i = 0; i < dom.screens.length; i += 1) {
      if (dom.screens[i].getAttribute("data-screen") === name) {
        return dom.screens[i];
      }
    }
    return null;
  }

  function isScreenActive(name) {
    var screen = getScreen(name);
    return Boolean(screen && screen.classList.contains("is-active"));
  }

  function fallbackStage() {
    if (state.vaultOpen) {
      return "rpg";
    }
    if (state.hasKey && state.path) {
      return "keypad";
    }
    if (state.hasKey) {
      return "mountain";
    }
    if (state.puzzleSolved) {
      return "minigame";
    }
    if (state.boxOpened && state.playerName) {
      return "puzzle";
    }
    if (state.boxOpened) {
      return "box";
    }
    return "boot";
  }

  function canEnter(name, silent) {
    if (name === "boot" || name === "box" || name === "mountain") {
      return true;
    }

    if (name === "puzzle") {
      if (!state.boxOpened) {
        if (!silent) {
          toast("Ketuk peti misteri dulu sebelum masuk ke puzzle.", "error");
        }
        return false;
      }
      if (!state.playerName) {
        if (!silent) {
          toast(
            "Isi nama panggilanmu dulu. CEO Meow tidak suka data kosong.",
            "error",
          );
        }
        return false;
      }
      return true;
    }

    if (name === "minigame") {
      if (!state.puzzleSolved) {
        if (!silent) {
          toast(
            "Selesaikan puzzle otter dulu untuk membuka mini-game.",
            "error",
          );
        }
        return false;
      }
      return true;
    }

    if (name === "keypad") {
      if (!state.hasKey) {
        if (!silent) {
          toast(
            "Kunci brankas belum didapat. Menangkan Save the Fish dulu.",
            "error",
          );
        }
        return false;
      }
      if (!state.path) {
        if (!silent) {
          toast("Pilih salah satu jalur gunung dulu.", "error");
        }
        return false;
      }
      return true;
    }

    if (name === "rpg") {
      if (!state.vaultOpen) {
        if (!silent) {
          toast(
            "Pintu brankas masih terkunci. Kode 4 digit belum dimasukkan.",
            "error",
          );
        }
        return false;
      }
      return true;
    }

    return false;
  }

  function showScreen(name, options) {
    var settings = options || {};
    var target = getScreen(name);

    if (!target) {
      return false;
    }

    if (name !== "keypad") {
      window.clearTimeout(pathTimer);
      pathTimer = 0;
    }

    if (name !== "rpg") {
      window.clearTimeout(keypadOpenTimer);
      keypadOpenTimer = 0;
    }

    if (!settings.force && !canEnter(name, settings.silent)) {
      return false;
    }

    hideToast();

    if (name !== "minigame") {
      stopFishGame();
    }

    state.stage = name;

    dom.screens.forEach(function (screen) {
      var active = screen === target;
      screen.classList.toggle("is-active", active);
      screen.setAttribute("aria-hidden", active ? "false" : "true");
    });

    target.scrollTop = 0;

    if (!settings.noSave) {
      saveProgress();
    }

    if (name === "boot") {
      syncBootUI();
    } else if (name === "box") {
      syncBoxUI();
    } else if (name === "puzzle") {
      syncPuzzleUI();
    } else if (name === "minigame") {
      prepareMinigame();
    } else if (name === "mountain") {
      updateMountainUI();
    } else if (name === "keypad") {
      syncKeypadUI();
    } else if (name === "rpg") {
      scheduleRpgScene();
    }

    return true;
  }

  function syncBootUI() {
    if (!dom.retry || !dom.start) {
      return;
    }

    if (bootRetrying) {
      return;
    }

    dom.retry.hidden = bootReady;
    dom.start.hidden = !bootReady;
    dom.retry.disabled = false;
    dom.retry.textContent = "Retry";

    if (bootReady) {
      dom.errorCopy.textContent = savedProgressRestored
        ? "Sistem pulih. Sebagian memori permainan berhasil dipulihkan."
        : READY_ERROR;
    } else {
      dom.errorCopy.textContent = DEFAULT_ERROR;
    }
  }

  function handleRetry() {
    if (bootRetrying || bootReady) {
      return;
    }

    bootRetrying = true;
    dom.retry.disabled = true;
    dom.retry.textContent = "Retrying...";
    dom.errorCopy.textContent = TROLL_MESSAGES[0];
    window.clearTimeout(bootTimer);

    bootTimer = window.setTimeout(function () {
      bootRetrying = false;
      bootReady = true;
      dom.errorCopy.textContent =
        "Oke, sistem akhirnya tenang. Start sudah muncul sebelum otter berubah pikiran.";
      syncBootUI();
      toast(
        "Start sudah tersedia. Jangan ditahan, nanti otter ngambek.",
        "",
        2600,
      );
    }, 1650);
  }

  function syncBoxUI() {
    var opened = state.boxOpened;
    dom.nameInput.disabled = !opened;
    dom.enterButton.disabled = !opened;

    if (state.playerName) {
      dom.nameInput.value = state.playerName;
    } else {
      dom.nameInput.value = "";
    }

    if (opened) {
      dom.boxCaption.textContent =
        "STATUS: DIBUKA · ISI: KUE, HOODIE, DAN SURAT PANJANG";
      dom.dialogText.textContent = state.playerName
        ? "“Hai, " +
          state.playerName +
          ". Nama itu sudah kucatat. Jangan bohong, kucing selalu tahu.”"
        : "“Peti sudah terbuka. Sekarang isi nama panggilanmu supaya sertifikat insiden ini sah.”";
    } else {
      dom.boxCaption.textContent =
        "ISI: ??? · BERAT: 1.2 KG DAN TERUS MENGEMBANG";
      dom.dialogText.textContent =
        "“Ketuk peti di atas dulu. Aku tidak akan membuka apa pun sebelum kamu menyapa.”";
    }
  }

  function handleBoxTap() {
    dom.mysteryBox.classList.remove("is-tapped");
    void dom.mysteryBox.offsetWidth;
    dom.mysteryBox.classList.add("is-tapped");

    if (!state.boxOpened) {
      state.boxOpened = true;
      state.stage = "box";
      boxDialogIndex = 0;
      saveProgress();
      dom.nameInput.disabled = false;
      dom.enterButton.disabled = false;
      dom.boxCaption.textContent =
        "STATUS: DIBUKA · ISI: KUE, HOODIE, DAN SURAT PANJANG";
      var openingLines =
        CONFIG.dialogs && Array.isArray(CONFIG.dialogs.chestOpen)
          ? CONFIG.dialogs.chestOpen
          : [];
      dom.dialogText.textContent =
        "“" + (openingLines[0] || "Peti terbuka. Silakan isi namamu.") + "”";
      toast(
        "Peti terbuka. CEO Meow ingin tahu nama panggilanmu.",
        "success",
        2800,
      );
      window.setTimeout(function () {
        if (isScreenActive("box")) {
          dom.nameInput.focus({ preventScroll: true });
        }
      }, 260);
      return;
    }

    var lines =
      CONFIG.dialogs && Array.isArray(CONFIG.dialogs.chestOpen)
        ? CONFIG.dialogs.chestOpen
        : [];
    if (lines.length) {
      boxDialogIndex = (boxDialogIndex + 1) % lines.length;
      dom.dialogText.textContent = "“" + lines[boxDialogIndex] + "”";
    }
  }

  function handlePlayerSubmit(event) {
    event.preventDefault();

    if (!state.boxOpened) {
      toast("Ketuk peti misteri dulu.", "error");
      return;
    }

    var name = dom.nameInput.value.replace(/\s+/g, " ").trim().slice(0, 16);
    if (!name) {
      toast("Nama tidak boleh kosong. Bahkan otter punya nama.", "error");
      dom.nameInput.focus({ preventScroll: true });
      return;
    }

    state.playerName = name;
    state.boxOpened = true;
    state.stage = "puzzle";
    saveProgress();

    dom.nameInput.value = name;
    dom.dialogText.textContent =
      "“" +
      name +
      ". Nama yang bagus. Sistem akan mengingatnya, dan CEO Meow juga.”";
    toast(
      "Selamat datang, " + name + ". Puzzle pertama sudah menunggu.",
      "success",
      2800,
    );
    showScreen("puzzle");
  }

  function renderPuzzle() {
    var puzzle = CONFIG.otterPuzzle || {};
    var options = Array.isArray(puzzle.options) ? puzzle.options : [];

    if (dom.puzzleQuestion) {
      dom.puzzleQuestion.textContent =
        puzzle.question || "Pertanyaan belum tersedia.";
    }

    dom.puzzleOptions.forEach(function (button, index) {
      var text = button.querySelector(".option__text");
      var value = options[index];
      button.hidden = value === undefined;
      button.disabled = state.puzzleSolved;
      button.classList.remove("is-correct", "is-wrong");
      if (text) {
        text.textContent = value === undefined ? "" : value;
      }
      if (state.puzzleSolved && index === puzzle.correctIndex) {
        button.classList.add("is-correct");
      }
    });

    if (dom.clueText) {
      if (state.puzzleSolved) {
        dom.clueText.textContent =
          CONFIG.dialogs && CONFIG.dialogs.clue24
            ? CONFIG.dialogs.clue24
            : "Clue pertama: 24.";
      } else {
        dom.clueText.textContent =
          "Terkunci. Jawab benar untuk membuka petunjuk kode.";
      }
    }

    if (dom.puzzleNext) {
      dom.puzzleNext.disabled = !state.puzzleSolved;
    }
  }

  function syncPuzzleUI() {
    renderPuzzle();
  }

  function handlePuzzleAnswer(index) {
    if (state.puzzleSolved) {
      return;
    }

    var puzzle = CONFIG.otterPuzzle || {};
    var button = dom.puzzleOptions[index];
    if (!button || button.hidden) {
      return;
    }

    if (index === puzzle.correctIndex) {
      state.puzzleSolved = true;
      state.clueA = true;
      state.stage = "puzzle";
      saveProgress();

      dom.puzzleOptions.forEach(function (option, optionIndex) {
        option.disabled = true;
        option.classList.toggle(
          "is-correct",
          optionIndex === puzzle.correctIndex,
        );
      });

      if (dom.clueText) {
        dom.clueText.textContent =
          CONFIG.dialogs && CONFIG.dialogs.clue24
            ? CONFIG.dialogs.clue24
            : "Clue pertama: 24.";
      }
      if (dom.puzzleNext) {
        dom.puzzleNext.disabled = false;
      }
      updateMountainUI();
      toast("Jawaban benar. Clue A terbuka: 24.", "success", 3000);
      return;
    }

    button.classList.add("is-wrong");
    button.disabled = true;
    toast("Bukan itu. Tidak ada penalti.", "error", 2600);
  }

  function handleHint() {
    var hint =
      CONFIG.otterPuzzle && CONFIG.otterPuzzle.hint
        ? CONFIG.otterPuzzle.hint
        : "Petunjuk belum tersedia. Coba pilih yang paling absurd.";
    toast(hint, "", 4400);
  }

  function updateHearts(lives) {
    dom.hearts.forEach(function (heart, index) {
      heart.classList.toggle("is-empty", index >= lives);
    });
    if (dom.fishLives) {
      dom.fishLives.setAttribute("aria-label", "Sisa " + lives + " nyawa");
    }
  }

  function updateScore(score) {
    if (dom.fishScore) {
      dom.fishScore.textContent = String(score);
    }
  }

  function setFishReadyState() {
    dom.fishRetry.hidden = true;
    dom.fishExit.textContent = "Keluar";
    dom.fishNote.textContent = DEFAULT_NOTE;
    dom.fishNote.hidden = false;
  }

  function prepareMinigame() {
    if (state.hasKey) {
      stopFishGame();
      fishGame.score = 100;
      fishGame.lives = 3;
      fishGame.ended = true;
      fishGame.won = true;
      updateScore(100);
      updateHearts(3);
      dom.fishRetry.hidden = true;
      dom.fishExit.textContent = "Ke Gunung";
      dom.fishNote.textContent =
        "KUNCI DIDAPAT · Clue B: 03 · lanjut ke gunung";
      drawFishScene(performance.now() / 1000);
      drawFishEndOverlay(true);
      return;
    }

    startFishGame();
  }

  function startFishGame() {
    stopFishGame();
    fishGame.active = true;
    fishGame.ended = false;
    fishGame.won = false;
    fishGame.score = 0;
    fishGame.lives = 3;
    fishGame.items = [];
    fishGame.particles = [];
    fishGame.playerX = FISH.width / 2;
    fishGame.targetX = FISH.width / 2;
    fishGame.spawnClock = 0.42;
    fishGame.lastTime = performance.now();
    fishGame.invulnerable = 0;
    fishGame.flash = 0;

    setFishReadyState();
    updateScore(0);
    updateHearts(3);

    fishGame.rafId = window.requestAnimationFrame(fishLoop);
  }

  function stopFishGame() {
    fishGame.active = false;
    if (fishGame.rafId) {
      window.cancelAnimationFrame(fishGame.rafId);
      fishGame.rafId = 0;
    }
  }

  function fishLoop(now) {
    if (!fishGame.active) {
      return;
    }

    var dt = Math.min((now - fishGame.lastTime) / 1000, 0.05);
    fishGame.lastTime = now;
    updateFishGame(dt);

    if (!fishGame.active) {
      return;
    }

    drawFishScene(now / 1000);
    fishGame.rafId = window.requestAnimationFrame(fishLoop);
  }

  function updateFishGame(dt) {
    fishGame.playerX +=
      (fishGame.targetX - fishGame.playerX) * Math.min(1, dt * 15);
    fishGame.playerX = clamp(fishGame.playerX, FISH.minX, FISH.maxX);
    fishGame.spawnClock += dt;
    fishGame.invulnerable = Math.max(0, fishGame.invulnerable - dt);
    fishGame.flash = Math.max(0, fishGame.flash - dt);

    var spawnInterval = Math.max(0.37, 0.82 - fishGame.score * 0.0036);
    if (fishGame.spawnClock >= spawnInterval) {
      fishGame.spawnClock = 0;
      spawnFishItem();
      if (fishGame.score >= 60 && Math.random() < 0.22) {
        spawnFishItem();
      }
    }

    var shouldWin = false;

    for (var i = fishGame.items.length - 1; i >= 0; i -= 1) {
      var item = fishGame.items[i];
      item.y += item.speed * dt;
      item.rotation += item.spin * dt;

      var hit =
        item.y > 790 &&
        item.y < 936 &&
        Math.abs(item.x - fishGame.playerX) < 88;

      if (hit) {
        fishGame.items.splice(i, 1);
        if (item.type === "fish") {
          fishGame.score += 10;
          updateScore(fishGame.score);
          burstParticles(item.x, item.y, "fish");
          if (fishGame.score >= 100) {
            shouldWin = true;
          }
        } else if (fishGame.invulnerable <= 0) {
          fishGame.lives -= 1;
          fishGame.invulnerable = 1.35;
          fishGame.flash = 0.26;
          updateHearts(fishGame.lives);
          burstParticles(item.x, item.y, "trap");
          if (fishGame.lives <= 0) {
            loseFishGame();
            return;
          }
        }
        continue;
      }

      if (item.y > FISH.height + 90) {
        fishGame.items.splice(i, 1);
      }
    }

    for (var p = fishGame.particles.length - 1; p >= 0; p -= 1) {
      var particle = fishGame.particles[p];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 160 * dt;
      if (particle.life <= 0) {
        fishGame.particles.splice(p, 1);
      }
    }

    if (shouldWin) {
      winFishGame();
    }
  }

  function spawnFishItem() {
    var trapChance = Math.min(0.43, 0.26 + fishGame.score / 620);
    var isTrap = Math.random() < trapChance;
    var type = isTrap ? (Math.random() < 0.5 ? "bone" : "bomb") : "fish";

    fishGame.items.push({
      type: type,
      x: randomBetween(92, FISH.width - 92),
      y: -52,
      speed: 250 + fishGame.score * 1.9 + randomBetween(0, 75),
      spin: randomBetween(-1.2, 1.2),
      rotation: randomBetween(-0.25, 0.25),
      hue: Math.random() < 0.5 ? "blue" : "mint",
    });
  }

  function burstParticles(x, y, kind) {
    var colors =
      kind === "fish"
        ? ["#5fa8d3", "#8fd5b4", "#fff6e6", "#f2799a"]
        : ["#f2799a", "#332b3a", "#ffc9d6", "#fff6e6"];

    for (var i = 0; i < 9; i += 1) {
      fishGame.particles.push({
        x: x,
        y: y,
        vx: randomBetween(-120, 120),
        vy: randomBetween(-190, -60),
        life: randomBetween(0.25, 0.62),
        maxLife: 0.62,
        size: randomBetween(3, 7),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function winFishGame() {
    stopFishGame();
    fishGame.ended = true;
    fishGame.won = true;
    fishGame.score = 100;
    fishGame.lives = Math.max(1, fishGame.lives);

    state.hasKey = true;
    state.clueB = true;
    state.minigameWon = true;
    saveProgress();

    updateScore(100);
    dom.fishRetry.hidden = true;
    dom.fishExit.textContent = "Ke Gunung";
    dom.fishNote.textContent = "KUNCI DIDAPAT · Clue B: 03 · lanjut ke gunung";
    dom.fishNote.hidden = false;
    updateMountainUI();
    toast("Kunci brankas didapat. Clue B terbuka: 03.", "success", 3600);
    drawFishScene(performance.now() / 1000);
    drawFishEndOverlay(true);
  }

  function loseFishGame() {
    stopFishGame();
    fishGame.ended = true;
    fishGame.won = false;

    dom.fishRetry.hidden = false;
    dom.fishExit.textContent = "Keluar";
    dom.fishNote.textContent =
      "Nyawa habis. Tekan Main Lagi untuk mencoba sekali lagi";
    dom.fishNote.hidden = false;
    toast("Nyawa habis. Ikan-ikan menunggu kamu kembali.", "error", 3000);
    drawFishScene(performance.now() / 1000);
    drawFishEndOverlay(false);
  }

  function roundRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawFishScene(time) {
    if (!fishCtx) {
      return;
    }

    var ctx = fishCtx;
    var width = FISH.width;
    var height = FISH.height;
    var gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#e3f3ff");
    gradient.addColorStop(0.45, "#c5e7ff");
    gradient.addColorStop(1, "#cdeedd");
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.23;
    ctx.fillStyle = "#fffdf6";
    ctx.beginPath();
    ctx.moveTo(50, 0);
    ctx.lineTo(220, 0);
    ctx.lineTo(440, height);
    ctx.lineTo(250, height);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(430, 0);
    ctx.lineTo(540, 0);
    ctx.lineTo(690, height);
    ctx.lineTo(570, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255, 253, 246, 0.72)";
    ctx.lineWidth = 4;
    for (var wave = 0; wave < 4; wave += 1) {
      ctx.beginPath();
      for (var x = -20; x <= width + 20; x += 20) {
        var y = 170 + wave * 112 + Math.sin(x / 80 + time * 1.4 + wave) * 9;
        if (x === -20) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    for (var bubble = 0; bubble < 16; bubble += 1) {
      var bx = (bubble * 83 + 41) % width;
      var by =
        height - ((time * (26 + bubble * 2) + bubble * 97) % (height + 80));
      var radius = 4 + (bubble % 4) * 3;
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = "#fffdf6";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = "#8fd5b4";
    ctx.beginPath();
    ctx.moveTo(0, height - 92);
    ctx.quadraticCurveTo(width * 0.25, height - 132, width * 0.52, height - 92);
    ctx.quadraticCurveTo(width * 0.8, height - 58, width, height - 104);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    fishGame.particles.forEach(function (particle) {
      var alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    fishGame.items.forEach(function (item) {
      drawFishItem(ctx, item, time);
    });

    drawFishPlayer(ctx, time);

    if (fishGame.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.32, fishGame.flash * 1.7);
      ctx.fillStyle = "#f2799a";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  function drawFishItem(ctx, item, time) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#332b3a";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (item.type === "fish") {
      var body = item.hue === "blue" ? "#a3d6fa" : "#8fd5b4";
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, 38, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(34, 0);
      ctx.lineTo(58, -16);
      ctx.lineTo(54, 0);
      ctx.lineTo(58, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fffdf6";
      ctx.beginPath();
      ctx.arc(-16, -7, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#332b3a";
      ctx.beginPath();
      ctx.arc(-17, -7, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-2, 10, 4, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 253, 246, 0.55)";
      ctx.beginPath();
      ctx.ellipse(8, -8, 12, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === "bone") {
      ctx.fillStyle = "#fff6e6";
      ctx.beginPath();
      ctx.arc(-28, -10, 10, 0, Math.PI * 2);
      ctx.arc(-28, 10, 10, 0, Math.PI * 2);
      ctx.arc(28, -10, 10, 0, Math.PI * 2);
      ctx.arc(28, 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(-30, -6, 60, 12);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#f2799a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-43, -23);
      ctx.lineTo(43, 23);
      ctx.moveTo(43, -23);
      ctx.lineTo(-43, 23);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#332b3a";
      ctx.beginPath();
      ctx.arc(0, 5, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff6e6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-9, -4, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#332b3a";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(9, -19);
      ctx.quadraticCurveTo(19, -38, 34, -32);
      ctx.stroke();
      ctx.fillStyle = Math.sin(time * 22) > 0 ? "#f2799a" : "#ffc9d6";
      ctx.beginPath();
      ctx.arc(35, -33, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFishPlayer(ctx, time) {
    var x = fishGame.playerX;
    var y = FISH.playerY;
    var blink =
      fishGame.invulnerable > 0 &&
      Math.floor(fishGame.invulnerable * 12) % 2 === 0;

    ctx.save();
    if (blink) {
      ctx.globalAlpha = 0.38;
    }

    ctx.fillStyle = "rgba(51, 43, 58, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x, y + 83, 92, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#332b3a";
    ctx.lineJoin = "round";

    ctx.fillStyle = "#f1c3a3";
    ctx.beginPath();
    ctx.arc(x - 37, y - 67, 18, 0, Math.PI * 2);
    ctx.arc(x + 37, y - 67, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffc9d6";
    ctx.beginPath();
    ctx.arc(x - 37, y - 67, 8, 0, Math.PI * 2);
    ctx.arc(x + 37, y - 67, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f1c3a3";
    ctx.beginPath();
    ctx.ellipse(x, y - 35, 55, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff6e6";
    ctx.beginPath();
    ctx.ellipse(x, y - 19, 32, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#332b3a";
    ctx.beginPath();
    ctx.arc(x - 19, y - 45, 5, 0, Math.PI * 2);
    ctx.arc(x + 19, y - 45, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#332b3a";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 22);
    ctx.quadraticCurveTo(x, y - 17, x + 5, y - 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - 32, y - 25, 5, 0, Math.PI * 2);
    ctx.arc(x + 32, y - 25, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 38, y - 22);
    ctx.lineTo(x - 54, y - 27);
    ctx.moveTo(x - 38, y - 16);
    ctx.lineTo(x - 55, y - 13);
    ctx.moveTo(x + 38, y - 22);
    ctx.lineTo(x + 54, y - 27);
    ctx.moveTo(x + 38, y - 16);
    ctx.lineTo(x + 55, y - 13);
    ctx.stroke();

    ctx.fillStyle = "#ffc9d6";
    ctx.beginPath();
    ctx.arc(x - 34, y - 28, 7, 0, Math.PI * 2);
    ctx.arc(x + 34, y - 28, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#8fd5b4";
    roundRect(ctx, x - 83, y - 2, 166, 96, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff6e6";
    roundRect(ctx, x - 91, y - 16, 182, 28, 13);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#332b3a";
    ctx.lineWidth = 2.2;
    for (var i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * 27 - 8, y + 20);
      ctx.lineTo(x + i * 27 + 8, y + 78);
      ctx.stroke();
    }
    for (var row = 0; row < 2; row += 1) {
      ctx.beginPath();
      ctx.moveTo(x - 72, y + 34 + row * 27);
      ctx.lineTo(x + 72, y + 34 + row * 27);
      ctx.stroke();
    }

    ctx.fillStyle = "#f1c3a3";
    ctx.beginPath();
    ctx.arc(x - 54, y - 4, 13, 0, Math.PI * 2);
    ctx.arc(x + 54, y - 4, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (fishGame.active && Math.sin(time * 3.2) > 0.76) {
      ctx.fillStyle = "#fffdf6";
      ctx.strokeStyle = "#332b3a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 65, y - 100, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#332b3a";
      ctx.font = "700 18px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♪", x + 65, y - 99);
    }

    ctx.restore();
  }

  function drawFishEndOverlay(won) {
    if (!fishCtx) {
      return;
    }

    var ctx = fishCtx;
    var panelX = 82;
    var panelY = 322;
    var panelWidth = 556;
    var panelHeight = 312;

    ctx.save();
    ctx.fillStyle = "rgba(51, 43, 58, 0.24)";
    roundRect(ctx, panelX + 10, panelY + 12, panelWidth, panelHeight, 22);
    ctx.fill();
    ctx.fillStyle = "#fffdf6";
    roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 22);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#332b3a";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = won ? "#332b3a" : "#a83e60";
    ctx.font = "700 34px Nunito, sans-serif";
    ctx.fillText(
      won ? "KUNCI DIDAPAT!" : "NYAWA HABIS",
      FISH.width / 2,
      panelY + 84,
    );

    if (won) {
      ctx.fillStyle = "#5fa8d3";
      ctx.font = "700 42px Nunito, sans-serif";
      ctx.fillText("CLUE B: 03", FISH.width / 2, panelY + 156);
      ctx.fillStyle = "#6b5a70";
      ctx.font = "700 24px Nunito, sans-serif";
      ctx.fillText(
        "Tekan Ke Gunung untuk melanjutkan.",
        FISH.width / 2,
        panelY + 220,
      );
      ctx.fillStyle = "#f2799a";
      ctx.font = "700 22px Nunito, sans-serif";
      ctx.fillText(
        "Skor akhir: " + fishGame.score,
        FISH.width / 2,
        panelY + 262,
      );
    } else {
      ctx.fillStyle = "#6b5a70";
      ctx.font = "700 28px Nunito, sans-serif";
      ctx.fillText(
        "Tekan Main Lagi untuk mengulang.",
        FISH.width / 2,
        panelY + 166,
      );
      ctx.fillStyle = "#f2799a";
      ctx.font = "700 22px Nunito, sans-serif";
      ctx.fillText(
        "Skor terakhir: " + fishGame.score,
        FISH.width / 2,
        panelY + 230,
      );
    }

    ctx.restore();
  }

  function handleFishPointer(event) {
    if (!fishGame.active || !isScreenActive("minigame")) {
      return;
    }

    var rect = dom.fishCanvas.getBoundingClientRect();
    if (!rect.width) {
      return;
    }

    var x = ((event.clientX - rect.left) / rect.width) * FISH.width;
    fishGame.targetX = clamp(x, FISH.minX, FISH.maxX);
    if (event.cancelable) {
      event.preventDefault();
    }
  }

  function updateMountainUI() {
    var pathName =
      state.path === "cave"
        ? "Gua Kabut"
        : state.path === "lake"
          ? "Danau Terbalik"
          : "";

    if (dom.teaserTitle) {
      dom.teaserTitle.textContent = state.vaultOpen
        ? "Brankas sudah terbuka"
        : "Pintu gua terkunci 4 digit";
    }

    if (dom.teaserHint) {
      if (state.vaultOpen) {
        dom.teaserHint.textContent = "Kue sudah menunggu di dalam rumah.";
      } else if (state.hasKey && state.path) {
        dom.teaserHint.textContent =
          "Clue A: 24 · Clue B: 03 · " + pathName + " sudah dipilih.";
      } else if (state.hasKey) {
        dom.teaserHint.textContent =
          "Kunci didapat. Pilih jalur gunung untuk menemukan keypad.";
      } else if (state.puzzleSolved) {
        dom.teaserHint.textContent =
          "Clue A: 24. Clue B masih tersembunyi di mini-game.";
      } else {
        dom.teaserHint.textContent =
          "Clue-nya mungkin terselip di puzzle tadi.";
      }
    }

    if (dom.keypadOpen) {
      dom.keypadOpen.disabled = state.vaultOpen || !state.hasKey || !state.path;
    }

    if (dom.houseButton) {
      dom.houseButton.disabled = !state.vaultOpen;
    }

    dom.pathCards.forEach(function (card) {
      var chosen = state.path === card.getAttribute("data-path");
      card.disabled = state.vaultOpen || Boolean(state.path) || !state.hasKey;
      card.classList.toggle("is-chosen", chosen);
      card.setAttribute("aria-pressed", chosen ? "true" : "false");
    });
  }

  function handlePathSelection(card) {
    if (state.vaultOpen) {
      toast("Brankas sudah terbuka. Jalur tidak diperlukan lagi.", "", 2200);
      return;
    }

    if (!state.hasKey) {
      toast(
        "Kunci brankas belum ada. Menangkan Save the Fish dulu.",
        "error",
        2800,
      );
      return;
    }

    if (state.path) {
      toast("Jalur sudah dipilih. Keypad menunggu.", "", 2200);
      return;
    }

    var path = card.getAttribute("data-path");
    if (path !== "cave" && path !== "lake") {
      return;
    }

    state.path = path;
    saveProgress();
    updateMountainUI();
    toast(
      path === "cave"
        ? "Jalur Gua Kabut dipilih. Pintu brankas muncul."
        : "Jalur Danau Terbalik dipilih. Pintu brankas muncul.",
      "success",
      2400,
    );

    window.clearTimeout(pathTimer);
    pathTimer = window.setTimeout(function () {
      if (isScreenActive("mountain")) {
        showScreen("keypad");
      }
    }, 900);
  }

  function updateKeypadDisplay() {
    var digits = keypadInput.split("");
    while (digits.length < 4) {
      digits.push("_");
    }
    if (dom.keypadDisplay) {
      dom.keypadDisplay.textContent = digits.join(" ");
      dom.keypadDisplay.setAttribute(
        "aria-label",
        "Kode dimasukkan: " + digits.join(" "),
      );
    }
  }

  function setKeypadMessage(message) {
    if (dom.keypadMessage) {
      dom.keypadMessage.textContent = message;
    }
  }

  function syncKeypadUI() {
    keypadLocked = false;
    keypadInput = "";

    if (dom.keypadDisplay) {
      dom.keypadDisplay.classList.remove("is-wrong");
      dom.keypadDisplay.classList.toggle("is-open", state.vaultOpen);
    }

    dom.keypadKeys.forEach(function (key) {
      key.disabled = state.vaultOpen;
    });

    if (state.vaultOpen) {
      if (dom.keypadDisplay) {
        dom.keypadDisplay.textContent = "2 4 0 3";
      }
      setKeypadMessage("Kode benar. Brankas terbuka. Rumah menunggu.");
    } else {
      updateKeypadDisplay();
      setKeypadMessage(DEFAULT_KEYPAD_MESSAGE);
    }
  }

  function shakeKeypadDisplay() {
    if (!dom.keypadDisplay) {
      return;
    }
    dom.keypadDisplay.classList.remove("is-wrong");
    void dom.keypadDisplay.offsetWidth;
    dom.keypadDisplay.classList.add("is-wrong");
  }

  function handleKeypadInput(key) {
    if (state.vaultOpen || keypadLocked) {
      return;
    }

    if (key === "clear") {
      keypadInput = "";
      updateKeypadDisplay();
      dom.keypadDisplay.classList.remove("is-wrong");
      setKeypadMessage("Input dibersihkan. Belum ada percobaan yang dihitung.");
      return;
    }

    if (key === "submit") {
      if (keypadInput.length < 4) {
        shakeKeypadDisplay();
        setKeypadMessage("Butuh tepat 4 digit. Jangan buru-buru.");
        return;
      }

      if (keypadInput === String(CONFIG.secretCode || "2403")) {
        state.vaultOpen = true;
        state.hasKey = true;
        state.clueB = true;
        state.minigameWon = true;
        state.stage = "keypad";
        saveProgress();

        if (dom.keypadDisplay) {
          dom.keypadDisplay.textContent = "2 4 0 3";
          dom.keypadDisplay.classList.remove("is-wrong");
          dom.keypadDisplay.classList.add("is-open");
        }
        dom.keypadKeys.forEach(function (button) {
          button.disabled = true;
        });
        setKeypadMessage(
          "Kode benar. Pintu brankas terbuka. Jangan lupa bernapas.",
        );
        toast("Brankas terbuka!", "success", 700);

        window.clearTimeout(keypadOpenTimer);
        keypadOpenTimer = window.setTimeout(openVault, 780);
        return;
      }

      keypadLocked = true;
      shakeKeypadDisplay();
      setKeypadMessage(
        WRONG_CODE_MESSAGES[
          Math.floor(Math.random() * WRONG_CODE_MESSAGES.length)
        ],
      );

      window.setTimeout(function () {
        keypadInput = "";
        updateKeypadDisplay();
        if (dom.keypadDisplay) {
          dom.keypadDisplay.classList.remove("is-wrong");
        }
        keypadLocked = false;
      }, 520);
      return;
    }

    if (!/^\d$/.test(key)) {
      return;
    }

    if (keypadInput.length >= 4) {
      return;
    }

    keypadInput += key;
    if (dom.keypadDisplay) {
      dom.keypadDisplay.classList.remove("is-wrong");
    }
    updateKeypadDisplay();
    setKeypadMessage("Sedang mengetik kode. Tekan OK saat sudah yakin.");
  }

  function openVault() {
    if (!state.vaultOpen) {
      return;
    }

    state.stage = "rpg";
    saveProgress();
    showScreen("rpg", { force: true });
  }

  function scheduleRpgScene() {
    if (rpgSceneStarted) {
      return;
    }

    window.setTimeout(function () {
      if (!isScreenActive("rpg")) {
        return;
      }
      startRpgScene();
    }, 70);
  }

  function startRpgScene() {
    if (rpgSceneStarted) {
      return;
    }
    rpgSceneStarted = true;

    if (typeof window.startRpgWorld === "function") {
      try {
        window.startRpgWorld();
        return;
      } catch (error) {
        if (window.console && window.console.error) {
          window.console.error("startRpgWorld gagal dijalankan:", error);
        }
      }
    }
  }

  function drawRpgFallback() {
    if (!rpgCtx) {
      return;
    }

    var ctx = rpgCtx;
    var width = 800;
    var height = 1120;

    dom.rpgLocation.textContent = "RUANG KUE · BRANKAS TERBUKA";
    dom.rpgQuest.textContent = "MISI: MAKAN KUE";
    dom.rpgPrompt.textContent = "Brankas terbuka! Kue ada di meja.";

    var sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#e3f3ff");
    sky.addColorStop(0.55, "#ffe3ea");
    sky.addColorStop(1, "#fff6e6");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#fffdf6";
    ctx.fillRect(0, 660, width, height - 660);
    ctx.fillStyle = "#cdedd6";
    ctx.fillRect(0, 660, width, 24);
    ctx.fillStyle = "#f7e8ce";
    for (var plank = 0; plank < 8; plank += 1) {
      ctx.fillRect(plank * 110, 710, 4, 410);
    }

    ctx.fillStyle = "#e0d3f5";
    ctx.fillRect(80, 180, 250, 440);
    ctx.strokeStyle = "#332b3a";
    ctx.lineWidth = 5;
    ctx.strokeRect(80, 180, 250, 440);

    ctx.fillStyle = "#332b3a";
    roundRect(ctx, 104, 210, 202, 382, 16);
    ctx.fill();
    ctx.fillStyle = "#fff6e6";
    roundRect(ctx, 118, 224, 174, 354, 12);
    ctx.fill();

    ctx.fillStyle = "#a3d6fa";
    roundRect(ctx, 144, 252, 122, 298, 10);
    ctx.fill();
    ctx.strokeStyle = "#332b3a";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#f2799a";
    ctx.beginPath();
    ctx.arc(250, 408, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(548, 704);
    ctx.fillStyle = "#f1c3a3";
    roundRect(ctx, -142, 0, 284, 40, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-112, 40, 20, 142);
    ctx.fillRect(92, 40, 20, 142);
    ctx.strokeRect(-112, 40, 20, 142);
    ctx.strokeRect(92, 40, 20, 142);

    ctx.fillStyle = "#fff6e6";
    roundRect(ctx, -94, -80, 188, 86, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffc9d6";
    ctx.beginPath();
    ctx.moveTo(-94, -58);
    ctx.quadraticCurveTo(-46, -28, 0, -58);
    ctx.quadraticCurveTo(48, -28, 94, -58);
    ctx.lineTo(94, -42);
    ctx.quadraticCurveTo(48, -12, 0, -42);
    ctx.quadraticCurveTo(-46, -12, -94, -42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#c5e7ff";
    roundRect(ctx, -66, -142, 132, 66, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffc9d6";
    ctx.beginPath();
    ctx.moveTo(-66, -124);
    ctx.quadraticCurveTo(-33, -102, 0, -124);
    ctx.quadraticCurveTo(33, -102, 66, -124);
    ctx.lineTo(66, -110);
    ctx.quadraticCurveTo(33, -88, 0, -110);
    ctx.quadraticCurveTo(-33, -88, -66, -110);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#332b3a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-36, -142);
    ctx.lineTo(-36, -168);
    ctx.moveTo(0, -142);
    ctx.lineTo(0, -174);
    ctx.moveTo(36, -142);
    ctx.lineTo(36, -168);
    ctx.stroke();
    ctx.fillStyle = "#f2799a";
    [-36, 0, 36].forEach(function (x, index) {
      ctx.beginPath();
      ctx.arc(x, index === 1 ? -180 : -174, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.fillStyle = "#332b3a";
    ctx.textAlign = "center";
    ctx.font = "700 34px Nunito, sans-serif";
    ctx.fillText("BRANKAS TERBUKA", width / 2, 120);
    ctx.fillStyle = "#6b5a70";
    ctx.font = "700 22px Nunito, sans-serif";
    ctx.fillText("Kue ulang tahun sudah menunggu di meja.", width / 2, 162);

    var confettiColors = [
      "#f2799a",
      "#a3d6fa",
      "#8fd5b4",
      "#e0d3f5",
      "#fff6e6",
    ];
    for (var i = 0; i < 34; i += 1) {
      var x = (i * 97) % width;
      var y = 250 + ((i * 131) % 390);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i * 0.7) % Math.PI);
      ctx.fillStyle = confettiColors[i % confettiColors.length];
      ctx.fillRect(-5, -12, 10, 24);
      ctx.restore();
    }
  }

  function toast(message, variant, duration) {
    if (!toastElement) {
      toastElement = document.createElement("p");
      toastElement.className = "toast";
      toastElement.setAttribute("role", "status");
      toastElement.setAttribute("aria-live", "polite");
      (dom.game || document.body).appendChild(toastElement);
    }

    toastElement.className = "toast" + (variant ? " toast--" + variant : "");
    toastElement.textContent = message;
    toastElement.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastElement.hidden = true;
    }, duration || 2600);
  }

  function hideToast() {
    window.clearTimeout(toastTimer);
    if (toastElement) {
      toastElement.hidden = true;
    }
  }

  function closeModal() {
    if (dom.modalOverlay) {
      dom.modalOverlay.hidden = true;
    }
    document.dispatchEvent(new CustomEvent("otter:modal-closed"));
  }

  function resetProgress() {
    var confirmed = window.confirm(
      "Reset semua progres? Nama, puzzle, kunci, dan kode akan hilang seperti biskuit di meja CEO Meow.",
    );
    if (!confirmed) {
      return;
    }

    window.clearTimeout(bootTimer);
    window.clearTimeout(pathTimer);
    window.clearTimeout(keypadOpenTimer);
    window.clearTimeout(toastTimer);
    pathTimer = 0;
    keypadOpenTimer = 0;
    bootTimer = 0;

    stopFishGame();
    fishGame.items = [];
    fishGame.particles = [];
    fishGame.score = 0;
    fishGame.lives = 3;
    fishGame.ended = false;
    fishGame.won = false;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      saveWarningShown = false;
    }

    state = createDefaultState();
    bootReady = false;
    bootRetrying = false;
    keypadInput = "";
    keypadLocked = false;
    boxDialogIndex = -1;
    rpgSceneStarted = false;
    savedProgressRestored = false;
    saveWarningShown = false;

    if (window.otterAlert) {
      window.otterAlert.state = getPublicState();
    }

    closeModal();
    if (typeof window.resetRpgWorld === "function") {
      try {
        window.resetRpgWorld();
      } catch (error) {
        if (window.console && window.console.error) {
          window.console.error("resetRpgWorld gagal:", error);
        }
      }
    }
    updateHearts(3);
    updateScore(0);
    renderPuzzle();
    syncBootUI();
    syncBoxUI();
    updateMountainUI();
    syncKeypadUI();

    if (dom.fishNote) {
      dom.fishNote.textContent = DEFAULT_NOTE;
    }
    if (dom.fishRetry) {
      dom.fishRetry.hidden = true;
    }
    if (dom.fishExit) {
      dom.fishExit.textContent = "Keluar";
    }

    showScreen("boot", { force: true, noSave: true, silent: true });
    toast("Progress dihapus. Kembali ke awal, tanpa jejak biskuit.", "", 3200);
  }

  function handleKeydown(event) {
    if (dom.modalOverlay && !dom.modalOverlay.hidden) {
      if (event.key === "Escape") {
        closeModal();
      }
      return;
    }

    if (isScreenActive("keypad") && !state.vaultOpen) {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        handleKeypadInput(event.key);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        keypadInput = keypadInput.slice(0, -1);
        updateKeypadDisplay();
        setKeypadMessage("Satu digit dihapus. Santai, tidak ada yang melihat.");
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        handleKeypadInput("submit");
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleKeypadInput("clear");
        return;
      }
    }

    if (isScreenActive("minigame") && fishGame.active) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        fishGame.targetX = clamp(fishGame.targetX - 70, FISH.minX, FISH.maxX);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        fishGame.targetX = clamp(fishGame.targetX + 70, FISH.minX, FISH.maxX);
      }
    }
  }

  function bindEvents() {
    if (dom.retry) {
      dom.retry.addEventListener("click", handleRetry);
    }

    if (dom.reset) {
      dom.reset.addEventListener("click", resetProgress);
    }

    var btnReset = document.getElementById("btn-reset");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        resetProgress();
      });
    }

    if (dom.mysteryBox) {
      dom.mysteryBox.addEventListener("click", handleBoxTap);
      dom.mysteryBox.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleBoxTap();
        }
      });
    }

    if (dom.playerForm) {
      dom.playerForm.addEventListener("submit", handlePlayerSubmit);
    }

    dom.puzzleOptions.forEach(function (button) {
      button.addEventListener("click", function () {
        handlePuzzleAnswer(Number(button.getAttribute("data-index")));
      });
    });

    if (dom.hintButton) {
      dom.hintButton.addEventListener("click", handleHint);
    }

    dom.pathCards.forEach(function (card) {
      card.addEventListener("click", function () {
        handlePathSelection(card);
      });
    });

    dom.keypadKeys.forEach(function (button) {
      button.addEventListener("click", function () {
        handleKeypadInput(button.getAttribute("data-key"));
      });
    });

    if (dom.fishRetry) {
      dom.fishRetry.addEventListener("click", function () {
        startFishGame();
      });
    }

    if (dom.fishCanvas) {
      dom.fishCanvas.style.touchAction = "none";
      dom.fishCanvas.addEventListener("pointerdown", handleFishPointer);
      dom.fishCanvas.addEventListener("pointermove", handleFishPointer);
    }

    if (dom.modalClose) {
      dom.modalClose.addEventListener("click", closeModal);
    }

    if (dom.modalOverlay) {
      dom.modalOverlay.addEventListener("click", function (event) {
        if (event.target === dom.modalOverlay) {
          closeModal();
        }
      });
    }

    document.addEventListener("click", function (event) {
      var goTarget =
        event.target && event.target.closest
          ? event.target.closest("[data-go]")
          : null;
      if (!goTarget) {
        return;
      }
      event.preventDefault();
      showScreen(goTarget.getAttribute("data-go"));
    });

    document.addEventListener("keydown", handleKeydown);
  }

  function init() {
    var saved = readSavedProgress();

    if (saved) {
      state = saved;
      savedProgressRestored = true;
      bootReady = true;
    } else {
      state = createDefaultState();
      bootReady = false;
    }

    if (window.otterAlert) {
      window.otterAlert.state = getPublicState();
    }

    renderPuzzle();
    updateHearts(3);
    updateScore(0);
    bindEvents();

    if (!saved) {
      showScreen("boot", { force: true, noSave: true, silent: true });
      return;
    }

    var restoredStage = state.stage;
    var shown = showScreen(restoredStage, { noSave: true, silent: true });

    if (!shown) {
      showScreen(fallbackStage(), { force: true, noSave: true, silent: true });
    }

    if (restoredStage !== "boot") {
      var stageNames = {
        box: "peti",
        puzzle: "puzzle",
        minigame: "mini-game",
        mountain: "gunung",
        keypad: "keypad",
        rpg: "rumah",
      };
      toast(
        "Progres dipulihkan. Lanjut dari " +
          (stageNames[restoredStage] || "petualangan") +
          ".",
        "",
        2200,
      );
    }
  }

  window.otterAlert = {
    config: CONFIG,
    state: getPublicState(),
    go: function (name, options) {
      return showScreen(name, options);
    },
    save: saveProgress,
    reset: resetProgress,
    toast: toast,
    closeModal: closeModal,
  };

  init();
})();
