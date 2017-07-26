const express = require('express');
const logger = require('morgan');
const http = require('http');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const passport = require('passport');
const Strategy = require('passport-http').BasicStrategy;
const mongodb = require('mongodb');
const mongoose = require('mongoose');
const Joi = require('joi');
const User = require('./user');
const UserGroup = require('./user_groups');

mongoose.connect('mongodb://localhost/node_4_homework');

 passport.use(new Strategy((username, password, cb) => {
    User.getUserByUsername(username, (err, user) => {
        if (err) { return cb(err); }
        if (!user || user.password !== password) { return cb(null, false); }
        return cb(null, user);
    });
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
}); 

const app = express();

app.use(logger('dev'));// for logging methods, url, code status and time spent on the request
app.use(bodyParser.json());// for parsing application/json
app.use(bodyParser.urlencoded({ extended: false })) // for parsing application/x-www-form-urlencoded


app.use(cookieParser());
app.use(cookieSession({
    name: 'session',
    keys: ['myKey'],
    maxAge: 24 * 60 * 60 * 1000
}))
app.use(passport.initialize());
app.use(passport.session()); 

/********************************* Users ********************************/


//authorize user
app.get('/login', passport.authenticate('basic', {session: true}), (req, res, next) => {
    res.json('Hello ' + req.session.passport.user.username);
});

//get all users
app.get('/users', (req, res, next) => {

    if(req.session.passport !== undefined){
        if(req.session.passport.user.role === 'superadmin'){
            User.getUsers((err, users) => {
                err ? res.json(err.name) : res.json(users);
            })
        }else{
            res.json('you cannot access the database as you are not superadmin');
        }
    }else{
        res.json('please authorize to access database');
    }
    
});

//get one user
app.get('/users/:id', (req, res, next) => {
    User.getUserById(req.params.id, (err, user) => {
        user ? res.json(user) : res.status(404).json('not found');
    })
});


//create new user
app.post('/users', (req, res, next) => {

    const schema = Joi.object().keys({
        username: Joi.string().alphanum().min(4).max(30).required(),
        password: Joi.string().alphanum().min(8).required(),
        email: Joi.string().email().required(),
        role: Joi.string().valid('superadmin', 'admin', 'user').required()
    });

    new Promise((resolve, reject) => {
        Joi.validate( req.body, schema, (err, value) => {
            if(err){
                reject(err.details[0].message);
                return;
            }else{
                return resolve(value);
            }
        });
    })
    .then((value) => {
        return new Promise((resolve, reject) => {
            if(value.role === 'superadmin'){
                User.getUsers((err, users) => {
                    err ? reject(err) : false;

                    function filterSuperadmins(arr){
                        return arr.role === 'superadmin';
                    }

                    if(users.filter(filterSuperadmins).length === 2){
                        reject('There are already 2 superadmins. You cannot add any more');
                        return;
                    }else{
                        return resolve(value);
                    }
                })
            }else{
                return resolve(value);
            }
        })
    })
    .then((value) => {
        return new Promise((resolve, reject) => {
            User.getUsers((err, users) => {
                err ? reject(err) : false;

                function findEmail(arr) {
                    return arr.email === value.email;
                }

                if(users.find(findEmail)){
                    reject('this email is already used');
                    return;
                }else{
                    return resolve(value);
                }
            })
        })
    })
    .then((value) => {
        let newUser = new User({
            username: value.username,
            password: value.password,
            email: value.email,
            role: value.role
        });

        User.createUser(newUser, (err, user) => {
            res.send('the new user has been added');
        })
    })
    .catch((error) => {
        res.send(error);
    })
});


//update user
app.patch('/users/:id', (req, res, next) => {
    const id = req.params.id;

    const data = {
        username: req.body.username,
        password: req.body.password,
        email: req.body.email,
        role: req.body.role
    }
    
    const schema = Joi.object().keys({
        username: Joi.string().alphanum().min(4).max(30).required(),
        password: Joi.string().alphanum().min(8).required(),
        email: Joi.string().email().required(),
        role: Joi.string().valid('superadmin', 'admin', 'user').required()
    });

    new Promise((resolve, reject) => {
        Joi.validate( data, schema, (err, value) => {
            if(err){
                reject(err.details[0].message);
                return;
            }else{
                return resolve(value);
            }
        });
    })
    .then((value) => {
        return new Promise((resolve, reject) => {
            if(value.role === 'superadmin'){
                User.getUsers((err, users) => {
                    err ? reject(err) : false;

                    filterSuperadmins(arr => {
                        return arr.role === 'superadmin';
                    })

                    if(users.filter(filterSuperadmins).length === 2){
                        reject('There are already 2 superadmins. You cannot add any more');
                        return;
                    }else{
                        return resolve(value);
                    }
                })
            }else{
                return resolve(value);
            }
        })  
    })
    .then((value) => {
        return new Promise((resolve, reject) => {
            User.getUsers((err, users) => {
                err ? reject(err) : false;

                findEmail(arr => {
                    return arr.email === value.email;
                })

                if(users.find(findEmail)){
                    reject('this email is already used');
                    return;
                }else{
                    return resolve(value);
                }
            })
        })
    })
    .then((value) => {
        User.updateUser(id, value, (err, user) => {
            err ? reject(err) : false;
            
            res.json('User has been updated');
        });
    })
    .catch((error) => {
        res.send(error);
    })
    
});

//remove user (also from all groups where he is present)
app.delete('/users/:id', (req, res, next) => {
    const id = req.params.id;

    //get all users
    new Promise((resolve, reject) => {
        User.getUserById(id, (err, user) => {
            err ? reject(err) : false;

            if(!user){
                reject('Cannot find user');
                return;
            }else{
                return resolve(user);
            }
        })
    })
    .then((user) => {
        //check is user is superadmin
        return new Promise((resolve, reject) => {
            if(user.role === 'superadmin'){
                User.getUsers((err, users) => {
                    err ? reject(err) : false;

                    filterSuperadmins(arr => {
                        return arr.role === 'superadmin';
                    })

                    if(users.filter(filterSuperadmins).length === 1){
                        reject('You cannot delete the last superadmin');
                        return;
                    }else{
                        return resolve(user);
                    }
                })
            }else{
                return resolve(user);
            }
        })
    })
    .then((user) => {
        //checking and removing users from all groups where he is present
        return new Promise((resolve, reject) => {
            UserGroup.removeUserFromAllGroups(id, (err, user) => {
                if(err){
                    reject(err);
                    return;
                }else{
                    return resolve(user);
                }
            })
        })
    })
    .then((user) => {
        User.removeUser(id, (err, deletedUser) => {
            err ? res.json(err.name) : res.send('user has been deleted');
        });
    })
    .catch((error) => {
        res.send(error);
    })
    
});

/********************************* User Groups ********************************/

//receive all the groups
app.get('/user_groups', (req, res, next) => {
    UserGroup.getUserGroups((err, groups) => {
        err ? res.json(err.name) : res.json(groups);
    })
});

//receive one group
app.get('/user_groups/:user_groups_id', (req, res, next) => {
    UserGroup.getUserGroupById(req.params.user_groups_id, (err, group) => {
        group ? res.json(group) : res.status(404).json('not found');
    })
});

//create group
app.post('/user_groups', (req, res, next) => {
    
    const schema = Joi.object().keys({
        groupname: Joi.string().alphanum().min(5).max(50).required(),
    });

    new Promise((resolve, reject) => {
        Joi.validate( req.body, schema, (err, value) => {
            if(err){
                reject(err.details[0].message);
                return;
            }else{
                return resolve(value);
            }
        });
    })
    .then((value) => {
        let newGroup = new UserGroup({
            groupname: value.groupname
        });

        UserGroup.createUserGroup(newGroup, (err, group) => {
            err ? res.json(err.name) : res.json('new group has been created');
        });
    })
    .catch((error) => {
        res.send(error);
    })
});


//add user to group
app.patch('/user_groups/:user_groups_id/:id', (req, res, next) => {
    const user_groups_id = req.params.user_groups_id;
    const id = req.params.id;
    
    new Promise((resolve, reject) => {
        //checking if user exist
        User.getUserById(id, (err, user) => {
            err ? reject(err) : false;
            if(!user){
                reject('Cannot find user');
                return;
            }else{
                return resolve();
            }
        })
    })
    .then(() => {
        //ckecking if group exist and if user is already in group
        return new Promise((resolve, reject) => {
            UserGroup.getUserGroupById(user_groups_id, (err, group) => {
                err ? reject(err) : false;
                
                if(!group){
                    reject('Cannot find group');
                    return;
                }else{
                    //checking if user is already in group
                    if(group.usersInGroup.indexOf(id) >= 0){
                        reject('User already exist in this group');
                        return;
                    }else{
                        return resolve();
                    } 
                }
            })
        })
    })
    .then(() => {
        UserGroup.addUserToGroup(user_groups_id, id, (err, value) => {
            err ? res.json(err.name) : res.json('user has been added to group');
        });
    })
    .catch((error) => {
        res.send(error);
    })

});


//remove user from group
app.delete('/user_groups/:user_groups_id/:id', (req, res, next) => {
    const user_groups_id = req.params.user_groups_id;
    const id = req.params.id;

    //checking if user exist
    new Promise((resolve, reject) => {
        User.getUserById(id, (err, user) => {
            err ? reject(err) : false;
            if(!user){
                reject('Cannot find user');
                return;
            }else{
                return resolve();
            }
        })
    })
    .then(() => {
        //checking if group exists and if user is in this group
        return new Promise((resolve, reject) => {
            UserGroup.getUserGroupById(user_groups_id, (err, group) => {
                err ? reject(err) : false;
                
                if(!group){
                    reject('Cannot find group');
                    return;
                }else{
                    if(group.usersInGroup.indexOf(id) >= 0){
                        return resolve();
                    }else{
                        reject('User is not exist in this group');
                        return;
                    } 
                }
            })
        })
    })
    .then(() => {
        //checking if user is the only person in group
        return new Promise((resolve, reject) => {
            UserGroup.getUserGroups((err, groups) => {
                if(err){
                    reject(err);
                    return;
                }else{
                    groups.forEach((elt, ind, arr) => {
                        let index = elt.usersInGroup.indexOf(id);
                        if(index === 0 && arr.length === 2){
                            reject('you cannot delete this user as he is last person in a group');
                            return;
                        }
                    });
                    return resolve();
                }
            })
        })
    })
    .then(() => {
        UserGroup.removeUserFromGroup(user_groups_id, id, (err, value) => {
            err ? res.json(err.name) : res.json('user has been removed from this group');
        });
    })
    .catch((error) => {
        res.send(error);
    })

});


//remove group
app.delete('/user_groups/:user_groups_id', (req, res, next) => {
    const user_groups_id = req.params.user_groups_id;
    
    UserGroup.removeUserGroup(user_groups_id, (err, user) => {
        err ? res.json(err.name) : res.json('group has been deleted');
    });
});




app.use((err, req, res, next) => {
    res.status(404);
    next(err);
})

const port = 3000;

// starting server
http.createServer(app)
.listen(port, () => {
    console.log(`Service was started successfully on port ${port}`);
})
.on('error', err => {
    // custom error handling to print more userfriendly error message
    // if port is already used by other app
    if (err.code === 'EADDRINUSE') {
      console.log(`Error: port address ${port} already in use`);
    } else {
      console.log(`Error: ${err.message}`);
    }
    process.exit(1);
});
