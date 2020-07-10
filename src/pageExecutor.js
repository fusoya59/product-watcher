var async = require("async");
var log = require("loglevel");

function executeActions(page, actions) {
  return new Promise((resolve, reject) => {
    async.forEachLimit(
      actions,
      1,
      (actionObj, cb) => {
        var { action, args, description } = actionObj;
        log.debug(`${description || "Executing " + action}`);
        page[action](...args)
          .then(() => {
            cb();
          })
          .catch((err) => {
            cb(err);
          });
      },
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

module.exports = { executeActions };
