'use strict';

const Promise = require('bluebird');
const r = require('rethinkdbdash');
const _ = require('lodash');
const { MoleculerClientError } = require('moleculer').Errors;

/**
 * Service mixin to access `rethinkdbdash` driver.
 */
module.exports = {
  r: null,
  rTable: null,

  async created() {
    this.r = r({
      silent: true,
      /* All logs are automatically forwarded to the service logger.
         This can be easily overrided. */
      log: message => this.logger.debug(message),
      ...this.schema.rOptions
    });

    const createdIndices = {};

    if (this.schema.rInitial) {
      if (!_.isFunction(this.schema.rInitial) && !_.isObject(this.schema.rInitial)) {
        throw new MoleculerClientError('Expected this.rInitial to be a function or an object.', null, 'ERR_INVALID_R_INITIAL');
      }

      const rInitial = _.isFunction(this.schema.rInitial) ? this.schema.rInitial(this.r) : this.schema.rInitial;
      if (_.isFunction(this.schema.rInitial) && !_.isObject(rInitial)) {
        throw new MoleculerClientError('Expected this.rInitial(r) to return an object.', null, 'ERR_INVALID_R_INITIAL_RESULT');
      }

      const dbNames = await this.r.dbList();
      await Promise.all(Object.keys(rInitial).map(async dbName => {
        const dbInitial = rInitial[dbName];
        createdIndices[dbName] = {};

        if (!dbNames.includes(dbName)) {
          await this.r.dbCreate(dbName);
          this.logger.debug(`Created DB: '${dbName}'.`);
        }

        if (dbInitial !== true && !_.isObject(dbInitial)) {
          throw new MoleculerClientError(`Expected this.rInitial.${dbName} to be true or an object.`, null, 'ERR_INVALID_DB_INITIAL');
        }

        if (dbInitial === true) { return; } // Skip creating tables and indices

        const tableNames = await this.r.db(dbName).tableList();
        await Promise.all(Object.keys(dbInitial).map(async tableName => {
          if (tableName.startsWith('$')) { return; }

          const tableInitial = dbInitial[tableName];
          createdIndices[dbName][tableName] = [];

          if (tableInitial !== true && !_.isObject(tableInitial)) {
            throw new MoleculerClientError(`Expected this.rInitial.${dbName}.${tableName} to be true or an object.`, null, 'ERR_INVALID_TABLE_INITIAL');
          }

          if (!tableNames.includes(tableName)) {
            await this.r.db(dbName).tableCreate(tableName, tableInitial.$options);
            this.logger.debug(`Created${tableInitial.$default ? ' default' : ''} table: ${dbName}.${tableName}`, {
              options: tableInitial.$options
            });
          }

          if (tableInitial.$default === true) {
            this.rTable = this.r.db(dbName).table(tableName);
          }

          if (tableInitial === true) { return; } // Skip creating indices

          const indexNames = await this.r.db(dbName).table(tableName).indexList();
          await Promise.all(Object.keys(tableInitial).map(async indexName => {
            if (indexName.startsWith('$')) { return; }

            const indexInitial = tableInitial[indexName];

            if (tableInitial !== true && !_.isObject(tableInitial)) {
              throw new MoleculerClientError(`Expected this.rInitial.${dbName}.${tableName}.${indexName} to be true or an object.`, null, 'ERR_INVALID_INDEX_INITIAL');
            }

            if (!indexNames.includes(indexName)) {
              await this.r.db(dbName).table(tableName).indexCreate(
                indexName,
                ...indexInitial.$function ? [indexInitial.$function] : [],
                ...indexInitial.$options ? [indexInitial.$options] : []
              );
              createdIndices[dbName][tableName].push(indexName);
              this.logger.debug(`Created index: ${dbName}.${tableName}.${indexName}`, {
                options: indexInitial.$options
              });
            }
          }));
        }));
      }));
    }

    if (_.isFunction(this.schema.rOnReady)) {
      /* Wait for indices to be created. */
      await Promise.all(Object.keys(createdIndices).map(dbName =>
        Promise.all(Object.keys(createdIndices[dbName]).map(tableName =>
          this.r.db(dbName).table(tableName).indexWait(...createdIndices[dbName][tableName])
        ))
      ));
      this.schema.rOnReady.call(this);
    }
  }
};
