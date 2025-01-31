const fs = require("fs");
const path = require("path");
const sudo = require("sudo-prompt");

const markerStart = "# SalamGuard Blocklist Start";
const markerEnd = "# SalamGuard Blocklist End";
const {
  readJsonFile,
  writeJsonFile,
  customUrlsPath,
  hostsPath,
  fetchBlocklistFromGitHub,
} = require("../utils");

const specificUrls = [
  "exampleadultsite.com",
  "0006666.net",
  "pornhub.com",
  "redtube.com",
  "xhamster.com",
  "youporn.com",
  "xvideos.com",
];

const getBlocklistUrls = async () => {
  try {
    const blocklist = await fetchBlocklistFromGitHub();
    return blocklist;
  } catch (error) {
    console.error("Failed to fetch blocklist:", error);
    return [];
  }
};

const checkBlocklistIntegrity = async (callback) => {
  try {
    const blocklist = await getBlocklistUrls();

    // read hosts
    fs.readFile(hostsPath, "utf-8", (err, data) => {
      if (err) {
        console.error("Failed to read the hosts file:", err);
        return callback(false, "Failed to read the hosts file.");
      }

      const dataLines = data.split("\n").map((line) => line.trim());
      const startFound = data.includes(markerStart);
      const endFound = data.includes(markerEnd);
      const blocklistSet = new Set(blocklist.map(url => [url, `www.${url}`]).flat());

      const currentHostsLines = data.split("\n").map(line => line.trim());
      const currentHostsSet = new Set(currentHostsLines.filter(line => line.startsWith("127.0.0.1")));

      const isValid = [...blocklistSet].every(url => 
        currentHostsSet.has(`127.0.0.1 ${url}`) || currentHostsSet.has(`127.0.0.1 www.${url}`)
      );

      console.log("startFound", startFound);
      console.log("endFound", endFound);
      console.log("allUrlsFound", isValid);

      if (startFound && endFound && isValid) {
        callback(true, {
          status: 1,
          message: "You are currently being protected from Haram sites",
        });
      } else if (startFound && endFound && !isValid) {
        console.log("Blocklist markers exist, but update is needed.");
        callback(false, {
          status: 2,
          message: "Your Blocklist needs an update",
        });
      } else {
        console.log("No blocklist or specific URLs found.");
        callback(false, {
          status: 3,
          message: "Your computer is unprotected from Haram sites",
        });
      }
    });
  } catch (error) {
    console.error("Failed to check blocklist integrity:", error);
    callback(false, { error: "Error fetching or processing blocklist." });
  }
};

const appendBlocklist = async (event, callback) => {
  try {
    const blocklist = await getBlocklistUrls();

    if (blocklist.length === 0) {
      return callback(false, "Blocklist is empty or invalid.");
    }

    const tempFile = path.join(require("os").tmpdir(), "blocklist_temp.txt");

    fs.writeFileSync(tempFile, `${markerStart}\n`); // Write start marker to temp file

    const batchSize = 500;
    let currentBatch = 0;

    const writeBatch = () => {
      const batch = blocklist
        .slice(currentBatch * batchSize, (currentBatch + 1) * batchSize)
        .map((domain) => `127.0.0.1 ${domain}\n127.0.0.1 www.${domain}`)
        .join("\n");

      fs.appendFileSync(tempFile, batch + "\n");

      currentBatch++;

      if (currentBatch * batchSize < blocklist.length) {
        setImmediate(writeBatch);
      } else {
        fs.appendFileSync(tempFile, `${markerEnd}\n`); // Write end marker after all entries
        executeAppendCommand(tempFile, callback, event);
      }
    };

    writeBatch();
  } catch (error) {
    console.error("Error appending blocklist:", error);
    callback(false, "Failed to append blocklist.");
  }
};

const executeAppendCommand = (tempFile, callback, event) => {
  const spacerLines = "\n".repeat(10000); // 10,000 blank lines

  const appendCommand =
    process.platform === "win32"
      ? `
      if (Test-Path "${tempFile}") {
          Add-Content -Path "${hostsPath}" -Value @"
${spacerLines}
"@;
          Get-Content "${tempFile}" | Out-File -Append -Encoding ascii "${hostsPath}";
          ipconfig /flushdns;
          Remove-Item "${tempFile}";
      }
    `
      : `
      sudo sh -c 'printf "${spacerLines}" >> "${hostsPath}";
      cat "${tempFile}" >> "${hostsPath}" && dscacheutil -flushcache && killall -HUP mDNSResponder && rm "${tempFile}"'
    `;

  sudo.exec(appendCommand, { name: "SalamGuard" }, (error) => {
    if (error) {
      console.error("Failed to append blocklist:", error);
      if (event && event.sender) {
        event.sender.send("blocklist-error", "Failed to append blocklist.");
      }
      return callback(false, "Failed to append blocklist.");
    }
    callback(true, "Blocklist appended successfully.");
  });
};

// Safely write content to the hosts file using sudo
const writeSafelyToHosts = (
  content,
  callback,
  successMessage = "Hosts file updated successfully."
) => {
  if (typeof content !== "string") {
    console.error("Invalid content provided to writeSafelyToHosts:", content);
    return callback(false, "Invalid content provided.");
  }

  const tempFile = path.join(require("os").tmpdir(), "temp_hosts_update.txt");

  try {
    fs.writeFileSync(tempFile, content);
  } catch (err) {
    console.error("Error writing to temp file:", err);
    return callback(false, "Failed to prepare the updated hosts file.");
  }

  const command = `cp "${tempFile}" "${hostsPath}"`;

  sudo.exec(command, { name: "SalamGuard" }, (error) => {
    fs.unlinkSync(tempFile); // Cleanup temp file
    if (error) {
      console.error("Failed to write to hosts file:", error);
      return callback(false, "Failed to update the hosts file.");
    }
    callback(true, successMessage);
  });
};

// Add a custom URL to the hosts file
const addCustomUrl = (url, callback) => {
  if (!url) {
    console.error("Invalid URL provided.");
    return callback(false, "Invalid URL provided.");
  }

  const cleanDomain = url.replace(/^www\./, "").trim();
  const entries = [`127.0.0.1 ${cleanDomain}`, `127.0.0.1 www.${cleanDomain}`];

  console.log("AddCustomURL triggered for", url)

  fs.readFile(hostsPath, "utf-8", (err, data) => {
    if (err) {
      console.error("Failed to read the hosts file:", err);
      return callback(false, "Failed to read the hosts file.");
    }

    if (data.includes(`127.0.0.1 ${cleanDomain}`)) {
      console.log("Domain already exists in the hosts file:", cleanDomain);
      return callback(false, "URL already exists in the hosts file.");
    }

    const updatedHosts = `${data.trim()}\n${entries.join("\n")}\n`;

    writeSafelyToHosts(updatedHosts, (success, message) => {
      console.log("Write to hosts file result:", cleanDomain, { success, message });
      if (success) {
        updateCustomUrls(cleanDomain, callback); // Add this!
      } else {
        callback(false, "Failed to update hosts file.");
      }
    });
  });
};

const updateCustomUrls = (url, callback) => {
  const customUrlsPath = require('../utils').getCustomUrlsPath();
  const customUrls = readJsonFile(customUrlsPath);

  console.log("Before updating custom URLs:", customUrls);
  console.log("Writing to path:", customUrlsPath);

  if (!customUrls.includes(url)) {
    customUrls.push(url);
    console.log("Adding URL to customUrls.json:", url);
    writeJsonFile(customUrlsPath, customUrls);
  } else {
    console.log("URL already exists in customUrls.json:", url);
  }

  callback(true, "Custom URL added successfully.");
};

// Remove a custom URL from the hosts file
const removeCustomUrl = (url, callback) => {
  const cleanDomain = url.replace(/^www\./, "");
  fs.readFile(hostsPath, "utf-8", (err, data) => {
    if (err) return callback(false, "Failed to read the hosts file.");

    const updatedContent = data
      .split("\n")
      .filter(
        (line) =>
          !line.includes(`127.0.0.1 ${cleanDomain}`) &&
          !line.includes(`127.0.0.1 www.${cleanDomain}`)
      )
      .join("\n");

    writeSafelyToHosts(
      updatedContent,
      callback,
      "Custom URL removed successfully."
    );
  });
};

module.exports = {
  addCustomUrl,
  checkBlocklistIntegrity,
  removeCustomUrl,
  blockPresetUrls: (callback) => appendBlocklist(readBlocklist(), callback),
  appendBlocklist,
  writeSafelyToHosts,
};
