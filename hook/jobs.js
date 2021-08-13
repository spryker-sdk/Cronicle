const StandaloneStorage = require('pixl-server-storage/standalone');

/**
 * @param {StandaloneStorage} storage
 *
 * @return {Promise}
 */
const getScheduledJobs = (storage) =>
    new Promise((res, rej) => {
        const scheduledJobs = new Map();

        /** @param {Array} jobs */
        storage.listGet('global/schedule', parseInt(0, 10), parseInt(0, 10), (err, jobs) => {
            if (err) {
                rej(new Error(`Failed to get jobs: ${err}`));
            }

            if (jobs !== null) {
                jobs.forEach((job) => {
                    if (job !== null) {
                        scheduledJobs.set(job.id, job);
                    }
                });
            }

            res(scheduledJobs);
        });
    });

/**
 * @param {StandaloneStorage} storage
 * @param {Object} job
 *
 * @return {Promise}
 */
const createJob = (storage, job) =>
    new Promise((res, rej) => {
        storage.listUnshift('global/schedule', job, (err) => {
            if (err) {
                rej(new Error(`Failed to create job: ${err}`));
            }

            res(new Map([[job.id, job]]));
        });
    });

/**
 * @param {StandaloneStorage} storage
 * @param {String} id
 * @param {Object} job
 *
 * @return {Promise}
 */
const updateJob = (storage, id, job) =>
    new Promise((res, rej) => {
        storage.listFindUpdate('global/schedule', { id }, job, (err) => {
            if (err) {
                rej(new Error(`Failed to update job: ${err}`));
            }

            res(new Map([[id, job]]));
        });
    });

/**
 * @param {StandaloneStorage} storage
 * @param {Map} scheduledJobs
 *
 * @return {Promise}
 */
const disableScheduledJobs = (storage, scheduledJobs) =>
    new Promise((res, rej) => {
        scheduledJobs.forEach((job) => {
            if (job != null) {
                const updatedJob = job;

                updatedJob.enabled = 0;
                scheduledJobs.set(updatedJob.id, job);

                storage.listFindUpdate('global/schedule', { id: updatedJob.id }, updatedJob, (err) => {
                    rej(new Error(`Failed to update event: ${err}`));
                });
            }
        });

        res(scheduledJobs);
    });

/**
 * @param {Array} jobsData
 */
const getJobMap = (jobsData) => {
    const jobMap = new Map();

    jobsData.forEach((job) => {
        jobMap.set(job.id, job);
    });

    return jobMap;
};

module.exports = {
    createJob,
    updateJob,
    getScheduledJobs,
    disableScheduledJobs,
    getJobMap,
};
