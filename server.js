const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const Vibrant = require('node-vibrant');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

// launch a headless browser instance
const browserPromise = puppeteer.launch({
  headless: "new",
  ignoreHTTPSErrors: true,
});

// handle the '/scrape' endpoint
app.get('/scrape', async (req, res) => {
  try {
    // extract query parameters
    const nickname = req.query.nickname;
    const year = req.query.year;
    const baseUrl = `https://letterboxd.com/${nickname}/films/diary/for/${year}/page/`;

    // scrape data from the provided URL
    const scrapedData = await scrapePages(baseUrl);

    // generate color palette for each film
    const colorPaletteData = await generateColorPalette(scrapedData);

    // send the color palette data as a json response
    res.json(colorPaletteData);
  } catch (error) {
    // handle errors during scraping
    console.error('Error during scraping:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function scrapePages(baseUrl) {
  const scrapedData = [];
  let currentPage = 1;

  try {
    const browser = await browserPromise;

    while (true) {
      const pageUrl = `${baseUrl}${currentPage}/`;
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36');
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });

      console.log('Navigated to page:', pageUrl);

      const entries = await page.$$('td.td-film-details');

      // scroll down multiple times to load more entries
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
        try {
          // extract film name and poster URL from the entry
          const filmNameElement = await entry.$('td.td-film-details h3 a');
          const filmName = await (filmNameElement ? filmNameElement.evaluate(node => node.textContent.trim()) : null);

          const filmPosterElement = await entry.$('td.td-film-details div.poster img.image');
          const filmPosterUrl = await (filmPosterElement ? filmPosterElement.evaluate(img => img.src || img.getAttribute('src')) : null);

          // ensure the URL and film name are valid before pushing to scrapedData
          if (filmPosterUrl && filmPosterUrl !== 'undefined' && filmName) {
            scrapedData.push({ filmName, filmPosterUrl });
          } else {
            console.error(`Error extracting poster URL or film name for an entry`);
          }
        } catch (error) {
          console.error('Error processing entry:', error.message);
        }
      }

      // close the page after scraping
      await page.close();
      currentPage++;
    }

    // return the collected film data
    return scrapedData;
  } catch (error) {
    // throw any encountered errors
    throw error;
  }
}

async function generateColorPalette(scrapedData) {
  const colorPaletteData = [];

  // iterate over each film entry
  for (const entry of scrapedData) {
    try {
      const palette = await Vibrant.from(entry.filmPosterUrl).getPalette();

      // extract the dominant color if Vibrant color is available
      const dominantColor = palette.Vibrant ? palette.Vibrant.hex : null;

      console.log(`Film: ${entry.filmName}, Poster URL: ${entry.filmPosterUrl}, Dominant Color: ${dominantColor}`);

      colorPaletteData.push({ filmName: entry.filmName, dominantColor });
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
