const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const { extractColors } = require('extract-colors');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

// create a single browser instance and reuse it
const browserPromise = puppeteer.launch({
  headless: "new",
  ignoreHTTPSErrors: true,
});

app.get('/scrape', async (req, res) => {
  try {
    const nickname = req.query.nickname;
    const year = req.query.year;
    const baseUrl = `https://letterboxd.com/${nickname}/films/diary/for/${year}/page/`;

    const scrapedData = await scrapePages(baseUrl);

    const colorPaletteData = await generateColorPalette(scrapedData);

    res.json(colorPaletteData);
  } catch (error) {
    console.error('Error during scraping:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


async function scrapePages(baseUrl) {
  const scrapedData = [];
  let currentPage = 1;

  try {
    // reuse the same browser instance
    const browser = await browserPromise;

    // continue looping until there are no more entries on the page
    while (true) {
      // build the URL for the current page
      const pageUrl = `${baseUrl}${currentPage}/`;

      // open a new page for each iteration
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36');

      // navigate to the page
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });


      // wait for the actual image to load (adjust the selector accordingly)
      console.log('Navigated to page:', pageUrl);
      // extract film entries from the current page
      const entries = await page.$$('td.td-film-details');

      // scroll down multiple times
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      // wait for a short delay before extracting data
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

      // if no entries are found, exit the loop
      if (entries.length === 0) {
        break;
      }

      // process each entry on the page
      for (const entry of entries) {
        // extract film name and poster URL from the entry
        const filmName = await entry.$eval('td.td-film-details h3 a', (link) => link.textContent.trim());
        // extract the actual image URL after scrolling
        const filmPosterUrl = await entry.$eval('td.td-film-details div.poster img.image', (img) => img.src || img.getAttribute('src'));


        // ensure the URL is valid before pushing to scrapedData
        if (filmPosterUrl && filmPosterUrl !== 'undefined') {
          scrapedData.push({ filmName, filmPosterUrl });
        } else {
          console.error(`Error extracting poster URL for film: ${filmName}`);
        }
      }

      // close the page after scraping
      await page.close();

      // move to the next page
      currentPage++;
    }

    // return the collected film data
    return scrapedData;
  } catch (error) {
    // throw any encountered errors
    throw error;
  }
}

// function to generate a color palette for each film in the provided data
async function generateColorPalette(scrapedData) {
  const colorPaletteData = [];

  // iterate over each film entry
  for (const entry of scrapedData) {
    try {
      // reuse the same browser instance
      const browser = await browserPromise;

      // open a new page for each iteration
      const page = await browser.newPage();

      const response = await page.goto(entry.filmPosterUrl, { waitUntil: 'load' });
      const imageDataBuffer = await response.buffer();

      const colorPaletteEntry = await extractColors({
        data: Array.from(imageDataBuffer),
        width: 1,
        height: imageDataBuffer.length / 4,
      });

      const dominantColor = colorPaletteEntry[0]?.hex || null;

      console.log(`Film: ${entry.filmName}, Poster URL: ${entry.filmPosterUrl}, Dominant Color: ${dominantColor}`);

      colorPaletteData.push({ filmName: entry.filmName, dominantColor });

      // close the page after generating color palette
      await page.close();
    } catch (error) {
      console.error('Error generating color palette:', error.message);
      console.log(`Film: ${entry.filmName}, Poster URL: ${entry.filmPosterUrl}, Error: ${error.message}`);

      colorPaletteData.push({ filmName: entry.filmName, dominantColor: null });
    }
  }

  // return the generated color palette
  return colorPaletteData;
}


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
