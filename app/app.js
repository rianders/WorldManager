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
  , config = require('./config')
  , net = require('net')
  , messenger = require('messenger')
  , MongoStore = require('connect-mongo')(express)
  , sessionStore = new MongoStore({db: "Session"})
  , crc32 = require('buffer-crc32')
  , crypto = require('crypto');

var secret = 'keyboard cat';
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
		$(config.db+".users").find({"identifier" : identifier}, function(r) {
			if(r.documents.length!=0) //if the user is alraedy in the db, just return the user
			{
				profile = r.documents[0];
				return done(null, profile);
			}
			else //otherwise create a new user to add to the db and return the new user
			{
				profile.identifier = identifier;
				$(config.db+".users").save(profile);
				return done(null, profile);
			}
		});
	});
}));

var client = messenger.createSpeaker(3006);
var server = messenger.createListener(3005);
deleteFolderRecursive = function(path) {
    var files = [];
    if( fs.existsSync(path) ) {
	files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

app.configure('development', function () {
	app.use(express.logger("dev"));
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack: true
	}))
});

// set .hbs as the default extension 
app.set('view engine', 'hbs');
app.engine('hbs', cons.handlebars);
app.set('views', __dirname + '/views');
app.set('view options', {layout:false});
app.use(express.static(__dirname+'/static'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: secret, store : sessionStore, cookie: { path: '/', httpOnly: false, maxAge: 14400000 }}));
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

Handlebars.registerHelper('embed', function(val, data) {
	var output =  fs.readFileSync(partialsDir + '/' + val+".hbs", 'utf8');
	output = Handlebars.compile(output);
	console.log(this);
	return output(this);;
  });

  
Handlebars.registerHelper('compare', function(lvalue, rvalue, options) {

    if (arguments.length < 3){
        throw new Error("Handlerbars Helper 'compare' needs 2 parameters");
	}

    operator = options.hash.operator || "==";

    var operators = {
        '==':       function(l,r) { return l == r; },
        '===':      function(l,r) { return l === r; },
        '!=':       function(l,r) { return l != r; },
        '<':        function(l,r) { return l < r; },
        '>':        function(l,r) { return l > r; },
        '<=':       function(l,r) { return l <= r; },
        '>=':       function(l,r) { return l >= r; },
        'typeof':   function(l,r) { return typeof l == r; }
    }

    if (!operators[operator]){
        throw new Error("Handlerbars Helper 'compare' doesn't know the operator "+operator);
	}

    var result = operators[operator](lvalue,rvalue);

    if( result ) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
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
		if(req.isAuthenticated())
		{
			if(req.user.identifier==world.world.user)
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
		var extension = path.extname(req.files.build.name);																		
		if(extension == ".unity3d") {
			newWorld = req.body;
			newWorld.id = path.basename(req.files.build.path);
			newWorld.world = "/builds/"+newWorld.id+"/"+req.files.build.name;												
			newWorld.img = "/img/"+newWorld.id+"/"+req.files.image.name;																			
			newWorld.href = "/builds/"+newWorld.id;
			newWorld.user = req.user.identifier;
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
			$(config.db+".worlds").save(newWorld)
		}
	}
	else
	{
		res.redirect('/login');
		req.session.redirectUrl=req.url;;
	}
});

app.get('/auth/google', passport.authenticate('google', { failureRedirect: '/login' }));

app.get('/auth/google/return', function(req, res, next){
  passport.authenticate('google', function(err, user, info){
    // This is the default destination upon successful login.
    var redirectUrl = '/login';

    if (err) { return next(err); }
    if (!user) { return res.redirect('/'); }

    // If we have previously stored a redirectUrl, use that, 
    // otherwise, use the default.
    if (req.session.redirectUrl) {
      redirectUrl = req.session.redirectUrl;
      req.session.redirectUrl = null;
    }
    req.logIn(user, function(err){
      if (err) { return next(err); }
    });
    res.redirect(redirectUrl);
  })(req, res, next);
});

app.get('/upload', function(req, res, next){
	if(req.isAuthenticated())
	{
		var formData = {};
		formData.upload=true;
		res.render('root', formData);
	}
	else
	{
		res.redirect('/login');
		req.session.redirectUrl=req.url;;
	}
});

app.get('/editprofile', function(req, res, next){
	if(req.isAuthenticated())
	{
		var formData = {};
		formData.editprofile=true;
		$(config.db+".users").find({"identifier" : req.user.identifier}, function(r) {
			formData.user = r.documents[0]; //should always find something since we always check that a user is in the db when we check authentication
			res.render('root', formData);
		});
	}
	else
	{
		res.redirect('/login');
		req.session.redirectUrl=req.url;;
	}
});

app.get('/myprofile', function(req, res, next){
	if(req.isAuthenticated())
	{
		var formData = {};
		$(config.db+".users").find({"identifier" : req.user.identifier}, function(r) {
			formData.user = r.documents[0]; //should always find something since we always check that a user is in the db when we check authentication
			formData.myProfile=true;
			res.render('root', formData);
		});
	}
	else
	{
		res.redirect('/login');
		req.session.redirectUrl=req.url;;
	}
});

app.get('/myworlds', function(req, res, next){
	if(req.isAuthenticated())
	{
		$(config.db+".worlds").find({"user" : req.user.identifier}, function(r) {
			var previews = {};
			previews.preview=r.documents;
			previews.myworlds=true;
			res.render('root', previews);
		});
	}
	else
	{
		res.redirect('/login');
		req.session.redirectUrl=req.url;;
	}
});

app.get('/logout', function(req, res , next){
	req.logout();
	res.redirect('/');
});
app.get('/editworld/:id', function(req, res, next){
	if(req.isAuthenticated())
	{
		var query = {};
		query.id = req.route.params.id;
		query.user = req.user.identifier;
		$(config.db+".worlds").find(query, function(r) {
			var previews ={};
			previews.preview = r.documents[0];
			previews.editworld=true;
			res.render('root', previews);
		});
	}
	else
	{
		res.redirect('/login');
		req.session.redirectUrl=req.url;;
	}
});
app.post('/edit/:id', function(req, res, next){
	if(!req.isAuthenticated())
	{
		return;
	}
	var query = {};
	query.id = req.route.params.id;
	query.user = req.user.identifier;
	$(config.db+'.worlds').update(query, {$set : req.params});
});
//generic handler for static handlebars pages
app.get('/:id', function(req, res, next){
	formData={};
	formData.path=req.route.params.id;
	if(!req.isAuthenticated())
	{
		formData.isNotAuthenticated=true;
	}
	res.render('root', formData);
});

app.get('/deleteworld/:id', function(req, res, next){
	if(!req.isAuthenticated())
	{
		return;
	}
	var query = {};
	query.id = req.route.params.id;
	query.user = req.user.identifier;
	$(config.db+'.worlds').find(query, function(r) {
		deleteFolderRecursive(__dirname+'/static/builds/'+r.documents[0].id);
		deleteFolderRecursive(__dirname+'/static/img/'+r.documents[0].id);
	});
	$(config.db+'.worlds').remove(query);
	res.redirect('/myworlds');
});

app.post('/editprofile', function(req, res, next){
	if(!req.isAuthenticated())
	{
		res.redirect('/login');
		return;
	}
	var query = {};
	query.identifier = req.user.identifier;
	query.name= {};
	query.name.givenName=req.body.givenName;
	query.name.familyName=req.body.familyName;
	query.isPublic=req.body.isPublic;
	query.displayName=req.body.displayName;
	query.emails=[];
	query.emails[0]={"value" :req.body.email};
	$(config.db+'.users').update({"identifier":req.user.identifier}, {$set : query });
	res.redirect('/myprofile');
});
var port = config.port;
console.log("WorldManager now listening on port:" + port);
app.listen(port);
server.on('Authenticate', function(message, data) {
	console.log("Got authentication request");
	sessionStore.get(parseSignedCookie(data, secret), function(err, sess)
	{
		if(err) throw err;
		console.log(sess)
	});
});
parseSignedCookie = function(str, secret){
  return 0 == str.indexOf('s:')
    ? unsign(str.slice(2), secret)
    : str;
};
unsign = function(val, secret){
  var str = val.slice(0, val.lastIndexOf('.'));
  return sign(str, secret) == val
    ? str
    : false;
};
sign = function(val, secret){
  return val + '.' + crypto
    .createHmac('sha256', secret)
    .update(val)
    .digest('base64')
    .replace(/=+$/, '');
};

