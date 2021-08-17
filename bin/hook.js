#!/usr/bin/env node
const path = require('path');
const os = require('os');

const Args = require('pixl-args');
const Tools = require('pixl-tools');
const StandaloneStorage = require('pixl-server-storage/standalone');

const setup = require('./../hook/setup');
const exportCli = require('./../hook/export-cli');
const jobs = require('./../hook/jobs');
const categories = require('./../hook/category');

// chdir to the proper server root dir
process.chdir(path.dirname(__dirname));

// load app's config file
const config = require('../conf/config.json');

// shift commands off beginning of arg array
const argv = JSON.parse(JSON.stringify(process.argv.slice(2)));
const commands = [];
while (argv.length && !argv[0].match(/^\-/)) {
    commands.push(argv.shift());
}

// now parse rest of cmdline args, if any
let args = new Args(argv, {
    debug: false,
    verbose: false,
    quiet: false,
});
args = args.get(); // simple hash

// copy debug flag into config (for standalone)
config.Storage.debug = args.debug;

const print = function (msg) {
    // print message to console
    if (!args.quiet) process.stdout.write(msg);
};
const verbose = function (msg) {
    // print only in verbose mode
    if (args.verbose) print(msg);
};
const warn = function (msg) {
    // print to stderr unless quiet
    if (!args.quiet) process.stderr.write(msg);
};
const verbose_warn = function (msg) {
    // verbose print to stderr unless quiet
    if (args.verbose && !args.quiet) process.stderr.write(msg);
};

if (config.uid && process.getuid() != 0) {
    print('ERROR: Must be root to use this script.\n');
    process.exit(1);
}

// determine server hostname
const hostname = (process.env.HOSTNAME || process.env.HOST || os.hostname()).toLowerCase();

// find the first external IPv4 address
let ip = '';
const ifaces = os.networkInterfaces();
const addrs = [];
for (const key in ifaces) {
    if (ifaces[key] && ifaces[key].length) {
        Array.from(ifaces[key]).forEach((item) => {
            addrs.push(item);
        });
    }
}
const addr = Tools.findObject(addrs, { family: 'IPv4', internal: false });
if (addr && addr.address && addr.address.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    ip = addr.address;
} else {
    print("ERROR: Could not determine server's IP address.\n");
    process.exit(1);
}

// util.isArray is DEPRECATED??? Nooooooooode!
const isArray = Array.isArray || util.isArray;

// prevent logging transactions to STDOUT
config.Storage.log_event_types = {};

// allow APPNAME_key env vars to override config
const env_regex = new RegExp('^CRONICLE_(.+)$');
for (const env_key in process.env) {
    if (env_key.match(env_regex)) {
        const env_path = RegExp.$1.trim().replace(/^_+/, '').replace(/_+$/, '').replace(/__/g, '/');
        let env_value = process.env[env_key].toString();

        // massage value into various types
        if (env_value === 'true') env_value = true;
        else if (env_value === 'false') env_value = false;
        else if (env_value.match(/^\-?\d+$/)) env_value = parseInt(env_value);
        else if (env_value.match(/^\-?\d+\.\d+$/)) env_value = parseFloat(env_value);

        Tools.setPath(config, env_path, env_value);
    }
}

const currentScheduler = process.env.SPRYKER_CURRENT_SCHEDULER || 'cronicle';
/**
 * @param {Array} enabledSchedulerStores
 */
const enabledSchedulerStores = JSON.parse(process.env.SPRYKER_ENABLED_SCHEDULER_STORES || []);

// construct standalone storage server
var storage = new StandaloneStorage(config.Storage, (err) => {
    if (err) throw err;
    // storage system is ready to go

    // become correct user
    if (config.uid && process.getuid() == 0) {
        verbose(`Switching to user: ${config.uid}\n`);
        process.setuid(config.uid);
    }

    // custom job data expire handler
    storage.addRecordType('cronicle_job', {
        delete(key, value, callback) {
            storage.delete(key, (err) => {
                storage.delete(`${key}/log.txt.gz`, (err) => {
                    callback();
                }); // delete
            }); // delete
        },
    });

    // process command
    const cmd = commands.shift();

    verbose('\n');

    switch (cmd) {
        case 'before-start':
            setup.setupDefaultUser(storage);
            setup.setupApiKey(storage);
            setup.setupSchedulerGroup(storage);

            importSchedulerData(storage).catch((rej) => {
                print(rej.message);
                process.exit(1);
            });

            break;

        default:
            print(`Unknown hook: ${cmd}\n`);
            storage.shutdown(() => {
                process.exit(0);
            });
            break;
    }
});

/**
 * @param {StandaloneStorage} storage
 */
const importSchedulerData = async (storage) => {
    let exportedCategoryMap = new Map();
    let exportedJobsMap = new Map();

    for (const store of enabledSchedulerStores) {
        const { jobData, categoryData } = await exportCli.exportDataFromCli(storage, store, currentScheduler);

        exportedCategoryMap = new Map([...exportedCategoryMap, ...categories.getCategoryMap(categoryData)]);

        exportedJobsMap = new Map([...exportedJobsMap, ...jobs.getJobMap(jobData)]);
    }

    let globalCategories = await categories.getGlobalCategories(storage);
    let scheduledJobs = await jobs.getScheduledJobs(storage);
    scheduledJobs = await jobs.disableScheduledJobs(storage, scheduledJobs);

    for (const [id, category] of exportedCategoryMap) {
        if (!globalCategories.has(id)) {
            const createdCategory = await categories.createCategory(storage, category);

            globalCategories = new Map([...globalCategories, ...createdCategory]);
        }
    }

    for (const [id, job] of exportedJobsMap) {
        const newJob = !scheduledJobs.has(id)
            ? await jobs.createJob(storage, job)
            : await jobs.updateJob(storage, id, job);

        scheduledJobs = new Map([...scheduledJobs, ...newJob]);
    }

    return { scheduledJobs, globalCategories };
};
