/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   4.1.1
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === GET_THEN_ERROR) {
      reject(promise, GET_THEN_ERROR.error);
      GET_THEN_ERROR.error = null;
    } else if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value.error = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      resolve(promise, value);
    } else if (failed) {
      reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator$1(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate(input);
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

Enumerator$1.prototype._enumerate = function (input) {
  for (var i = 0; this._state === PENDING && i < input.length; i++) {
    this._eachEntry(input[i], i);
  }
};

Enumerator$1.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$1 = c.resolve;

  if (resolve$$1 === resolve$1) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise$3) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$1) {
        return resolve$$1(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$1(entry), i);
  }
};

Enumerator$1.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator$1.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all$1(entries) {
  return new Enumerator$1(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race$1(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise$3(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise$3 ? initializePromise(this, resolver) : needsNew();
  }
}

Promise$3.all = all$1;
Promise$3.race = race$1;
Promise$3.resolve = resolve$1;
Promise$3.reject = reject$1;
Promise$3._setScheduler = setScheduler;
Promise$3._setAsap = setAsap;
Promise$3._asap = asap;

Promise$3.prototype = {
  constructor: Promise$3,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

/*global self*/
function polyfill$1() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise$3;
}

// Strange compat..
Promise$3.polyfill = polyfill$1;
Promise$3.Promise = Promise$3;

Promise$3.polyfill();

return Promise$3;

})));

//# sourceMappingURL=es6-promise.auto.map

(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["aspnetValidation"] = factory();
	else
		root["aspnetValidation"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
Object.defineProperty(__webpack_exports__, "__esModule", { value: true });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MvcValidationProviders", function() { return MvcValidationProviders; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ValidationService", function() { return ValidationService; });
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
/**
 * Contains default implementations for ASP.NET Core MVC validation attributes.
 */
var MvcValidationProviders = /** @class */ (function () {
    function MvcValidationProviders() {
        /**
         * Validates whether the input has a value.
         */
        this.required = function (value, element, params) {
            return Boolean(value);
        };
        /**
         * Validates whether the input value satisfies the length contstraint.
         */
        this.stringLength = function (value, element, params) {
            if (!value) {
                return true;
            }
            if (params.min) {
                var min = parseInt(params.min);
                if (value.length < min) {
                    return false;
                }
            }
            if (params.max) {
                var max = parseInt(params.max);
                if (value.length > max) {
                    return false;
                }
            }
            return true;
        };
        /**
         * Validates whether the input value is equal to another input value.
         */
        this.compare = function (value, element, params) {
            if (!params.other) {
                return true;
            }
            // Sample other parameter: "*.Name"
            // Wat?
            var otherElement = document.getElementById(params.other.substr(2));
            if (!otherElement) {
                return true;
            }
            return (otherElement.value === value);
        };
        /**
         * Validates whether the input value is a number within a given range.
         */
        this.range = function (value, element, params) {
            if (!value) {
                return true;
            }
            var val = parseFloat(value);
            if (isNaN(val)) {
                return false;
            }
            if (params.min) {
                var min = parseFloat(params.min);
                if (val < min) {
                    return false;
                }
            }
            if (params.max) {
                var max = parseFloat(params.max);
                if (val > max) {
                    return false;
                }
            }
            return true;
        };
        /**
         * Validates whether the input value satisfies a regular expression pattern.
         */
        this.regex = function (value, element, params) {
            if (!value || !params.pattern) {
                return true;
            }
            var r = new RegExp(params.pattern);
            return r.test(value);
        };
        /**
         * Validates whether the input value is an email in accordance to RFC822 specification, with a top level domain.
         */
        this.email = function (value, element, params) {
            if (!value) {
                return true;
            }
            // RFC822 email address with .TLD validation
            // (c) Richard Willis, Chris Ferdinandi, MIT Licensed
            // https://gist.github.com/badsyntax/719800
            // https://gist.github.com/cferdinandi/d04aad4ce064b8da3edf21e26f8944c4
            var r = /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*(\.\w{2,})+$/;
            return r.test(value);
        };
        /**
         * Validates whether the input value is a credit card number, with Luhn's Algorithm.
         */
        this.creditcard = function (value, element, params) {
            if (!value) {
                return true;
            }
            // (c) jquery-validation, MIT Licensed
            // https://github.com/jquery-validation/jquery-validation/blob/master/src/additional/creditcard.js
            // based on https://en.wikipedia.org/wiki/Luhn_algorithm
            // Accept only spaces, digits and dashes
            if (/[^0-9 \-]+/.test(value)) {
                return false;
            }
            var nCheck = 0, nDigit = 0, bEven = false, n, cDigit;
            value = value.replace(/\D/g, "");
            // Basing min and max length on https://developer.ean.com/general_info/Valid_Credit_Card_Types
            if (value.length < 13 || value.length > 19) {
                return false;
            }
            for (n = value.length - 1; n >= 0; n--) {
                cDigit = value.charAt(n);
                nDigit = parseInt(cDigit, 10);
                if (bEven) {
                    if ((nDigit *= 2) > 9) {
                        nDigit -= 9;
                    }
                }
                nCheck += nDigit;
                bEven = !bEven;
            }
            return (nCheck % 10) === 0;
        };
        /**
         * Validates whether the input value is a URL.
         */
        this.url = function (value, element, params) {
            if (!value) {
                return true;
            }
            // (c) Diego Perini, MIT Licensed
            // https://gist.github.com/dperini/729294
            var r = new RegExp("^" +
                // protocol identifier
                "(?:(?:https?|ftp)://)" +
                // user:pass authentication
                "(?:\\S+(?::\\S*)?@)?" +
                "(?:" +
                // IP address exclusion
                // private & local networks
                "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
                "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
                "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
                // IP address dotted notation octets
                // excludes loopback network 0.0.0.0
                // excludes reserved space >= 224.0.0.0
                // excludes network & broacast addresses
                // (first & last IP address of each class)
                "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
                "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
                "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
                "|" +
                // host name
                "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
                // domain name
                "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
                // TLD identifier
                "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
                // TLD may end with dot
                "\\.?" +
                ")" +
                // port number
                "(?::\\d{2,5})?" +
                // resource path
                "(?:[/?#]\\S*)?" +
                "$", "i");
            return r.test(value);
        };
        /**
         * Validates whether the input value is a phone number.
         */
        this.phone = function (value, element, params) {
            if (!value) {
                return true;
            }
            // Allows whitespace or dash as number separator because some people like to do that...
            var consecutiveSeparator = /[\+\-\s][\-\s]/g;
            if (consecutiveSeparator.test(value)) {
                return false;
            }
            var r = /^\+?[0-9\-\s]+$/;
            return r.test(value);
        };
        /**
         * Asynchronously validates the input value to a JSON GET API endpoint.
         */
        this.remote = function (value, element, params) {
            if (!value) {
                return true;
            }
            return new Promise(function (ok, reject) {
                var url = params['url'] + '?' + element.name + '=' + encodeURIComponent(value);
                // params.additionalfields: *.Email,*.Username
                var xtras = params.additionalfields.split(',');
                for (var i = 0; i < xtras.length; i++) {
                    var xtra = xtras[i].substr(2);
                    if (xtra === element.name) {
                        continue;
                    }
                    var e = document.getElementById(xtra);
                    if (!e || !e.value) {
                        continue;
                    }
                    url = url + '&' + e.name + '=' + encodeURIComponent(e.value);
                }
                var request = new XMLHttpRequest();
                request.open('get', url);
                request.onload = function (e) {
                    if (request.status >= 200 && request.status < 300) {
                        var data = JSON.parse(request.responseText);
                        ok(data);
                    }
                    else {
                        reject({
                            status: request.status,
                            statusText: request.statusText,
                            data: request.responseText
                        });
                    }
                };
                request.onerror = function (e) {
                    reject({
                        status: request.status,
                        statusText: request.statusText,
                        data: request.responseText
                    });
                };
                request.send();
            });
        };
    }
    return MvcValidationProviders;
}());

/**
 * Responsibles for managing the DOM elements and running the validation providers.
 */
var ValidationService = /** @class */ (function () {
    function ValidationService() {
        /**
         * A key-value collection of loaded validation plugins.
         */
        this.providers = {};
        /**
         * A key-value collection of <span> elements for displaying validation messages for an input (by DOM ID).
         */
        this.messageFor = {};
        /**
         * A list of managed elements, each having a randomly assigned unique identifier (UID).
         */
        this.elementUIDs = [];
        /**
         * A key-value collection of UID to Element for quick lookup.
         */
        this.elementByUID = {};
        /**
         * A key-value collection of input UIDs for a <form> UID.
         */
        this.formInputs = {};
        /**
         * A key-value map for input UID to its validator factory.
         */
        this.validators = {};
        /**
         * A key-value map for element UID to its trigger element (submit event for <form>, input event for <textarea> and <input>).
         */
        this.elementEvents = {};
        /**
         * A key-value map of input UID to its validation error message.
         */
        this.summary = {};
        /**
         * In milliseconds, the rate of fire of the input validation.
         */
        this.debounce = 300;
    }
    /**
     * Registers a new validation plugin of the given name, if not registered yet.
     * Registered plugin validates inputs with data-val-[name] attribute, used as error message.
     * @param name
     * @param callback
     */
    ValidationService.prototype.addProvider = function (name, callback) {
        if (this.providers[name]) {
            // First-Come-First-Serve validation plugin design.
            // Allows developers to override the default MVC Providers by adding custom providers BEFORE bootstrap() is called!
            return;
        }
        this.providers[name] = callback;
    };
    /**
     * Registers the default providers for enabling ASP.NET Core MVC client-side validation.
     */
    ValidationService.prototype.addMvcProviders = function () {
        var mvc = new MvcValidationProviders();
        // [Required]
        this.addProvider('required', mvc.required);
        // [StringLength], [MinLength], [MaxLength]
        this.addProvider('length', mvc.stringLength);
        this.addProvider('maxlength', mvc.stringLength);
        this.addProvider('minlength', mvc.stringLength);
        // [Compare]
        this.addProvider('equalto', mvc.compare);
        // [Range]
        this.addProvider('range', mvc.range);
        // [RegularExpression]
        this.addProvider('regex', mvc.regex);
        // [CreditCard]
        this.addProvider('creditcard', mvc.creditcard);
        // [EmailAddress]
        this.addProvider('email', mvc.email);
        // [Url]
        this.addProvider('url', mvc.url);
        // [Phone]
        this.addProvider('phone', mvc.phone);
        // [Remote]
        this.addProvider('remote', mvc.remote);
    };
    /**
     * Scans document for all validation message <span> generated by ASP.NET Core MVC, then tracks them.
     */
    ValidationService.prototype.scanMessages = function () {
        var validationMessageElements = document.querySelectorAll('[data-valmsg-for]');
        for (var i = 0; i < validationMessageElements.length; i++) {
            var e = validationMessageElements[i];
            var name_1 = e.getAttribute('data-valmsg-for');
            if (!this.messageFor[name_1]) {
                this.messageFor[name_1] = [];
            }
            this.messageFor[name_1].push(e);
        }
    };
    /**
     * Given attribute map for an HTML input, returns the validation directives to be executed.
     * @param attributes
     */
    ValidationService.prototype.parseDirectives = function (attributes) {
        var directives = {};
        var validationAtributes = {};
        var cut = 'data-val-'.length;
        for (var i = 0; i < attributes.length; i++) {
            var a = attributes[i];
            if (a.name.indexOf('data-val-') === 0) {
                var key = a.name.substr(cut);
                validationAtributes[key] = a.value;
            }
        }
        var _loop_1 = function (key) {
            if (key.indexOf('-') === -1) {
                var parameters = Object.keys(validationAtributes).filter(function (Q) {
                    return (Q !== key) && (Q.indexOf(key) === 0);
                });
                var directive = {
                    error: validationAtributes[key],
                    params: {}
                };
                var pcut = (key + '-').length;
                for (var i = 0; i < parameters.length; i++) {
                    var pvalue = validationAtributes[parameters[i]];
                    var pkey = parameters[i].substr(pcut);
                    directive.params[pkey] = pvalue;
                }
                directives[key] = directive;
            }
        };
        for (var key in validationAtributes) {
            _loop_1(key);
        }
        // console.log(directives);
        return directives;
    };
    /**
     *  Returns an RFC4122 version 4 compliant GUID.
     */
    ValidationService.prototype.guid4 = function () {
        // (c) broofa, MIT Licensed
        // https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript/2117523#2117523
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
    /**
     * Gets a UID for an DOM element.
     * @param node
     */
    ValidationService.prototype.getElementUID = function (node) {
        var x = this.elementUIDs.filter(function (e) {
            return e.node === node;
        })[0];
        if (x) {
            return x.uid;
        }
        var uid = this.guid4();
        this.elementUIDs.push({
            node: node,
            uid: uid
        });
        this.elementByUID[uid] = node;
        return uid;
    };
    /**
     * Returns a Promise that returns validation result for each and every inputs within the form.
     * @param formUID
     */
    ValidationService.prototype.getFormValidationTask = function (formUID) {
        var formInputUIDs = this.formInputs[formUID];
        if (!formInputUIDs || formInputUIDs.length === 0) {
            return null;
        }
        var formValidators = [];
        for (var i = 0; i < formInputUIDs.length; i++) {
            var inputUID = formInputUIDs[i];
            formValidators.push(this.validators[inputUID]);
        }
        var tasks = formValidators.map(function (factory) { return factory(); });
        return Promise.all(tasks).then(function (result) { return result.every(function (e) { return e; }); });
    };
    /**
     * Tracks a <form> element as parent of an input UID. When the form is submitted, attempts to validate the said input asynchronously.
     * @param form
     * @param inputUID
     */
    ValidationService.prototype.trackFormInput = function (form, inputUID) {
        var _this = this;
        var formUID = this.getElementUID(form);
        if (!this.formInputs[formUID]) {
            this.formInputs[formUID] = [];
        }
        var add = (this.formInputs[formUID].indexOf(inputUID) === -1);
        if (add) {
            this.formInputs[formUID].push(inputUID);
        }
        if (this.elementEvents[formUID]) {
            return;
        }
        var cb = function (e) {
            var validate = _this.getFormValidationTask(formUID);
            if (!validate) {
                return;
            }
            e.preventDefault();
            validate.then(function (success) {
                if (success) {
                    form.submit();
                }
            }).catch(function (error) {
                console.log(error);
            });
        };
        form.addEventListener('submit', cb);
        form.addEventListener('reset', function (e) {
            var uids = _this.formInputs[formUID];
            for (var _i = 0, uids_1 = uids; _i < uids_1.length; _i++) {
                var uid = uids_1[_i];
                var input = _this.elementByUID[uid];
                input.classList.remove('input-validation-error');
                input.classList.remove('input-validation-valid');
                var spans = _this.messageFor[input.name];
                if (spans) {
                    for (var i = 0; i < spans.length; i++) {
                        spans[i].innerHTML = '';
                    }
                }
                delete _this.summary[uid];
            }
            _this.renderSummary();
        });
        this.elementEvents[formUID] = cb;
    };
    /**
     * Adds an input element to be managed and validated by the service.
     * Triggers a debounced live validation when input value changes.
     * @param input
     */
    ValidationService.prototype.addInput = function (input) {
        var _this = this;
        var uid = this.getElementUID(input);
        var directives = this.parseDirectives(input.attributes);
        var validate = this.createValidator(input, directives);
        this.validators[uid] = validate;
        this.trackFormInput(input.form, uid);
        if (this.elementEvents[uid]) {
            return;
        }
        var delay;
        var cb = function (e) {
            var validate = _this.validators[uid];
            clearTimeout(delay);
            delay = setTimeout(validate, _this.debounce);
        };
        var isDropdown = input.tagName.toLowerCase() === 'select';
        if (isDropdown) {
            input.addEventListener('change', cb);
        }
        else {
            input.addEventListener('input', cb);
        }
        this.elementEvents[uid] = cb;
    };
    /**
     * Scans the entire document for input elements to be validated.
     */
    ValidationService.prototype.scanInputs = function () {
        var inputs = document.querySelectorAll('[data-val="true"]');
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            this.addInput(input);
        }
    };
    /**
     * Returns a <ul> element as a validation errors summary.
     */
    ValidationService.prototype.createSummaryDOM = function () {
        if (!Object.keys(this.summary).length) {
            return null;
        }
        var ul = document.createElement('ul');
        for (var key in this.summary) {
            var li = document.createElement('li');
            li.innerHTML = this.summary[key];
            ul.appendChild(li);
        }
        return ul;
    };
    /**
     * Displays validation summary to ASP.NET Core MVC designated elements, when it actually gets updated.
     */
    ValidationService.prototype.renderSummary = function () {
        var summaryElements = document.querySelectorAll('[data-valmsg-summary="true"]');
        if (!summaryElements.length) {
            return;
        }
        // Using JSON.stringify for quick and painless deep compare of simple KVP. You need to sort the keys first, tho...
        var shadow = JSON.stringify(this.summary, Object.keys(this.summary).sort());
        if (shadow === this.renderedSummaryJSON) {
            return;
        }
        // Prevents wasteful re-rendering of summary list element with identical items!
        // console.log('RENDERING VALIDATION SUMMARY');
        this.renderedSummaryJSON = shadow;
        var ul = this.createSummaryDOM();
        for (var i = 0; i < summaryElements.length; i++) {
            var e = summaryElements[i];
            e.innerHTML = '';
            if (ul) {
                e.className = 'validation-summary-error';
                e.appendChild(ul.cloneNode(true));
            }
            else {
                e.className = 'validation-summary-valid';
            }
        }
    };
    /**
     * Adds an error message to an input element, which also updates the validation message elements and validation summary elements.
     * @param input
     * @param message
     */
    ValidationService.prototype.addError = function (input, message) {
        var spans = this.messageFor[input.name];
        if (spans) {
            for (var i = 0; i < spans.length; i++) {
                spans[i].innerHTML = message;
                spans[i].className = 'field-validation-error';
            }
        }
        input.classList.remove('input-validation-valid');
        input.classList.add('input-validation-error');
        var uid = this.getElementUID(input);
        this.summary[uid] = message;
        this.renderSummary();
    };
    /**
     * Removes an error message from an input element, which also updates the validation message elements and validation summary elements.
     * @param input
     */
    ValidationService.prototype.removeError = function (input) {
        var spans = this.messageFor[input.name];
        if (spans) {
            for (var i = 0; i < spans.length; i++) {
                spans[i].innerHTML = '';
                spans[i].className = 'field-validation-valid';
            }
        }
        input.classList.remove('input-validation-error');
        input.classList.add('input-validation-valid');
        var uid = this.getElementUID(input);
        delete this.summary[uid];
        this.renderSummary();
    };
    /**
     * Returns a validation Promise factory for an input element, using given validation directives.
     * @param input
     * @param directives
     */
    ValidationService.prototype.createValidator = function (input, directives) {
        var _this = this;
        return function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, _b, _i, key, directive, provider, result, valid, error, resolution;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = [];
                        for (_b in directives)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 7];
                        key = _a[_i];
                        directive = directives[key];
                        provider = this.providers[key];
                        if (!provider) {
                            console.log('aspnet-validation provider not implemented: ' + key);
                            return [3 /*break*/, 6];
                        }
                        result = provider(input.value, input, directive.params);
                        valid = false;
                        error = directive.error;
                        if (!(typeof result === 'boolean')) return [3 /*break*/, 2];
                        valid = result;
                        return [3 /*break*/, 5];
                    case 2:
                        if (!(typeof result === 'string')) return [3 /*break*/, 3];
                        valid = false;
                        error = result;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, result];
                    case 4:
                        resolution = _c.sent();
                        if (typeof resolution === 'boolean') {
                            valid = resolution;
                        }
                        else {
                            valid = false;
                            error = resolution;
                        }
                        _c.label = 5;
                    case 5:
                        if (!valid) {
                            this.addError(input, error);
                            return [2 /*return*/, false];
                        }
                        _c.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7:
                        this.removeError(input);
                        return [2 /*return*/, true];
                }
            });
        }); };
    };
    /**
     * Load default validation providers and scans the entire document when ready.
     */
    ValidationService.prototype.bootstrap = function () {
        var _this = this;
        this.addMvcProviders();
        document.addEventListener('DOMContentLoaded', function (event) {
            _this.scanMessages();
            _this.scanInputs();
        });
    };
    return ValidationService;
}());



/***/ })
/******/ ]);
});