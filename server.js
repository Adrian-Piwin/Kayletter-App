var path = require("path");
var express = require("express");

var PUBLIC_DIR = path.join(__dirname, "dist");
var PORT = 3000;
var app = express();

app.set('port', (process.env.PORT || PORT))

//Send index.html when the user access the web
app.get('/', function (req, res) {
  res.redirect('/index.html')
});

//Serving the files on the dist folder
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log('Running on port ' + PORT);
})