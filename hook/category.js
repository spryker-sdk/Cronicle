const StandaloneStorage = require('pixl-server-storage/standalone');

/**
 * @param {StandaloneStorage} storage
 *
 * @return {Promise}
 */
const getGlobalCategories = (storage) =>
    new Promise((res, rej) => {
        const globalCategories = new Map();

        /** @param {Array} categories */
        storage.listGet('global/categories', parseInt(0, 10), parseInt(0, 10), (err, categories) => {
            if (err) {
                rej(new Error(`Failed to get categories: ${err}`));
            }

            if (categories !== null) {
                categories.forEach((category) => {
                    if (category != null) {
                        globalCategories.set(category.id, category);
                    }
                });
            }

            res(globalCategories);
        });
    });

/**
 * @param {StandaloneStorage} storage
 * @param {Object} category
 *
 * @return {Map}
 */
const createCategory = (storage, category) =>
    new Promise((res, rej) => {
        storage.listUnshift('global/categories', category, (err) => {
            if (err) {
                rej(new Error(`Failed to create category: ${err}`));
            }

            res(new Map([[category.id, category]]));
        });
    });

/**
 * @param {Array} categoriesData
 *
 * @return {Map}
 */
const getCategoryMap = (categoriesData) => {
    const categories = new Map();

    categoriesData.forEach((category) => {
        categories.set(category.id, category);
    });

    return categories;
};

module.exports = {
    getGlobalCategories,
    createCategory,
    getCategoryMap,
};
