const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const { setupRabbitMQListeners, publishEvent } = require('./events');
const { createUser, deleteUser, getAllUsers, getUserById } = require('./userOperations');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

app.post('/users', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await createUser(email);
        publishEvent('userCreated', { id: user.id });
        res.status(201).send(user);
    } catch (error) {
        console.error(`Error creating user: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.delete('/users/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const user = await deleteUser(id);
        if (user) {
            publishEvent('userDeleted', { id: user.id });
            res.status(200).send(user);
        } else {
            res.status(404).send({ error: 'User not found' });
        }
    } catch (error) {
        console.error(`Error deleting user: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/users', async (_, res) => {
    try {
        const users = await getAllUsers();
        res.status(200).send(users);
    } catch (error) {
        console.error(`Error fetching users: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/users/:id', async (req, res) => {
    try {
        const id = req.params?.id;
        console.log("request to service: ", req.params)
        const user = await getUserById(id);
        if (user) {
            res.status(200).send(user);
        } else {
            res.status(404).send({ error: 'User not found' });
        }
    } catch (error) {
        console.error(`Error fetching user: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

setupRabbitMQListeners();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`User Management Service is running on port ${PORT}`);
});
