const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const { data } = await axios.get('https://newsinlevels.com/products/a-virus-on-a-ship-level-2/');
  const $ = cheerio.load(data);
  $('script, style, noscript, iframe, svg').remove();
  
  // Substitui <br> e </p> por algo que possamos quebrar
  $('br').replaceWith('||BR||');
  $('p, div, h1, h2, h3').each(function() {
    $(this).append('||BR||');
  });

  let rawText = $('body').text().replace(/\s+/g, ' ');
  
  // Restaura as quebras
  let lines = rawText.split('||BR||').map(l => l.trim()).filter(Boolean);

  let recording = false;
  let result = [];
  for (let line of lines) {
     if (!recording) {
        if (/^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/.test(line)) {
           recording = true;
        }
        continue;
     }

     if (line.includes('You can watch the original video') || line.includes('News in Levels is designed')) {
        break;
     }
     
     result.push(line);

     if (line.includes('Difficult words:')) {
        break;
     }
  }

  console.log(result.join('\\n\\n'));
})().catch(console.error);