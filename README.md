@kothique/moleculer-rethinkdbdash
=================================

# Install

```bash
$ npm install --save @kothique/moleculer-rethinkdbdash
```

# Usage

```js
'use strict';

const { ServiceBroker } = require('moleculer');
const RService = require('@kothique/moleculer-rethinkdbdash');

const broker = new ServiceBroker({ logLevel: 'debug' });

// Create a DB service for `user` entities
broker.createService({
    name: 'users',
    mixins: [RService],
    /* Options passed to `rethinkdbdash` directly. */
    rOptions: {
      db: 'mydb', // rethinkdbdash's option, has nothing to do with the mixin
      timeout: 30,
      buffer: 80
    },
    /* Ensure certain dbs, tables, and indices are created. */
    rInitial: r => ({
      mydb: { // Ensure database `mydb` exists
        users: { // Ensure table `users` exists in `mydb`
          $default: true, // So that `this.rTable` === `this.r.db('mydb').table('users')`
          $options: {     // Options passed to `tableCreate`
            primaryKey: 'boom',
            durability: 'soft'
          },

          // Ensure indexes exist in `users`
          username: true,
          my_awesome_compound_index: {
            $function: [r.row('compound'), r.row('index')] // Index function
          },
          nicknames: {
            $function: r.row('nestedData')('nicknames'),
            $options: { multi: true }
          }
        },

        /*
        anotherTable: {
          ...
        },
        ...
        */
      },
      /*
      anotherDB: {
        ...
      },
      ...
      */
    }),
    /* Called when all dbs, tables, and indices are created. */
    async rOnReady() {
      const usersByAge = await this.rTable.orderBy(this.r.desc('age'));
      const changesCursor = await this.r.db('boom').table('meow').changes();
      // ...
    }
});

broker.start();
```
