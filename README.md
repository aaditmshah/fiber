# Fiber #

A powerful, armor-plated fiber manager for JavaScript 1.7+. Fibers allow you to call asynchronous functions synchronously without losing any of the benefits of asynchronous style programming.

## Installation ##

Currently fibers only work on RingoJS and Firefox. To install it on [RingoJS](http://ringojs.org/ "Home - RingoJS") use the following [rp](https://github.com/grob/rp "grob/rp") command:

```bash
rp install fiber
```

To use it in Firefox simply include the follow `<script>` tag in your HTML document:

```html
<script src="https://raw.github.com/aaditmshah/fiber/master/lib/fiber.js" type="text/javascript;version=1.7"></script>
```

The `type` attribute of the `<script>` tag must be `text/javascript;version=1.7` or higher.

## Getting Started ##

Getting started with fibers is very simple. Here's a `Hello World!` program written using fibers:

```javascript
var Fiber = require("fiber");
var {sleep} = Fiber;

exports.main = main;

function main(args) {
    new Fiber(function () {
        console.log("Hello");
        yield sleep(1000);
        console.log("JavaScript");
        yield sleep(1000);
        console.log("Fibers!");
    }).start();
}
```

In the browser you simply comment out the first two lines of the program. The `args` parameter will hold the command line arguments in RingoJS.

## Three Ways of Creating Fibers ##

Fibers are cooperative thread like structures. They are modelled after threads in Java. You can create a fiber by simply passing a `run` function to the `Fiber` constructor as demonstrated above.

Sometimes you may wish to create a group of similar fibers instead of a single fiber, in which case you could create a subclass of `Fiber` and then create as many instances of it as you would like:

```javascript
var Fiber = require("fiber");
var {cooperation} = Fiber;

exports.main = main;

function main(args) {
    var a = new F("A");
    var b = new F("B");
    a.start();
    b.start();
}

F.prototype = Object.create(Fiber.prototype);
F.prototype.constructor = F;

function F(name) {
    Fiber.call(this);
    this.name = name;
}

F.prototype.run = function () {
    console.log("Started fiber " + this.name + ".");
    yield cooperation;
    console.log("Stopped fiber " + this.name + ".");
};
```

Other times you may wish to create a subclass of another constructor, but still be able to use the instances of that constructor as a fiber. I that case you would do the following:

```javascript
var Fiber = require("./lib/fiber");
var {continuation, suspension} = Fiber;
var {Worker} = require("ringo/worker");

exports.main = main;

function main(args) {
    var moduleId = module.resolve("./worker");

    var worker = new FiberWorker(moduleId, function () {
        this.postMessage("Hello Worker!");
        var reply = yield this.getMessage();
        console.log(reply.data);
        this.terminate();
    })

    var fiber = new Fiber(worker);

    fiber.start();
}

FiberWorker.prototype = Object.create(Worker.prototype);
FiberWorker.prototype.constructor = FiberWorker;

function FiberWorker(moduleId, run) {
    Worker.call(this, moduleId);
    var messages = [];
    this.run = run;

    this.onmessage = function (message) {
        messages.push(message);
    };

    this.getMessage = function () {
        if (messages.length) yield messages.shift();
        else {
            var callback = yield continuation;
            var onmessage = this.onmessage;
            this.onmessage = deliver;
            yield suspension;
        }

        function deliver(message) {
            this.onmessage = onmessage;
            callback(message);
        }
    };
}
```

You can create a simple RingoJS worker as follows:

```javascript
function onmessage(event) {
    console.log(event.data);
    event.source.postMessage("Hello Fiber!");
}
```

That's all folks!
