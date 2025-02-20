const fs = require("fs");
const path = require("path");
const { app, autoUpdater, BrowserWindow, ipcMain } = require("electron");
// const {autoUpdater} = require("electron-updater");
const log = require('electron-log');
const {
  addCustomUrl,
  removeCustomUrl,
  appendBlocklist,
  checkBlocklistIntegrity,
  writeSafelyToHosts,
} = require("./backend/hostsHandler");
const axios = require("axios");

const {
  ensureFileExists,
  readJsonFile,
  writeJsonFile,
  getCustomUrlsPath,
  hostsPath,
  fetchBlocklistFromGitHub,
  checkLatestVersion
} = require("./utils");

let mainWindow;
const configPath = path.join(app.getPath("userData"), "config.json");


ensureFileExists(getCustomUrlsPath(), []);
ensureFileExists(configPath);

app.on("ready", () => {
  mainWindow = new BrowserWindow({
    width: 1250,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));

  // Check version after window loads
  mainWindow.webContents.on("did-finish-load", async () => {
    const versionInfo = await checkLatestVersion();
    if (versionInfo.needsUpdate && !versionInfo.error) {
      mainWindow.webContents.send('version-update-available', {
        current: versionInfo.currentVersion,
        latest: versionInfo.latestVersion
      });
    }
  });

  ipcMain.handle("get-blocklist", async () => {
    return await fetchBlocklistFromGitHub();
  });

  ipcMain.handle("read-hosts-file", async () => {
    try {
      const hostsContent = fs.readFileSync(hostsPath, "utf-8");
      return hostsContent;
    } catch (error) {
      console.error("Error reading hosts file:", error);
      throw error;
    }
  });

  function readConfig(callback) {
    const defaultConfig = { haramBlocked: false }; // Default configuration

    // Ensure config file exists with correct default values
    ensureFileExists(configPath, defaultConfig);

    // Read the current config
    const config = readJsonFile(configPath);

    // Dynamically check the blocklist status and update the config
    checkBlocklistIntegrity((blocked) => {
      config.haramBlocked = blocked; // Update the value dynamically
      writeJsonFile(configPath, config); // Save the updated config
      if (callback) callback(config); // Pass updated config to callback if needed
    });

    return config;
  }

  // Send initial config and haram status to the renderer
  mainWindow.webContents.on("did-finish-load", () => {
    readConfig((updatedConfig) => {
      mainWindow.webContents.send("initial-config", updatedConfig); // Send updated config
    });
    const customUrls = readJsonFile(getCustomUrlsPath());
    mainWindow.webContents.send("update-custom-list", customUrls); // Send initial list
  });
});

ipcMain.on("check-blocklist-integrity", (event) => {
  checkBlocklistIntegrity((isValid, result) => {
    event.reply("blocklist-integrity-status", isValid, result);
  });
});

ipcMain.on("rewrite-hosts", (event, content) => {
  writeSafelyToHosts(content, (success, message) => {
    if (success) {
      // Recheck blocklist integrity after successful update
      checkBlocklistIntegrity((isValid, result) => {
        event.reply("block-haram-success", {
          success: true,
          result: result || { message: "Blocklist successfully updated." },
        });
      });
    } else {
      event.reply("block-haram-success", { success: false, message });
    }
  });
});

ipcMain.on("block-haram-content", (event) => {
  appendBlocklist(event, (success, message) => {
    if (success) {
      checkBlocklistIntegrity((isValid, result) => {
        event.reply("block-haram-success", { success: true, result });
      });
    } else {
      event.reply("block-haram-success", { success: false, message });
    }
  });
});

// Handle adding a custom URL
ipcMain.on("add-custom-url", (event, url) => {
  console.log("Received request to add URL:", url);

  addCustomUrl(url, (success, message) => {
    if (success) {
      const customUrls = readJsonFile(getCustomUrlsPath());
      event.reply("update-custom-list", customUrls);
    }

    event.reply("notify", { success, message });
  });
});

// Handle removing a custom URL
ipcMain.on("remove-custom-url", (event, url) => {
  removeCustomUrl(url, (success, message) => {
    if (success) {
      let customUrls = readJsonFile(getCustomUrlsPath());
      customUrls = customUrls.filter((item) => item !== url);
      writeJsonFile(getCustomUrlsPath(), customUrls);
      event.reply("update-custom-list", customUrls);
    }
    event.reply("notify", { success, message });
  });
});

// Send the initial custom URL list on app start
ipcMain.handle("get-custom-list", () => {
  return readJsonFile(getCustomUrlsPath());
});

ipcMain.handle("update-custom-urls-json", (_, updatedUrls) => {
  try {
    writeJsonFile(getCustomUrlsPath(), updatedUrls);
    return true;
  } catch (error) {
    console.error("Failed to update customUrls.json:", error);
    return false;
  }
});