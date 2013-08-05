module.exports =  function(req, res, next) {
	req.hbs={};
	req.hbs.isAuthenticated=req.isAuthenticated();
	if(req.hbs.isAuthenticated)
	{
		req.hbs.user=req.user;
	}
	else if(req.session!=null && req.url!='/login')
	{
		req.session.redirectUrl=req.url;
	}
	req.hbs.path=__dirname+'/views/partials/'+req.url.split('/')[1]+".hbs";
	next();
}

