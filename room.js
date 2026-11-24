(function () {
  "use strict";

  const cfg = window.GAME_CONFIG || {};
  const hoodieColor = cfg.hoodieColor || "#89CFF0";

  function getState() {
    return window.otterAlert?.state || {};
  }

  function saveProgress() {
    if (window.otterAlert && window.otterAlert.save) {
      window.otterAlert.save();
    }
  }

  function toast(message, variant, duration) {
    const otterToast =
      window.otterAlert && typeof window.otterAlert.toast === "function"
        ? window.otterAlert.toast
        : null;
    if (otterToast) {
      otterToast(message, variant, duration);
      return;
    }
    if (typeof window.toast === "function") {
      window.toast(message, variant, duration);
      return;
    }
    if (window.console && window.console.log) {
      window.console.log(message);
    }
  }

  const rpgCanvas = document.getElementById("rpg-canvas");
  if (!rpgCanvas) {
    throw new Error("#rpg-canvas not found");
  }
  const rpgCtx = rpgCanvas.getContext("2d");
  rpgCanvas.style.touchAction = "none";
  rpgCanvas.style.msTouchAction = "none";

  const locationEl = document.getElementById("rpg-location");
  const questEl = document.getElementById("rpg-quest");
  const promptEl = document.getElementById("rpg-prompt");

  const TILE = 32;
  const MAP1_W = 24;
  const MAP1_H = 16;
  const MAP2_W = 20;
  const MAP2_H = 18;

  const T = {
    EMPTY: 0,
    ROAD: 1,
    YARD: 2,
    HOUSE: 3,
    MAILBOX: 4,
    TREE: 5,
    LAMP: 6,
    KEY: 7,
    HOUSE_DOOR: 8,
    BRIDGE: 9,
    RIVER: 10,
    FLOWER: 11,
  };

  let currentMap = null;
  let player = { x: 4, y: 12, step: 0, moving: false };
  let mailboxRead = false;
  let hasHouseKey = false;
  let npcTalked = false;
  let giftOpened = false;
  let rpgSceneStarted = false;
  let inputBound = false;
  let resizeBound = false;
  let pathTimer = 0;
  let stepTimer = 0;
  let targetTile = null;
  let photoFrame = "a";
  let photoPose = "wave";
  let photoStream = null;
  let cameraRequestId = 0;
  let capturedPhotoDataUrl = "";

  let isMusicPlaying = false;
  let musicLoopTimer = null;
  let htmlAudioPlayer = null;
  let webAudioCtx = null;
  let modalCloseBound = false;

  const mailbox = { x: 7, y: 3 };
  const keyTile = { x: 21, y: 8 };
  const houseDoor = { x: 4, y: 3 };
  const npc = { x: 5, y: 4 };
  const giftBox = { x: 10, y: 8 };
  const computerDesk = { x: 4, y: 14 };
  const photoBooth = { x: 14, y: 14 };
  const exitDoor = { x: 9, y: 16 };

  function createMap1() {
    const tiles = [];
    for (let y = 0; y < MAP1_H; y += 1) {
      tiles[y] = [];
      for (let x = 0; x < MAP1_W; x += 1) {
        tiles[y][x] = T.YARD;
      }
    }

    for (let y = 1; y <= 3; y += 1) {
      for (let x = 2; x <= 6; x += 1) {
        tiles[y][x] = T.HOUSE;
      }
    }
    tiles[3][4] = T.HOUSE_DOOR;
    tiles[3][7] = T.MAILBOX;

    for (let y = 4; y <= 12; y += 1) {
      tiles[y][4] = T.ROAD;
    }
    for (let x = 4; x <= 18; x += 1) {
      tiles[12][x] = T.ROAD;
    }
    for (let y = 12; y >= 8; y -= 1) {
      tiles[y][18] = T.ROAD;
    }
    for (let x = 18; x <= 22; x += 1) {
      tiles[8][x] = T.BRIDGE;
    }
    for (let y = 5; y <= 7; y += 1) {
      for (let x = 19; x <= 23; x += 1) {
        tiles[y][x] = T.RIVER;
      }
    }
    tiles[8][21] = T.KEY;

    tiles[4][9] = T.TREE;
    tiles[5][12] = T.TREE;
    tiles[6][9] = T.TREE;
    tiles[4][12] = T.FLOWER;
    tiles[6][13] = T.FLOWER;
    tiles[9][5] = T.FLOWER;
    tiles[1][2] = T.LAMP;

    return tiles;
  }

  function createMap2() {
    const tiles = [];
    for (let y = 0; y < MAP2_H; y += 1) {
      tiles[y] = [];
      for (let x = 0; x < MAP2_W; x += 1) {
        tiles[y][x] = T.YARD;
      }
    }

    for (let y = 0; y < MAP2_H; y += 1) {
      tiles[y][0] = T.HOUSE;
      tiles[y][MAP2_W - 1] = T.HOUSE;
    }
    for (let x = 0; x < MAP2_W; x += 1) {
      tiles[0][x] = T.HOUSE;
      tiles[MAP2_H - 1][x] = T.HOUSE;
    }

    for (let y = 1; y < MAP2_H - 1; y += 1) {
      for (let x = 1; x < MAP2_W - 1; x += 1) {
        tiles[y][x] = T.YARD;
      }
    }

    tiles[9][1] = T.ROAD;
    tiles[9][2] = T.ROAD;
    tiles[9][3] = T.ROAD;
    tiles[9][4] = T.ROAD;
    for (let y = 9; y <= 15; y += 1) {
      tiles[y][9] = T.ROAD;
    }

    tiles[14][4] = T.HOUSE;
    tiles[14][5] = T.HOUSE;
    tiles[15][4] = T.HOUSE;
    tiles[15][5] = T.HOUSE;

    tiles[14][14] = T.HOUSE;
    tiles[14][15] = T.HOUSE;
    tiles[15][14] = T.HOUSE;
    tiles[15][15] = T.HOUSE;

    tiles[16][9] = T.HOUSE_DOOR;
    tiles[16][10] = T.HOUSE_DOOR;

    tiles[5][7] = T.HOUSE;
    tiles[5][8] = T.HOUSE;
    tiles[6][7] = T.HOUSE;
    tiles[12][5] = T.HOUSE;
    tiles[12][6] = T.HOUSE;
    tiles[13][5] = T.HOUSE;
    tiles[13][6] = T.HOUSE;
    tiles[7][13] = T.HOUSE;
    tiles[7][14] = T.HOUSE;
    tiles[8][13] = T.HOUSE;

    tiles[8][10] = T.HOUSE;
    tiles[8][11] = T.HOUSE;

    return tiles;
  }

  const MAP1 = { tiles: createMap1() };
  const MAP2 = { tiles: createMap2() };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fitCanvas() {
    rpgCanvas.style.width = "100%";
    rpgCanvas.style.height = "100%";
    rpgCanvas.style.display = "block";
    const parent = rpgCanvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : null;
    const w =
      rect && rect.width ? rect.width : parent ? parent.clientWidth : 360;
    const h =
      rect && rect.height ? rect.height : parent ? parent.clientHeight : 300;
    rpgCanvas.width = Math.max(1, Math.floor(w));
    rpgCanvas.height = Math.max(1, Math.floor(h));
  }

  function colorForTile1(tile) {
    switch (tile) {
      case T.ROAD:
        return "#e8d8b8";
      case T.YARD:
        return "#86efac";
      case T.HOUSE:
        return "#fff6e6";
      case T.MAILBOX:
        return "#89CFF0";
      case T.TREE:
        return "#6FB2D2";
      case T.LAMP:
        return "#B3D4F2";
      case T.KEY:
        return "#FFD700";
      case T.HOUSE_DOOR:
        return "#8B4513";
      case T.BRIDGE:
        return "#DEB887";
      case T.RIVER:
        return "#B3D4F2";
      case T.FLOWER:
        return "#a7f3d0";
      default:
        return "#86efac";
    }
  }

  function colorForTile2(tile) {
    switch (tile) {
      case T.ROAD:
        return "#f8b195";
      case T.YARD:
        return "#e8c39e";
      case T.HOUSE:
        return "#B3D4F2";
      case T.HOUSE_DOOR:
        return "#6FB2D2";
      default:
        return "#e8c39e";
    }
  }

  function drawGrassTexture(ctx) {
    ctx.fillStyle = "#a7f3d0";
    for (let y = 0; y < MAP1_H; y += 1) {
      for (let x = 0; x < MAP1_W; x += 1) {
        if ((x + y) % 3 === 0) {
          ctx.fillRect(x * TILE + 6, y * TILE + 8, 3, 3);
          ctx.fillRect(x * TILE + 18, y * TILE + 20, 3, 3);
        }
      }
    }
  }

  function drawRoadTexture(ctx) {
    ctx.fillStyle = "#d7c4a8";
    for (let y = 0; y < MAP1_H; y += 1) {
      for (let x = 0; x < MAP1_W; x += 1) {
        if (MAP1.tiles[y][x] === T.ROAD) {
          ctx.fillRect(x * TILE + 4, y * TILE + 4, 6, 6);
          ctx.fillRect(x * TILE + 18, y * TILE + 18, 6, 6);
        }
      }
    }
  }

  function drawHouse(ctx) {
    const x = 2 * TILE;
    const y = 1 * TILE;
    const w = 5 * TILE;
    const h = 3 * TILE;

    ctx.fillStyle = "#fff6e6";
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y + TILE * 0.4, w, h - TILE * 0.4, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#89CFF0";
    ctx.beginPath();
    ctx.moveTo(x - TILE * 0.2, y + TILE * 0.5);
    ctx.lineTo(x + w / 2, y - TILE * 0.4);
    ctx.lineTo(x + w + TILE * 0.2, y + TILE * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + (w / 5) * i, y + TILE * 0.1);
      ctx.lineTo(x + (w / 5) * i, y + TILE * 0.5);
      ctx.stroke();
    }

    ctx.fillStyle = "#B3D4F2";
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    roundRect(ctx, x + TILE * 0.4, y + TILE * 0.9, TILE * 0.9, TILE * 0.9, 3);
    ctx.fill();
    ctx.stroke();
    roundRect(
      ctx,
      x + w - TILE * 1.3,
      y + TILE * 0.9,
      TILE * 0.9,
      TILE * 0.9,
      3,
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hasHouseKey ? "#86efac" : "#8B4513";
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    roundRect(
      ctx,
      x + w / 2 - TILE * 0.45,
      y + TILE * 1.2,
      TILE * 0.9,
      TILE * 1.4,
      3,
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(x + w / 2 + TILE * 0.25, y + TILE * 1.9, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMailbox(ctx) {
    const x = mailbox.x * TILE;
    const y = mailbox.y * TILE;
    ctx.fillStyle = "#89CFF0";
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    roundRect(ctx, x + 4, y + 8, TILE - 8, TILE - 4, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2C3E50";
    ctx.fillRect(x + TILE / 2 - 2, y + 2, 4, 10);
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(x + TILE - 10, y + 12, 4, 8);
  }

  function drawTree(ctx, gx, gy) {
    const x = gx * TILE;
    const y = gy * TILE;
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(x + TILE / 2 - 4, y + TILE * 0.5, 8, TILE * 0.5);
    ctx.fillStyle = "#86efac";
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE * 0.35, TILE * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawFlower(ctx, gx, gy) {
    const x = gx * TILE + TILE / 2;
    const y = gy * TILE + TILE / 2;
    ctx.fillStyle = "#89CFF0";
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(angle) * 5,
        y + Math.sin(angle) * 5,
        3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLamp(ctx) {
    const x = 2 * TILE;
    const y = 1 * TILE;
    ctx.fillStyle = "#2C3E50";
    ctx.fillRect(x + TILE / 2 - 2, y + TILE * 0.3, 4, TILE * 0.7);
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE * 0.25, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawRiver(ctx) {
    ctx.fillStyle = "#B3D4F2";
    ctx.fillRect(19 * TILE, 5 * TILE, 5 * TILE, 3 * TILE);
    ctx.strokeStyle = "#89CFF0";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(19 * TILE + i * 18, 5 * TILE + 8);
      ctx.quadraticCurveTo(
        19 * TILE + i * 18 + 9,
        5 * TILE + 16,
        19 * TILE + i * 18 + 18,
        5 * TILE + 8,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(19 * TILE + i * 18, 6 * TILE + 16);
      ctx.quadraticCurveTo(
        19 * TILE + i * 18 + 9,
        6 * TILE + 24,
        19 * TILE + i * 18 + 18,
        6 * TILE + 16,
      );
      ctx.stroke();
    }
  }

  function drawBridge(ctx) {
    ctx.fillStyle = "#DEB887";
    ctx.fillRect(18 * TILE, 8 * TILE, 5 * TILE, TILE);
    ctx.strokeStyle = "#8B4513";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(18 * TILE + i * TILE + TILE / 2, 8 * TILE);
      ctx.lineTo(18 * TILE + i * TILE + TILE / 2, 9 * TILE);
      ctx.stroke();
    }
    ctx.strokeRect(18 * TILE, 8 * TILE, 5 * TILE, TILE);
  }

  function drawKey(ctx) {
    if (hasHouseKey) {
      return;
    }
    const x = keyTile.x * TILE + TILE / 2;
    const y = keyTile.y * TILE + TILE / 2;
    ctx.fillStyle = "#FFD700";
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 6, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(x, y - 3, 16, 6);
    ctx.fillRect(x + 10, y + 3, 4, 8);
    ctx.fillRect(x + 14, y + 3, 4, 6);
  }

  function drawPlayer(ctx, gx, gy, step, moving) {
    const cx = gx * TILE + TILE / 2;
    const cy = gy * TILE + TILE / 2;
    const bob = moving ? (step ? -1 : 1) : 0;

    ctx.save();
    ctx.translate(cx, cy + bob);

    ctx.fillStyle = "rgba(51,43,58,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 14, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2C3E50";
    const legOffset = step ? 3 : -3;
    ctx.fillRect(-6, 6 + legOffset, 4, 8);
    ctx.fillRect(2, 6 - legOffset, 4, 8);

    ctx.fillStyle = "#1E88E5";
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 1.5;
    roundRect(ctx, -9, -6, 18, 16, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#F1C3A3";
    ctx.beginPath();
    ctx.arc(0, -14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.arc(0, -16, 8, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = "#332B3A";
    ctx.beginPath();
    ctx.arc(-3, -13, 1.2, 0, Math.PI * 2);
    ctx.arc(3, -13, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawMap1() {
    rpgCtx.clearRect(0, 0, rpgCanvas.width, rpgCanvas.height);
    rpgCtx.fillStyle = "#dff3ff";
    rpgCtx.fillRect(0, 0, rpgCanvas.width, rpgCanvas.height);

    const sx = rpgCanvas.width / (MAP1_W * TILE);
    const sy = rpgCanvas.height / (MAP1_H * TILE);

    rpgCtx.save();
    rpgCtx.scale(sx, sy);

    for (let y = 0; y < MAP1_H; y += 1) {
      for (let x = 0; x < MAP1_W; x += 1) {
        rpgCtx.fillStyle = colorForTile1(MAP1.tiles[y][x]);
        rpgCtx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    drawGrassTexture(rpgCtx);
    drawRoadTexture(rpgCtx);
    drawRiver(rpgCtx);
    drawBridge(rpgCtx);
    drawHouse(rpgCtx);
    drawMailbox(rpgCtx);
    drawTree(rpgCtx, 9, 4);
    drawTree(rpgCtx, 12, 5);
    drawTree(rpgCtx, 9, 6);
    drawFlower(rpgCtx, 12, 4);
    drawFlower(rpgCtx, 13, 6);
    drawFlower(rpgCtx, 5, 9);
    drawLamp(rpgCtx);
    drawKey(rpgCtx);
    drawPlayer(rpgCtx, player.x, player.y, player.step, player.moving);

    rpgCtx.restore();
  }

  function drawHoodieNpc(ctx, gx, gy) {
    const cx = gx * TILE + TILE / 2;
    const cy = gy * TILE + TILE / 2;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = "rgba(51,43,58,0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 16, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hoodieColor;
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    roundRect(ctx, -11, -2, 22, 22, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hoodieColor;
    ctx.beginPath();
    ctx.arc(0, -8, 12, Math.PI, 0);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#F1C3A3";
    ctx.beginPath();
    ctx.arc(0, -6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#332B3A";
    ctx.beginPath();
    ctx.arc(-2.5, -6, 1.2, 0, Math.PI * 2);
    ctx.arc(2.5, -6, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(-3, 10);
    ctx.moveTo(3, 0);
    ctx.lineTo(3, 10);
    ctx.stroke();

    ctx.restore();
  }

  function drawFurniture(ctx) {
    ctx.fillStyle = "#f8b195";
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    roundRect(ctx, 7 * TILE + 2, 5 * TILE + 4, TILE * 2.4, TILE * 1.2, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#a8d5ba";
    roundRect(ctx, 12 * TILE + 2, 5 * TILE + 4, TILE * 2.4, TILE * 1.2, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8B4513";
    roundRect(ctx, 12 * TILE + 4, 5 * TILE + 8, TILE * 2, TILE * 0.8, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#DDEEDD";
    roundRect(ctx, 3 * TILE + 2, 6 * TILE + 4, TILE * 7, TILE * 1.5, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#FFD700";
    roundRect(ctx, 10 * TILE + 4, 8 * TILE + 4, TILE * 2, TILE * 1.7, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#89CFF0";
    ctx.fillRect(10 * TILE + TILE, 8 * TILE + 4, 4, TILE * 1.7);

    ctx.fillStyle = "#89CFF0";
    roundRect(ctx, 4 * TILE + 4, 14 * TILE + 4, TILE * 2, TILE * 2.5, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#2C3E50";
    ctx.fillRect(4 * TILE + 10, 14 * TILE + 10, TILE * 1.4, TILE * 1.2);

    ctx.fillStyle = "#86efac";
    roundRect(ctx, 14 * TILE + 4, 14 * TILE + 4, TILE * 2.6, TILE * 1.8, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#8B4513";
    roundRect(ctx, 9 * TILE + 4, 16 * TILE + 2, TILE * 1.6, TILE * 1.4, 4);
    ctx.fill();
    ctx.stroke();
  }

  function drawFireplace(ctx) {
    const x = 13 * TILE;
    const y = 7 * TILE;
    ctx.fillStyle = "#8B4513";
    roundRect(ctx, x + 4, y + 4, TILE * 2, TILE * 1.6, 4);
    ctx.fill();
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#FF9F1C";
    ctx.beginPath();
    ctx.moveTo(x + TILE * 0.6, y + TILE * 1.4);
    ctx.quadraticCurveTo(
      x + TILE,
      y + TILE * 0.4,
      x + TILE * 1.4,
      y + TILE * 1.4,
    );
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.moveTo(x + TILE * 0.8, y + TILE * 1.4);
    ctx.quadraticCurveTo(
      x + TILE,
      y + TILE * 0.8,
      x + TILE * 1.2,
      y + TILE * 1.4,
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawMap2() {
    rpgCtx.clearRect(0, 0, rpgCanvas.width, rpgCanvas.height);
    rpgCtx.fillStyle = "#dff3ff";
    rpgCtx.fillRect(0, 0, rpgCanvas.width, rpgCanvas.height);

    const sx = rpgCanvas.width / (MAP2_W * TILE);
    const sy = rpgCanvas.height / (MAP2_H * TILE);

    rpgCtx.save();
    rpgCtx.scale(sx, sy);

    for (let y = 0; y < MAP2_H; y += 1) {
      for (let x = 0; x < MAP2_W; x += 1) {
        rpgCtx.fillStyle = colorForTile2(MAP2.tiles[y][x]);
        rpgCtx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    rpgCtx.fillStyle = "rgba(137,207,240,0.25)";
    rpgCtx.fillRect(2 * TILE, 2 * TILE, 16 * TILE, 12 * TILE);

    drawFurniture(rpgCtx);
    drawFireplace(rpgCtx);
    drawHoodieNpc(rpgCtx, npc.x, npc.y);
    drawPlayer(rpgCtx, player.x, player.y, player.step, player.moving);

    rpgCtx.restore();
  }

  function redraw() {
    if (currentMap === MAP2) {
      drawMap2();
    } else {
      drawMap1();
    }
  }

  function isPassable(map, x, y) {
    if (x < 0 || y < 0 || x >= map.tiles[0].length || y >= map.tiles.length) {
      return false;
    }
    const tile = map.tiles[y][x];
    if (
      tile === T.HOUSE ||
      tile === T.MAILBOX ||
      tile === T.TREE ||
      tile === T.LAMP ||
      tile === T.RIVER
    ) {
      return false;
    }
    if (tile === T.HOUSE_DOOR) {
      return currentMap === MAP2 || hasHouseKey;
    }
    return true;
  }

  function enterHouse() {
    window.clearInterval(pathTimer);
    targetTile = null;
    currentMap = MAP2;
    player.x = 15;
    player.y = 9;
    player.moving = false;
    updateQuest();
    redraw();
    toast("Masuk ke dalam rumah. Cari orang ber-hoodie.", "success", 2200);
  }

  function leaveHouse() {
    window.clearInterval(pathTimer);
    targetTile = null;
    currentMap = MAP1;
    player.x = 4;
    player.y = 12;
    player.moving = false;
    updateQuest();
    redraw();
    toast("Keluar ke halaman depan.", "success", 2000);
  }

  function handleTileEnter() {
    const tile = currentMap.tiles[player.y][player.x];
    if (currentMap === MAP1) {
      if (tile === T.KEY && !hasHouseKey) {
        if (!mailboxRead) {
          toast(
            "Baca kotak surat dulu. CEO Meow menyembunyikan petunjuknya di sana.",
            "error",
            2400,
          );
          return;
        }
        hasHouseKey = true;
        currentMap.tiles[player.y][player.x] = T.BRIDGE;
        toast(
          "Kunci Rumah ditemukan! Sekarang buka pintu rumah.",
          "success",
          2200,
        );
        updateQuest();
      }
      if (tile === T.HOUSE_DOOR && hasHouseKey) {
        enterHouse();
      }
    } else if (tile === T.HOUSE_DOOR) {
      leaveHouse();
    }
  }

  function movePlayer(dx, dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (!isPassable(currentMap, nx, ny)) {
      return;
    }
    player.x = nx;
    player.y = ny;
    player.step = 1 - player.step;
    player.moving = true;
    window.clearTimeout(stepTimer);
    stepTimer = window.setTimeout(function () {
      player.moving = false;
      redraw();
    }, 140);
    handleTileEnter();
    redraw();
  }

  function nearEntity(entity) {
    return (
      Math.abs(player.x - entity.x) <= 1 && Math.abs(player.y - entity.y) <= 1
    );
  }

  function fakeEndingSequence() {
    if (giftOpened) {
      openBirthdayCakeModal();
      return;
    }

    const lines =
      cfg.dialogs && cfg.dialogs.fakeEnding
        ? cfg.dialogs.fakeEnding
        : [
            "Selamat! Kamu menemukan dapur kosong.",
            "Ini fake ending. Ending aslinya masih menunggu.",
            "Jangan berkecil hati, setiap ending palsu adalah kesempatan.",
          ];

    toast(
      "FAKE ENDING · CEO MEOW: Kue ulang tahun tidak ada di sini.",
      "error",
      2600,
    );
    lines.forEach(function (line, index) {
      window.setTimeout(
        function () {
          if (currentMap === MAP2) {
            toast(line, "error", 2300);
          }
        },
        (index + 1) * 1400,
      );
    });
    window.setTimeout(
      function () {
        if (currentMap !== MAP2) {
          return;
        }
        toast(
          "Plot Twist: Kue itu muncul kembali di atas meja!",
          "success",
          2600,
        );
        window.setTimeout(function () {
          if (currentMap === MAP2) {
            openBirthdayCakeModal(function () {
              giftOpened = true;
              updateQuest();
              toast(
                "Meja Komputer Retro dan Bilik Photobooth sekarang terbuka.",
                "success",
                2800,
              );
            });
          }
        }, 1300);
      },
      (lines.length + 1) * 1400 + 500,
    );
  }

  function handleA() {
    const modalOpen =
      document.getElementById("modal-overlay") &&
      !document.getElementById("modal-overlay").hidden;
    if (modalOpen) {
      return;
    }

    if (currentMap === MAP1) {
      if (nearEntity(mailbox)) {
        mailboxRead = true;
        updateQuest();
        redraw();
        openMailboxLetter();
        return;
      }
      if (nearEntity(keyTile)) {
        if (!hasHouseKey) {
          if (!mailboxRead) {
            toast(
              "Baca kotak surat dulu. Petunjuk kunci ada di surat CEO Meow.",
              "error",
              2400,
            );
            return;
          }
          hasHouseKey = true;
          currentMap.tiles[keyTile.y][keyTile.x] = T.BRIDGE;
          updateQuest();
          redraw();
          toast(
            "Kunci Rumah ditemukan! Pintu rumah bisa dibuka.",
            "success",
            2200,
          );
        } else {
          toast("Kunci Rumah sudah di tanganmu.", "success", 1200);
        }
        return;
      }
      if (nearEntity(houseDoor)) {
        if (hasHouseKey) {
          enterHouse();
        } else {
          toast(
            "Pintu rumah masih terkunci. Cari kunci di jembatan kanan.",
            "error",
            2000,
          );
        }
        return;
      }
      toast("Tidak ada yang bisa diperiksa di sini.", "", 1200);
      return;
    }

    if (nearEntity(npc)) {
      npcTalked = true;
      updateQuest();
      openHoodieDialog();
      return;
    }
    if (nearEntity(giftBox)) {
      fakeEndingSequence();
      return;
    }
    if (nearEntity(computerDesk)) {
      if (!giftOpened) {
        toast("Periksa peti hadiah di tengah ruangan dulu.", "error", 2200);
        return;
      }
      openComputerModal();
      return;
    }
    if (nearEntity(photoBooth)) {
      if (!giftOpened) {
        toast("Periksa peti hadiah di tengah ruangan dulu.", "error", 2200);
        return;
      }
      openPhotoboothModal();
      return;
    }
    if (nearEntity(exitDoor)) {
      leaveHouse();
      return;
    }
    toast("Tidak ada yang bisa diperiksa di sini.", "", 1200);
  }

  function startPathTo(tx, ty) {
    targetTile = { x: tx, y: ty };
    window.clearInterval(pathTimer);
    pathTimer = window.setInterval(function () {
      if (!targetTile) {
        return;
      }
      const dx = Math.sign(targetTile.x - player.x);
      const dy = Math.sign(targetTile.y - player.y);
      if (dx === 0 && dy === 0) {
        window.clearInterval(pathTimer);
        targetTile = null;
        return;
      }
      if (dx !== 0 && isPassable(currentMap, player.x + dx, player.y)) {
        movePlayer(dx, 0);
      } else if (dy !== 0 && isPassable(currentMap, player.x, player.y + dy)) {
        movePlayer(0, dy);
      } else {
        window.clearInterval(pathTimer);
        targetTile = null;
      }
    }, 180);
  }

  function onCanvasPointerDown(event) {
    const rect = rpgCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const mapW = currentMap === MAP2 ? MAP2_W : MAP1_W;
    const mapH = currentMap === MAP2 ? MAP2_H : MAP1_H;
    const tx = Math.floor(((event.clientX - rect.left) / rect.width) * mapW);
    const ty = Math.floor(((event.clientY - rect.top) / rect.height) * mapH);
    startPathTo(tx, ty);
  }

  function isRpgActive() {
    const screen = document.getElementById("screen-rpg");
    return Boolean(screen && screen.classList.contains("is-active"));
  }

  function onKey(event) {
    if (!isRpgActive() || !currentMap) {
      return;
    }
    const overlay = document.getElementById("modal-overlay");
    if (overlay && !overlay.hidden) {
      return;
    }
    const key = event.key;
    const target = event.target;
    const typing =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);
    if (typing) {
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      movePlayer(0, -1);
    } else if (key === "ArrowDown") {
      event.preventDefault();
      movePlayer(0, 1);
    } else if (key === "ArrowLeft") {
      event.preventDefault();
      movePlayer(-1, 0);
    } else if (key === "ArrowRight") {
      event.preventDefault();
      movePlayer(1, 0);
    } else if (key === " " || key.toLowerCase() === "a") {
      event.preventDefault();
      handleA();
    }
  }

  function findActionButton() {
    return (
      document.getElementById("btn-a") ||
      document.getElementById("btn-action") ||
      document.querySelector(
        '.btn-a, .action-btn, [data-btn="a"], [data-action="a"], [data-key="a"]',
      )
    );
  }

  function bindInput() {
    if (inputBound) {
      return;
    }
    inputBound = true;

    const up = document.querySelector('.dpad__btn[data-dir="up"]');
    const down = document.querySelector('.dpad__btn[data-dir="down"]');
    const left = document.querySelector('.dpad__btn[data-dir="left"]');
    const right = document.querySelector('.dpad__btn[data-dir="right"]');
    const a = findActionButton();

    if (up) {
      up.addEventListener("click", function (e) {
        e.stopPropagation();
        movePlayer(0, -1);
      });
    }
    if (down) {
      down.addEventListener("click", function (e) {
        e.stopPropagation();
        movePlayer(0, 1);
      });
    }
    if (left) {
      left.addEventListener("click", function (e) {
        e.stopPropagation();
        movePlayer(-1, 0);
      });
    }
    if (right) {
      right.addEventListener("click", function (e) {
        e.stopPropagation();
        movePlayer(1, 0);
      });
    }
    if (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        handleA();
      });
    }

    document.addEventListener("keydown", onKey);
    rpgCanvas.addEventListener("pointerdown", onCanvasPointerDown);
  }

  function updateQuest() {
    if (locationEl) {
      locationEl.textContent =
        currentMap === MAP2 ? "DALAM RUMAH" : "HALAMAN DEPAN";
    }
    if (questEl) {
      if (!mailboxRead) {
        questEl.textContent = "MISI: BACA KOTAK SURAT";
      } else if (!hasHouseKey) {
        questEl.textContent = "MISI: AMBIL KUNCI DI JEMBATAN KANAN";
      } else if (currentMap === MAP1) {
        questEl.textContent = "MISI: BUKA PINTU RUMAH";
      } else if (!npcTalked) {
        questEl.textContent = "MISI: BICARA DENGAN ORANG BER-HOODIE";
      } else if (!giftOpened) {
        questEl.textContent = "MISI: PERIKSA PETI HADIAH";
      } else {
        questEl.textContent = "MISI: BUKA KOMPUTER & PHOTOBOOTH";
      }
    }
    if (promptEl) {
      promptEl.textContent = "Tekan A untuk memeriksa objek";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getModalParts() {
    return {
      overlay: document.getElementById("modal-overlay"),
      screen: document.getElementById("modal-screen"),
      title: document.getElementById("modal-title"),
    };
  }

  function stopPhotoStream() {
    cameraRequestId += 1;
    if (photoStream) {
      photoStream.getTracks().forEach(function (track) {
        if (track && typeof track.stop === "function") {
          track.stop();
        }
      });
      photoStream = null;
    }
    const video = document.getElementById("photobooth-video");
    if (video && video.srcObject) {
      video.srcObject = null;
    }
  }

  function bindModalCloseOnce() {
    if (modalCloseBound) {
      return;
    }
    modalCloseBound = true;
    document.addEventListener("otter:modal-closed", function () {
      stopMusic();
      stopPhotoStream();
    });
  }

  function openSolidModal(title, innerHTML) {
    bindModalCloseOnce();
    const parts = getModalParts();
    if (!parts.overlay || !parts.screen) {
      return null;
    }
    if (parts.title) {
      parts.title.textContent = title || "OTTER_ALERT.EXE";
    }
    parts.screen.innerHTML = innerHTML;
    parts.overlay.hidden = false;
    parts.screen.scrollTop = 0;
    return parts.screen;
  }

  function closeSolidModal() {
    stopMusic();
    stopPhotoStream();
    const overlay = document.getElementById("modal-overlay");
    if (overlay) {
      overlay.hidden = true;
    }
  }

  function bindBackButtons(container, onBack) {
    if (!container) {
      return;
    }
    container
      .querySelectorAll('[data-retro-back="true"]')
      .forEach(function (btn) {
        btn.addEventListener("click", function (event) {
          event.preventDefault();
          onBack();
        });
      });
  }

  function openMailboxLetter() {
    const playerName = getState().playerName || "Kamu";
    const body = `
      <div class="retro-card">
        <div class="retro-card__nav">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
        <div class="retro-card__body">
          <p class="retro-card__heading">SURAT DARI CEO MEOW</p>
          <div class="letter-card__body">
            Hai ${escapeHtml(playerName)},<br /><br />
            Pintu rumah dikunci karena kue ulang tahun sedang dalam pengawasan ketat.
            Kuncinya kutinggalkan di ujung jembatan kayu, di sisi kanan sungai.
            Ambil kuncinya, lalu buka pintu rumah. Jangan lupa bernapas dan jangan
            memberi tahu otter lain.
            <br /><br />— CEO Meow
          </div>
          <p class="retro-card__sub">Pintu rumah ada di sisi kiri halaman, di bawah atap biru.</p>
        </div>
        <div class="retro-card__nav retro-card__nav--bottom">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
      </div>
    `;
    const screen = openSolidModal("MAILBOX.DM", body);
    bindBackButtons(screen, closeSolidModal);
  }

  function openHoodieDialog() {
    const body = `
      <div class="retro-card">
        <div class="retro-card__nav">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
        <div class="retro-card__body">
          <div class="hoodie-dialog">
            <div class="hoodie-dialog__avatar" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="46" height="46">
                <circle cx="24" cy="20" r="12" fill="#f1c3a3" stroke="#2C3E50" stroke-width="2"/>
                <path d="M11 43c0-9 6-14 13-14s13 5 13 14Z" fill="${escapeHtml(hoodieColor)}" stroke="#2C3E50" stroke-width="2"/>
                <path d="M14 17c2-7 18-7 20 0v6H14Z" fill="${escapeHtml(hoodieColor)}" stroke="#2C3E50" stroke-width="2"/>
                <circle cx="20" cy="21" r="1.6" fill="#332B3A"/>
                <circle cx="28" cy="21" r="1.6" fill="#332B3A"/>
                <path d="M21 26c2 2 4 2 6 0" fill="none" stroke="#332B3A" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="hoodie-dialog__bubble">
              <p class="hoodie-dialog__name">ORANG BER-HOODIE</P>
              <p class="hoodie-dialog__text">
                “Akhirnya kamu datang! Peti hadiah di tengah ruangan itu aneh.
                Isinya kue, satu hoodie, dan surat panjang. Coba periksa sendiri,
                tapi siapkan mental untuk plot twist.”
              </p>
            </div>
          </div>
          <p class="retro-card__sub">Setelah bicara, dekatkan diri ke peti emas di tengah ruangan lalu tekan A.</p>
        </div>
        <div class="retro-card__nav retro-card__nav--bottom">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
      </div>
    `;
    const screen = openSolidModal("HOODIE_FRIEND.EXE", body);
    bindBackButtons(screen, closeSolidModal);
  }

  function downloadFile(name, dataUrl) {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = name;
    link.click();
  }

  function barPatterns(d) {
    const patterns = {
      0: [1, 1, 0, 1, 1, 0, 1, 0],
      1: [0, 1, 1, 1, 0, 1, 1, 0],
      2: [1, 0, 1, 1, 1, 0, 0, 1],
      3: [1, 1, 0, 0, 1, 1, 1, 0],
      4: [0, 1, 1, 0, 1, 1, 0, 1],
      5: [1, 0, 0, 1, 1, 0, 1, 1],
      6: [0, 0, 1, 0, 1, 1, 1, 1],
      7: [1, 0, 1, 0, 0, 1, 0, 1],
      8: [0, 1, 0, 1, 0, 0, 1, 1],
      9: [1, 1, 1, 0, 0, 1, 1, 0],
    };
    return patterns[parseInt(d, 10)] || [1, 1, 0, 1, 0, 1, 1, 0];
  }

  const VOUCHER_CODE = "0911247537200422";

  function buildBarcodeSpans() {
    let bars = "";
    VOUCHER_CODE.split("").forEach(function (digit, idx) {
      barPatterns(digit).forEach(function (on, bIdx) {
        const h = on ? 2 : 1;
        const opacity = on || (idx + bIdx) % 2 === 0 ? "1" : "0.18";
        bars +=
          '<span style="height:' + h + "px;opacity:" + opacity + '"></span>';
      });
    });
    return bars;
  }

  function drawVoucherCanvas(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = "#FFFDF7";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#89CFF0";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 7]);
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.setLineDash([]);

    const leftStripW = 68;
    const rightStripW = 104;

    ctx.strokeStyle = "#89CFF0";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(leftStripW + 14, 22);
    ctx.lineTo(leftStripW + 14, h - 22);
    ctx.moveTo(w - rightStripW - 14, 22);
    ctx.lineTo(w - rightStripW - 14, h - 22);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sisi kiri: tulisan vertikal "HAPPY BIRTHDAY"
    ctx.save();
    ctx.translate(leftStripW / 2 + 8, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#1E88E5";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("HAPPY BIRTHDAY", 0, 0);
    ctx.restore();

    // Kanan atas: ikon hati merah
    ctx.fillStyle = "#E53935";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("❤️", w - 26, 26);

    // Bagian tengah
    const centerX = (leftStripW + 14 + (w - rightStripW - 14)) / 2;

    ctx.fillStyle = "#332B3A";
    ctx.font = "italic 21px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("This voucher is good for one", centerX, h * 0.34);

    ctx.strokeStyle = "#89CFF0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 150, h * 0.44);
    ctx.lineTo(centerX + 150, h * 0.44);
    ctx.stroke();

    ctx.fillStyle = "#1E88E5";
    ctx.font = "bold 23px monospace";
    ctx.fillText("ACCESS WHATEVER YOU WANT", centerX, h * 0.55);

    ctx.fillStyle = "#4A5568";
    ctx.font = "13px monospace";
    ctx.fillText(
      "Terms: let me know 24 h in advance if you have any special wishes.",
      centerX,
      h * 0.72,
    );

    // Sisi kanan: barcode vertikal + angka 0911247537200422
    const rightCenterX = w - (rightStripW + 14) / 2;
    const barW = 42;
    let by = 58;
    VOUCHER_CODE.split("").forEach(function (digit) {
      barPatterns(digit).forEach(function (on) {
        if (on) {
          ctx.fillStyle = "#2C3E50";
          ctx.fillRect(rightCenterX - barW / 2, by, barW, 2);
        }
        by += 1;
      });
    });

    ctx.save();
    ctx.translate(rightCenterX, h - 38);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#2C3E50";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(VOUCHER_CODE, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  function wrapCardContent(innerHTML, heading) {
    return `
      <div class="retro-card">
        <div class="retro-card__nav">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
        <div class="retro-card__body">
          ${heading ? '<p class="retro-card__heading">' + escapeHtml(heading) + "</p>" : ""}
          ${innerHTML}
        </div>
        <div class="retro-card__nav retro-card__nav--bottom">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
      </div>
    `;
  }

  function showRetroMenu() {
    const body = `
      <div class="retro-card">
        <div class="retro-card__nav">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
        <div class="retro-card__body">
          <p class="retro-card__heading">DESKTOP.EXE</p>
          <p class="retro-card__sub">Pilih satu aplikasi. Semuanya sudah disiapkan untukmu.</p>
          <div class="retro-app-list">
            <button type="button" class="retro-app-btn retro-app-btn--gift" data-retro-app="gift">
              <span class="retro-app-btn__title">Final Gift</span>
              <span class="retro-app-btn__desc">Kupon hadiah spesial siap cetak (PNG)</span>
            </button>
            <button type="button" class="retro-app-btn retro-app-btn--message" data-retro-app="message">
              <span class="retro-app-btn__title">Birthday Message</span>
              <span class="retro-app-btn__desc">Surat ulang tahun hangat untukmu</span>
            </button>
            <button type="button" class="retro-app-btn retro-app-btn--music" data-retro-app="music">
              <span class="retro-app-btn__title">Musik</span>
              <span class="retro-app-btn__desc">Pemutar kaset pastel / music box</span>
            </button>
          </div>
        </div>
        <div class="retro-card__nav retro-card__nav--bottom">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
      </div>
    `;
    const screen = openSolidModal("COMPUTER.EXE", body);
    if (!screen) {
      return;
    }
    bindBackButtons(screen, closeSolidModal);
    screen.querySelectorAll("[data-retro-app]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        openRetroSubApp(btn.getAttribute("data-retro-app"));
      });
    });
  }

  function openRetroSubApp(appName) {
    let body = "";
    let title = "COMPUTER";

    if (appName === "gift") {
      title = "FINAL_GIFT.EXE";
      const ticketHTML = `
        <div class="gift-ticket">
          <div class="gift-ticket__side-left">HAPPY BIRTHDAY</div>
          <div class="gift-ticket__center">
            <div class="gift-ticket__top-row">
              <span class="gift-ticket__heart" aria-label="Hati merah">❤️</span>
            </div>
            <p class="gift-ticket__cursive">This voucher is good for one</p>
            <div class="gift-ticket__divider"></div>
            <p class="gift-ticket__headline">ACCESS WHATEVER YOU WANT</p>
            <p class="gift-ticket__terms">Terms: let me know 24 h in advance if you have any special wishes.</p>
          </div>
          <div class="gift-ticket__side-right">
            <div class="gift-ticket__barcode" aria-hidden="true">${buildBarcodeSpans()}</div>
            <span class="gift-ticket__code-num">${VOUCHER_CODE}</span>
          </div>
        </div>
        <button type="button" class="retro-action-btn" id="btn-download-gift-png">Unduh Kupon (PNG)</button>
      `;
      body = wrapCardContent(ticketHTML, "KUPON SPESIAL · CETAK / SIMPAN");
    } else if (appName === "message") {
      title = "BIRTHDAY_MESSAGE.TXT";
      const playerName = getState().playerName || "Teman";
      const rawMsg =
        cfg.birthdayMessage ||
        "Selamat ulang tahun, {playerName}! Semoga harimu penuh kehangatan, tawa, dan segala hal baik yang kamu impikan.";
      const formatted = rawMsg.replace(/\{playerName\}/g, playerName);
      const letterHTML =
        '<div class="birthday-letter">' + escapeHtml(formatted) + "</div>";
      body = wrapCardContent(letterHTML, "SURAT ULANG TAHUN UNTUKMU");
    } else if (appName === "music") {
      title = "MUSIC_BOX.EXE";
      const sourceLabel = cfg.musicUrl
        ? "File Audio: " + cfg.musicUrl
        : "Melodi: Music Box Romantis (Happy Birthday)";
      const musicHTML = `
        <div class="cassette-player">
          <div class="cassette-deck">
            <div class="cassette-deck__label">PASTEL MUSIC BOX TAPE</div>
            <div class="cassette-reels">
              <span class="reel ${isMusicPlaying ? "is-spinning" : ""}" id="reel-left"></span>
              <span class="cassette-tape-strip">${escapeHtml(sourceLabel)}</span>
              <span class="reel ${isMusicPlaying ? "is-spinning" : ""}" id="reel-right"></span>
            </div>
          </div>
          <p class="music-status" id="music-status-text">${
            isMusicPlaying ? "Sedang diputar..." : "Siap diputar"
          }</p>
          <button type="button" class="retro-action-btn" id="btn-music-toggle">${
            isMusicPlaying ? "Pause" : "Play"
          }</button>
        </div>
      `;
      body = wrapCardContent(musicHTML, "MUSIK ROMANTIS");
    } else {
      showRetroMenu();
      return;
    }

    const screen = openSolidModal(title, body);
    if (!screen) {
      return;
    }
    bindBackButtons(screen, showRetroMenu);

    if (appName === "gift") {
      const dlBtn = document.getElementById("btn-download-gift-png");
      if (dlBtn) {
        dlBtn.addEventListener("click", function () {
          const canvas = document.createElement("canvas");
          canvas.width = 760;
          canvas.height = 460;
          const ctx = canvas.getContext("2d");
          drawVoucherCanvas(ctx, canvas.width, canvas.height);
          downloadFile("final-gift-voucher.png", canvas.toDataURL("image/png"));
          toast("Kupon PNG diunduh!", "success", 1600);
        });
      }
    } else if (appName === "music") {
      const toggleBtn = document.getElementById("btn-music-toggle");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", function () {
          if (isMusicPlaying) {
            stopMusic();
            updateMusicUI(false);
          } else {
            startMusic();
            updateMusicUI(true);
          }
        });
      }
    }
  }

  function updateMusicUI(playing) {
    const toggleBtn = document.getElementById("btn-music-toggle");
    const statusEl = document.getElementById("music-status-text");
    const leftReel = document.getElementById("reel-left");
    const rightReel = document.getElementById("reel-right");
    if (toggleBtn) {
      toggleBtn.textContent = playing ? "Pause" : "Play";
    }
    if (statusEl) {
      statusEl.textContent = playing
        ? "Sedang diputar..."
        : "Dijeda / Berhenti";
    }
    if (leftReel) {
      leftReel.classList.toggle("is-spinning", playing);
    }
    if (rightReel) {
      rightReel.classList.toggle("is-spinning", playing);
    }
  }

  function stopMusic() {
    isMusicPlaying = false;
    if (musicLoopTimer) {
      window.clearTimeout(musicLoopTimer);
      musicLoopTimer = null;
    }
    if (htmlAudioPlayer) {
      htmlAudioPlayer.pause();
      htmlAudioPlayer.currentTime = 0;
    }
    if (webAudioCtx) {
      webAudioCtx.close().catch(function () {});
      webAudioCtx = null;
    }
  }

  function playMusicBoxNote(ctx, freq, startTime, duration, volume) {
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const gain = ctx.createGain();
    const overtoneGain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, startTime);

    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(freq * 2, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    overtoneGain.gain.setValueAtTime(0.0001, startTime);
    overtoneGain.gain.linearRampToValueAtTime(volume * 0.22, startTime + 0.015);
    overtoneGain.gain.exponentialRampToValueAtTime(
      0.0005,
      startTime + duration * 0.65,
    );

    osc.connect(gain);
    overtone.connect(overtoneGain);
    gain.connect(ctx.destination);
    overtoneGain.connect(ctx.destination);

    osc.start(startTime);
    overtone.start(startTime);
    osc.stop(startTime + duration + 0.02);
    overtone.stop(startTime + duration + 0.02);
  }

  function scheduleRomanticMusicBoxLoop() {
    if (!isMusicPlaying) {
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      isMusicPlaying = false;
      updateMusicUI(false);
      toast("Audio tidak didukung di browser ini.", "error", 2200);
      return;
    }
    if (!webAudioCtx || webAudioCtx.state === "closed") {
      webAudioCtx = new AudioCtx();
    }
    if (webAudioCtx.state === "suspended") {
      webAudioCtx.resume().catch(function () {});
    }

    // Melodi Happy Birthday tempo lambat & hangat + akor lembut (Cmaj7 - G/B - Am7 - Fmaj7)
    const sequence = [
      // Bar 1: Hap-py birth-day to you (C)
      { f: 261.63, t: 0.0, d: 0.55, c: [130.81, 196.0, 246.94] },
      { f: 261.63, t: 0.42, d: 0.45 },
      { f: 293.66, t: 0.85, d: 0.9 },
      { f: 261.63, t: 1.75, d: 0.9 },
      // Bar 2: Hap-py birth-day to you (G / B)
      { f: 349.23, t: 2.65, d: 0.9, c: [123.47, 196.0, 293.66] },
      { f: 329.63, t: 3.55, d: 1.4 },
      // Bar 3: Hap-py birth-day dear friend (Am7)
      { f: 261.63, t: 5.05, d: 0.55, c: [220.0, 261.63, 329.63, 392.0] },
      { f: 261.63, t: 5.48, d: 0.45 },
      { f: 293.66, t: 5.9, d: 0.9 },
      { f: 261.63, t: 6.8, d: 0.9 },
      // Bar 4: Hap-py birth-day to you (Fmaj7 -> C)
      { f: 392.0, t: 7.7, d: 0.9, c: [174.61, 261.63, 329.63, 440.0] },
      { f: 349.23, t: 8.6, d: 1.45, c: [130.81, 196.0, 261.63, 329.63] },
    ];

    const baseTime = webAudioCtx.currentTime + 0.05;
    sequence.forEach(function (step) {
      if (step.c) {
        step.c.forEach(function (chordFreq) {
          playMusicBoxNote(
            webAudioCtx,
            chordFreq,
            baseTime + step.t,
            step.d + 0.35,
            0.045,
          );
        });
      }
      playMusicBoxNote(webAudioCtx, step.f, baseTime + step.t, step.d, 0.11);
    });

    const totalDurationMs = 10400;
    musicLoopTimer = window.setTimeout(function () {
      if (isMusicPlaying) {
        scheduleRomanticMusicBoxLoop();
      }
    }, totalDurationMs);
  }

  function startMusic() {
    stopMusic();
    isMusicPlaying = true;

    if (cfg.musicUrl) {
      if (!htmlAudioPlayer) {
        htmlAudioPlayer = new Audio(cfg.musicUrl);
        htmlAudioPlayer.loop = true;
        htmlAudioPlayer.addEventListener("ended", function () {
          if (!htmlAudioPlayer.loop) {
            isMusicPlaying = false;
            updateMusicUI(false);
          }
        });
      } else if (htmlAudioPlayer.src !== cfg.musicUrl) {
        htmlAudioPlayer.src = cfg.musicUrl;
      }
      htmlAudioPlayer.play().catch(function () {
        isMusicPlaying = false;
        updateMusicUI(false);
        toast("Tidak dapat memutar file audio.", "error", 2000);
      });
      return;
    }

    scheduleRomanticMusicBoxLoop();
  }

  function openComputerModal() {
    showRetroMenu();
  }

  function drawConfetti(ctx, width, height) {
    const colors = ["#89CFF0", "#FFD700", "#86efac", "#B3D4F2", "#fffdf6"];
    for (let i = 0; i < 44; i += 1) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(
        Math.random() * (width || 260),
        Math.random() * (height || 200),
        4,
        8,
      );
    }
  }

  function openBirthdayCakeModal(onDone) {
    const body = `
      <div class="retro-card">
        <div class="retro-card__nav">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
        <div class="retro-card__body">
          <p class="retro-card__heading">PLOT TWIST · KUE ULANG TAHUN</p>
          <div class="cake-card">
            <canvas id="rpg-cake-canvas" width="260" height="210" aria-label="Kue ulang tahun dengan lilin"></canvas>
            <p class="retro-card__sub">Pejamkan mata, buat harapan, lalu tiup lilinnya.</p>
            <button id="rpg-blow-candle" class="retro-action-btn" type="button">Tiup Lilin</button>
          </div>
        </div>
        <div class="retro-card__nav retro-card__nav--bottom">
          <button type="button" class="retro-back-btn" data-retro-back="true">← Kembali</button>
        </div>
      </div>
    `;
    const screen = openSolidModal("CAKE.EXE", body);
    if (!screen) {
      return;
    }
    bindBackButtons(screen, closeSolidModal);

    const canvas = document.getElementById("rpg-cake-canvas");
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    let flame = 1;
    let done = false;

    function drawCake() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fffdf6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#fff6e6";
      ctx.strokeStyle = "#2C3E50";
      ctx.lineWidth = 3;
      roundRect(ctx, 48, 126, 164, 58, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#C5E7FF";
      roundRect(ctx, 66, 92, 128, 40, 9);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#FFF6E6";
      roundRect(ctx, 82, 62, 96, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "#2C3E50";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(120, 62);
      ctx.lineTo(120, 40);
      ctx.moveTo(142, 62);
      ctx.lineTo(142, 36);
      ctx.stroke();

      if (flame > 0) {
        ctx.fillStyle = "#FF9F1C";
        ctx.beginPath();
        ctx.ellipse(120, 30, 7 * flame, 13 * flame, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FFD700";
        ctx.beginPath();
        ctx.ellipse(120, 32, 3.5 * flame, 7 * flame, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#FF9F1C";
        ctx.beginPath();
        ctx.ellipse(142, 26, 6 * flame, 11 * flame, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#8FD5B4";
      ctx.fillRect(58, 144, 144, 8);
      ctx.fillStyle = "#A3D6FA";
      ctx.fillRect(58, 164, 144, 8);
    }

    drawCake();

    const blowBtn = document.getElementById("rpg-blow-candle");
    if (blowBtn) {
      blowBtn.addEventListener("click", function () {
        if (flame <= 0) {
          return;
        }
        blowBtn.disabled = true;
        const iv = window.setInterval(function () {
          flame -= 0.12;
          if (flame <= 0) {
            flame = 0;
            window.clearInterval(iv);
            drawCake();
            drawConfetti(ctx, canvas.width, canvas.height);
            blowBtn.textContent = "Lilin sudah padam!";
            if (!done) {
              done = true;
              if (typeof onDone === "function") {
                onDone();
              }
            }
            toast(
              "Lilin padam. Harapanmu terkirim, dan plot twist selesai!",
              "success",
              2800,
            );
          } else {
            drawCake();
          }
        }, 70);
      });
    }
  }

  function drawPhotoStar(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.32, y - r * 0.32);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.32, y + r * 0.32);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.32, y + r * 0.32);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.32, y - r * 0.32);
    ctx.closePath();
    ctx.fill();
  }

  function drawPixelOtter(ctx, ox, oy, scale, options) {
    const opts = options || {};
    const fur = "#C98F68";
    const furDark = "#A9714F";
    const furLight = "#E4B48C";
    const belly = "#FBEBDD";
    const ink = "#332B3A";
    const cheek = "#F29CB3";

    function p(bx, by, bw, bh, color) {
      ctx.fillStyle = color;
      ctx.fillRect(
        Math.round(ox + bx * scale),
        Math.round(oy + by * scale),
        Math.ceil(bw * scale),
        Math.ceil(bh * scale),
      );
    }

    p(-3, 24, 6, 5, furDark);
    p(5, 30, 8, 5, furDark);
    p(19, 30, 8, 5, furDark);

    if (opts.hoodie) {
      p(4, 19, 24, 16, opts.hoodieColor || hoodieColor);
      p(8, 23, 16, 10, belly);
      p(11, 27, 10, 6, opts.hoodieColor || hoodieColor);
      p(13, 34, 6, 2, furDark);
      p(3, 18, 5, 12, opts.hoodieColor || hoodieColor);
      p(25, 18, 5, 12, opts.hoodieColor || hoodieColor);
      p(2, 28, 6, 5, furLight);
      p(25, 28, 6, 5, furLight);
    } else {
      p(6, 19, 20, 16, fur);
      p(11, 23, 10, 10, belly);
      p(4, 21, 4, 11, fur);
      p(25, 21, 4, 11, fur);
      p(2, 29, 6, 5, furLight);
      p(25, 29, 6, 5, furLight);
    }

    if (opts.hoodie) {
      p(3, 3, 26, 19, opts.hoodieColor || hoodieColor);
      p(9, 8, 14, 9, belly);
      ctx.strokeStyle = "#FFF6E6";
      ctx.lineWidth = Math.max(2, scale * 0.35);
      ctx.beginPath();
      ctx.moveTo(ox + 13 * scale, oy + 17 * scale);
      ctx.lineTo(ox + 13 * scale, oy + 21 * scale);
      ctx.moveTo(ox + 19 * scale, oy + 17 * scale);
      ctx.lineTo(ox + 19 * scale, oy + 21 * scale);
      ctx.stroke();
    }

    p(3, 4, 7, 7, fur);
    p(22, 4, 7, 7, fur);
    p(5, 6, 3, 3, furLight);
    p(24, 6, 3, 3, furLight);
    p(5, 6, 22, 16, fur);
    p(10, 13, 12, 7, belly);
    p(15, 15, 2, 2, ink);

    if (opts.wink) {
      p(11, 11, 3, 3, ink);
      p(12, 11, 1, 1, "#FFFDF6");
      ctx.fillStyle = ink;
      ctx.fillRect(
        Math.round(ox + 18 * scale),
        Math.round(oy + 12.6 * scale),
        Math.ceil(4 * scale),
        Math.max(2, Math.ceil(scale * 0.45)),
      );
    } else {
      p(11, 11, 3, 3, ink);
      p(18, 11, 3, 3, ink);
      p(12, 11, 1, 1, "#FFFDF6");
      p(19, 11, 1, 1, "#FFFDF6");
    }

    p(11, 17, 2, 1, ink);
    p(18, 17, 2, 1, ink);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.5, scale * 0.28);
    ctx.beginPath();
    ctx.moveTo(ox + 13 * scale, oy + 18 * scale);
    ctx.quadraticCurveTo(
      ox + 16 * scale,
      oy + 20 * scale,
      ox + 19 * scale,
      oy + 18 * scale,
    );
    ctx.stroke();

    p(7, 15, 3, 2, cheek);
    p(22, 15, 3, 2, cheek);

    if (opts.partyHat) {
      p(13, -9, 6, 4, "#332B3A");
      p(14, -9, 4, 4, "#A3D6FA");
      p(10, -5, 12, 4, "#332B3A");
      p(11, -5, 10, 4, "#C5E7FF");
      p(7, -1, 18, 4, "#332B3A");
      p(8, -1, 16, 4, "#89CFF0");
      p(10, 1, 12, 2, "#FFF6E6");
      p(14, -12, 4, 4, "#F29CB3");
    }

    if (opts.cake) {
      ctx.save();
      ctx.translate(ox + 30 * scale, oy + 26 * scale);
      ctx.fillStyle = "#FFF6E6";
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.fillRect(0, 10, 22, 12);
      ctx.strokeRect(0, 10, 22, 12);
      ctx.fillStyle = "#A3D6FA";
      ctx.fillRect(0, 10, 22, 4);
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(10, 2, 3, 8);
      ctx.fillStyle = "#FF9F1C";
      ctx.beginPath();
      ctx.ellipse(11.5, 1, 3, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPixelHeart(ctx, cx, cy, size) {
    ctx.save();
    ctx.fillStyle = "#F29CB3";
    ctx.strokeStyle = "#332B3A";
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.beginPath();
    ctx.moveTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.lineTo(cx - size, cy - size * 0.45);
    ctx.lineTo(cx - size * 0.5, cy - size * 0.85);
    ctx.lineTo(cx, cy - size * 0.4);
    ctx.lineTo(cx + size * 0.5, cy - size * 0.85);
    ctx.lineTo(cx + size, cy - size * 0.45);
    ctx.lineTo(cx + size, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPoseOtter(ctx, pose, x, y, scale) {
    if (pose === "cake") {
      drawPixelOtter(ctx, x, y, scale, { partyHat: true, cake: true });
      return;
    }

    if (pose === "heart") {
      drawPixelOtter(ctx, x, y, scale, { wink: true });
      drawPixelHeart(ctx, x + 37 * scale, y + 3 * scale, 4.4 * scale);
      return;
    }

    if (pose === "hoodie") {
      drawPixelOtter(ctx, x, y, scale, {
        hoodie: true,
        hoodieColor: hoodieColor,
      });
      return;
    }

    drawPixelOtter(ctx, x, y, scale);
    const pawX = Math.round(x + 27 * scale);
    const pawY = Math.round(y + 8 * scale);
    const pawW = Math.ceil(6 * scale);
    const pawH = Math.ceil(8 * scale);
    ctx.save();
    ctx.fillStyle = "#C98F68";
    ctx.strokeStyle = "#332B3A";
    ctx.lineWidth = Math.max(2, scale * 0.45);
    ctx.fillRect(pawX, pawY, pawW, pawH);
    ctx.strokeRect(pawX, pawY, pawW, pawH);
    ctx.fillStyle = "#E4B48C";
    ctx.fillRect(
      pawX + Math.round(scale),
      pawY + Math.round(scale),
      Math.ceil(4 * scale),
      Math.ceil(4 * scale),
    );
    ctx.restore();
  }

  function renderPhotoSticker(canvas, pose, width, height) {
    const ctx = canvas.getContext("2d");
    const x = 28;
    const y = height - 300;
    const scale = 4.2;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.fillStyle = "rgba(255, 253, 246, 0.78)";
    ctx.strokeStyle = "rgba(51, 43, 58, 0.38)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(
      x + 16 * scale,
      y + 19 * scale,
      21 * scale,
      22 * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    drawPoseOtter(ctx, pose, x, y, scale);
  }

  function drawPixelFish(ctx, cx, cy, scale) {
    const ink = "#332B3A";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#A3D6FA";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.fillRect(-8 * scale, -3 * scale, 16 * scale, 6 * scale);
    ctx.strokeRect(-8 * scale, -3 * scale, 16 * scale, 6 * scale);
    ctx.fillStyle = "#8FD5B4";
    ctx.beginPath();
    ctx.moveTo(8 * scale, 0);
    ctx.lineTo(13 * scale, -4 * scale);
    ctx.lineTo(13 * scale, 4 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#FFFDF6";
    ctx.beginPath();
    ctx.arc(-4 * scale, -1 * scale, 1.4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(-4 * scale, -1 * scale, 0.6 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPhotoBackdrop(ctx, frame, width, height) {
    if (frame === "a") {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#E3F3FF");
      grad.addColorStop(0.6, "#C5E7FF");
      grad.addColorStop(1, "#FFF6E6");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      drawPhotoStar(ctx, 82, 105, 16, "#FFF6E6");
      drawPhotoStar(ctx, 552, 150, 20, "#FFF6E6");
      drawPhotoStar(ctx, 126, 250, 10, "#89CFF0");
      drawPhotoStar(ctx, 508, 306, 12, "#89CFF0");
      ctx.fillStyle = "rgba(255,253,246,0.8)";
      ctx.beginPath();
      ctx.ellipse(120, 560, 120, 32, 0, 0, Math.PI * 2);
      ctx.ellipse(520, 560, 130, 34, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (frame === "b") {
      ctx.fillStyle = "#FFFDF6";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#FFF2DF";
      ctx.fillRect(24, 24, width - 48, height - 48);
      ctx.fillStyle = "rgba(137,207,240,0.24)";
      for (let i = 0; i < 12; i += 1) {
        ctx.fillRect(30, 30 + i * 64, width - 60, 22);
      }
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#CDEEDD");
      grad.addColorStop(0.45, "#C5E7FF");
      grad.addColorStop(1, "#A3D6FA");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(255,253,246,0.7)";
      ctx.lineWidth = 5;
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath();
        for (let x = -20; x <= width + 20; x += 24) {
          const y = 100 + i * 104 + Math.sin(x / 44 + i) * 12;
          if (x === -20) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,253,246,0.75)";
      ctx.lineWidth = 2;
      const bubbles = [
        [70, 120, 18],
        [560, 170, 24],
        [110, 430, 13],
        [520, 430, 17],
        [250, 90, 10],
      ];
      bubbles.forEach(function (b) {
        ctx.beginPath();
        ctx.arc(b[0], b[1], b[2], 0, Math.PI * 2);
        ctx.stroke();
      });
      drawPaw(ctx, 72, 690, 1.1, "rgba(255,253,246,0.6)");
      drawPaw(ctx, 562, 650, 1.2, "rgba(255,253,246,0.5)");
      drawPaw(ctx, 96, 330, 0.8, "rgba(255,253,246,0.45)");
      drawPaw(ctx, 540, 340, 0.8, "rgba(255,253,246,0.45)");
    }
  }

  function drawPaw(ctx, x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-13, -12, 5, 7, -0.4, 0, Math.PI * 2);
    ctx.ellipse(-4, -17, 5, 7, -0.1, 0, Math.PI * 2);
    ctx.ellipse(5, -17, 5, 7, 0.1, 0, Math.PI * 2);
    ctx.ellipse(14, -12, 5, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawMirroredVideo(ctx, video, width, height) {
    const videoWidth = video.videoWidth || width;
    const videoHeight = video.videoHeight || height;
    const targetRatio = width / height;
    const videoRatio = videoWidth / videoHeight;
    let sx = 0;
    let sy = 0;
    let sw = videoWidth;
    let sh = videoHeight;

    if (videoRatio > targetRatio) {
      sw = videoHeight * targetRatio;
      sx = (videoWidth - sw) / 2;
    } else {
      sh = videoWidth / targetRatio;
      sy = (videoHeight - sh) / 2;
    }

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);
    ctx.restore();
  }

  function drawOtterEar(ctx, x, y, radius) {
    ctx.save();
    ctx.fillStyle = "#C98F68";
    ctx.strokeStyle = "#332B3A";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#F1C3A3";
    ctx.beginPath();
    ctx.arc(x, y + 2, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCaptionBand(ctx, width, height, title, subtitle) {
    ctx.save();
    ctx.fillStyle = "#FFFDF6";
    ctx.strokeStyle = "#332B3A";
    ctx.lineWidth = 4;
    ctx.fillRect(40, height - 130, width - 80, 92);
    ctx.strokeRect(40, height - 130, width - 80, 92);
    ctx.fillStyle = "#332B3A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 30px Nunito, sans-serif";
    ctx.fillText(title, width / 2, height - 100);
    ctx.font = "600 17px Nunito, sans-serif";
    ctx.fillStyle = "#5C6678";
    ctx.fillText(subtitle, width / 2, height - 66);
    ctx.restore();
  }

  function drawPhotoFrameOverlay(ctx, frame, width, height) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (frame === "a") {
      ctx.strokeStyle = "#89CFF0";
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, width - 18, height - 18);
      ctx.strokeStyle = "#FFFDF6";
      ctx.lineWidth = 4;
      ctx.strokeRect(28, 28, width - 56, height - 56);
      drawOtterEar(ctx, width * 0.26, 30, 34);
      drawOtterEar(ctx, width * 0.74, 30, 34);
      drawPhotoStar(ctx, 58, height - 58, 14, "#FFF6E6");
      drawPhotoStar(ctx, width - 58, height - 58, 14, "#FFF6E6");
      ctx.fillStyle = "#332B3A";
      ctx.font = "bold 25px Nunito, sans-serif";
      ctx.fillText("OTTER SELFIE · HAPPY BIRTHDAY", width / 2, height - 58);
    } else if (frame === "b") {
      ctx.strokeStyle = "#FFFDF6";
      ctx.lineWidth = 38;
      ctx.strokeRect(19, 19, width - 38, height - 38);
      ctx.strokeStyle = "#332B3A";
      ctx.lineWidth = 5;
      ctx.strokeRect(3, 3, width - 6, height - 6);
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = "#89CFF0";
      ctx.lineWidth = 3;
      ctx.strokeRect(43, 43, width - 86, height - 120);
      ctx.setLineDash([]);
      drawCaptionBand(
        ctx,
        width,
        height,
        "HAPPY BIRTHDAY",
        "OTTER PHOTOBOOTH · 24 · 03",
      );
    } else {
      ctx.strokeStyle = "#5FA8D3";
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, width - 14, height - 14);
      ctx.strokeStyle = "#FFFDF6";
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 24, width - 48, height - 48);
      const confetti = [
        [88, 120, 18, "#FFD166"],
        [540, 160, 14, "#F29CB3"],
        [120, 330, 12, "#8FD5B4"],
        [520, 360, 20, "#89CFF0"],
        [300, 110, 13, "#B79CED"],
        [200, 470, 16, "#FF9F1C"],
        [470, 500, 12, "#FFD166"],
      ];
      confetti.forEach(function (piece, index) {
        ctx.save();
        ctx.translate(piece[0], piece[1]);
        ctx.rotate(index * 0.7);
        if (index % 2 === 0) {
          drawPhotoStar(ctx, 0, 0, piece[2], piece[3]);
        } else {
          ctx.fillStyle = piece[3];
          ctx.fillRect(-piece[2], -piece[2] / 2, piece[2] * 2, piece[2]);
        }
        ctx.restore();
      });
      drawCaptionBand(
        ctx,
        width,
        height,
        "STARS & CONFETTI",
        "OTTER SELFIE · HAPPY BIRTHDAY",
      );
    }

    ctx.restore();
  }

  function drawPhotoboothScene(canvas, pose, frame) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const scale = 7;
    const leftX = 78;
    const rightX = 338;
    const baseY = 270;
    const centerX = width / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    drawPhotoBackdrop(ctx, frame, width, height);

    ctx.fillStyle = "rgba(51,43,58,0.12)";
    ctx.beginPath();
    ctx.ellipse(centerX, 578, 218, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    const wink = pose === 2;
    drawPixelOtter(ctx, leftX, baseY, scale, {
      partyHat: true,
      wink: false,
    });
    drawPixelOtter(ctx, rightX, baseY, scale, {
      hoodie: true,
      hoodieColor: hoodieColor,
      wink: wink,
      cake: false,
    });

    const handY = baseY + 27 * scale;
    if (pose === 1) {
      ctx.fillStyle = "#C98F68";
      ctx.fillRect(
        leftX + 24 * scale,
        handY,
        centerX - (leftX + 24 * scale),
        4 * scale,
      );
      ctx.fillRect(centerX, handY, rightX + 4 * scale - centerX, 4 * scale);
      ctx.fillStyle = "#E4B48C";
      ctx.strokeStyle = "#332B3A";
      ctx.lineWidth = 2;
      ctx.fillRect(centerX - 16, handY - 5, 32, 18);
      ctx.strokeRect(centerX - 16, handY - 5, 32, 18);
    } else if (pose === 2) {
      ctx.fillStyle = "#C98F68";
      ctx.fillRect(
        leftX + 24 * scale,
        handY - 8,
        centerX - (leftX + 24 * scale),
        4 * scale,
      );
      ctx.fillRect(centerX, handY - 8, rightX + 4 * scale - centerX, 4 * scale);
      drawPixelFish(ctx, centerX, handY + 12, 1.4);
    } else {
      ctx.fillStyle = "#C98F68";
      ctx.fillRect(
        leftX + 24 * scale,
        handY + 8,
        centerX - (leftX + 24 * scale),
        4 * scale,
      );
      ctx.fillRect(centerX, handY + 8, rightX + 4 * scale - centerX, 4 * scale);
      ctx.save();
      ctx.translate(centerX - 52, handY - 18);
      ctx.fillStyle = "#FFF6E6";
      ctx.strokeStyle = "#332B3A";
      ctx.lineWidth = 3;
      ctx.fillRect(0, 26, 104, 46);
      ctx.strokeRect(0, 26, 104, 46);
      ctx.fillStyle = "#C5E7FF";
      ctx.fillRect(0, 26, 104, 14);
      ctx.fillStyle = "#F29CB3";
      ctx.fillRect(0, 58, 104, 8);
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(20, 6, 6, 20);
      ctx.fillRect(50, 2, 6, 24);
      ctx.fillRect(80, 6, 6, 20);
      ctx.fillStyle = "#FF9F1C";
      [23, 53, 83].forEach(function (fx, index) {
        ctx.beginPath();
        ctx.ellipse(fx, index === 1 ? -2 : 2, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    drawPhotoFrameOverlay(ctx, frame, width, height);
  }

  function openPhotoboothModal() {
    const template = document.getElementById("photobooth-template");
    if (!template) {
      return;
    }

    const screen = openSolidModal("PHOTOBOOTH", "");
    if (!screen) {
      return;
    }
    screen.appendChild(template.content.cloneNode(true));
    bindBackButtons(screen, closeSolidModal);

    const cameraFrame = document.getElementById("photo-camera-frame");
    const video = document.getElementById("photobooth-video");
    const statusEl = document.getElementById("photo-camera-status");
    const canvas = document.getElementById("photobooth-canvas");
    const stickerCanvas = document.getElementById("photobooth-sticker-canvas");
    const preview = document.getElementById("photo-preview");
    const previewWrap = document.getElementById("photo-preview-wrap");
    const takeBtn = document.getElementById("btn-take-photo");
    const resultActions = document.getElementById("photo-result-actions");
    const retakeBtn = document.getElementById("btn-retake-photo");
    const saveBtn = document.getElementById("btn-save-photo");

    if (
      !cameraFrame ||
      !video ||
      !statusEl ||
      !canvas ||
      !stickerCanvas ||
      !preview ||
      !previewWrap ||
      !takeBtn ||
      !resultActions ||
      !retakeBtn ||
      !saveBtn
    ) {
      return;
    }

    capturedPhotoDataUrl = "";

    function syncChoices() {
      screen
        .querySelectorAll(".photo-choice[data-pose]")
        .forEach(function (btn) {
          btn.classList.toggle(
            "is-active",
            btn.getAttribute("data-pose") === photoPose,
          );
        });
      screen
        .querySelectorAll(".photo-choice[data-frame]")
        .forEach(function (btn) {
          btn.classList.toggle(
            "is-active",
            btn.getAttribute("data-frame") === photoFrame,
          );
        });
      cameraFrame.setAttribute("data-frame", photoFrame);
      renderPhotoSticker(
        stickerCanvas,
        photoPose,
        stickerCanvas.width,
        stickerCanvas.height,
      );
    }

    function showCameraView() {
      cameraFrame.hidden = false;
      previewWrap.hidden = true;
      resultActions.hidden = true;
      takeBtn.hidden = false;
      preview.removeAttribute("src");
    }

    function startCamera() {
      stopPhotoStream();
      const requestId = cameraRequestId;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusEl.textContent = "Browser ini tidak mendukung kamera.";
        takeBtn.disabled = true;
        return;
      }

      statusEl.textContent = "Meminta akses kamera…";
      takeBtn.disabled = true;

      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1600 },
          },
          audio: false,
        })
        .then(function (stream) {
          if (requestId !== cameraRequestId) {
            stream.getTracks().forEach(function (track) {
              track.stop();
            });
            return null;
          }
          photoStream = stream;
          video.srcObject = stream;
          return video.play().then(function () {
            if (requestId !== cameraRequestId) {
              stopPhotoStream();
              return;
            }
            statusEl.textContent = "Kamera siap · senyum!";
            takeBtn.disabled = false;
          });
        })
        .catch(function () {
          if (requestId !== cameraRequestId) {
            return;
          }
          statusEl.textContent =
            "Akses kamera ditolak. Izinkan kamera, lalu coba lagi.";
          takeBtn.disabled = true;
        });
    }

    function capturePhoto() {
      if (!video.videoWidth || !video.videoHeight) {
        toast("Kamera belum siap.", "error", 1800);
        return;
      }

      const ctx = canvas.getContext("2d");
      drawMirroredVideo(ctx, video, canvas.width, canvas.height);
      ctx.drawImage(stickerCanvas, 0, 0);
      drawPhotoFrameOverlay(ctx, photoFrame, canvas.width, canvas.height);
      capturedPhotoDataUrl = canvas.toDataURL("image/png");
      preview.src = capturedPhotoDataUrl;
      cameraFrame.hidden = true;
      previewWrap.hidden = false;
      resultActions.hidden = false;
      takeBtn.hidden = true;
      stopPhotoStream();
      toast("Foto berhasil dijepret!", "success", 1600);
    }

    function savePhoto() {
      if (!capturedPhotoDataUrl) {
        return;
      }

      downloadFile(
        "otter-selfie-pose" + photoPose + "-frame" + photoFrame + ".png",
        capturedPhotoDataUrl,
      );
      toast("Foto diunduh ke galeri perangkat!", "success", 1800);

      const playerName = getState().playerName || "Pemain";
      fetch("/api/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: capturedPhotoDataUrl,
          playerName: playerName,
        }),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (data) {
          if (data && data.success) {
            toast("Foto tersimpan!", "success", 2200);
          }
        })
        .catch(function () {
          toast(
            "Server tidak tersedia. Foto tetap tersimpan di perangkat.",
            "error",
            2200,
          );
        });
    }

    screen.querySelectorAll(".photo-choice[data-pose]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const next = btn.getAttribute("data-pose");
        photoPose =
          next === "cake" || next === "heart" || next === "hoodie"
            ? next
            : "wave";
        syncChoices();
      });
    });

    screen
      .querySelectorAll(".photo-choice[data-frame]")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          const next = btn.getAttribute("data-frame");
          photoFrame =
            next === "a" || next === "b" || next === "c" ? next : "a";
          syncChoices();
        });
      });

    takeBtn.addEventListener("click", capturePhoto);
    retakeBtn.addEventListener("click", function () {
      capturedPhotoDataUrl = "";
      showCameraView();
      startCamera();
    });
    saveBtn.addEventListener("click", savePhoto);

    syncChoices();
    showCameraView();
    startCamera();
  }

  function startRpgWorld() {
    if (!currentMap) {
      currentMap = MAP1;
      player = { x: 4, y: 12, step: 0, moving: false };
    }
    rpgSceneStarted = true;
    fitCanvas();
    bindInput();
    updateQuest();
    redraw();

    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener("resize", function () {
        fitCanvas();
        redraw();
      });
    }
  }

  function resetRpgWorld() {
    window.clearInterval(pathTimer);
    pathTimer = 0;
    window.clearTimeout(stepTimer);
    stepTimer = 0;
    targetTile = null;
    currentMap = MAP1;
    player = { x: 4, y: 12, step: 0, moving: false };
    mailboxRead = false;
    hasHouseKey = false;
    npcTalked = false;
    giftOpened = false;
    closeSolidModal();
    if (rpgCanvas) {
      fitCanvas();
      updateQuest();
      redraw();
    }
  }

  window.startRpgWorld = startRpgWorld;
  window.resetRpgWorld = resetRpgWorld;
})();
