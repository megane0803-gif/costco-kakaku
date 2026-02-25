module.exports = async (req, res) => {
  const { keyword } = req.query;
  const apiKey = process.env.RAKUTEN_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'RAKUTEN_API_KEY not set' });
  }
  if (!keyword) {
    return res.status(400).json({ error: 'keyword required' });
  }

  const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?applicationId=${apiKey}&keyword=${encodeURIComponent(keyword)}&hits=5&sort=%2BitemPrice&availability=1&format=json`;

  const response = await fetch(url);
  const data = await response.json();

  res.setHeader('Cache-Control', 's-maxage=300');
  res.status(200).json(data);
};
