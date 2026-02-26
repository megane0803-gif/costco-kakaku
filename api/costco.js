const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
};

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
      if (res.status === 429 || res.status >= 500) {
        if (i < retries) { await new Promise(r => setTimeout(r, 800 * (i + 1))); continue; }
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 800 * (i + 1)));
    }
  }
}

function extractPrice(html, itemNo) {
  const priceRe = /¥([\d,]{3,8})/g;
  const allMatches = [];
  let m;
  while ((m = priceRe.exec(html)) !== null) {
    allMatches.push({ pos: m.index, raw: m[1], value: parseInt(m[1].replace(/,/g, ''), 10) });
  }
  if (allMatches.length === 0) return null;
  const itemPos = html.indexOf(itemNo);
  if (itemPos !== -1) {
    const nearby = allMatches.filter(p => Math.abs(p.pos - itemPos) < 500);
    if (nearby.length > 0) {
      nearby.sort((a, b) => Math.abs(a.pos - itemPos) - Math.abs(b.pos - itemPos));
      return nearby[0].value;
    }
  }
  const reasonable = allMatches.filter(p => p.value >= 100 && p.value <= 100000);
  return reasonable.length > 0 ? reasonable[0].value : null;
}

module.exports = async (req, res) => {
  const { itemNo } = req.query;
  if (!itemNo) return res.status(400).json({ error: 'itemNo required' });

  try {
    // API（現在価格）とHTML（通常価格）を並列取得
    const [apiResult, htmlResult] = await Promise.allSettled([
      fetchWithRetry(`https://www.costco.co.jp/rest/v2/japan/metadata/productDetails?code=${encodeURIComponent(itemNo)}&lang=ja&curr=JPY`),
      fetchWithRetry(`https://www.costco.co.jp/p/${encodeURIComponent(itemNo)}`),
    ]);

    let name = null, priceYen = null, normalPriceYen = null, discountYen = null, priceValidUntil = null;
    let finalUrl = `https://www.costco.co.jp/p/${itemNo}`;

    // productDetails API → 商品名・現在価格・セール期限
    if (apiResult.status === 'fulfilled') {
      try {
        const data = await apiResult.value.json();
        name = data.metaTitle || null;
        if (data.schemaOrgProduct) {
          const schema = JSON.parse(data.schemaOrgProduct);
          if (schema.offers) {
            const p = parseFloat(schema.offers.price);
            if (!isNaN(p)) priceYen = Math.round(p);
            priceValidUntil = schema.offers.priceValidUntil || null;
          }
        }
      } catch (_) {}
    }

    // HTML → 通常価格（静的HTML内の¥表記）
    if (htmlResult.status === 'fulfilled') {
      try {
        const html = await htmlResult.value.text();
        finalUrl = htmlResult.value.url;
        if (!name) {
          const titleMatch = html.match(/<title>(.*?)<\/title>/i);
          if (titleMatch) name = titleMatch[1].replace(/\s*\|\s*Costco Japan\s*$/i, '').trim();
        }
        normalPriceYen = extractPrice(html, itemNo);
      } catch (_) {}
    }

    // 割引額を計算（通常価格 > 現在価格のとき）
    if (priceYen && normalPriceYen && normalPriceYen > priceYen) {
      discountYen = normalPriceYen - priceYen;
    }

    res.status(200).json({
      itemNo, name, priceYen, normalPriceYen, discountYen, priceValidUntil, finalUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      error: e.message, itemNo, name: null,
      priceYen: null, normalPriceYen: null, discountYen: null, priceValidUntil: null,
    });
  }
};
