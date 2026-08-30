import { desktopCapturer } from "electron";

export function configureFakeMediaForTests(app, enabled) {
  if (!enabled) return;
  app.commandLine.appendSwitch("use-fake-device-for-media-stream");
}

function isLocalRendererOrigin(origin) {
  const value = String(origin ?? "").trim();
  if (!value || value === "file://") return true;
  try {
    const url = new URL(value);
    return url.protocol === "file:" || url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

function shouldAllowMainWindowPermission(input) {
  const { webContents, permission, origin, details, mainWindow } = input;
  if (!mainWindow || !webContents || webContents.id !== mainWindow.webContents.id) return false;
  if (!isLocalRendererOrigin(origin)) return false;
  if (permission !== "media" && permission !== "audioCapture") return true;
  const mediaType = typeof details.mediaType === "string" ? details.mediaType : "";
  // The renderer's recorder is user-initiated from the app's own UI; which
  // display to capture is decided by installDisplayMediaHandler below.
  if (mediaType === "display-capture") return true;
  if (mediaType && mediaType !== "audio") return false;
  const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
  return mediaType === "audio" || (mediaTypes.includes("audio") && !mediaTypes.includes("video"));
}

/**
 * Electron ships no screen picker, so a granted `display-capture` permission is
 * still not enough: without this handler the renderer's getDisplayMedia() call
 * fails for want of a source. The recorder has no per-window chooser yet, so
 * capture the first display.
 */
function installDisplayMediaHandler(session) {
  session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        const screen = sources[0];
        if (!screen) return callback({});
        callback(request.audio ? { video: screen, audio: "loopback" } : { video: screen });
      })
      .catch(() => callback({}));
  });
}

export function installMediaPermissionHandlers(session, getMainWindow) {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(shouldAllowMainWindowPermission({
      webContents,
      permission,
      origin: details?.requestingUrl,
      details: details ?? {},
      mainWindow: getMainWindow(),
    }));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => (
    shouldAllowMainWindowPermission({
      webContents,
      permission,
      origin: requestingOrigin,
      details: details ?? {},
      mainWindow: getMainWindow(),
    })
  ));
  installDisplayMediaHandler(session.defaultSession);
}
