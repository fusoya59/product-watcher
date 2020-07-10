# Product Watcher
Checks if products are in stock and notifies the user. Can be used in conjuction with cron or some scheduler.
For example [product-watcher-docker](https://github.com/fusoya59/product-watcher-docker).

# Installation
## Bare metal
Using Ubuntu 18.04 and node.js installed, run `npm install`.

This program uses [puppeteer](https://github.com/puppeteer/puppeteer), so please read their
[troubleshooting guide](https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md)
to help set up.

## Docker
Included in this repo is a Dockerfile. With docker installed, build the repo: `docker build -t product-watcher:latest .`

Once built, do a test run of the program: `docker run --rm --name product-watcher product-watcher:latest`

# Usage
Call npm start and give it an optional json file to look at (defaults to watchlist.json).
```
$ npm start (jsonfile)
```
Optional environment variables include:

`LOG_LEVEL` - set either to `trace`, `error`, `debug`, `info`, `warn`, or `silent`.

`NOTIFICATION_URL` - some endpoint that'll trigger a notification. POSTs a JSON with the payload:
```json
{
  "to": "email to send notification to",
  "subject": "description of a product that is in stock or not",
  "body": "description of all products that are or aren't in stock"
}
```

`TO_EMAIL` - email to send notifications to.

`IN_STOCK_NOTIFICATION_ONLY` - set this to any value if you want to send notifications only when there is any product in stock.

# Configuration
Included in this repo is an example `watchlist.json` file. It requires an array of `ProductWatcher`s that is described below in JSON schema:
```yaml
definitions:
  ProductWatcher:
    description: Configuration to watch a particular product.
    type: object
    required:
    - url
    - selectors
    properties:
      url:
        type: string
        description: The URL of the product to check
      timeout:
        type: integer
        description: The number of milliseconds before the URL times out
      preCheck:
        type: string
        description: |
          A file path to a JSON file that describes an array of synthetic 
          user commands that are performed before checking stock availability
          of a product. See the "Pre-Check" section for more details.
      selectors:
        $ref: '#/definitions/Selectors'
      extractors:
        $ref: '#/definitions/Extractors'
      evaluator:
        $ref: '#/definitions/Evaluator'
  Selectors:
    description: |
      Parameters to configure how to select an product for stock status and 
      its name from a web page.
    type: object
    required:
    - stock
    - productName
    properties:
      stock:
        type: string
        description: |
          A query selector string to find the stock status. See
          https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
      productName:
        type: string
        description: |
          A query selector string to find the product name. See
          https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
  Extractors:
    description: |
      Once an element is selected by the selector, the value of that element will
      be determined by this configuration. If this object is not defined, then it
      will use 'textContent` as the default property.
    type: object
    required:
    - stock
    - productName
    properties:
      stock:
        type: string
        description: |
          The Element property to use once the stock status is selected. See
          https://developer.mozilla.org/en-US/docs/Web/API/Element and
          https://developer.mozilla.org/en-US/docs/Web/API/Node for all the
          properties that this can be set to.
      productName:
        type: string
        description: |
          The Element property to use to extract the name of the product once it
          is selected. See https://developer.mozilla.org/en-US/docs/Web/API/Element
          and https://developer.mozilla.org/en-US/docs/Web/API/Node for all the
          properties that this can be set to.
  Evaluator:
    description: |
      Once a stock status is selected and extracted, it must be evaluated to 
      determine whether that product is truly in stock or not. If this object 
      is not defined, then it will evaluate based on the element's existence.
      See "Evluators" section for more details.
    required:
    - type
    - parameters
    properties:
      type:
        type: string
        description: |
          The type of evaluator to use. Only 'regex' is supported at the moment.
      parameters:
        type: object
        description: |
          An object with properties that will be consumed by this evaluator.
```

## Evaluators
### regex
This evaluator does a `RegExp.test` on the pattern you give it. Parameters include:

`pattern` : string - the regular expression pattern to test against.

`flags` : string - (optional) flags sent to `RegExp`.

## Pre-Checks
This is a JSON file that describes a certain set of actions that a user might do before
checking if a product is in stock. [For example](./examplePrechecks/targetPrecheck.json)
a user will first set his/her location to a certain zip code before checking
availability.

The `action`s that can be performed corresponds to any method that the [Page class of puppeteer](https://github.com/puppeteer/puppeteer/blob/v5.0.0/docs/api.md#class-page)
can execute. `arguments` correspond to that method's set of arguments.