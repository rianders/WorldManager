/*
 To use this file:
 npm install express
 npm install request
 npm install handlebars
 npm install mongoose
 npm install fs
 npm install mongous
*/
var express = require('express')
  , util = require('util')
  , cons = require('consolidate')
  , Handlebars = require('handlebars')
  , request = require('request')  
  , app = express()
  , fs = require('fs')
  , $ = require("mongous").Mongous
  , passport = require('passport')
  , GoogleStrategy = require('passport-google').Strategy
  , path = require('path')
  , config = require('./config');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GoogleStrategy({
    returnURL:config.url+':'+config.port+'/auth/google/return',
    realm: config.url+':'+config.port
  },
  function(identifier, profile, done) {
	process.nextTick(function () {
		  
		  // To keep the example simple, the user's Google profile is returned to
		  // represent the logged-in user.  In a typical application, you would want
		  // to associate the Google account with a user record in your database,
		  // and return that user instead.
		  profile.identifier = identifier;
		  return done(null, profile);
	});
  }
));

app.configure('development', function () {
	app.use(express.logger());
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack: true}))
	});

// set .hbs as the default extension 
app.set('view engine', 'hbs');
app.engine('hbs', cons.handlebars);
app.set('views', __dirname + '/views');
app.set('view options', {layout:false});
app.use(express.static(__dirname+'/static'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);
//handlebars partials and helpers
var partialsDir = __dirname + '/views/partials';
//grab all the files in the partials directory
fs.readdir(partialsDir, function(err, files) {
	for(var filename in files)
	{
		filename=files[filename];
//check that the file is a handlebars file
     		var filetype = path.extname(filename);
     		console.log("registering file: " + filename);
     if (filetype==".hbs") {
		  var name = path.basename(filename, filetype);
		  var template = fs.readFileSync(partialsDir + '/' + filename, 'utf8');
		  console.log(name);
		  Handlebars.registerPartial(name, template);
		}
	}
	});

Handlebars.registerHelper('embed', function(val) {
		var output =  fs.readFileSync(partialsDir + '/' + val+".hbs", 'utf8');
		console.log(output);
		return output;
  });

app.get('/', function(req, res) {
	$(config.db+".worlds").find(function(r){ //grab the info from mongodb about the worlds that we have to render, and then display them on the page
			var previews = {};
			if(!req.isAuthenticated()) {
				previews.isNotAuthenticated=true; //set to true because 
			}
			previews.preview=r.documents;
			previews.home=true;
			console.log(previews);
			console.log("Loading home page");
			res.render('root', previews);
	});

});

app.get('/builds/:id', function(req,res) {
	$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
		var world = {};
		world.world=r.documents[0];
		console.log(world);
		if(req.isAuthenticated())
		{
			world.isNotAuthenticated=true;
			if(req.user==world.user)
			{
				console.log("This is my world!");
				world.isMine=true;
			}
			
		}
		res.render('root',world);
	});
});

app.post('/', function(req, res, next){
	if(req.isAuthenticated())
	{
		console.log("Received new world!");
		console.log(req.files.build);
		var extension = path.extname(req.files.build.name);
		console.log(extension);
		if(extension == ".unity3d") {
			newWorld = req.body;
			newWorld.id = path.basename(req.files.build.path);
			newWorld.world = "/builds/"+newWorld.id+"/"+req.files.build.name;
			newWorld.img = "/img/"+newWorld.id+"/"+req.files.image.name;
			newWorld.href = "/builds/"+newWorld.id;
			newWorld.user = req.user;
			fs.mkdirSync(__dirname+"/static/img/"+newWorld.id);
			fs.mkdirSync(__dirname+"/static/builds/"+newWorld.id);
			fs.readFile(req.files.build.path, function(err, data) {
				fs.writeFile(__dirname+"/static/builds/"+newWorld.id+"/"+req.files.build.name, data, function (err) {
					if(err) throw err;
					res.redirect("/");
				});
			});
			fs.readFile(req.files.image.path, function(err, data) {
				fs.writeFile(__dirname+"/static/img/"+newWorld.id+"/"+req.files.image.name, data, function (err) {
					if(err) throw err;
				});
			});
			$(config.db+".worlds").save(newWorld);
		}
	}
	else
	{
		res.redirect('/auth/google');
	}
});

app.get('/auth/google', passport.authenticate('google', { failureRedirect: '/login' }));

app.get('/auth/google/return', 
  passport.authenticate('google', { successRedirect: '/',
                                    failureRedirect: '/' }),   function(req, res) {
    res.redirect('/');
  });
  
app.get('/upload', function(req, res, next){
if(req.isAuthenticated())
{
	var formData = {};
	formData.upload=true;
	formData.form=[{desc:"Build", type: "file", name:"build"}, {desc:"Preview", type: "file", name:"image"}, {desc:"Name", type:"text", name:"name"}];
	res.render('root', formData);
}
else
{
	res.redirect('/auth/google');
}
});

app.get('/:id', function(req, res, next){
	console.log(req.route)
	formData={};
	formData.path=req.route.params.id;
	if(!req.isAuthenticated())
	{
		formData.isNotAuthenticated=true;
	}
	console.log(formData);
	res.render('root', formData);
});
var port = config.port;
console.log("WorldManager now listening on port:" + port);

app.listen(port);
