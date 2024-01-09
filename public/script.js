async function fetchColorPalette() {
  const username = document.getElementById('username').value;
  const yearInput = document.getElementById('year').value;
  const year = parseInt(yearInput, 10);

  if (isNaN(year) || year <= 0) {
    console.error('Invalid year input. Please enter a valid positive year.');
    return;
  }

  try {
    const response = await fetch(`http://localhost:3000/scrape?username=${username}&year=${year}`);
    const colorPaletteData = await response.json();

    if (!response.ok) {
      console.error(`Failed to fetch. HTTP error! Status: ${response.status}`);
    }

    console.log('Color Palette Data:', colorPaletteData);
    renderYearlyCalendar(colorPaletteData, year);
  } catch (error) {
    console.error('Error during fetch:', error.message);
  }
}

function getColor(date, colorPaletteData) {
  // format date as 'MM/DD'
  const formattedDate = ('0' + (date.getMonth() + 1)).slice(-2) + '/' + ('0' + date.getDate()).slice(-2);
  const items = colorPaletteData.filter(item => item.viewingDate === formattedDate);
  const colors = items.map(item => item.dominantColor);
  return colors.length ? averageColor(colors) : 'rgba(0, 0, 0, 0.05)';
}

function averageColor(colors) {
  let r = 0, g = 0, b = 0;

  for (let color of colors) {
    r += parseInt(color.slice(1, 3), 16);
    g += parseInt(color.slice(3, 5), 16);
    b += parseInt(color.slice(5, 7), 16);
  }

  r = Math.floor(r / colors.length);
  g = Math.floor(g / colors.length);
  b = Math.floor(b / colors.length);

  return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
}


function renderYearlyCalendar(colorPaletteData, year) {
  const table = document.querySelector('#calendar');
  const startDate = new Date(year, 0, 1); // the start date of the calendar
  const startDay = startDate.getDay(); // the day of the week of the start date

  // create an array of month names
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

   // create an array of colspan for each month
   const colSpanForMonth = [4, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 5];

   // create a row for month headings 
   const monthRow = document.createElement('tr');
   for (let i = 0; i < 12; i++) {
     const monthCell = document.createElement('th');
     monthCell.textContent = months[i];
     monthCell.colSpan = colSpanForMonth[i]; // set colspan according to the array
     monthRow.appendChild(monthCell);
   }
   table.appendChild(monthRow);

  for (let i = 0; i < 7; i++) { // for each day of the week
    const row = document.createElement('tr');
    for (let j = 0; j < (isLeapYear(year) ? 53 : 52); j++) { // adjust weeks for leap year
      const cell = document.createElement('td');
      const date = new Date(startDate.getTime() + (((j * 7 + i) - startDay) * 24 * 60 * 60 * 1000));
      cell.style.backgroundColor = getColor(date, colorPaletteData); // pass the date object directly
      cell.title = date.toDateString();
      row.appendChild(cell);
    }
    table.appendChild(row);
  }
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}




