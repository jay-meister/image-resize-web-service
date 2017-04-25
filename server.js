var http = require('http')
var url = require('url')

var qs = require('querystring')
var fs = require('fs')
var path = require('path')

var jimp = require('jimp')

http.createServer((req, res) => {

  var purl = url.parse(req.url, true)
  if (purl.pathname !== '/resize') {
    return res.end('Hello World\n')
  }
  var params = purl.query
  var width = params.width
  var height = params.height
  var image_url = params.url

  // return early if no image url
  if (!image_url) {
    return res.end('No image url found\n')
  }

  // hash url so we can save to file system
  var ext = path.extname(image_url)
  var hashed_filename = create_filename(image_url, ext)


  http.get(image_url, (image_res) => {
    // store the image
    var download_file = fs.createWriteStream(hashed_filename)
    // pipe image download to new file
    image_res.pipe(download_file)
    image_res.on('end', () => {
      // image_res.setEncoding('binary')
      var headers = create_headers(hashed_filename)
      var resized_filename = 'resized-' + hashed_filename

      res.writeHead(200, headers)

      // Read the image, resize and write to file system
      jimp.read(hashed_filename, (err, resizable) => {
        resizable
          .resize(+width || jimp.AUTO, +height || jimp.AUTO)
          .write(resized_filename)

        var read = fs.createReadStream(resized_filename)
        read.pipe(res)
      })
    })
  })
}).listen(1337)
console.log('Server running at http://127.0.0.1:1337/')


var crypto = require('crypto');
var create_filename = (url, ext) => crypto.createHash('md5').update(url).digest('hex') + ext

var mime = require('mime-types')
var create_headers = (filename) => (
  { 'Content-Type': mime.lookup(filename)
  , 'Content-Disposition' : 'attachment; filename=' + filename
  }
)
