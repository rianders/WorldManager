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
  , MongoStore = require('connect-mongo')(express)
  , sessionStore = new MongoStore({db: "Session"});

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
app.use(express.methodOverride());
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
	var output =  fs.readFileSync(val, 'utf8');
	output = Handlebars.compile(output);
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
		previews.path=partialsDir+"/home.hbs";
		res.render('root', previews);
	});

});

app.get('/builds/:id', function(req,res) {
	$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
		if(r.documents.length!=0)
		{
			var world = {};
			world.world=r.documents[0];
			if(req.isAuthenticated())
			{
				if(req.user.identifier==world.world.user)
				{
					world.isMine=true;
				}
				
			}
			if(!fs.existsSync(__dirname+"/static/partials/"+req.route.params.id+"/world.hbs")) //world page has not been edited, use default
			{
				world.path=partialsDir+"/world.hbs";
			}
			else //load in the custom world page
			{
				world.path=__dirname+"/static/partials/"+req.route.params.id+"/world.hbs";	
			}
			world.identifier = req.route.params.id;
			res.render('root',world);
		}
		else
		{
			res.send(404);
		}
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
	}
});

app.get('/auth/google', passport.authenticate('google', { failureRedirect: '/login' }));

app.get('/auth/google/return', function(req, res, next){
  passport.authenticate('google', function(err, user, info){
    // This is the default destination upon successful login.
    var redirectUrl = '/';

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
	req.session.redirectUrl=req.url;
	if(req.isAuthenticated())
	{
		var formData = {};
		formData.path=partialsDir+"/upload.hbs";
		res.render('root', formData);
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/editprofile', function(req, res, next){
	req.session.redirectUrl=req.url;
	if(req.isAuthenticated())
	{
		var formData = {};
		formData.path=partialsDir+"/editprofile.hbs";
		$(config.db+".users").find({"identifier" : req.user.identifier}, function(r) {
			formData.user = r.documents[0]; //should always find something since we always check that a user is in the db when we check authentication
			res.render('root', formData);
		});
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/myprofile', function(req, res, next){
	req.session.redirectUrl=req.url;
	if(req.isAuthenticated())
	{
		var formData = {};
		$(config.db+".users").find({"identifier" : req.user.identifier}, function(r) {
			formData.user = r.documents[0]; //should always find something since we always check that a user is in the db when we check authentication
			formData.path=partialsDir+"/myprofile.hbs";
			res.render('root', formData);
		});
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/myworlds', function(req, res, next){
	req.session.redirectUrl=req.url;
	if(req.isAuthenticated())
	{
		$(config.db+".worlds").find({"user" : req.user.identifier}, function(r) {
			var previews = {};
			previews.preview=r.documents;
			previews.path=partialsDir+"/myworlds.hbs";
			res.render('root', previews);
		});
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/logout', function(req, res , next){
	req.session.redirectUrl=req.url;
	req.logout();
	res.redirect('/');
});
app.get('/editworld/:id', function(req, res, next){
	req.session.redirectUrl=req.url;
	if(req.isAuthenticated())
	{
		var query = {};
		query.id = req.route.params.id;
		query.user = req.user.identifier;
		$(config.db+".worlds").find(query, function(r) {
			var previews ={};
			previews.preview = r.documents[0];
			previews.path=partialsDir+"/editworld.hbs";
			res.render('root', previews);
		});
	}
	else
	{
		res.redirect('/login');
	}
});
app.put('/editpage/:id', function(req,res,next){
	req.session.redirectUrl=req.url;
	if(req.isAuthenticated())
	{	
		$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
			if(req.user.identifier=r.documents[0].user)
			{
				fs.exists(__dirname+"/static/partials/"+req.route.params.id+"/world.hbs", function(exists)
				{
					if(!exists)
					{
						//create a new page for them to edit by cloning the default
						if(!fs.existsSync(__dirname+"/static/partials/"+req.route.params.id))
						{	
							//ensure that the directory exists before we add the file to it
							fs.mkdirSync(__dirname+"/static/partials/"+req.route.params.id);
						}
					}
					fs.writeFile(__dirname+"/static/partials/"+req.route.params.id+"/world.hbs", req.body.data);
				});
				res.send({status: 'ok'});
			}
			else
			{
				res.send(403);
			}
		});
	}
	else
	{
		res.send(403);
	}
});
app.get('/editpage/:id', function(req,res, next){
	req.session.redirectUrl=req.url;
	if(req.isAuthenticated())
	{
		$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
			if(req.user.identifier=r.documents[0].user)
			{
				formData={};
				fs.exists(__dirname+"/static/partials/"+req.route.params.id+"/world.hbs", function(exists)
				{
					if(!exists)
					{
						//create a new page for them to edit by cloning the default
						if(!fs.existsSync(__dirname+"/static/partials/"+req.route.params.id))
						{	
							//ensure that the directory exists before we add the file to it
							fs.mkdirSync(__dirname+"/static/partials/"+req.route.params.id);
						}
						fs.createReadStream(partialsDir+"/world.hbs").pipe(fs.createWriteStream(__dirname+"/static/partials/"+req.route.params.id+"/world.hbs"));
					}
				});
				formData.pathToPartial=config.url+":"+config.port+"/partials/"+req.route.params.id+"/world.hbs";
				formData.path=partialsDir+"/editpage.hbs";
				formData.identifier=req.route.params.id;
				res.render('root', formData);
			}
			else
			{
				res.send(403);
			}
		});
	}
	else
	{
		res.send(403);
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
	if(req.route.params.id!="login")
	{
		req.session.redirectUrl=req.url;
	}
	formData={};
	formData.path=partialsDir+"/"+req.route.params.id+".hbs";
	if(!req.isAuthenticated())
	{
		formData.isNotAuthenticated=true;
	}
	res.render('root', formData);
});

app.get('/deleteworld/:id', function(req, res, next){
	req.session.redirectUrl=req.url;
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
