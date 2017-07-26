const mongoose = require('mongoose');

const userGroupSchema = mongoose.Schema({
    groupname: {
        type: String,
        index: true,
        required: true
    },
    usersInGroup: {
        type: [String]
    }
});

const UserGroup = module.exports = mongoose.model('UserGroup', userGroupSchema);


//get all groups
module.exports.getUserGroups = (data) => {
    UserGroup.find(data);
}


//get group by ID
module.exports.getUserGroupById = (id, data) => {
    UserGroup.findById(id, data);
}


//create new group
module.exports.createUserGroup = (newGroup, data) => {
    newGroup.save(data);
}

//update group with users
module.exports.addUserToGroup = (id, data, new_data) => {
    
    UserGroup.findById(id, (err, group) => {
        
        group.usersInGroup.push(data);
        
        group.save(new_data);
    })
}

//remove user from group
module.exports.removeUserFromGroup = (id, data, new_data) => {
    
    UserGroup.findById(id, (err, group) => {
        
        const ind = group.usersInGroup.indexOf(data);
        group.usersInGroup.splice(ind, 1);
        
        group.save(new_data);
    })
}

//remove user from all groups
module.exports.removeUserFromAllGroups = (id, data) => {

    UserGroup.find((err, groups) => {

        groups.forEach((elt, ind, arr) => {
            let index = elt.usersInGroup.indexOf(id);
            if(index >= 0){
                elt.usersInGroup.splice(index, 1);
                elt.save(data);
            }
            elt.save(data);
        });
    });  
}

//remove group
module.exports.removeUserGroup = (id, data) => {
    UserGroup.find({_id: id}).remove(data);
}