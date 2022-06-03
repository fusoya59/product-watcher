var notificationPlugin = process.env.NOTIFICATION_DRIVER || "sendgrid";
var notificationEndpoint = process.env.NOTIFICATION_URL;
var notifyOnlyOnStock = process.env.IN_STOCK_NOTIFICATION_ONLY;

var puppeteer = require("puppeteer");

var log = require("loglevel");
var fs = require("fs");
var notifier = require(`./notifiers/${notificationPlugin}`);

var { executeActions } = require("./pageExecutor");

log.setLevel(process.env.LOG_LEVEL || "info");


var productsFile = process.argv[2] || "./watchlist.json";

log.debug(`Opening ${productsFile}`);
var products = JSON.parse(fs.readFileSync(productsFile, "utf8"));

var defaultEvaluator = async (element) => {
  return !!element;
};

var defaultExtractors = {
  stock: "textContent",
  productName: "textContent",
};

function isNotificationConfigured() {
  return notificationEndpoint && process.env.TO_EMAIL && process.env.FROM_EMAIL;
}

function shouldNotify(stockCount) {
  return !notifyOnlyOnStock || stockCount > 0;
}

function printEmail(to, subject, body) {
  log.debug(`\nTo: ${to || "<not configured>"}`);
  log.debug(`Subject: ${subject}`);
  log.debug(`Body:\n${body}`);
}

function createEvaluator(evaluator) {
  if (!evaluator) {
    return defaultEvaluator;
  }

  var fn = null;
  switch (evaluator.type) {
    case "regex":
      if (!evaluator.parameters || !evaluator.parameters.pattern) {
        throw new Error(`Regex evaluator is incorrectly configured.`);
      }
      fn = async (element) => {
        var regex = new RegExp(
          evaluator.parameters.pattern,
          evaluator.parameters.flags || "i"
        );
        return regex.test(element);
      };
      break;
    default:
      throw new Error(`Evaluator type ${evaluator.type} not supported.`);
  }

  return fn;
}

async function isInStock(
  url,
  timeout,
  selectors,
  extractors,
  evaluator,
  preCheck
) {
  var browser = null;
  var vals = null;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    var page = await browser.newPage();

    // page.on("console", (msg) => log.debug(msg.text()));

    log.debug(`checking stock for ${url}`);
    await page.goto(url, { timeout });

    if (preCheck) {
      preCheck = await fs.promises.readFile(preCheck, "utf8");
      log.debug("running pre-check actions");
      await executeActions(page, JSON.parse(preCheck));
    }

    vals = await page.evaluate(
      (select, extract) => {
        /* eslint-disable-next-line*/
        var stockEle = document.querySelector(select.stock);
        /* eslint-disable-next-line*/
        var productEle = document.querySelector(select.productName);
        var ret = {
          productName: productEle,
          inStock: stockEle,
        };
        if (extract) {
          if (stockEle && extract.stock) {
            ret.inStock = stockEle[extract.stock];
            if (ret.inStock) {
              ret.inStock = ret.inStock.trim();
            }
          }
          if (productEle && extract.productName) {
            ret.productName = productEle[extract.productName];
            if (ret.productName) {
              ret.productName = ret.productName.trim();
            }
          }
        }
        return ret;
      },
      selectors,
      extractors
    );

    if (!vals.productName) {
      vals.productName = url;
    }
    if (vals.inStock === undefined) {
      vals.inStock = false;
    }
    vals.url = url;
    if (evaluator) {
      vals.inStock = await evaluator(vals.inStock);
    }
    return vals;
  } catch (err) {
    throw new Error(`Error when checking stock: ${err.message}`);
  } finally {
    if (browser) {
      log.debug(`shutting down browser for ${url}`);
      await browser.close();
    }
  }
}

log.info("Checking products if in stock...");
products = products.map((product) => {
  var timeout = parseInt(product.timeout, 10);
  return isInStock(
    product.url,
    !isNaN(timeout) ? timeout : 30000,
    product.selectors,
    product.extractors || defaultExtractors,
    createEvaluator(product.evaluator),
    product.preCheck
  );
});
Promise.all(products)
  .then((values) => {
    var body = "";
    var stockCount = 0;
    var firstInStock = null;
    values.forEach((v) => {
      body += `<a href="${v.url}">${v.productName}</a> ${
        !v.inStock ? "is not in stock." : "is <b>IN STOCK!!</b>"
      }<br/>`;
      if (v.inStock) {
        stockCount++;
        if (!firstInStock) {
          firstInStock = v.productName;
        }
      }
    });
    log.debug("stock check complete");

    var to = process.env.TO_EMAIL;
    var from = process.env.FROM_EMAIL;
    var subject = "Nothing in stock";
    if (stockCount > 0) {
      subject = `${firstInStock}`;
      if (stockCount > 1) {
        subject += " and others are ";
      } else {
        subject += " is ";
      }
      subject += "in stock!";
      log.info("Product(s) are in stock!");
    } else {
      log.info("None of the products are in stock.");
    }

    if (isNotificationConfigured()) {
      if (shouldNotify(stockCount)) {
        log.info(`Notifying ${to}`);
        return notifier.notify(to, from, subject, body)
          .then(() => {
            return Promise.resolve(stockCount);
          });
      } else {
        printEmail(to, subject, body);
        return Promise.resolve(stockCount);
      }
    } else {
      log.info("no notification setting configured.");
      printEmail(to, subject, body);
      return Promise.resolve(stockCount);
    }
  })
  .then((stockCount) => {
    if (isNotificationConfigured() && shouldNotify(stockCount)) {
      log.debug(`Notified ${process.env.TO_EMAIL}!`);
    }
  })
  .catch((err) => log.error(err))
  .finally(() => log.info("Stock check complete!"));
