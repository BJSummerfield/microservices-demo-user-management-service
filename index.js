const express = require('express');
const mongoose = require('mongoose');
const amqp = require('amqplib/callback_api');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const User = require('./models/user');

const app = express();
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false });

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE = 'user_events';

function publishEvent(eventType, message) {
    amqp.connect(RABBITMQ_URL, function(error0, connection) {
        if (error0) {
            console.error(`Failed to connect to RabbitMQ: ${error0.message}`);
            throw error0;
        }
        connection.createChannel(function(error1, channel) {
            if (error1) {
                console.error(`Failed to create channel in RabbitMQ: ${error1.message}`);
                throw error1;
            }
            channel.assertExchange(EXCHANGE, 'topic', { durable: false });
            channel.publish(EXCHANGE, eventType, Buffer.from(JSON.stringify(message)));
            console.log(`Event published: ${eventType}`);
            setTimeout(() => {
                connection.close();
            }, 500);
        });
    });
}

app.post('/users', async (req, res) => {
    try {
        const id = uuidv4();
        const { email } = req.body;
        const user = new User({ id, email });
        await user.save();
        console.log(`User created: ${JSON.stringify(user)}`);
        publishEvent('userManagement.userCreated', { id, email });
        res.status(201).send(user);
    } catch (error) {
        console.error(`Error creating user: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.delete('/users/:id', async (req, res) => {
    const id = req.params.id;
    console.log(`Attempting to delete user with id: ${id}`);
    try {
        const user = await User.findOneAndRemove(id);
        if (user) {
            console.log(`User deleted: ${user}`);
            publishEvent('userManagement.userDeleted', { id });
            res.status(200).send(user);
        } else {
            console.log(`User not found with id: ${id}`);
            res.status(404).send({ error: 'User not found' });
        }
    } catch (error) {
        console.error(`Error deleting user with ID ${id}: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/users', async (_, res) => {
    try {
        const users = await User.find({});
        console.log(`Fetched all users: ${users.length} users found`);
        res.status(200).send(users);
    } catch (error) {
        console.error(`Error fetching users: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

app.get('/users/:id', async (req, res) => {
    const id = req.params.id;
    console.log(`Attempting to fetch user with id: ${id}`);
    try {
        const user = await User.findOne({ id });
        if (user) {
            console.log(`User found: ${user}`);
            res.status(200).send(user);
        } else {
            console.log(`User not found with id: ${id}`);
            res.status(404).send({ error: 'User not found' });
        }
    } catch (error) {
        console.error(`Error fetching user with ID ${id}: ${error.message}`);
        res.status(500).send({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`User Management Service is running on port ${PORT}`);
});
