const StandaloneStorage = require('pixl-server-storage/standalone');
const Tools = require('pixl-tools');
const bcrypt = require('bcrypt-node');

const print = (msg) => {
    process.stdout.write(msg);
};

/**
 * @param {StandaloneStorage} storage
 *
 * @return void
 */
const setupDefaultUser = (storage) => {
    let username = process.env.SPRYKER_SCHEDULER_USERNAME || 'spryker';
    username = username.toLowerCase();

    const password = process.env.SPRYKER_SCHEDULER_PASSWORD || 'secret';
    const email = process.env.SPRYKER_SCHEDULER_EMAIL || 'admin@spryker.local';

    storage.get(`users/${username}`, (err, user) => {
        if (err) {
            print(`ERROR: ${err}`);
        }

        if (!user) {
            const timeNow = Tools.timeNow(true);
            const newUser = {
                username,
                password,
                full_name: 'Spryker',
                email,
            };

            newUser.active = 1;
            newUser.created = timeNow;
            newUser.modified = timeNow;
            newUser.salt = Tools.generateUniqueID(64, newUser.username);
            newUser.password = bcrypt.hashSync(newUser.password + newUser.salt);
            newUser.privileges = {
                admin: 1,
            };

            storage.put(`users/${newUser.username}`, newUser, (err) => {
                if (err) {
                    print(`ERROR: ${err}`);
                }
                print(`\nAdministrator '${username}' created successfully.\n`);
                print('\n');
            });

            storage.listPush('global/users', { username: newUser.username }, (err) => {
                if (err) {
                    print(`ERROR: ${err}`);
                }
            });
        }
    });
};

/**
 * @param {StandaloneStorage} storage
 *
 * @return void
 */
const setupApiKey = (storage) => {
    const title = process.env.SPRYKER_CURRENT_SCHEDULER;
    const key = process.env.SPRYKER_SCHEDULER_API_KEY;
    const timeNow = Tools.timeNow(true);
    const apiKeyParams = {
        id: title,
        title,
        key,
        username: 'admin',
        created: timeNow,
        modified: timeNow,
        active: 1,
        privileges: {
            admin: 1,
        },
    };

    storage.listFindUpdate('global/api_keys', { id: apiKeyParams.id }, apiKeyParams, (err) => {
        if (err) {
            storage.listUnshift('global/api_keys', apiKeyParams, (err) => {
                if (err) {
                    print(`Failed to create api_key: ${err}`);
                    process.exit(1);
                }
            });
        }
    });
};

/**
 * @param {StandaloneStorage} storage
 *
 * @return void
 */
const setupSchedulerGroup = (storage) => {
    const groupData = {
        id: process.env.SPRYKER_CURRENT_SCHEDULER,
        title: 'Master Group',
        regexp: '.+',
        master: 1,
    };

    storage.listFindUpdate('global/server_groups', { id: groupData.id }, groupData, (err) => {
        if (err) {
            storage.listUnshift('global/server_groups', groupData, (err) => {
                if (err) {
                    print(`Failed to create server group: ${err}`);
                    process.exit(1);
                }
            });
        }
    });
};

module.exports = {
    setupSchedulerGroup,
    setupDefaultUser,
    setupApiKey,
};
