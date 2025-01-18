const axios = require('axios');
const fs = require('fs');
const path = require('path');

const urls = [
  "https://raw.githubusercontent.com/4skinSkywalker/Anti-Porn-HOSTS-File/refs/heads/master/HOSTS.txt",
  "https://blocklistproject.github.io/Lists/gambling.txt",
];

async function generateDefaultBlocklist() {
  const urlSet = new Set();

  console.log('Fetching blocklists...');
  for (const url of urls) {
    try {
      console.log(`Fetching from ${url}...`);
      const response = await axios.get(url);
      const rawList = response.data.split("\n");

      rawList.forEach((line) => {
        const trimmedLine = line.trim();
        if (
          !trimmedLine ||
          trimmedLine.startsWith("#") ||
          trimmedLine.includes("0.0.0.0    target.com")
        ) {
          return;
        }

        const parts = trimmedLine.split(/\s+/);
        if (parts.length > 1) {
          let domain = parts[1];
          if (domain.startsWith("www.")) {
            domain = domain.slice(4);
          }
          urlSet.add(domain);
        }
      });
    } catch (error) {
      console.error(`Failed to fetch from ${url}:`, error.message);
    }
  }

  // Add mandatory URLs
  urlSet.add("exampleadultsite.com");
  urlSet.add("wattpad.com");
  urlSet.add("archiveofourown.org");

  const blocklistData = {
    urls: Array.from(urlSet).sort(),
    lastUpdated: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, 'defaultBlocklist.json');
  fs.writeFileSync(outputPath, JSON.stringify(blocklistData, null, 2));
  
  console.log(`Successfully generated defaultBlocklist.json with ${blocklistData.urls.length} URLs`);
}

generateDefaultBlocklist().catch(console.error);