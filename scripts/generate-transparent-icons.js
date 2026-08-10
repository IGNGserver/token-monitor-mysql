'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const ICONS_DIR = path.join(ASSETS_DIR, 'icons');
const BUILD_ICONS_DIR = path.join(ROOT, 'build', 'icons');
const TEMP_HTML = path.join(ROOT, 'build', 'temp_icon_render.html');
const ANDROID_ICON_PATH = path.join(ROOT, 'src', 'hub', 'web', 'icons', 'icon-512.png');

function buildLogoSvg(size = 1024, isTray = false, androidIconDataUrl = '') {
  const scale = size / 1024;

  if (isTray) {
    // Crisp standalone tray icon for OS menu bar / notification area
    const s = size / 108;
    const strokeWidth = 7.5 * s;
    const dotR = 5.5 * s;

    const pArc = `M ${31.2 * s},${67.1 * s} A ${34 * s},${34 * s} 0 1,1 ${78.1 * s},${78.1 * s}`;
    const cxDot = 31.2 * s;
    const cyDot = 67.1 * s;
    const pTopBar = `M ${41 * s},${44 * s} H ${67 * s}`;
    const pStem = `M ${54 * s},${44 * s} V ${62 * s} c 0,${4 * s} ${3 * s},${7 * s} ${7 * s},${7 * s} h ${3 * s}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="trayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0284C7" />
    </linearGradient>
  </defs>
  <path d="${pArc}" fill="none" stroke="url(#trayGrad)" stroke-width="${strokeWidth}" stroke-linecap="round" />
  <circle cx="${cxDot}" cy="${cyDot}" r="${dotR}" fill="#38BDF8" />
  <path d="${pTopBar}" fill="none" stroke="url(#trayGrad)" stroke-width="${strokeWidth}" stroke-linecap="round" />
  <path d="${pStem}" fill="none" stroke="url(#trayGrad)" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;
  }

  // Reuse the original Android/PWA T mark as the desktop source. Keeping the
  // source artwork intact avoids the old low-resolution cutout and any logo
  // drift between desktop surfaces. Only the outer canvas gets rounded.
  const cornerRadius = 160 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="appIconClip">
      <rect width="${size}" height="${size}" rx="${cornerRadius}" />
    </clipPath>
  </defs>
  <image href="${androidIconDataUrl}" width="${size}" height="${size}" preserveAspectRatio="none" clip-path="url(#appIconClip)" />
</svg>`;
}

function packIco(pngItems) {
  const count = pngItems.length;
  const headerSize = 6 + 16 * count;
  let dataOffset = headerSize;

  const entries = [];
  const buffers = [];

  for (const item of pngItems) {
    const entryBuf = Buffer.alloc(16);
    const sizeByte = item.size >= 256 ? 0 : item.size;
    entryBuf.writeUInt8(sizeByte, 0); // width
    entryBuf.writeUInt8(sizeByte, 1); // height
    entryBuf.writeUInt8(0, 2);        // color count
    entryBuf.writeUInt8(0, 3);        // reserved
    entryBuf.writeUInt16LE(1, 4);     // color planes
    entryBuf.writeUInt16LE(32, 6);    // bits per pixel
    entryBuf.writeUInt32LE(item.buffer.length, 8); // size of image data
    entryBuf.writeUInt32LE(dataOffset, 12);        // offset of image data

    entries.push(entryBuf);
    buffers.push(item.buffer);
    dataOffset += item.buffer.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4);

  return Buffer.concat([header, ...entries, ...buffers]);
}

async function renderSvgToPng(win, svgContent, size) {
  win.setSize(size, size);
  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; background: transparent; overflow: hidden; }
  svg { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>${svgContent}</body>
</html>`;

  fs.writeFileSync(TEMP_HTML, html, 'utf8');
  await win.loadFile(TEMP_HTML);
  await new Promise((r) => setTimeout(r, 60));
  const image = await win.webContents.capturePage();
  const pngBuf = image.resize({ width: size, height: size, quality: 'best' }).toPNG();
  return pngBuf;
}

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    fs.mkdirSync(ICONS_DIR, { recursive: true });
    fs.mkdirSync(BUILD_ICONS_DIR, { recursive: true });

    const win = new BrowserWindow({
      width: 1024,
      height: 1024,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: false
      }
    });

    const androidIconDataUrl = `data:image/png;base64,${fs.readFileSync(ANDROID_ICON_PATH).toString('base64')}`;
    const main1024Png = await renderSvgToPng(win, buildLogoSvg(1024, false, androidIconDataUrl), 1024);

    fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), main1024Png);
    fs.writeFileSync(path.join(ASSETS_DIR, 'icon-win.png'), main1024Png);

    // 44x44 high-DPI tray icon matching test assertion
    const trayPng = await renderSvgToPng(win, buildLogoSvg(44, true), 44);
    fs.writeFileSync(path.join(ICONS_DIR, 'tray-token-monitor.png'), trayPng);

    // Sizes for ICO container
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const icoItems = [];

    for (const sz of sizes) {
      const pngBuf = await renderSvgToPng(win, buildLogoSvg(sz, false, androidIconDataUrl), sz);
      fs.writeFileSync(path.join(BUILD_ICONS_DIR, `${sz}x${sz}.png`), pngBuf);
      icoItems.push({ size: sz, buffer: pngBuf });
    }

    const sz512Png = await renderSvgToPng(win, buildLogoSvg(512, false, androidIconDataUrl), 512);
    fs.writeFileSync(path.join(BUILD_ICONS_DIR, '512x512.png'), sz512Png);
    fs.writeFileSync(path.join(BUILD_ICONS_DIR, '1024x1024.png'), main1024Png);

    const icoBuf = packIco(icoItems);
    fs.writeFileSync(path.join(BUILD_ICONS_DIR, 'icon.ico'), icoBuf);

    win.destroy();
    if (fs.existsSync(TEMP_HTML)) fs.unlinkSync(TEMP_HTML);

    console.log('Successfully generated crisp high-DPI squircle app icon and tray icon!');
    app.exit(0);
  } catch (err) {
    console.error('Error generating icons:', err);
    if (fs.existsSync(TEMP_HTML)) fs.unlinkSync(TEMP_HTML);
    app.exit(1);
  }
});
