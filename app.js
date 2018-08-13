const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const exphbs = require('express-handlebars');
const multer = require('multer');
const app = express();
const flash = require('connect-flash');
const mkdirp = require('mkdirp');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const expressValidator = require('express-validator');
const passport = require('passport');
const session = require('express-session');
const config = require('./config/config');
const bluebird = require('bluebird');
const xoauth2 = require('xoauth2');

	//DIRECTORY INITIALIZATION
	//static public folder initialization
	app.use('/public', express.static(path.join(__dirname, 'public')));

	//MIDDLEWARE INITIALIZATION
	//body-parser
	//app.use(bodyParser.urlencoded({ extended: false}));
	//app.use(bodyParser.json());
	//app.use(bodyParser({uploadDir: path.join(__dirname, '../public/uploads')}));

	app.use(bodyParser.json());
	//app.use(bodyParser({uploadDir: path.join(__dirname, '../public/uploads')}));
	app.use(bodyParser.urlencoded({
	  extended: true
	}));

	//express-session
	app.use(session({
	  secret: 'keyboard cat',
	  resave: true,
	  saveUninitialized: true
	}));

	//express-messages
	app.use(require('connect-flash')());
	app.use(function (req, res, next) {
	  res.locals.messages = require('express-messages')(req, res)();
	  next();
	});

	//express-validator
	app.use(expressValidator({
		errorFormatter: function(param, msg, value) {
		  var namespace = param.split('.')
		  , root    = namespace.shift()
		  , formParam = root;
		while(namespace.length) {
		  formParam += '[' + namespace.shift() + ']';
		}
		return {
		  param : formParam,
		  msg   : msg,
		  value : value
		};
	  }
	}));

	//mongoose
	const dbconf = require('./config/database');
	mongoose.Promise = bluebird;
	mongoose.connect(dbconf.database, { useMongoClient: true });
	var conn = mongoose.connection;
	conn.once('open', function(){console.log('Connected to MongoDB');});
	conn.on('error', function(err){console.log(err);});

	//passport
	require('./config/passport')(passport);
	app.use(passport.initialize());
	app.use(passport.session());

	//handlebars
	app.engine('handlebars', exphbs.create({
	defaultLayout: 'main',
	layoutsDir: app.get('views') + '/layouts',
	partialsDir: [app.get('views') + '/partials'],
	}).engine);
	app.set('view engine', 'handlebars');

	//multer
	var storage = multer.diskStorage({
	  destination: function (req, file, cb) {
		var dest = 'public/uploads/';
		mkdirp(dest, function (err) {
			if (err) cb(err, dest);
			else cb(null, dest);
		});
	  },
	  filename: function (req, file, cb) {
		//cb(null, Date.now()+'-'+file.originalname);
		var possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
        imgUrl = '';
		for(var i=0; i < 6; i+=1) {
			imgUrl += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		cb(null, imgUrl + path.extname(file.originalname));
	  }
	});
	var upload = multer({ storage: storage });

	//ROUTES
	//global user log in route
	app.get('*', function(req,res,next){
	res.locals.user = req.user || null;
	next();
	});

	//home route
	app.get('/', function(req,res){
		res.render('gallery_index');
	});

	//gallery get route
	app.get('/gallery/:gallery_id', function(req,res){
		Image.find({gallery: req.params.gallery_id}, function(err, images) {
			if(err){
			}else{
				res.render('gallery', {
					images: images
				});
			}
		});
	});

	//image get route
	app.get('/images/:id', function(req,res){
		var id = req.params.id;
		Image.findById(id, function(err,image){
			res.render('image', {
				image:image
			});
		});
	});

	//image upload get route
	app.get('/upload', function(req,res){
		if(req.user){
			res.render('upload');
		}else{
			res.send('Go Away');
		}
	});

	//image upload post route
	app.post('/images', upload.single('avatar'),function (req,res){
		var ext = path.extname(req.file.path);
		var newImg = new Image({
			path: req.file.path,
			originalname: req.file.originalname,
			filename: req.file.filename,
			title: req.body.title,
			gallery: req.body.gallery_id,
			description: req.body.description,
			extension: ext
		});
		newImg.save(function(err){
			if(err) return handleError(err);
		});
		if(req.file){
			//console.dir(req.file);
			return res.render('upload');
		}
		res.end('missing');
	});

	//image delete route
	app.delete('/images/:id', function(req,res){
		let query = {_id:req.params.id}
		Image.findById(query, function(err,image){
			image:image
			deletePath = image.path;
			console.log(deletePath);
			//delete the file from the mongoose db
			Image.remove(query, function(err){
				if(err){
					console.log(err);
				}else{
					res.send('file deleted from database');
				}
			});
			//delete the file from the local public directory
			fs.unlink(deletePath,function(err){
				if(err) return console.log(err);
					console.log('file deleted from local public folder');
				});
		});
	});

	//shop route
	app.get('/shop', function(req,res){
		res.render('shop');
	});

	//profile route
	app.get('/profile', function(req,res){
		res.render('profile');
	});

	//contact route get
	app.get('/contact', function(req,res){
		res.render('contact');
	});

	app.post('/send', upload.any('avatar'), (req, res) => {

		var attachmentList = [];

		const output = `
		 <p>You have a new contact request</p>
		 <h3>Contact Details</h3>
		 <ul>
			<li>Name: ${req.body.name}</li>
			<li>Subject: ${req.body.subject}</li>
			<li>Email: ${req.body.email}</li>
		 </ul>
		 <h3>Message</h3>
		 <p>${req.body.message}</p>
		`;

		for(var i = 0; i < req.files.length; i++){
			attachmentList.push({filename: req.files[i].originalname, path: req.files[i].path});

		}

		let transporter = nodemailer.createTransport({
		    host: 'smtp.gmail.com',
		    port: 465,
		    secure: true,
		    auth: {
		        type: 'OAuth2',
		        user: config.mailUser,
		        clientId: config.clientId,
		        clientSecret: config.clientSecret,
		        refreshToken: config.refreshToken,
		        accessToken: config.accessToken,
		        expires: 1484314697598
		    }
		});
		
		// setup email data with unicode symbols
		var mailOptions = {
			from: '"Nodemailer Contact" <rrcraft.gallery@gmail.com>', // sender address
			to: 'rrcraft.gallery@gmail.com', // list of receivers
			subject: req.body.subject, // Subject line
			html: output, // html body
			attachments: attachmentList
		};


		// send mail with defined transport object
		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				return console.log(error);
			}
			console.log('Message sent: %s', info.messageId);
			console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
			res.render('contact', {msg:'Email has been sent!'});
		});
	});



//import models
var Image = require('./models/image');

//import routes
let users = require('./routes/users');
app.use('/users', users);

//start server
app.listen(3000, function(){
  console.log('Server started on port 3000');
});
