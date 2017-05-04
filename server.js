// core
var http = require('http')
var url = require('url')
var qs = require('querystring')
var fs = require('fs')
var path = require('path')

// external
var jimp = require('jimp')

// download register is a mutable object
var download_register = {}

http.createServer((req, res) => {
  var purl = url.parse(req.url, true)
  if (purl.pathname !== '/resize') {
    return res.end('Hello World\n')
  }
  var image = get_image_info(req.url)
  // var params = purl.query
  // var width = params.width
  // var height = params.height
  // var image_url = params.url

  // return early if no image url
  if (!image.url || (!image.new_width && !image.new_height)) {
    res.writeHead(400)
    return res.end('Please provide image url and either a width and a height\n')
  }

  // hash url so we can save to file system
  // var ext = path.extname(image_url)
  // var hashed_filename = create_filename(image_url, ext)


  // if url is in image download register, subscribe to the end event
  if (download_register[image.url]) {
    var upload_stream = download_register[image.url]
    return upload_stream.on('finish', () => {
      resize_image(image.hashed, image.new_width, image.new_height, (err, resized_filename) => {
        reply_with_error_or_resized(err, resized_filename, res)
      })
    })
  }


  // if image has already been downloaded
  if (fs.existsSync(image.hashed)) {
    return resize_image(image.hashed, image.new_width, image.new_height, (err, resized_filename) => {
      reply_with_error_or_resized(err, resized_filename, res)
    })
  }

  // if image has not yet been downloaded
  http.get(image.url, (image_res) => {
    // store the image
    var write_file = fs.createWriteStream(image.hashed)
    // pipe image download to new file
    var write = image_res.pipe(write_file)
    // update the download register
    download_register[image.url] = write_file

    write_file.on('finish', () => {
      // update download register
      delete download_register[image.url]

      resize_image(image.hashed, image.new_width, image.new_height, (err, resized_filename) => {
        reply_with_error_or_resized(err, resized_filename, res)
      })
    })
    image_res.on('error', (error) => {
      delete download_register[image.url]
      reply_with_error_or_resized(err, null, res)
    })
    write_file.on('error', (error) => {
      delete download_register[image.url]
      reply_with_error_or_resized(err, null, res)
    })
  })
}).listen(1337)
console.log('Server running at http://127.0.0.1:1337/')



var reply_with_error_or_resized = (err, resized_filename, res) => {
  if (err) {
    res.writeHead(500)
    return res.end('Server Error')
  }
  var headers = create_headers(resized_filename)
  res.writeHead(200, headers)
  var read = fs.createReadStream(resized_filename)
  return read.pipe(res)
}

var resize_image = (filename, width, height, cb) => {
  var resized_filename = 'resized-' + filename
  // Read the image, resize and write to file system
  jimp.read(filename, (err, resizable) => {
    if (err) {
      console.log("error resizing image");
      return cb(err, null)
    }
    resizable
      .resize(+width || jimp.AUTO, +height || jimp.AUTO)
      .write(resized_filename)

      return cb(null, resized_filename)
  })
}

var get_image_info = (req_url) => {
  var purl = url.parse(req_url, true)
  var params = purl.query
  return (
    { new_width: params.width
    , new_height: params.height
    , url: params.url
    , ext: path.extname(req_url)
    , hashed: create_filename(req_url, path.extname(req_url))
    }
  )
}


var crypto = require('crypto');
var create_filename = (url, ext) => crypto.createHash('md5').update(url).digest('hex') + ext

var mime = require('mime-types')
var create_headers = (filename) => (
  { 'Content-Type': mime.lookup(filename)
  , 'Content-Disposition' : 'attachment; filename=' + filename
  }
)
