const https = require('https');
const fs = require('fs');
const path = require('path');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const hostname = '0.0.0.0';
const port = 3001;

const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'mcc.local+2-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'mcc.local+2.pem')),
};

app.prepare().then(() => {
  https.createServer(options, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, hostname, () => {
    console.log(`🔒 HTTPS server running at https://mcc.local:${port}`);
  });
});