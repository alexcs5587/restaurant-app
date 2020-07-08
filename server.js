const express = require('express');
const app = express();
const session = require('cookie-session');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const rand = require("random-key");
const mongoURL = "mongodb+srv://mytestingdb:mytestingdb@cluster0-jyai0.azure.mongodb.net/test?retryWrites=true&w=majority";

app.set('view engine', 'ejs');
app.use(fileUpload());
app.use(express.static(__dirname + '/public'));

app.use(session({
	name: 'session',
	keys: ['i go to school by bus', 'everyday']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: true
}));

app.post('/login', function (req, res) {
	console.log('post');

	var criteria = {
		"name": req.body.user.userid,
		"password": req.body.user.password
	};

	MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
		assert.equal(err, null);
		console.log('DB connected');
		var db = client.db('mytestingdb');
		findUsers(db, criteria, function (users) {
			client.close();
			console.log('DB disconnected');
			if (users.length > 0) {
				req.session.authenticated = true;
				req.session.userid = req.body.user.userid;
				res.redirect('/restaurant/read');
			} else {
				res.render('message', {
					title: 'Login Failed',
					msg: 'Incorrect User ID or Password.'
				});
			}
		});
	});

});

app.get('/login', function (req, res) {
	res.render('userForm', {
		title: 'Login',
		path: '/login'
	});
});

app.get('/logout', function (req, res) {
	req.session = null;
	res.redirect('/');
});

app.get('/register', function (req, res) {
	res.render('userForm', {
		title: 'Register',
		path: '/register'
	});
});

app.post('/register', function (req, res) {
	var criteria = {
		"name": req.body.user.userid
	};
	MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
		assert.equal(err, null);
		var db = client.db('mytestingdb');
		console.log('DB connected');
		findUsers(db, criteria, function (users) {
			if (users.length > 0) {
				res.render('message', {
					title: 'Create User Failed',
					msg: 'User existed.'
				});
			} else {
				MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
					assert.equal(err, null);
					var db = client.db('mytestingdb');
					console.log('DB connected');
					var criteria2 = {
						"name": req.body.user.userid,
						"password": req.body.user.password,
						"api": rand.generate(40)
					};
					insertUser(db, criteria2, function (err) {
						if (err) {
							res.render('message', {
								title: 'Create User Failed',
								msg: 'Error occur. Please try again.'
							});
						} else {
							res.render('messagelink', {
								title: 'Create User Success',
								msg: 'Welcome, ' + req.body.user.userid,
								path: '/login',
								btnName: 'Back to Login Page'
							});
						}
					});
				});
				client.close();
				console.log('DB disconnected');
			}
		});
		client.close();
		console.log('DB disconnected');
	});
});

app.get('/restaurant/create', function (req, res) {
	if (!(isLogin(req))) {
		res.redirect('/login');
	}
	res.render('create', {
		path: '/restaurant/create'
	});
})

app.post('/restaurant/create', function (req, res) {
	if (req.body.name) {
		var restaurant = getRestaurant(req.body, req.files, req.session.userid);
		console.log('formatted restaurant: ' + JSON.stringify(restaurant));
		MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
			assert.equal(err, null);
			var db = client.db('mytestingdb');
			console.log('DB connected');
			insertRestaurant(db, restaurant, function (err, result) {
				if (err) {
					res.render('message', {
						title: 'Create Restaurant Failed',
						msg: 'Error. Please try again.'
					});
				} else {
					res.redirect('/restaurant/read')
				}
			});
			client.close();
			console.log('DB disconnected');
		});
	} else {
		res.render('message', {
			title: 'Create Restaurant Failed',
			msg: 'Please fill in restaurant name.'
		});
	}
})

app.post('/restaurant/rate', function (req, res) {
	console.log('scores: ' + JSON.stringify(req.body));
	var score = req.body.score;
	var id = req.body.restaurant_id;
	if (score && !(isNaN(score))) {
		console.log('has score, is number');
		score = parseInt(score);
		if (score > 0 && score <= 10) {
			console.log('has score, is valid number');
			MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
				assert.equal(err, null);
				var db = client.db('mytestingdb');
				console.log('DB connected');
				var user = req.body.user;
				insertGrade(db, id, score, user, function (err) {
					if (err) {
						res.render('messagelink', {
							title: 'Rate Failed',
							msg: 'Rate restaurant failed. *score should be (0-10)',
							path: '/restaurant/detail?restaurant_id=' + id,
							btnName: 'Back'
						});
					} else {
						var path = '/restaurant/detail?restaurant_id=' + id;
						res.redirect(path);
					}
				});
				client.close();
				console.log('DB disconnected');
			});
		} else {
			res.render('messagelink', {
				title: 'Rate Failed',
				msg: 'Score should be (0-10)',
				path: '/restaurant/detail?restaurant_id=' + id,
				btnName: 'Back'
			});
		}
	} else {
		res.render('messagelink', {
			title: 'Rate Failed',
			msg: 'Score should be (0-10)',
			path: '/restaurant/detail?restaurant_id=' + id,
			btnName: 'Back'
		});
	}
})

app.post('/restaurant/update', function (req, res) {
	var restaurant = getUpdatedRestaurant(req.body, req.files);
	MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
		console.log('DB connected');
		assert.equal(err, null);
		var db = client.db('mytestingdb');
		var id = req.body.restaurant_id;

		updateRestaurant(db, id, restaurant, req, function (err) {
			if (err) {
				res.render('messagelink', {
					title: 'Edit Failed',
					msg: 'Edit restaurant failed.',
					path: '/restaurant/detail?restaurant_id=' + id,
					btnName: 'Back'
				});
			} else {
				var path = '/restaurant/detail?restaurant_id=' + id;
				res.redirect(path);
			}
		});

		client.close();
		console.log('DB disconnected');
	});
})

app.post('/restaurant/delete', function (req, res) {
	var id = req.body.restaurant_id;
	var criteria = {
		"restaurant_id": req.body.restaurant_id,
		"owner": req.session.userid
	};
	MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
		console.log('DB connected');
		assert.equal(err, null);
		var db = client.db('mytestingdb');
		deleteRestaurant(db, criteria, function (err) {
			if (err) {
				res.render('messagelink', {
					title: 'Delete Failed',
					msg: 'Delete Failed.',
					path: '/restaurant/detail?restaurant_id=' + id,
					btnName: 'Back'
				});
			} else {
				res.redirect('/restaurant/read')
			}
		});
		client.close();
		console.log('DB disconnected');
	});
})

app.post('/api/restaurant/create', function (req, res) {
	console.log('post data: ' + JSON.stringify(req.body));
	if (req.body.name && req.body.api) {
		var file = (req.files) ? req.files : "";
		var criteria = {
			"api": req.body.api
		};

		MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
			assert.equal(err, null);
			var db = client.db('mytestingdb');
			console.log('DB connected');
			findUsers(db, criteria, function (users) {
				var owner = users[0].name;
				console.log('POST/ /api/restaurant/create/ owner: ' + owner);
				var restaurant = getRestaurant(req.body, file, owner);
				console.log('restaurant: ' + JSON.stringify(restaurant));
				MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
					assert.equal(err, null);
					var db = client.db('mytestingdb');
					console.log('DB connected');
					insertRestaurant(db, restaurant, function (err, result) {
						if (err) {
							var response = {};
							response['status'] = 'failed';
							res.writeHead(200, {
								"Content-Type": "application/json"
							});
							res.end(JSON.stringify(response));
						} else {
							var response = {};
							response['status'] = 'ok';
							response['_id'] = result.ops[0]._id;
							res.writeHead(200, {
								"Content-Type": "application/json"
							});
							res.end(JSON.stringify(response));
						}
					});
					client.close();
					console.log('DB disconnected');
				});
			});
			client.close();
			console.log('DB disconnected');
		});
	} else {
		var response = {};
		response['status'] = 'failed';
		res.writeHead(200, {
			"Content-Type": "application/json"
		});
		res.end(JSON.stringify(response));
	}
})

app.get('/restaurant/read', function (req, res) {
	if (!(isLogin(req))) {
		res.redirect('/login');
	}
	MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
		assert.equal(err, null);
		var db = client.db('mytestingdb');
		var projection = {
			"restaurant_id": 1,
			"name": 1,
			"_id": 0
		};
		var criteria = {};
		console.log('DB connected');
		findRestaurantsName(db, criteria, projection, function (restaurants) {
			res.render('display', {
				title: 'Restaurants',
				restaurants: restaurants,
				username: req.session.userid
			})
		});
		client.close();
		console.log('DB disconnected');
	});
})

app.get('/restaurant/detail', function (req, res) {
	if (!(isLogin(req))) {
		res.redirect('/login');
	}
	if (!(req.query.restaurant_id)) {
		res.redirect('/restaurant/read');
	}
	MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
		assert.equal(err, null);
		var db = client.db('mytestingdb');
		var criteria = {
			"restaurant_id": req.query.restaurant_id
		};
		console.log('DB connected');
		findRestaurant(db, criteria, function (restaurants) {
			var isGraded = false;
			for (i in restaurants) {
				for (j in restaurants[i].grades) {
					if (restaurants[i].grades[j].user == req.session.userid) {
						isGraded = true;
					}
				}
			}
			res.render('details', {
				r: restaurants[0],
				cu: req.session.userid,
				isGraded: isGraded
			});
		});
		client.close();
		console.log('DB disconnected');
	});
})

app.get('/restaurant/search', function (req, res) {
	if (!(isLogin(req))) {
		res.redirect('/login');
	}
	res.render('search', {
		path: '/restaurant/search'
	});
});

app.post('/restaurant/search', function (req, res) {
	if (!(isLogin(req))) {
		res.redirect('/login');
	}

	var criteria = getSearchedCriteria(req.body);
	var projection = {
		"restaurant_id": 1,
		"name": 1,
		"_id": 0
	};

	console.log('criteria: ' + JSON.stringify(criteria));

	MongoClient.connect(mongoURL,{ useNewUrlParser: true }, function (err, client) {
		assert.equal(err, null);
		var db = client.db('mytestingdb');
		console.log('DB connected');

		findRestaurantsName(db, criteria, projection, function (restaurants) {
			if (restaurants.length > 0) {
				res.render('displaysearched', {
					title: 'Searcheded Restaurants',
					restaurants: restaurants
				});
			} else {
				res.render('message', {
					title: 'No Restaurant Match',
					msg: 'No results.'
				});
			}
		});

		client.close();
		console.log('DB disconnected');
	});
})
app.get('/', function (req, res) {
	if (!(isLogin(req))) {
		res.redirect('/login');
	} else {
		res.redirect('/restaurant/read');
	}
});

function findUsers(db, criteria, callback) {
	var cursor = db.collection("users").find(criteria);
	var users = [];
	cursor.each(function (err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			users.push(doc);
		} else {
			callback(users, err);
		}
	});
}

function insertUser(db, user, callback) {
	db.collection('users').insertOne(user, function (err, result) {
		assert.equal(err, null);
		callback(err);
	});
}

function insertRestaurant(db, restaurant, callback) {
	db.collection('restaurants').insert(restaurant, function (err, result) {
		assert.equal(err, null);
		callback(err, result);
	});
}

function updateRestaurant(db, id, restaurant, req, callback) {
	db.collection('restaurants').findAndModify({
			"restaurant_id": id,
			"owner": req.session.userid
		},
		[], {
			$set: restaurant
		}, {},
		function (err) {
			callback(err);
		}
	);
}

function insertGrade(db, id, score, user, callback) {
	var grade = {
		"user": user,
		"score": score
	};
	db.collection('restaurants').findAndModify({
			"restaurant_id": id
		},
		[], {
			$push: {
				"grades": grade
			}
		}, {},
		function (err) {
			callback(err);
		}
	);
}

function findRestaurant(db, criteria, callback) {
	var cursor = db.collection("restaurants").find(criteria);
	var restaurants = [];
	cursor.each(function (err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants);
		}
	});
}

function deleteRestaurant(db, criteria, callback) {
	db.collection('restaurants').remove(criteria, function (err) {
		assert.equal(err, null);
		callback(err);
	});
}

function findRestaurantsName(db, criteria, projection, callback) {
	var cursor = db.collection("restaurants").find(criteria).project(projection);
	var restaurants = [];
	cursor.each(function (err, doc) {
		assert.equal(err, null);
		if (doc != null) {
			restaurants.push(doc);
		} else {
			callback(restaurants);
		}
	});
}


function getUpdatedRestaurant(body, files) {
	var restaurant = {};
	restaurant['name'] = body.name;
	restaurant['borough'] = body.borough;
	restaurant['cuisine'] = body.cuisine;

	restaurant['address'] = {};
	restaurant['address']['street'] = body.street;
	restaurant['address']['building'] = body.building;
	restaurant['address']['zipcode'] = body.zipcode;

	if (files != null) {
		restaurant['photo'] = files.photo.data.toString('base64');
		restaurant['photo_mimetype'] = files.photo.mimetype
	} else {
		restaurant['photo'] = body.photo;
		restaurant['photo_mimetype'] = body.photo_mimetype;
	}

	restaurant['address']['coord'] = [];
	if ((body.lat) && (body.lon)) {
		restaurant['address']['coord'][0] = Number(body.lat);
		restaurant['address']['coord'][1] = Number(body.lon);
	}

	return restaurant;
}

function getSearchedCriteria(body) {
	var criteria = {};
	if (body.match == 0) {
		if (body.name) {
			criteria['name'] = body.name;
		}
		if (body.borough) {
			criteria['borough'] = body.borough;
		}
		if (body.cuisine) {
			criteria['cuisine'] = body.cuisine;
		}
		if (body.owner) {
			criteria['owner'] = body.owner;
		}

		if (body.score || body.user) {
			criteria['grades'] = {
				$elemMatch: {}
			};
			if (body.score) {
				var score = parseInt(body.score);
				if (body.scoreCompare == '0') {
					criteria.grades.$elemMatch.score = score;
				} else if (body.scoreCompare == '1') {
					criteria.grades.$elemMatch.score = {
						$gt: score
					};
				} else if (body.scoreCompare == '2') {
					criteria.grades.$elemMatch.score = {
						$lt: score
					};
				}
			}
			if (body.user) {
				criteria.grades.$elemMatch.user = body.user;
			}
		}
	} else {
		criteria['$or'] = [];
		if (body.name) {
			criteria.$or.push({
				"name": body.name
			});
		}
		if (body.borough) {
			criteria.$or.push({
				"borough": body.borough
			});
		}
		if (body.cuisine) {
			criteria.$or.push({
				"cuisine": body.cuisine
			});
		}
		if (body.owner) {
			criteria.$or.push({
				"owner": body.owner
			});
		}

		if (body.score) {
			var score = parseInt(body.score);
			if (body.scoreCompare == '0') {
				criteria.$or.push({
					"grades": {
						$elemMatch: {
							"score": score
						}
					}
				});
			} else if (body.scoreCompare == '1') {
				criteria.$or.push({
					"grades": {
						$elemMatch: {
							"score": {
								$gt: score
							}
						}
					}
				});
			} else if (body.scoreCompare == '2') {
				criteria.$or.push({
					"grades": {
						$elemMatch: {
							"score": {
								$lt: score
							}
						}
					}
				});
			}
		}
		if (body.user) {
			criteria.$or.push({
				"grades": {
					$elemMatch: {
						"user": body.user
					}
				}
			});
		}
	}
	return criteria;
}

function isLogin(req) {
	if (req.session.length == 0) {
		return false;
	} else {
		return true;
	}
}

function getRestaurant(body, files, owner) {
	var restaurant = {};
	restaurant['restaurant_id'] = Math.random().toString(36).substr(2, 8);
	restaurant['name'] = body.name;
	restaurant['borough'] = (body.borough) ? body.borough : "";
	restaurant['cuisine'] = (body.cuisine) ? body.cuisine : "";

	restaurant['address'] = {};

	restaurant['address']['street'] = (body.street) ? body.street : "";
	restaurant['address']['building'] = (body.building) ? body.building : "";
	restaurant['address']['zipcode'] = (body.zipcode) ? body.zipcode : "";

	restaurant['photo'] = "";
	restaurant['photo_mimetype'] = "";

	if (files != null) {
		restaurant['photo'] = files.photo.data.toString('base64');
		restaurant['photo_mimetype'] = files.photo.mimetype
	}

	restaurant['address']['coord'] = [];
	if ((body.lat) && (body.lon)) {
		restaurant['address']['coord'][0] = Number(body.lat);
		restaurant['address']['coord'][1] = Number(body.lon);
	}
	restaurant['grades'] = [];
	var score = body.score;
	if (score && !isNaN(score)) {
		score = parseInt(score);
		if (score > 0 && score <= 10) {
			restaurant['grades'][0] = {};
			restaurant['grades'][0]['user'] = owner;
			restaurant['grades'][0]['score'] = parseInt(body.score);
		}
	}
	restaurant['owner'] = owner;

	return restaurant;
}

app.listen(app.listen(process.env.PORT || 5000));