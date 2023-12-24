const serverBaseUrl = 'http://localhost:3000'; // Change this to the actual base URL when deploying

async function startScraping() {
  const nickname = document.getElementById('nickname').value;
  const year = document.getElementById('year').value;

  try {
    const response = await fetch(`${serverBaseUrl}/scrape?nickname=${nickname}&year=${year}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch. HTTP error! Status: ${response.status}`);
      return;
    }

    const colorPaletteData = await response.json();
    console.log('Color Palette Data:', colorPaletteData);
    renderColorPalette(colorPaletteData);
  } catch (error) {
    console.error('Error during fetch:', error.message);
  }
}

function renderColorPalette(colorPaletteData) {
  const colorPaletteContainer = document.getElementById('colorPalette');
  colorPaletteContainer.innerHTML = '';

  if (Array.isArray(colorPaletteData)) {
    colorPaletteData.forEach(({ filmName, dominantColor }) => {
      const colorBox = document.createElement('div');
      colorBox.classList.add('color-box');
      colorBox.style.backgroundColor = dominantColor || 'transparent';
      colorPaletteContainer.appendChild(colorBox);
    });
  } else {
    console.error('Invalid colorPaletteData:', colorPaletteData);
  }
}