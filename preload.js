// preload.js

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  readHostsFile: async () => ipcRenderer.invoke("read-hosts-file"),
  getBlocklistUrls: async () => ipcRenderer.invoke("get-blocklist"),
  blockPresetUrls: () => ipcRenderer.send("block-preset-urls"),
  addCustomUrl: (url) => {
    ipcRenderer.send("add-custom-url", url);
  },
  onNotify: (callback) => {
    const subscription = (_event, args) => callback(args);
    ipcRenderer.on("notify", subscription);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("notify", subscription);
    };
  },
  removeCustomUrl: (url) => ipcRenderer.send("remove-custom-url", url),
  getCustomList: () => ipcRenderer.invoke("get-custom-list"),
  onUpdateCustomList: (callback) => {
    const subscription = (_event, args) => callback(args);
    ipcRenderer.on("update-custom-list", subscription);
    
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("update-custom-list", subscription);
    };
  },
  blockHaramContent: () => ipcRenderer.send("block-haram-content"),
  onBlocklistError: (callback) =>
    ipcRenderer.on("blocklist-error", (_, message) => callback(message)),
  onBlockHaramSuccess: (callback) =>
    ipcRenderer.on("block-haram-success", (_, args) => callback(args)),
  receiveInitialConfig: (callback) =>
    ipcRenderer.on("initial-config", (_, config) => callback(config)),
  checkBlocklistIntegrity: () => ipcRenderer.send("check-blocklist-integrity"),
  onBlocklistIntegrityStatus: (callback) =>
    ipcRenderer.on("blocklist-integrity-status", (_, isValid, result) =>
      callback(isValid, result)
    ),
  rewriteHosts: (content, callback) => {
    ipcRenderer.once("block-haram-success", (_, response) => {
      callback(response.success, response);
    });
    ipcRenderer.send("rewrite-hosts", content);
  },
  updateCustomUrlsJson: (urls) => ipcRenderer.invoke("update-custom-urls-json", urls),
});