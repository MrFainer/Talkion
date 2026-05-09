const axios = require('axios');
const cheerio = require('cheerio');

(async () => {
  const { data } = await axios.get('https://newsinlevels.com/products/a-virus-on-a-ship-level-2/');
  const $ = cheerio.load(data);
  const pTags = $('p').map((i, el) => $(el).text().trim()).get().filter(t => t.length > 0);
  console.log(pTags);
})().catch(console.error);