const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
  // ¥ パターンを全て抽出（¥1,234 or ¥1234 形式）
  const priceRe = /¥([\d,]{3,8})/g;
  const allMatches = [];
  let m;
  while ((m = priceRe.exec(html)) !== null) {
    allMatches.push({ pos: m.index, raw: m[1], value: parseInt(m[1].replace(/,/g, ''), 10) });
  }
  if (allMatches.length === 0) return null;

  // itemNo の近傍（前後500文字）にある価格を優先
  const itemPos = html.indexOf(itemNo);
  if (itemPos !== -1) {
    const nearby = allMatches.filter(p => Math.abs(p.pos - itemPos) < 500);
    if (nearby.length > 0) {
      // 最も近いものを返す
      nearby.sort((a, b) => Math.abs(a.pos - itemPos) - Math.abs(b.pos - itemPos));
      return nearby[0].value;
    }
  }

  // 近傍になければ最初に出てきた価格（100円〜100,000円の範囲に絞る）
  const reasonable = allMatches.filter(p => p.value >= 100 && p.value <= 100000);
  return reasonable.length > 0 ? reasonable[0].value : null;
}

module.exports = async (req, res) => {
  const { itemNo } = req.query;
  if (!itemNo) return res.status(400).json({ error: 'itemNo required' });

  try {
    const response = await fetchWithRetry(`https://www.costco.co.jp/p/${encodeURIComponent(itemNo)}`);
    const html = await response.text();
    const finalUrl = response.url;

    // 商品名
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const name = titleMatch
      ? titleMatch[1].replace(/\s*\|\s*Costco Japan\s*$/i, '').trim()
      : null;

    // 価格
    const priceYen = extractPrice(html, itemNo);

    res.status(200).json({
      itemNo,
      name: name || null,
      priceYen,
      finalUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message, itemNo, name: null, priceYen: null });
  }
};
