const { v4: uuidv4 } = require('uuid');
const User = require('./models/user');

async function createUser(email) {
    const user = new User({ id: uuidv4(), email });
    await user.save();
    return user;
}

async function deleteUser(id) {
    const user = await User.findOneAndRemove({ id: id });
    return user;
}

async function getAllUsers() {
    return await User.find({});
}

async function getUserById(id) {
    console.log("ID oF USER", id)
    return await User.findbyId({ _id: id });
}

module.exports = { createUser, deleteUser, getAllUsers, getUserById };
