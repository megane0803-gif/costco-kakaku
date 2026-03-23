module.exports = async (req, res) => {
  const { keyword, jan, name, apiKey: queryApiKey } = req.query;
  // クライアント提供キーを優先（環境変数が無効な場合に対応）
  const apiKey = queryApiKey || process.env.RAKUTEN_API_KEY;

  if (!apiKey) return res.status(400).json({ error: 'APIキーが設定されていません。設定画面で楽天アプリIDを入力してください。' });
  if (!keyword && !jan && !name) return res.status(400).json({ error: 'keyword, jan, or name required' });

  const BASE = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
  const COMMON = `applicationId=${apiKey}&hits=5&sort=%2BitemPrice&availability=1&format=json`;

  try {
    let url;
    if (keyword) {
      url = `${BASE}?${COMMON}&keyword=${encodeURIComponent(keyword)}`;
    } else if (jan) {
      url = `${BASE}?${COMMON}&jan=${encodeURIComponent(jan)}`;
    } else {
      url = `${BASE}?${COMMON}&keyword=${encodeURIComponent(name)}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    // 楽天APIのエラーをクライアントに正しく伝える
    if (data.error) {
      return res.status(502).json({ error: `楽天API: ${data.error_description || data.error}` });
    }

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
