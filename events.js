const amqp = require('amqplib/callback_api');
const { createUser, deleteUser } = require('./userOperations');

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE = 'user_events';

function publishEvent(eventType, eventData) {
    amqp.connect(RABBITMQ_URL, function(error0, connection) {
        if (error0) {
            console.error(`Failed to connect to RabbitMQ: ${error0.message}`);
            return;
        }
        connection.createChannel(function(error1, channel) {
            if (error1) {
                console.error(`Failed to create channel in RabbitMQ: ${error1.message}`);
                return;
            }
            const routingKey = `userManagement.${eventType}`;
            const event = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                serviceOrigin: 'UserManagementService',
                traceId: require('uuid').v4(),
                eventType,
                environment: process.env.NODE_ENV || 'development',
                payload: eventData
            };
            channel.assertExchange(EXCHANGE, 'topic', { durable: false });
            channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(event)));
            console.log(`Event published: ${eventType} with data: ${JSON.stringify(eventData)}`);
            setTimeout(() => {
                connection.close();
            }, 500);
        });
    });
}


function connectWithRetry(url, retries = 5, delay = 3000) {
    return new Promise((resolve, reject) => {
        function attemptConnect(attemptsLeft) {
            amqp.connect(url, function(error, connection) {
                if (error) {
                    console.error(`Failed to connect to RabbitMQ: ${error.message}`);
                    if (attemptsLeft > 0) {
                        console.log(`Retrying in ${delay / 1000} seconds...`);
                        setTimeout(() => attemptConnect(attemptsLeft - 1), delay);
                    } else {
                        reject(error);
                    }
                } else {
                    resolve(connection);
                }
            });
        }
        attemptConnect(retries);
    });
}

function setupRabbitMQListeners() {
    connectWithRetry(RABBITMQ_URL)
        .then(connection => {
            connection.createChannel((error1, channel) => {
                if (error1) throw error1;
                channel.assertExchange(EXCHANGE, 'topic', { durable: false });
                setupQueue(channel, 'requestUserCreate', handleUserCreateRequest);
                setupQueue(channel, 'requestUserDelete', handleUserDeleteRequest);
            });
        })
        .catch(error => console.error('Failed to establish a connection with RabbitMQ:', error));
}


function setupQueue(channel, routingKey, handler) {
    channel.assertQueue('', { exclusive: true }, (error, q) => {
        if (error) throw error;
        channel.bindQueue(q.queue, EXCHANGE, routingKey);
        channel.consume(q.queue, (msg) => {
            const data = JSON.parse(msg.content.toString());
            handler(data);
        }, { noAck: true });
    });
}

async function handleUserCreateRequest(data) {
    const { email } = data;
    try {
        const user = await createUser(email);
        console.log(`User created: ${JSON.stringify(user)}`);
        publishEvent('userCreated', { id: user.id });
    } catch (error) {
        console.error(`Error in handleUserCreateRequest: ${error.message}`);
    }
}

async function handleUserDeleteRequest(data) {
    const { id } = data;
    try {
        const user = await deleteUser(id);
        if (user) {
            console.log(`User deleted: ${JSON.stringify(user)}`);
            publishEvent('userDeleted', { id: user.id });
        } else {
            console.log('User not found');
        }
    } catch (error) {
        console.error(`Error in handleUserDeleteRequest: ${error.message}`);
    }
}

module.exports = { publishEvent, setupRabbitMQListeners };
