const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    username: {
        type: String,
        index: true,
        required: true
    },
    password: {
        type: String,
        index: true,
        required: true
    },
    email: {
        type: String,
        required: true,
        index: { unique: true }
    },
    role: {
        type: String,
        required: true
    }
});

const User = module.exports = mongoose.model('User', userSchema);

//get all users
module.exports.getUsers = (data) => {
    User.find(data);
}

//get user by ID
module.exports.getUserById = (id, data) => {
    User.findById(id, data);
}

module.exports.getUserByUsername = (name, data) => {
    User.findOne({'username': name}, data);
}

//add user
module.exports.createUser = (newUser, data) => {
    newUser.save(data);
}

//update user
module.exports.updateUser = (id, data, new_data) => {
    
    User.findById(id, (err, user) => {
        user.username = data.username,
        user.password = data.password,
        user.email = data.email,
        user.role = data.role
        
        user.save(new_data);
    })
}

//remove user
module.exports.removeUser = (id, data) => {
    User.find({_id: id}).remove(data);
}