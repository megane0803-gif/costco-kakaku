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

module.exports = async (req, res) => {
  const { itemNo } = req.query;
  if (!itemNo) return res.status(400).json({ error: 'itemNo required' });

  try {
    // productDetails API から商品名・価格・セール期限を取得
    const apiUrl = `https://www.costco.co.jp/rest/v2/japan/metadata/productDetails?code=${encodeURIComponent(itemNo)}&lang=ja&curr=JPY`;
    const apiRes = await fetchWithRetry(apiUrl);
    const data = await apiRes.json();

    // 商品名
    const name = data.metaTitle || null;

    // schemaOrgProduct から現在価格とセール期限を取得
    let priceYen = null;
    let priceValidUntil = null;
    if (data.schemaOrgProduct) {
      try {
        const schema = JSON.parse(data.schemaOrgProduct);
        if (schema.offers) {
          const price = parseFloat(schema.offers.price);
          if (!isNaN(price)) priceYen = Math.round(price);
          priceValidUntil = schema.offers.priceValidUntil || null;
        }
      } catch (_) {}
    }

    const finalUrl = `https://www.costco.co.jp/p/${itemNo}`;

    res.status(200).json({
      itemNo,
      name,
      priceYen,
      priceValidUntil,
      finalUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message, itemNo, name: null, priceYen: null, priceValidUntil: null });
  }
};
