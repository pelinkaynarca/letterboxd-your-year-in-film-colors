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
  headless: true,
  ignoreHTTPSErrors: true,
});

// handle the '/scrape' endpoint
app.get('/scrape', async (req, res) => {
  try {
    // extract query parameters
    const username = req.query.username;
    const year = req.query.year;
    const baseUrl = `https://letterboxd.com/${username}/films/diary/for/${year}/page/`;

    // scrape data from the provided URL
    const scrapedData = await scrapePages(baseUrl);

    // generate color palette for each film
    const colorPaletteData = await generateColorPalette(scrapedData);

    // send the color palette data as a JSON response
    res.json(colorPaletteData);
    console.log(colorPaletteData)
  } catch (error) {
    // handle errors during scraping
    console.error('Error during scraping:', error.message);
    res.status(500).json({ error: `Internal Server Error: ${error.message}` });
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

      console.log('Before navigating to page:', pageUrl);
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
      console.log('After navigating to page. Waiting for entries...');

      console.log('Navigated to page:', pageUrl);

      // extract entries
      const entries = await page.$$('tr.diary-entry-row');

      // scroll down multiple times to load more entries
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        // wait for a short delay before extracting data
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // break the loop if no entries are found
      if (entries.length === 0) {
        break;
      }

      // process each entry on the page
      for (const entry of entries) {
        try {
          const filmPosterElement = await entry.$('.td-film-details div.poster img.image');
          const viewingDateElement = await entry.$('.td-day.diary-day a');

          // ensure both elements are present before proceeding
          if (filmPosterElement && viewingDateElement) {
            // extract film poster URL and viewing date element
            const filmPosterUrl = await filmPosterElement.evaluate(img => img.src || img.getAttribute('src'));
            const viewingDateStr = await viewingDateElement.evaluate(a => a.getAttribute('href'));

            // convert the extracted date string to the desired format
            const viewingDate = convertDateStr(viewingDateStr);

            // ensure the URL and viewing date are valid before pushing to scrapedData
            if (filmPosterUrl && filmPosterUrl !== 'undefined' && viewingDate) {
              scrapedData.push({ filmPosterUrl, viewingDate });
            } else {
              console.error(`Error extracting poster URL or viewing date for an entry`);
            }
          } else {
            console.error(`Error: Film poster or viewing date element not found.`);
          }
        } catch (error) {
          console.error('Error processing entry:', error.message);
        }
      }

      // function to convert date format from "/${username}/films/diary/for/${year}/04/22/" to "04/22" e.g.
      function convertDateStr(dateStr) {
        const match = dateStr.match(/\/(\d{2})\/(\d{2})\//);
        if (match) {
          const [, month, day] = match;
          return `${month}/${day}`;
        }
        return null; // handle the case where the match fails
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

      // extract month and day from the viewing date
      const [month, day] = entry.viewingDate.split('/');

      // log the month, day, and dominant color to the console
      console.log(`Month: ${month}, Day: ${day}, Dominant Color: ${dominantColor}`);

      colorPaletteData.push({ dominantColor, viewingDate: entry.viewingDate });
    } catch (error) {
      console.error('Error generating color palette:', error.message);

      // log the error along with the viewing date
      console.log(`Viewing Date: ${entry.viewingDate}, Error: ${error.message}`);

      colorPaletteData.push({ dominantColor: null, viewingDate: entry.viewingDate });
    }
  }

  // return the generated color palette
  return colorPaletteData;
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
