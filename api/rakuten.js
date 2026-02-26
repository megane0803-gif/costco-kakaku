module.exports = async (req, res) => {
  const { keyword, name } = req.query;
  const apiKey = process.env.RAKUTEN_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'RAKUTEN_API_KEY not set' });
  if (!keyword && !name) return res.status(400).json({ error: 'keyword or name required' });

  // キーワード検索（ホーム画面のクイック検索）
  if (keyword) {
    const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?applicationId=${apiKey}&keyword=${encodeURIComponent(keyword)}&hits=5&sort=%2BitemPrice&availability=1&format=json`;
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(data);
  }

  // JAN検索（商品詳細）: 商品名 → JANコード取得 → 商品検索
  try {
    // Step 1: 楽天商品データベースAPIでJANコードを取得
    const productUrl = `https://app.rakuten.co.jp/services/api/Product/Search/20170426?applicationId=${apiKey}&keyword=${encodeURIComponent(name)}&hits=1&format=json`;
    const productRes = await fetch(productUrl);
    const productData = await productRes.json();

    const jan = productData.Products?.[0]?.Product?.jan;
    if (!jan) {
      // JANコードなし＝コストコ専用商品の可能性
      return res.status(200).json({ Items: [], noJan: true });
    }

    // Step 2: JANコードで楽天市場の商品を検索
    const itemUrl = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?applicationId=${apiKey}&jan=${encodeURIComponent(jan)}&hits=5&sort=%2BitemPrice&availability=1&format=json`;
    const itemRes = await fetch(itemUrl);
    const itemData = await itemRes.json();

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({ ...itemData, jan });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
