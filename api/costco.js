module.exports = async (req, res) => {
  const { itemNo } = req.query;
  if (!itemNo) return res.status(400).json({ error: 'itemNo required' });

  try {
    const response = await fetch(`https://www.costco.co.jp/p/${encodeURIComponent(itemNo)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    const html = await response.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (!titleMatch) return res.status(404).json({ error: 'title not found' });

    const name = titleMatch[1].replace(/\s*\|\s*Costco Japan\s*$/i, '').trim();
    if (!name) return res.status(404).json({ error: 'product not found' });

    res.status(200).json({ name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
