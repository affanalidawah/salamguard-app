const fs = require("fs");
const path = require("path");
const axios = require("axios");

const hostsPath =
  process.platform === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts";

const defaultBlocklistPath = path.join(__dirname, "defaultBlocklist.json");

// Ensure required files exist with default values
function ensureFileExists(filePath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filePath)) {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      console.log(`Created file: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error in ensureFileExists: ${err.message}`);
    throw err;
  }
}

// Read and parse JSON file with error handling
function readJsonFile(filePath) {
  try {
    ensureFileExists(filePath, []);
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`Error reading JSON file at ${filePath}:`, err);
    return [];
  }
}

// Write to JSON file with error handling
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing to JSON file at ${filePath}:`, err);
  }
}

let resolvedCustomUrlsPath = null;

function getCustomUrlsPath() {
  if (!resolvedCustomUrlsPath) {
    resolvedCustomUrlsPath = process.env.NODE_ENV === 'development'
      ? path.join(__dirname, "customUrls.json")
      : path.join(require('electron').app.getPath('userData'), "customUrls.json");
  }
  return resolvedCustomUrlsPath;
}

const githubBlocklistUrls = [
  "https://raw.githubusercontent.com/4skinSkywalker/Anti-Porn-HOSTS-File/refs/heads/master/HOSTS.txt",
  "https://blocklistproject.github.io/Lists/gambling.txt",
];

async function checkInternetConnection() {
  try {
    await axios.get('https://www.google.com', { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

function loadDefaultBlocklist() {
  try {
    const data = fs.readFileSync(defaultBlocklistPath, 'utf-8');
    return JSON.parse(data).urls;
  } catch (error) {
    console.error('Error reading default blocklist:', error);
    return [];
  }
}

const fetchBlocklistFromGitHub = async () => {
  try {
    const isOnline = await checkInternetConnection();
    
    if (!isOnline) {
      console.log("No internet connection, using default blocklist");
      return loadDefaultBlocklist();
    }

    const urlSet = new Set();

    for (const url of githubBlocklistUrls) {
      try {
        const response = await axios.get(url);
        const rawList = response.data.split("\n");

        rawList.forEach((line) => {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine.startsWith("#")) {
            return;
          }

          // Only process lines that start with 0.0.0.0
          if (trimmedLine.startsWith("0.0.0.0")) {
            let domain = trimmedLine
              .replace("0.0.0.0", "") // Remove 0.0.0.0
              .trim()                 // Remove any whitespace
              .toLowerCase()          // Normalize case
              .replace(/^www\./, ''); // Remove www. prefix

            // Only add if it's a valid-looking domain
            if (domain.includes('.') && domain.length > 3) {
              urlSet.add(domain);
            }
          }
        });
      } catch (error) {
        console.error(`Failed to fetch from ${url}:`, error);
      }
    }

    // Add the mandatory URLs to the set
    urlSet.add("exampleadultsite.com");
    urlSet.add("wattpad.com");
    urlSet.add("archiveofourown.org");

    // If we failed to get any URLs from GitHub, use the default list
    if (urlSet.size === 0) {
      return loadDefaultBlocklist();
    }

    return urlArray;
  } catch (error) {
    console.error("Failed to fetch blocklists:", error);
    return loadDefaultBlocklist();
  }
};

async function updateDefaultBlocklist() {
  try {
    const isOnline = await checkInternetConnection();
    if (!isOnline) {
      console.log("No internet connection, skipping default blocklist update");
      return;
    }

    const urls = await fetchBlocklistFromGitHub();
    if (urls.length > 0) {
      fs.writeFileSync(
        defaultBlocklistPath,
        JSON.stringify({ urls }, null, 2)
      );
      console.log("Default blocklist updated successfully");
    }
  } catch (error) {
    console.error("Failed to update default blocklist:", error);
  }
}



module.exports = {
  ensureFileExists,
  readJsonFile,
  writeJsonFile,
  getCustomUrlsPath,
  hostsPath,
  fetchBlocklistFromGitHub,
  updateDefaultBlocklist,
};
