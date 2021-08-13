const StandaloneStorage = require('pixl-server-storage/standalone');
const cp = require('child_process');

/**
 * @param {StandaloneStorage} storage
 * @param {String} store
 * @param {String} currentScheduler
 *
 * @return Promise
 */
const exportDataFromCli = (storage, store, currentScheduler) =>
    new Promise((res, rej) => {
        let jobs = '';
        let errors = '';

        const schedulerDataReader = cp.exec(
            `APPLICATION_STORE=${store} vendor/bin/console scheduler:export ${currentScheduler}`,
            {
                cwd: process.env.SPRYKER_PROJECT_ROOT || '/data',
            },
        );

        schedulerDataReader.stdout.on('data', (data) => {
            jobs += String(data);
        });

        schedulerDataReader.stderr.on('data', (data) => {
            errors += String(data);
        });

        schedulerDataReader.on('close', (code) => {
            if (code > 0) {
                rej(errors);
            }

            const schedulerData = JSON.parse(jobs.substring(Math.min(jobs.indexOf('['), jobs.indexOf('{'))));

            res(schedulerData);
        });

        schedulerDataReader.stderr.on('data', (data) => {
            rej(data);
        });
    });

module.exports = {
    exportDataFromCli,
};
