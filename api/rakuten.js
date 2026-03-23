module.exports = async (req, res) => {
  const { keyword, jan, name, apiKey: queryApiKey } = req.query;
  const apiKey = process.env.RAKUTEN_API_KEY || queryApiKey;

  if (!apiKey) return res.status(400).json({ error: 'APIキーが設定されていません。設定画面で楽天アプリIDを入力してください。' });
  if (!keyword && !jan && !name) return res.status(400).json({ error: 'keyword, jan, or name required' });

  const BASE = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
  const COMMON = `applicationId=${apiKey}&hits=5&sort=%2BitemPrice&availability=1&format=json`;

  try {
    let url;
    if (keyword) {
      // キーワード検索（ホーム画面のクイック検索 or カスタムキーワード）
      url = `${BASE}?${COMMON}&keyword=${encodeURIComponent(keyword)}`;
    } else if (jan) {
      // JANコード検索（コストコAPIから取得したJAN）
      url = `${BASE}?${COMMON}&jan=${encodeURIComponent(jan)}`;
    } else {
      // 商品名でキーワード検索（フォールバック）
      url = `${BASE}?${COMMON}&keyword=${encodeURIComponent(name)}`;
    }

    const response = await fetch(url);
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
